use super::types::*;
use crate::bir::BirCircuit;
use axiom_syntax::ast::*;
use hashbrown::HashMap;

pub struct FsmDetector;

impl FsmDetector {
    pub fn detect_fsms(module: &ModuleDef, _circuit: &BirCircuit) -> Vec<MacroBlock> {
        let mut fsms = Vec::new();

        // 1. Collect named constants (parameters / localparams)
        let mut param_map: HashMap<u64, String> = HashMap::new();
        for param in &module.params {
            if let Some(val) = Self::eval_const_expr(&param.value) {
                param_map.insert(val, param.name.clone());
            }
        }
        for item in &module.items {
            if let ModuleItem::ParamDecl(param) = item {
                if let Some(val) = Self::eval_const_expr(&param.value) {
                    param_map.insert(val, param.name.clone());
                }
            }
        }

        // 2. Scan procedural blocks for state registers and case branching
        for (proc_idx, item) in module.items.iter().enumerate() {
            if let ModuleItem::ProceduralBlock(proc) = item {
                if let Some(macro_block) = Self::analyze_procedural_block(proc, &param_map, proc_idx) {
                    fsms.push(macro_block);
                }
            }
        }

        fsms
    }

    fn analyze_procedural_block(
        proc: &ProceduralBlock,
        param_map: &HashMap<u64, String>,
        proc_idx: usize,
    ) -> Option<MacroBlock> {
        let mut clock_net = None;
        let mut reset_net = None;

        if let Some(sens) = &proc.sensitivity {
            for item in sens {
                if let Expr::Ident(ref name, _) = item.signal {
                    if name.contains("clk") {
                        clock_net = Some(name.clone());
                    } else if name.contains("rst") {
                        reset_net = Some(name.clone());
                    }
                }
            }
        }

        // Find candidate state register and case statement
        let mut found_fsm = None;
        Self::find_case_on_state(&proc.body, &mut |state_var, items, reset_val| {
            if found_fsm.is_some() {
                return;
            }

            let mut states = Vec::new();
            let mut transitions = Vec::new();
            let mut inputs_set = hashbrown::HashSet::new();
            let mut outputs_set = hashbrown::HashSet::new();

            for item in items {
                let state_val = if let Some(first_pat) = item.patterns.first() {
                    Self::eval_const_expr(first_pat).unwrap_or(0)
                } else {
                    999
                };

                let state_name = param_map
                    .get(&state_val)
                    .cloned()
                    .unwrap_or_else(|| {
                        if state_val == 999 {
                            "DEFAULT".to_string()
                        } else {
                            format!("STATE_{}", state_val)
                        }
                    });

                let is_reset = reset_val.map_or(false, |r| r == state_val);

                // Collect state outputs and transitions
                let mut moore_outputs = Vec::new();
                Self::extract_transitions_and_outputs(
                    &item.body,
                    &state_name,
                    state_var,
                    param_map,
                    &mut transitions,
                    &mut moore_outputs,
                    &mut inputs_set,
                    &mut outputs_set,
                );

                states.push(FsmState {
                    id: format!("state_{}", state_val),
                    name: state_name,
                    value: state_val,
                    binary_str: format!("{:02b}", state_val),
                    is_reset,
                    moore_outputs,
                });
            }

            if states.len() >= 2 {
                let reset_state_name = reset_val
                    .and_then(|r| param_map.get(&r).cloned())
                    .unwrap_or_else(|| {
                        states.first().map(|s| s.name.clone()).unwrap_or_else(|| "IDLE".to_string())
                    });

                let fsm_macro = FsmMacro {
                    state_reg: state_var.to_string(),
                    state_width: 2, // default 2-bit
                    reset_state: reset_state_name.clone(),
                    current_state_default: reset_state_name,
                    states,
                    transitions,
                    inputs: inputs_set.into_iter().collect(),
                    outputs: outputs_set.into_iter().collect(),
                };

                found_fsm = Some((state_var.to_string(), fsm_macro));
            }
        });

        if let Some((state_var, fsm_macro)) = found_fsm {
            let mut ports = Vec::new();
            if let Some(ref clk) = clock_net {
                ports.push(MacroPort {
                    id: "port_clk".to_string(),
                    name: clk.clone(),
                    width: 1,
                    direction: MacroPortDirection::In,
                    is_clock: true,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 20.0,
                    offset_y: 80.0,
                });
            }
            if let Some(ref rst) = reset_net {
                ports.push(MacroPort {
                    id: "port_rst".to_string(),
                    name: rst.clone(),
                    width: 1,
                    direction: MacroPortDirection::In,
                    is_clock: false,
                    is_reset: true,
                    is_datapath: false,
                    offset_x: 40.0,
                    offset_y: 80.0,
                });
            }

            for inp in &fsm_macro.inputs {
                ports.push(MacroPort {
                    id: format!("in_{}", inp),
                    name: inp.clone(),
                    width: 1,
                    direction: MacroPortDirection::In,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 0.0,
                    offset_y: 20.0,
                });
            }

            for out in &fsm_macro.outputs {
                ports.push(MacroPort {
                    id: format!("out_{}", out),
                    name: out.clone(),
                    width: 1,
                    direction: MacroPortDirection::Out,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 160.0,
                    offset_y: 20.0,
                });
            }

            let label = if state_var.to_lowercase().contains("tx") {
                "TX Controller FSM".to_string()
            } else if state_var.to_lowercase().contains("rx") {
                "RX Controller FSM".to_string()
            } else if state_var.to_lowercase().contains("spi") {
                "SPI Protocol FSM".to_string()
            } else {
                format!("{} FSM", state_var.to_uppercase())
            };

            return Some(MacroBlock {
                id: format!("fsm_block_{}_{}", state_var, proc_idx),
                name: state_var.clone(),
                label,
                sublabel: format!("{} States | Synchronous STG", fsm_macro.states.len()),
                category: MacroCategory::Control,
                kind: MacroKind::Fsm(fsm_macro),
                inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                x: 0.0,
                y: 0.0,
                width: 180.0,
                height: 100.0,
                clock_domain: clock_net,
                latency_cycles: 1,
                source_line: None,
            });
        }

        None
    }

    fn find_case_on_state<F>(stmt: &Statement, cb: &mut F)
    where
        F: FnMut(&str, &[CaseItem], Option<u64>),
    {
        match stmt {
            Statement::Block(inner) => {
                let mut reset_val = None;
                for s in inner {
                    // Detect reset branch
                    if let Statement::If { cond: _, then_branch, else_branch: Some(else_b), .. } = s {
                        Self::find_reset_assign(then_branch, &mut reset_val);
                        Self::find_case_in_stmt(else_b, reset_val, cb);
                    } else {
                        Self::find_case_in_stmt(s, reset_val, cb);
                    }
                }
            }
            Statement::If { cond: _, then_branch, else_branch, .. } => {
                let mut reset_val = None;
                Self::find_reset_assign(then_branch, &mut reset_val);
                if let Some(else_b) = else_branch {
                    Self::find_case_in_stmt(else_b, reset_val, cb);
                }
            }
            _ => {}
        }
    }

    fn find_reset_assign(stmt: &Statement, reset_val: &mut Option<u64>) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_reset_assign(s, reset_val);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if name.contains("state") {
                        if let Some(v) = Self::eval_const_expr(rhs) {
                            *reset_val = Some(v);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn find_case_in_stmt<F>(stmt: &Statement, reset_val: Option<u64>, cb: &mut F)
    where
        F: FnMut(&str, &[CaseItem], Option<u64>),
    {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_case_in_stmt(s, reset_val, cb);
                }
            }
            Statement::Case { expr, items, .. } => {
                if let Expr::Ident(ref name, _) = expr {
                    cb(name, items, reset_val);
                }
            }
            Statement::If { then_branch, else_branch, .. } => {
                Self::find_case_in_stmt(then_branch, reset_val, cb);
                if let Some(else_b) = else_branch {
                    Self::find_case_in_stmt(else_b, reset_val, cb);
                }
            }
            _ => {}
        }
    }

    fn extract_transitions_and_outputs(
        stmt: &Statement,
        current_state: &str,
        state_var: &str,
        param_map: &HashMap<u64, String>,
        transitions: &mut Vec<FsmTransition>,
        moore_outputs: &mut Vec<(String, String)>,
        inputs_set: &mut hashbrown::HashSet<String>,
        outputs_set: &mut hashbrown::HashSet<String>,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::extract_transitions_and_outputs(
                        s,
                        current_state,
                        state_var,
                        param_map,
                        transitions,
                        moore_outputs,
                        inputs_set,
                        outputs_set,
                    );
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(target, _) = lhs {
                    if target == state_var {
                        // Direct unconditional transition
                        let dest_name = Self::resolve_state_name(rhs, param_map);
                        transitions.push(FsmTransition {
                            from_state: current_state.to_string(),
                            to_state: dest_name,
                            condition: "always".to_string(),
                            mealy_outputs: Vec::new(),
                        });
                    } else {
                        outputs_set.insert(target.clone());
                        moore_outputs.push((target.clone(), Self::expr_to_string(rhs)));
                    }
                }
            }
            Statement::If { cond, then_branch, else_branch, .. } => {
                Self::collect_expr_vars(cond, inputs_set);
                let cond_str = Self::expr_to_string(cond);

                // Look for next-state assignments in then branch
                let mut then_next_state = None;
                Self::find_next_state_assign(then_branch, state_var, param_map, &mut then_next_state);
                if let Some(dest) = then_next_state {
                    transitions.push(FsmTransition {
                        from_state: current_state.to_string(),
                        to_state: dest,
                        condition: cond_str.clone(),
                        mealy_outputs: Vec::new(),
                    });
                } else {
                    Self::extract_transitions_and_outputs(
                        then_branch,
                        current_state,
                        state_var,
                        param_map,
                        transitions,
                        moore_outputs,
                        inputs_set,
                        outputs_set,
                    );
                }

                if let Some(else_b) = else_branch {
                    let mut else_next_state = None;
                    Self::find_next_state_assign(else_b, state_var, param_map, &mut else_next_state);
                    if let Some(dest) = else_next_state {
                        transitions.push(FsmTransition {
                            from_state: current_state.to_string(),
                            to_state: dest,
                            condition: format!("!({})", cond_str),
                            mealy_outputs: Vec::new(),
                        });
                    } else {
                        Self::extract_transitions_and_outputs(
                            else_b,
                            current_state,
                            state_var,
                            param_map,
                            transitions,
                            moore_outputs,
                            inputs_set,
                            outputs_set,
                        );
                    }
                }
            }
            _ => {}
        }
    }

    fn find_next_state_assign(
        stmt: &Statement,
        state_var: &str,
        param_map: &HashMap<u64, String>,
        out: &mut Option<String>,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_next_state_assign(s, state_var, param_map, out);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if name == state_var {
                        *out = Some(Self::resolve_state_name(rhs, param_map));
                    }
                }
            }
            Statement::If { then_branch, .. } => {
                Self::find_next_state_assign(then_branch, state_var, param_map, out);
            }
            _ => {}
        }
    }

    fn resolve_state_name(expr: &Expr, param_map: &HashMap<u64, String>) -> String {
        if let Expr::Ident(name, _) = expr {
            return name.clone();
        }
        if let Some(v) = Self::eval_const_expr(expr) {
            if let Some(name) = param_map.get(&v) {
                return name.clone();
            }
            return format!("STATE_{}", v);
        }
        Self::expr_to_string(expr)
    }

    fn collect_expr_vars(expr: &Expr, out: &mut hashbrown::HashSet<String>) {
        match expr {
            Expr::Ident(name, _) => {
                out.insert(name.clone());
            }
            Expr::Unary { expr: inner, .. } => {
                Self::collect_expr_vars(inner, out);
            }
            Expr::Binary { lhs, rhs, .. } => {
                Self::collect_expr_vars(lhs, out);
                Self::collect_expr_vars(rhs, out);
            }
            Expr::Ternary { cond, then_expr, else_expr, .. } => {
                Self::collect_expr_vars(cond, out);
                Self::collect_expr_vars(then_expr, out);
                Self::collect_expr_vars(else_expr, out);
            }
            Expr::Slice { target, .. } => {
                Self::collect_expr_vars(target, out);
            }
            _ => {}
        }
    }

    fn expr_to_string(expr: &Expr) -> String {
        match expr {
            Expr::Ident(name, _) => name.clone(),
            Expr::Number(vec, _) => format!("{}", vec.to_u64().unwrap_or(0)),
            Expr::UnsizedInt(v, _) => format!("{}", v),
            Expr::StringLiteral(s, _) => format!("\"{}\"", s),
            Expr::Unary { op, expr: inner, .. } => {
                let op_str = match op {
                    UnaryOp::Not => "~",
                    UnaryOp::LogicNot => "!",
                    UnaryOp::Minus => "-",
                    _ => "",
                };
                format!("{}{}", op_str, Self::expr_to_string(inner))
            }
            Expr::Binary { op, lhs, rhs, .. } => {
                let op_str = match op {
                    BinaryOp::Eq => "==",
                    BinaryOp::Neq => "!=",
                    BinaryOp::Lt => "<",
                    BinaryOp::Gt => ">",
                    BinaryOp::LtEq => "<=",
                    BinaryOp::GtEq => ">=",
                    BinaryOp::BitAnd => "&",
                    BinaryOp::BitOr => "|",
                    BinaryOp::BitXor => "^",
                    BinaryOp::LogicAnd => "&&",
                    BinaryOp::LogicOr => "||",
                    BinaryOp::Add => "+",
                    BinaryOp::Sub => "-",
                    _ => "op",
                };
                format!("{} {} {}", Self::expr_to_string(lhs), op_str, Self::expr_to_string(rhs))
            }
            _ => "expr".to_string(),
        }
    }

    fn eval_const_expr(expr: &Expr) -> Option<u64> {
        match expr {
            Expr::Number(vec, _) => vec.to_u64(),
            Expr::UnsizedInt(v, _) => Some(*v),
            _ => None,
        }
    }
}
