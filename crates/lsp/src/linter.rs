use crate::types::LspDiagnostic;
use axiom_core::{offset_to_line_col, FileId, Span};
use axiom_syntax::ast::*;
use axiom_syntax::parse_hdl;
use std::collections::{HashMap, HashSet};

pub struct VerilogLinter;

impl VerilogLinter {
    pub fn lint(source: &str) -> Vec<LspDiagnostic> {
        let mut diagnostics = Vec::new();

        // 1. Parse and collect syntax errors
        let file_id = FileId(1);
        let (ast, syntax_diags) = parse_hdl(file_id, source);

        for diag in syntax_diags {
            let (start_line, start_col) = offset_to_line_col(source, diag.span.start);
            let (end_line, end_col) = offset_to_line_col(source, diag.span.end.max(diag.span.start + 1));

            diagnostics.push(LspDiagnostic::error(
                "AXIOM_E001_SYNTAX_ERROR",
                &diag.message,
                start_line as u32,
                start_col as u32,
                end_line as u32,
                end_col as u32,
            ));
        }

        // 2. Semantic & Design Quality Rules on AST
        let modules_map: HashMap<String, &ModuleDef> = ast.modules.iter().map(|m| (m.name.clone(), m)).collect();
        for module in &ast.modules {
            Self::lint_module(source, module, &modules_map, &mut diagnostics);
        }

        diagnostics
    }

    fn lint_module(
        source: &str,
        module: &ModuleDef,
        all_modules: &HashMap<String, &ModuleDef>,
        diags: &mut Vec<LspDiagnostic>,
    ) {
        let mut declared_signals: HashMap<String, (DataType, Option<Range>, Span)> = HashMap::new();
        let mut parameter_names: HashSet<String> = HashSet::new();
        let mut input_ports: HashSet<String> = HashSet::new();
        let mut output_ports: HashSet<String> = HashSet::new();

        let mut assigned_signals: HashMap<String, Vec<Span>> = HashMap::new();
        let mut read_signals: HashSet<String> = HashSet::new();
        let mut referenced_idents: Vec<(String, Span)> = Vec::new();

        // Register module name as a valid scope symbol (e.g. for $dumpvars(0, tb_name))
        declared_signals.insert(module.name.clone(), (DataType::Implicit, None, module.span));
        parameter_names.insert(module.name.clone());

        // Collect module parameters
        for param in &module.params {
            declared_signals.insert(param.name.clone(), (DataType::Implicit, None, param.span));
            parameter_names.insert(param.name.clone());
            Self::collect_expr_reads(&param.value, &mut read_signals);
            Self::collect_expr_idents(&param.value, &mut referenced_idents);
        }

        // Collect ports
        for port in &module.ports {
            match port.direction {
                PortDirection::Input => {
                    input_ports.insert(port.name.clone());
                }
                PortDirection::Output => {
                    output_ports.insert(port.name.clone());
                }
                PortDirection::Inout => {
                    input_ports.insert(port.name.clone());
                    output_ports.insert(port.name.clone());
                }
            }
            declared_signals.insert(port.name.clone(), (port.data_type, port.range.clone(), port.span));
        }

        // Collect net and parameter declarations from module items (including generate blocks)
        Self::collect_declarations_from_items(
            &module.items,
            &mut declared_signals,
            &mut parameter_names,
            &mut assigned_signals,
            &mut read_signals,
            &mut referenced_idents,
        );

        // Inspect Continuous Assignments
        for item in &module.items {
            if let ModuleItem::ContinuousAssign(assign) = item {
                Self::collect_expr_reads(&assign.rhs, &mut read_signals);
                Self::collect_expr_idents(&assign.lhs, &mut referenced_idents);
                Self::collect_expr_idents(&assign.rhs, &mut referenced_idents);
                let lhs_names = Self::collect_expr_targets(&assign.lhs);
                for lhs in lhs_names {
                    assigned_signals.entry(lhs).or_default().push(assign.span);
                }

                // Check Width Mismatch on literals
                if let (Some(target_width), Some(rhs_width)) = (
                    Self::resolve_lhs_width(&assign.lhs, &declared_signals),
                    Self::estimate_expr_width(&assign.rhs),
                ) {
                    if rhs_width > target_width {
                        let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, assign.span);
                        diags.push(
                            LspDiagnostic::info(
                                "AXIOM_W008_WIDTH_MISMATCH",
                                format!("Truncation warning: RHS expression ({rhs_width}-bit) is wider than target ({target_width}-bit)"),
                                s_line,
                                s_col,
                                e_line,
                                e_col,
                            )
                            .with_help("Truncation will drop high-order bits."),
                        );
                    }
                }
            }
        }

        // Check Multi-Driver Net Rule: wires with multiple continuous assignments
        for (net_name, assign_spans) in &assigned_signals {
            if assign_spans.len() > 1 {
                if let Some((dtype, _, _)) = declared_signals.get(net_name) {
                    if *dtype == DataType::Wire || *dtype == DataType::Implicit {
                        for span in assign_spans.iter().skip(1) {
                            let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *span);
                            diags.push(LspDiagnostic::error(
                                "AXIOM_E002_MULTI_DRIVER",
                                format!("Net '{net_name}' is driven by multiple continuous assignments (causes X-state contention)"),
                                s_line,
                                s_col,
                                e_line,
                                e_col,
                            ));
                        }
                    }
                }
            }
        }

        // Inspect Procedural Blocks
        for item in &module.items {
            if let ModuleItem::ProceduralBlock(proc) = item {
                if let Some(sens_list) = &proc.sensitivity {
                    for s in sens_list {
                        Self::collect_expr_idents(&s.signal, &mut referenced_idents);
                    }
                }
                Self::collect_statement_idents(&proc.body, &mut referenced_idents);
                Self::lint_procedural_block(
                    source,
                    proc,
                    &mut assigned_signals,
                    &mut read_signals,
                    diags,
                );
            }
        }

        // Inspect Submodule and Gate Instances
        let mut instance_connected_signals = HashSet::new();
        for item in &module.items {
            if let ModuleItem::Instance(inst) = item {
                let is_gate = axiom_syntax::is_gate_primitive(&inst.module_name);
                let is_prim = is_gate || crate::primitives_doc::primitive_doc(&inst.module_name).is_some();
                let child_def = all_modules.get(&inst.module_name).copied();

                for (port_name, expr) in &inst.port_bindings {
                    Self::collect_expr_idents(expr, &mut referenced_idents);

                    let is_output = if is_prim {
                        crate::primitives_doc::is_primitive_output_port(&inst.module_name, port_name)
                    } else if let Some(target_mod) = child_def {
                        let formal_port = if let Ok(i) = port_name.parse::<usize>() {
                            target_mod.ports.get(i)
                        } else {
                            target_mod.ports.iter().find(|p| &p.name == port_name)
                        };
                        formal_port.map(|p| p.direction == PortDirection::Output).unwrap_or(false)
                    } else {
                        false
                    };

                    if is_output {
                        for sig in Self::collect_expr_targets(expr) {
                            assigned_signals.entry(sig.clone()).or_default().push(inst.span);
                            instance_connected_signals.insert(sig);
                        }
                    } else if child_def.is_none() && !is_prim {
                        // Completely unknown blackbox module: could be input or output driver
                        Self::collect_expr_reads(expr, &mut read_signals);
                        for sig in Self::collect_expr_targets(expr) {
                            instance_connected_signals.insert(sig);
                        }
                    } else {
                        Self::collect_expr_reads(expr, &mut read_signals);
                    }
                }
                for (_, expr) in &inst.param_bindings {
                    Self::collect_expr_reads(expr, &mut read_signals);
                    Self::collect_expr_idents(expr, &mut referenced_idents);
                }
            }
            if let ModuleItem::Assertion(asrt) = item {
                if let Some(clk) = &asrt.clock {
                    Self::collect_expr_reads(&clk.signal, &mut read_signals);
                    Self::collect_expr_idents(&clk.signal, &mut referenced_idents);
                }
                for word in asrt.expr_text.split(|c: char| !c.is_alphanumeric() && c != '_') {
                    if !word.is_empty() && declared_signals.contains_key(word) {
                        read_signals.insert(word.to_string());
                    }
                }
            }
        }

        // Rule AXIOM_E003_UNDECLARED_IDENTIFIER: Any identifier referenced in expressions that is not declared
        let mut reported_undeclared = HashSet::new();
        for (ident, span) in &referenced_idents {
            if ident.starts_with('$') {
                continue; // Built-in system tasks / functions ($time, $display, $finish, etc.)
            }
            if !declared_signals.contains_key(ident) && reported_undeclared.insert((ident.clone(), span.start)) {
                let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *span);
                diags.push(
                    LspDiagnostic::error(
                        "AXIOM_E003_UNDECLARED_IDENTIFIER",
                        format!("Identifier '{ident}' is not declared in module '{}'", module.name),
                        s_line,
                        s_col,
                        e_line,
                        e_col,
                    )
                    .with_help(format!("Declare 'wire {ident};' or check for spelling mistakes.")),
                );
            }
        }

        // Rule AXIOM_W003_UNDRIVEN_NET: Declared & read, but never driven (and not an input port, parameter, or instance output)
        for (sig_name, (_, _, decl_span)) in &declared_signals {
            if !input_ports.contains(sig_name)
                && !parameter_names.contains(sig_name)
                && read_signals.contains(sig_name)
                && !assigned_signals.contains_key(sig_name)
                && !instance_connected_signals.contains(sig_name)
            {
                let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *decl_span);
                diags.push(
                    LspDiagnostic::warning(
                        "AXIOM_W003_UNDRIVEN_NET",
                        format!("Net '{sig_name}' is read in logic but never assigned or driven (will remain at high-impedance / unknown)"),
                        s_line,
                        s_col,
                        e_line,
                        e_col,
                    )
                    .with_help("Assign this net or verify port connections."),
                );
            }
        }

        // Rule AXIOM_W004_UNUSED_SIGNAL: Declared & assigned, but never read and not an output port or parameter
        for (sig_name, (_, _, decl_span)) in &declared_signals {
            if parameter_names.contains(sig_name) {
                continue;
            }
            if !output_ports.contains(sig_name)
                && !input_ports.contains(sig_name)
                && assigned_signals.contains_key(sig_name)
                && !read_signals.contains(sig_name)
            {
                let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *decl_span);
                diags.push(LspDiagnostic::info(
                    "AXIOM_W004_UNUSED_SIGNAL",
                    format!("Signal '{sig_name}' is assigned but its value is never read or output"),
                    s_line,
                    s_col,
                    e_line,
                    e_col,
                ));
            } else if !output_ports.contains(sig_name)
                && !input_ports.contains(sig_name)
                && !assigned_signals.contains_key(sig_name)
                && !read_signals.contains(sig_name)
            {
                // Never assigned and never read
                let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *decl_span);
                diags.push(LspDiagnostic::info(
                    "AXIOM_W004_UNUSED_SIGNAL",
                    format!("Signal '{sig_name}' is declared but never used"),
                    s_line,
                    s_col,
                    e_line,
                    e_col,
                ));
            }
        }
    }

    fn lint_procedural_block(
        source: &str,
        proc: &ProceduralBlock,
        assigned_signals: &mut HashMap<String, Vec<Span>>,
        read_signals: &mut HashSet<String>,
        diags: &mut Vec<LspDiagnostic>,
    ) {
        let is_clocked = if let Some(sens_list) = &proc.sensitivity {
            sens_list
                .iter()
                .any(|s| matches!(s.edge, EdgeKind::Posedge | EdgeKind::Negedge))
        } else {
            proc.kind == ProceduralKind::AlwaysFf
        };

        let is_combinational = if let Some(sens_list) = &proc.sensitivity {
            sens_list.is_empty()
                || sens_list.iter().any(|s| matches!(s.edge, EdgeKind::AnyChange))
        } else {
            proc.kind == ProceduralKind::AlwaysComb
        };

        // Check sensitivity list reads
        if let Some(sens_list) = &proc.sensitivity {
            for item in sens_list {
                Self::collect_expr_reads(&item.signal, read_signals);
            }
        }

        // Lint statements inside procedural block
        Self::lint_statement(
            source,
            &proc.body,
            is_clocked,
            is_combinational,
            assigned_signals,
            read_signals,
            diags,
        );
    }

    fn lint_statement(
        source: &str,
        stmt: &Statement,
        is_clocked: bool,
        is_combinational: bool,
        assigned_signals: &mut HashMap<String, Vec<Span>>,
        read_signals: &mut HashSet<String>,
        diags: &mut Vec<LspDiagnostic>,
    ) {
        match stmt {
            Statement::BlockingAssign { lhs, rhs, span } => {
                Self::collect_expr_reads(rhs, read_signals);
                let targets = Self::collect_expr_targets(lhs);
                for target in targets {
                    assigned_signals.entry(target).or_default().push(*span);
                }

                // Rule AXIOM_W001_BLOCKING_IN_SEQ: Blocking '=' in clocked block
                if is_clocked {
                    let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *span);
                    diags.push(
                        LspDiagnostic::warning(
                            "AXIOM_W001_BLOCKING_IN_SEQ",
                            "Blocking assignment '=' inside clocked sequential block. Use non-blocking '<=' to avoid race hazards.",
                            s_line,
                            s_col,
                            e_line,
                            e_col,
                        )
                        .with_help("Replace '=' with '<=' for synchronous flip-flop registers."),
                    );
                }
            }

            Statement::NonBlockingAssign { lhs, rhs, span } => {
                Self::collect_expr_reads(rhs, read_signals);
                let targets = Self::collect_expr_targets(lhs);
                for target in targets {
                    assigned_signals.entry(target).or_default().push(*span);
                }

                // Rule AXIOM_W002_NONBLOCKING_IN_COMB: Non-blocking '<=' in combinational block
                if is_combinational {
                    let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *span);
                    diags.push(
                        LspDiagnostic::warning(
                            "AXIOM_W002_NONBLOCKING_IN_COMB",
                            "Non-blocking assignment '<=' in combinational block. Use blocking '=' for purely combinational logic.",
                            s_line,
                            s_col,
                            e_line,
                            e_col,
                        )
                        .with_help("Replace '<=' with '=' for combinational always blocks."),
                    );
                }
            }

            Statement::Block(stmts) => {
                for s in stmts {
                    Self::lint_statement(
                        source,
                        s,
                        is_clocked,
                        is_combinational,
                        assigned_signals,
                        read_signals,
                        diags,
                    );
                }
            }

            Statement::If {
                cond,
                then_branch,
                else_branch,
                span,
            } => {
                Self::collect_expr_reads(cond, read_signals);
                Self::lint_statement(
                    source,
                    then_branch,
                    is_clocked,
                    is_combinational,
                    assigned_signals,
                    read_signals,
                    diags,
                );

                if let Some(else_b) = else_branch {
                    Self::lint_statement(
                        source,
                        else_b,
                        is_clocked,
                        is_combinational,
                        assigned_signals,
                        read_signals,
                        diags,
                    );
                } else if is_combinational {
                    // Rule AXIOM_W006_LATCH_INFERENCE: Missing else branch in combinational if
                    let then_targets = Self::collect_statement_assigned_targets(then_branch);
                    if !then_targets.is_empty() {
                        let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *span);
                        diags.push(
                            LspDiagnostic::warning(
                                "AXIOM_W006_LATCH_INFERENCE",
                                format!("Combinational 'if' assigns ({}) without an 'else' branch; this infers an unintended transparent latch.", then_targets.join(", ")),
                                s_line,
                                s_col,
                                e_line,
                                e_col,
                            )
                            .with_help("Add an 'else' branch or initialize default values at the start of the always block."),
                        );
                    }
                }
            }

            Statement::Case {
                expr,
                items,
                span,
                ..
            } => {
                Self::collect_expr_reads(expr, read_signals);
                let mut has_default = false;

                for item in items {
                    if item.patterns.is_empty() {
                        has_default = true;
                    }
                    for pat in &item.patterns {
                        Self::collect_expr_reads(pat, read_signals);
                    }
                    Self::lint_statement(
                        source,
                        &item.body,
                        is_clocked,
                        is_combinational,
                        assigned_signals,
                        read_signals,
                        diags,
                    );
                }

                if !has_default {
                    // Rule AXIOM_W007_CASE_NO_DEFAULT
                    let (s_line, s_col, e_line, e_col) = Self::span_to_coords(source, *span);
                    diags.push(
                        LspDiagnostic::warning(
                            "AXIOM_W007_CASE_NO_DEFAULT",
                            "Case statement is missing a 'default' branch (may infer latches or undefined states for uncovered bit patterns)",
                            s_line,
                            s_col,
                            e_line,
                            e_col,
                        )
                        .with_help("Add 'default: ...' to handle unmapped patterns."),
                    );
                }
            }

            Statement::For {
                init,
                cond,
                step,
                body,
                ..
            } => {
                Self::lint_statement(source, init, is_clocked, is_combinational, assigned_signals, read_signals, diags);
                Self::collect_expr_reads(cond, read_signals);
                Self::lint_statement(source, step, is_clocked, is_combinational, assigned_signals, read_signals, diags);
                Self::lint_statement(source, body, is_clocked, is_combinational, assigned_signals, read_signals, diags);
            }

            Statement::Forever { body, .. } => {
                Self::lint_statement(source, body, is_clocked, is_combinational, assigned_signals, read_signals, diags);
            }

            Statement::Repeat { count, body, .. } => {
                Self::collect_expr_reads(count, read_signals);
                Self::lint_statement(source, body, is_clocked, is_combinational, assigned_signals, read_signals, diags);
            }

            Statement::While { cond, body, .. } => {
                Self::collect_expr_reads(cond, read_signals);
                Self::lint_statement(source, body, is_clocked, is_combinational, assigned_signals, read_signals, diags);
            }

            Statement::Delay { stmt, .. } => {
                if let Some(inner) = stmt {
                    Self::lint_statement(
                        source,
                        inner,
                        is_clocked,
                        is_combinational,
                        assigned_signals,
                        read_signals,
                        diags,
                    );
                }
            }

            Statement::TaskCall { args, .. } => {
                for arg in args {
                    Self::collect_expr_reads(arg, read_signals);
                }
            }

            Statement::Assertion(asrt) => {
                if let Some(clk) = &asrt.clock {
                    Self::collect_expr_reads(&clk.signal, read_signals);
                }
                for word in asrt.expr_text.split(|c: char| !c.is_alphanumeric() && c != '_') {
                    if !word.is_empty() {
                        read_signals.insert(word.to_string());
                    }
                }
            }

            Statement::Null => {}
        }
    }

    // Helper: collect variables read in an expression
    fn collect_expr_reads(expr: &Expr, reads: &mut HashSet<String>) {
        match expr {
            Expr::Ident(name, _) => {
                reads.insert(name.clone());
            }
            Expr::Unary { expr: inner, .. } => {
                Self::collect_expr_reads(inner, reads);
            }
            Expr::Binary { lhs: left, rhs: right, .. } => {
                Self::collect_expr_reads(left, reads);
                Self::collect_expr_reads(right, reads);
            }
            Expr::Ternary { cond, then_expr, else_expr, .. } => {
                Self::collect_expr_reads(cond, reads);
                Self::collect_expr_reads(then_expr, reads);
                Self::collect_expr_reads(else_expr, reads);
            }
            Expr::Concat(items, _) => {
                for item in items {
                    Self::collect_expr_reads(item, reads);
                }
            }
            Expr::Slice { target, msb, lsb, .. } => {
                Self::collect_expr_reads(target, reads);
                Self::collect_expr_reads(msb, reads);
                Self::collect_expr_reads(lsb, reads);
            }
            Expr::IndexedSlice { target, base, width, .. } => {
                Self::collect_expr_reads(target, reads);
                Self::collect_expr_reads(base, reads);
                Self::collect_expr_reads(width, reads);
            }
            Expr::Call { args, .. } => {
                for arg in args {
                    Self::collect_expr_reads(arg, reads);
                }
            }
            Expr::Replication { count, expr, .. } => {
                Self::collect_expr_reads(count, reads);
                Self::collect_expr_reads(expr, reads);
            }
            _ => {}
        }
    }

    fn collect_declarations_from_items(
        items: &[ModuleItem],
        declared: &mut HashMap<String, (DataType, Option<Range>, Span)>,
        parameters: &mut HashSet<String>,
        assigned: &mut HashMap<String, Vec<Span>>,
        reads: &mut HashSet<String>,
        referenced: &mut Vec<(String, Span)>,
    ) {
        for item in items {
            match item {
                ModuleItem::NetDecl(net) => {
                    for name in &net.names {
                        declared.insert(name.clone(), (net.data_type, net.range.clone(), net.span));
                        if let Some(ref init_expr) = net.init {
                            assigned.entry(name.clone()).or_default().push(net.span);
                            Self::collect_expr_reads(init_expr, reads);
                            Self::collect_expr_idents(init_expr, referenced);
                        }
                    }
                }
                ModuleItem::ParamDecl(param) => {
                    declared.insert(param.name.clone(), (DataType::Implicit, None, param.span));
                    parameters.insert(param.name.clone());
                    Self::collect_expr_reads(&param.value, reads);
                    Self::collect_expr_idents(&param.value, referenced);
                }
                ModuleItem::GenerateBlock(gen) => {
                    Self::collect_declarations_from_items(
                        &gen.items,
                        declared,
                        parameters,
                        assigned,
                        reads,
                        referenced,
                    );
                }
                _ => {}
            }
        }
    }

    fn collect_expr_idents(expr: &Expr, idents: &mut Vec<(String, Span)>) {
        match expr {
            Expr::Ident(name, span) => {
                idents.push((name.clone(), *span));
            }
            Expr::Unary { expr: inner, .. } => {
                Self::collect_expr_idents(inner, idents);
            }
            Expr::Binary { lhs, rhs, .. } => {
                Self::collect_expr_idents(lhs, idents);
                Self::collect_expr_idents(rhs, idents);
            }
            Expr::Ternary { cond, then_expr, else_expr, .. } => {
                Self::collect_expr_idents(cond, idents);
                Self::collect_expr_idents(then_expr, idents);
                Self::collect_expr_idents(else_expr, idents);
            }
            Expr::Concat(items, _) => {
                for item in items {
                    Self::collect_expr_idents(item, idents);
                }
            }
            Expr::Slice { target, msb, lsb, .. } => {
                Self::collect_expr_idents(target, idents);
                Self::collect_expr_idents(msb, idents);
                Self::collect_expr_idents(lsb, idents);
            }
            Expr::IndexedSlice { target, base, width, .. } => {
                Self::collect_expr_idents(target, idents);
                Self::collect_expr_idents(base, idents);
                Self::collect_expr_idents(width, idents);
            }
            Expr::Call { name, args, span } => {
                if !name.starts_with('$') {
                    idents.push((name.clone(), *span));
                }
                for arg in args {
                    Self::collect_expr_idents(arg, idents);
                }
            }
            Expr::Replication { count, expr, .. } => {
                Self::collect_expr_idents(count, idents);
                Self::collect_expr_idents(expr, idents);
            }
            _ => {}
        }
    }

    fn collect_statement_idents(stmt: &Statement, idents: &mut Vec<(String, Span)>) {
        match stmt {
            Statement::BlockingAssign { lhs, rhs, .. } | Statement::NonBlockingAssign { lhs, rhs, .. } => {
                Self::collect_expr_idents(lhs, idents);
                Self::collect_expr_idents(rhs, idents);
            }
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::collect_statement_idents(s, idents);
                }
            }
            Statement::If { cond, then_branch, else_branch, .. } => {
                Self::collect_expr_idents(cond, idents);
                Self::collect_statement_idents(then_branch, idents);
                if let Some(else_b) = else_branch {
                    Self::collect_statement_idents(else_b, idents);
                }
            }
            Statement::Case { expr, items, .. } => {
                Self::collect_expr_idents(expr, idents);
                for item in items {
                    for pat in &item.patterns {
                        Self::collect_expr_idents(pat, idents);
                    }
                    Self::collect_statement_idents(&item.body, idents);
                }
            }
            Statement::For { init, cond, step, body, .. } => {
                Self::collect_statement_idents(init, idents);
                Self::collect_expr_idents(cond, idents);
                Self::collect_statement_idents(step, idents);
                Self::collect_statement_idents(body, idents);
            }
            Statement::Forever { body, .. } => {
                Self::collect_statement_idents(body, idents);
            }
            Statement::Repeat { count, body, .. } => {
                Self::collect_expr_idents(count, idents);
                Self::collect_statement_idents(body, idents);
            }
            Statement::While { cond, body, .. } => {
                Self::collect_expr_idents(cond, idents);
                Self::collect_statement_idents(body, idents);
            }
            Statement::Delay { amount, stmt, .. } => {
                Self::collect_expr_idents(amount, idents);
                if let Some(s) = stmt {
                    Self::collect_statement_idents(s, idents);
                }
            }
            Statement::TaskCall { name, args, span } => {
                if !name.starts_with('$') {
                    idents.push((name.clone(), *span));
                }
                for arg in args {
                    Self::collect_expr_idents(arg, idents);
                }
            }
            Statement::Assertion(_) => {}
            Statement::Null => {}
        }
    }

    // Helper: collect target variables on the LHS of an assignment
    fn collect_expr_targets(expr: &Expr) -> Vec<String> {
        match expr {
            Expr::Ident(name, _) => vec![name.clone()],
            Expr::Slice { target, .. } | Expr::IndexedSlice { target, .. } => Self::collect_expr_targets(target),
            Expr::Concat(items, _) => {
                let mut targets = Vec::new();
                for item in items {
                    targets.extend(Self::collect_expr_targets(item));
                }
                targets
            }
            _ => Vec::new(),
        }
    }

    fn collect_statement_assigned_targets(stmt: &Statement) -> Vec<String> {
        let mut targets = Vec::new();
        match stmt {
            Statement::BlockingAssign { lhs, .. } | Statement::NonBlockingAssign { lhs, .. } => {
                targets.extend(Self::collect_expr_targets(lhs));
            }
            Statement::Block(stmts) => {
                for s in stmts {
                    targets.extend(Self::collect_statement_assigned_targets(s));
                }
            }
            Statement::If {
                then_branch,
                else_branch,
                ..
            } => {
                targets.extend(Self::collect_statement_assigned_targets(then_branch));
                if let Some(else_b) = else_branch {
                    targets.extend(Self::collect_statement_assigned_targets(else_b));
                }
            }
            Statement::For { init, step, body, .. } => {
                targets.extend(Self::collect_statement_assigned_targets(init));
                targets.extend(Self::collect_statement_assigned_targets(step));
                targets.extend(Self::collect_statement_assigned_targets(body));
            }
            Statement::Forever { body, .. } => {
                targets.extend(Self::collect_statement_assigned_targets(body));
            }
            Statement::Repeat { body, .. } => {
                targets.extend(Self::collect_statement_assigned_targets(body));
            }
            Statement::While { body, .. } => {
                targets.extend(Self::collect_statement_assigned_targets(body));
            }
            Statement::Case { items, .. } => {
                for item in items {
                    targets.extend(Self::collect_statement_assigned_targets(&item.body));
                }
            }
            _ => {}
        }
        targets.sort();
        targets.dedup();
        targets
    }

    fn resolve_lhs_width(
        lhs: &Expr,
        declared: &HashMap<String, (DataType, Option<Range>, Span)>,
    ) -> Option<u32> {
        match lhs {
            Expr::Ident(name, _) => {
                if let Some((_, Some(_), _)) = declared.get(name) {
                    Some(8)
                } else if declared.contains_key(name) {
                    Some(1)
                } else {
                    None
                }
            }
            Expr::Slice { .. } => Some(1),
            _ => None,
        }
    }

    fn estimate_expr_width(expr: &Expr) -> Option<u32> {
        match expr {
            Expr::Number(lv, _) => Some(lv.width()),
            Expr::UnsizedInt(val, _) => {
                if *val > 0xFF {
                    Some(16)
                } else if *val > 1 {
                    Some(8)
                } else {
                    Some(1)
                }
            }
            _ => None,
        }
    }

    fn span_to_coords(source: &str, span: Span) -> (u32, u32, u32, u32) {
        let (s_line, s_col) = offset_to_line_col(source, span.start);
        let (e_line, e_col) = offset_to_line_col(source, span.end.max(span.start + 1));
        (s_line as u32, s_col as u32, e_line as u32, e_col as u32)
    }
}
