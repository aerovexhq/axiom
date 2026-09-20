use super::types::*;
use crate::bir::BirCircuit;
use axiom_syntax::ast::*;
use hashbrown::HashSet;

pub struct AluDetector;

impl AluDetector {
    pub fn detect_alus(module: &ModuleDef, _circuit: &BirCircuit) -> Vec<MacroBlock> {
        let mut alus = Vec::new();

        // Scan procedural blocks for case statements evaluating opcode and computing operations on operands
        for (proc_idx, item) in module.items.iter().enumerate() {
            if let ModuleItem::ProceduralBlock(proc) = item {
                if let Some(alu_macro) = Self::analyze_proc_for_alu(&proc.body) {
                    let mut ports = Vec::new();

                    // Operand A
                    ports.push(MacroPort {
                        id: "in_a".to_string(),
                        name: alu_macro.operand_a.clone(),
                        width: alu_macro.operand_width,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 25.0,
                    });

                    // Operand B
                    ports.push(MacroPort {
                        id: "in_b".to_string(),
                        name: alu_macro.operand_b.clone(),
                        width: alu_macro.operand_width,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 55.0,
                    });

                    // Opcode
                    ports.push(MacroPort {
                        id: "in_opcode".to_string(),
                        name: alu_macro.opcode_signal.clone(),
                        width: alu_macro.opcode_width,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: false,
                        offset_x: 90.0,
                        offset_y: 0.0,
                    });

                    // Result
                    ports.push(MacroPort {
                        id: "out_result".to_string(),
                        name: alu_macro.result_signal.clone(),
                        width: alu_macro.result_width,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 180.0,
                        offset_y: 40.0,
                    });

                    // Flags
                    for flag in &alu_macro.flags {
                        ports.push(MacroPort {
                            id: format!("out_flag_{}", flag.name.to_lowercase()),
                            name: flag.signal.clone(),
                            width: 1,
                            direction: MacroPortDirection::Out,
                            is_clock: false,
                            is_reset: false,
                            is_datapath: false,
                            offset_x: 180.0,
                            offset_y: 65.0,
                        });
                    }

                    // Check for zero / carry flags in module items
                    let enriched_macro = Self::enrich_flags(alu_macro, module);

                    let block = MacroBlock {
                        id: format!("alu_block_{}", proc_idx),
                        name: enriched_macro.result_signal.clone(),
                        label: format!("{}-bit Arithmetic Logic Unit (ALU)", enriched_macro.operand_width),
                        sublabel: format!("{} Operations | Zero & Carry Flags", enriched_macro.operations.len()),
                        category: MacroCategory::Datapath,
                        kind: MacroKind::Alu(enriched_macro),
                        inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                        outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                        x: 0.0,
                        y: 0.0,
                        width: 190.0,
                        height: 95.0,
                        clock_domain: None,
                        latency_cycles: 0,
                        source_line: None,
                    };
                    alus.push(block);
                }
            }
        }

        alus
    }

    fn analyze_proc_for_alu(stmt: &Statement) -> Option<AluMacro> {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    if let Some(alu) = Self::analyze_proc_for_alu(s) {
                        return Some(alu);
                    }
                }
            }
            Statement::Case { expr, items, .. } => {
                let opcode_sig = Self::expr_to_name(expr)?;

                let mut operations = Vec::new();
                let mut target_res = None;
                let mut operands = HashSet::new();

                for item in items {
                    if item.patterns.is_empty() {
                        continue; // default branch
                    }

                    let opcode_val = Self::eval_const_expr(item.patterns.first()?).unwrap_or(0);
                    let (target, op_name, expr_str, detected_operands) = Self::inspect_alu_branch(&item.body)?;

                    target_res = Some(target);
                    for op in detected_operands {
                        operands.insert(op);
                    }

                    operations.push(AluOperation {
                        opcode_val,
                        opcode_bin: format!("{:03b}", opcode_val),
                        name: op_name,
                        expression: expr_str,
                    });
                }

                // If we found at least 2 distinct operations on common operands
                if operations.len() >= 2 {
                    let mut op_list: Vec<String> = operands.into_iter().collect();
                    op_list.sort();

                    let operand_a = op_list.first().cloned().unwrap_or_else(|| "a".to_string());
                    let operand_b = op_list.get(1).cloned().unwrap_or_else(|| "b".to_string());
                    let result_sig = target_res.unwrap_or_else(|| "result".to_string());

                    let width = if operand_a.contains("32") || result_sig.contains("32") {
                        32
                    } else if operand_a.contains("16") || result_sig.contains("16") {
                        16
                    } else {
                        8
                    };

                    let opcode_width = if operations.len() > 4 { 3 } else { 2 };

                    return Some(AluMacro {
                        opcode_signal: opcode_sig,
                        opcode_width,
                        operand_a,
                        operand_b,
                        operand_width: width,
                        result_signal: result_sig,
                        result_width: width,
                        flags: vec![
                            AluFlag {
                                name: "ZERO".to_string(),
                                signal: "zero_flag".to_string(),
                                description: "Asserted when ALU result is all-zero".to_string(),
                            },
                            AluFlag {
                                name: "CARRY".to_string(),
                                signal: "carry_flag".to_string(),
                                description: "Arithmetic overflow/carry out from MSB".to_string(),
                            },
                        ],
                        operations,
                    });
                }
            }
            _ => {}
        }
        None
    }

    fn inspect_alu_branch(stmt: &Statement) -> Option<(String, String, String, Vec<String>)> {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    if let Some(res) = Self::inspect_alu_branch(s) {
                        return Some(res);
                    }
                }
            }
            Statement::BlockingAssign { lhs, rhs, .. } | Statement::NonBlockingAssign { lhs, rhs, .. } => {
                let target = Self::expr_to_name(lhs)?;
                let (op_name, operands) = Self::classify_rhs_expr(rhs);
                let expr_str = Self::expr_to_string(rhs);
                return Some((target, op_name, expr_str, operands));
            }
            _ => {}
        }
        None
    }

    fn classify_rhs_expr(expr: &Expr) -> (String, Vec<String>) {
        let mut operands = Vec::new();
        match expr {
            Expr::Binary { op, lhs, rhs, .. } => {
                if let Some(l) = Self::expr_to_name(lhs) {
                    operands.push(l);
                }
                if let Some(r) = Self::expr_to_name(rhs) {
                    operands.push(r);
                }
                let name = match op {
                    BinaryOp::Add => "ADD",
                    BinaryOp::Sub => "SUB",
                    BinaryOp::BitAnd => "AND",
                    BinaryOp::BitOr => "OR",
                    BinaryOp::BitXor => "XOR",
                    BinaryOp::Shl => "SHL",
                    BinaryOp::Shr => "SHR",
                    _ => "OP",
                };
                (name.to_string(), operands)
            }
            Expr::Unary { op, expr: inner, .. } => {
                if let Some(n) = Self::expr_to_name(inner) {
                    operands.push(n);
                }
                let name = match op {
                    UnaryOp::Not => "NOT",
                    UnaryOp::Minus => "NEG",
                    _ => "UNARY",
                };
                (name.to_string(), operands)
            }
            Expr::Concat(items, _) => {
                for it in items {
                    let (_, sub_ops) = Self::classify_rhs_expr(it);
                    operands.extend(sub_ops);
                }
                if items.len() >= 2 {
                    let (name, _) = Self::classify_rhs_expr(&items[1]);
                    (name, operands)
                } else {
                    ("CONCAT".to_string(), operands)
                }
            }
            _ => ("UNKNOWN".to_string(), operands),
        }
    }

    fn enrich_flags(mut alu: AluMacro, module: &ModuleDef) -> AluMacro {
        for item in &module.items {
            if let ModuleItem::ContinuousAssign(assign) = item {
                if let Some(lhs_name) = Self::expr_to_name(&assign.lhs) {
                    if lhs_name.contains("zero") {
                        if !alu.flags.iter().any(|f| f.name == "ZERO") {
                            alu.flags.push(AluFlag {
                                name: "ZERO".to_string(),
                                signal: lhs_name,
                                description: "Zero flag comparator".to_string(),
                            });
                        }
                    }
                }
            }
        }
        alu
    }

    fn expr_to_name(expr: &Expr) -> Option<String> {
        match expr {
            Expr::Ident(name, _) => Some(name.clone()),
            Expr::Slice { target, .. } => Self::expr_to_name(target),
            _ => None,
        }
    }

    fn expr_to_string(expr: &Expr) -> String {
        match expr {
            Expr::Ident(n, _) => n.clone(),
            Expr::Binary { op, lhs, rhs, .. } => {
                let op_s = match op {
                    BinaryOp::Add => "+",
                    BinaryOp::Sub => "-",
                    BinaryOp::BitAnd => "&",
                    BinaryOp::BitOr => "|",
                    BinaryOp::BitXor => "^",
                    BinaryOp::Shl => "<<",
                    BinaryOp::Shr => ">>",
                    _ => "op",
                };
                format!("{} {} {}", Self::expr_to_string(lhs), op_s, Self::expr_to_string(rhs))
            }
            Expr::Unary { op, expr: inner, .. } => {
                let op_s = match op {
                    UnaryOp::Not => "~",
                    UnaryOp::Minus => "-",
                    _ => "",
                };
                format!("{}{}", op_s, Self::expr_to_string(inner))
            }
            Expr::Concat(items, _) => {
                let s: Vec<String> = items.iter().map(Self::expr_to_string).collect();
                format!("{{{}}}", s.join(", "))
            }
            Expr::Number(n, _) => format!("{}", n.to_u64().unwrap_or(0)),
            Expr::UnsizedInt(v, _) => format!("{}", v),
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
