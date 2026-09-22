use crate::arena::SimStateArena;
use axiom_core::{Logic4, LogicVector};
use axiom_ir::{BirCircuit, BirContinuousAssign, BirExpr, BirProcess, BirStatement, NetId};
use axiom_syntax::{BinaryOp, UnaryOp};

/// Portable in-memory evaluator for BIR circuits (WebAssembly and reference execution).
pub struct PortableEvaluator;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProcessEvalOutput {
    pub changed_blocking_nets: Vec<NetId>,
    pub scheduled_nbas: Vec<(NetId, LogicVector)>,
}

impl IntoIterator for ProcessEvalOutput {
    type Item = (NetId, LogicVector);
    type IntoIter = std::vec::IntoIter<(NetId, LogicVector)>;

    fn into_iter(self) -> Self::IntoIter {
        self.scheduled_nbas.into_iter()
    }
}

impl PortableEvaluator {
    /// Evaluates a continuous assignment. Writes the result into `arena` and returns `true` if the signal changed.
    pub fn eval_continuous_assign(
        assign: &BirContinuousAssign,
        circuit: &BirCircuit,
        arena: &mut SimStateArena,
    ) -> bool {
        let target_net = match circuit.get_net(assign.target) {
            Some(n) => n,
            None => return false,
        };

        let result = Self::eval_expr(&assign.expr, circuit, arena, target_net.width);
        arena.write_net(target_net, &result)
    }

    /// Evaluates a procedural block.
    /// Blocking assignments update `arena` immediately and record modified nets in `changed_blocking_nets`.
    /// Non-blocking assignments (NBAs) are returned in `scheduled_nbas` for the NBA region of the scheduler.
    pub fn eval_process(
        proc: &BirProcess,
        circuit: &BirCircuit,
        arena: &mut SimStateArena,
    ) -> ProcessEvalOutput {
        let mut output = ProcessEvalOutput::default();
        for stmt in &proc.body {
            Self::eval_statement(stmt, circuit, arena, &mut output);
        }
        output
    }

    fn eval_statement(
        stmt: &BirStatement,
        circuit: &BirCircuit,
        arena: &mut SimStateArena,
        output: &mut ProcessEvalOutput,
    ) {
        match stmt {
            BirStatement::Block(stmts) => {
                for s in stmts {
                    Self::eval_statement(s, circuit, arena, output);
                }
            }
            BirStatement::Assign { target, expr, is_nonblocking } => {
                if let Some(target_net) = circuit.get_net(*target) {
                    let val = Self::eval_expr(expr, circuit, arena, target_net.width);
                    if *is_nonblocking {
                        output.scheduled_nbas.push((*target, val));
                    } else {
                        let changed = arena.write_net(target_net, &val);
                        if changed && !output.changed_blocking_nets.contains(target) {
                            output.changed_blocking_nets.push(*target);
                        }
                    }
                }
            }
            BirStatement::If { cond, then_body, else_body } => {
                let cond_val = Self::eval_expr(cond, circuit, arena, 1);
                let is_true = cond_val.get_bit(0) == Logic4::One || cond_val.to_u64().unwrap_or(0) != 0;
                if is_true {
                    for s in then_body {
                        Self::eval_statement(s, circuit, arena, output);
                    }
                } else {
                    for s in else_body {
                        Self::eval_statement(s, circuit, arena, output);
                    }
                }
            }
        }
    }

    pub fn eval_expr(
        expr: &BirExpr,
        circuit: &BirCircuit,
        arena: &SimStateArena,
        expected_width: u32,
    ) -> LogicVector {
        match expr {
            BirExpr::Net(id) => {
                if let Some(net) = circuit.get_net(*id) {
                    arena.read_net(net)
                } else {
                    LogicVector::zeros(expected_width)
                }
            }
            BirExpr::Const(vec) => {
                if vec.width() != expected_width && expected_width > 0 {
                    // Resize/zero-extend
                    if vec.width() < expected_width {
                        let mut ext = LogicVector::zeros(expected_width);
                        for i in 0..vec.width() {
                            ext.set_bit(i, vec.get_bit(i));
                        }
                        ext
                    } else {
                        vec.slice(expected_width - 1, 0)
                    }
                } else {
                    vec.clone()
                }
            }
            BirExpr::Unary { op, expr } => {
                let inner = Self::eval_expr(expr, circuit, arena, expected_width);
                match op {
                    UnaryOp::Not => inner.bitwise_not(),
                    UnaryOp::LogicNot => {
                        let is_zero = inner.is_all_known() && inner.to_u64() == Some(0);
                        if is_zero {
                            LogicVector::fill(expected_width, Logic4::One)
                        } else if inner.is_all_known() {
                            LogicVector::fill(expected_width, Logic4::Zero)
                        } else {
                            LogicVector::fill(expected_width, Logic4::X)
                        }
                    }
                    UnaryOp::And => {
                        // Reduction AND
                        let mut all_one = true;
                        for i in 0..inner.width() {
                            if inner.get_bit(i) != Logic4::One {
                                all_one = false;
                                break;
                            }
                        }
                        LogicVector::fill(1, if all_one { Logic4::One } else { Logic4::Zero })
                    }
                    UnaryOp::Or => {
                        // Reduction OR
                        let mut any_one = false;
                        for i in 0..inner.width() {
                            if inner.get_bit(i) == Logic4::One {
                                any_one = true;
                                break;
                            }
                        }
                        LogicVector::fill(1, if any_one { Logic4::One } else { Logic4::Zero })
                    }
                    UnaryOp::Xor => {
                        // Reduction XOR
                        let mut ones = 0;
                        for i in 0..inner.width() {
                            if inner.get_bit(i) == Logic4::One {
                                ones += 1;
                            }
                        }
                        LogicVector::fill(1, if ones % 2 == 1 { Logic4::One } else { Logic4::Zero })
                    }
                    _ => inner,
                }
            }
            BirExpr::Binary { op, lhs, rhs } => {
                let (child_w_l, child_w_r) = match op {
                    BinaryOp::Eq | BinaryOp::Neq | BinaryOp::CaseEq | BinaryOp::CaseNeq
                    | BinaryOp::Lt | BinaryOp::LtEq | BinaryOp::Gt | BinaryOp::GtEq => (0, 0),
                    BinaryOp::LogicAnd | BinaryOp::LogicOr => (1, 1),
                    _ => (expected_width, expected_width),
                };
                let l_val = Self::eval_expr(lhs, circuit, arena, child_w_l);
                let r_val = Self::eval_expr(rhs, circuit, arena, child_w_r);
                let op_w = if expected_width > 0 {
                    expected_width
                } else {
                    l_val.width().max(r_val.width()).max(1)
                };
                Self::eval_binary_op(*op, &l_val, &r_val, op_w)
            }
            BirExpr::Slice { target, lsb, width } => {
                let inner = Self::eval_expr(target, circuit, arena, lsb + width);
                let msb = lsb + width - 1;
                inner.slice(msb, *lsb)
            }
            BirExpr::Concat(items) => {
                if items.is_empty() {
                    return LogicVector::zeros(expected_width);
                }
                let mut acc = Self::eval_expr(&items[0], circuit, arena, 1);
                for item in &items[1..] {
                    let next = Self::eval_expr(item, circuit, arena, 1);
                    acc = acc.concat(&next);
                }
                acc
            }
        }
    }

    fn eval_binary_op(op: BinaryOp, lhs: &LogicVector, rhs: &LogicVector, width: u32) -> LogicVector {
        match op {
            BinaryOp::Add => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    let sum = a.wrapping_add(b);
                    LogicVector::from_u64(sum, width)
                } else {
                    LogicVector::unknowns(width)
                }
            }
            BinaryOp::Sub => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    let diff = a.wrapping_sub(b);
                    LogicVector::from_u64(diff, width)
                } else {
                    LogicVector::unknowns(width)
                }
            }
            BinaryOp::Mul => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    let prod = a.wrapping_mul(b);
                    LogicVector::from_u64(prod, width)
                } else {
                    LogicVector::unknowns(width)
                }
            }
            BinaryOp::Div => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    let quotient = if b != 0 { a / b } else { 0 };
                    LogicVector::from_u64(quotient, width)
                } else {
                    LogicVector::unknowns(width)
                }
            }
            BinaryOp::BitAnd => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                norm_l.bitwise_and(&norm_r)
            }
            BinaryOp::BitOr => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                norm_l.bitwise_or(&norm_r)
            }
            BinaryOp::BitXor => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                norm_l.bitwise_xor(&norm_r)
            }
            BinaryOp::BitXnor => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                norm_l.bitwise_xor(&norm_r).bitwise_not()
            }
            BinaryOp::LogicAnd => {
                let l_truthy = lhs.to_u64().map(|v| v != 0).unwrap_or(false);
                let r_truthy = rhs.to_u64().map(|v| v != 0).unwrap_or(false);
                LogicVector::fill(1, Logic4::from_bool(l_truthy && r_truthy))
            }
            BinaryOp::LogicOr => {
                let l_truthy = lhs.to_u64().map(|v| v != 0).unwrap_or(false);
                let r_truthy = rhs.to_u64().map(|v| v != 0).unwrap_or(false);
                LogicVector::fill(1, Logic4::from_bool(l_truthy || r_truthy))
            }
            BinaryOp::Eq | BinaryOp::CaseEq => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                let is_eq = norm_l == norm_r;
                LogicVector::fill(1, Logic4::from_bool(is_eq))
            }
            BinaryOp::Neq | BinaryOp::CaseNeq => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                let is_neq = norm_l != norm_r;
                LogicVector::fill(1, Logic4::from_bool(is_neq))
            }
            BinaryOp::Lt => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    LogicVector::fill(1, Logic4::from_bool(a < b))
                } else {
                    LogicVector::fill(1, Logic4::X)
                }
            }
            BinaryOp::LtEq => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    LogicVector::fill(1, Logic4::from_bool(a <= b))
                } else {
                    LogicVector::fill(1, Logic4::X)
                }
            }
            BinaryOp::Gt => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    LogicVector::fill(1, Logic4::from_bool(a > b))
                } else {
                    LogicVector::fill(1, Logic4::X)
                }
            }
            BinaryOp::GtEq => {
                let (norm_l, norm_r) = Self::normalize_widths(lhs, rhs);
                if let (Some(a), Some(b)) = (norm_l.to_u64(), norm_r.to_u64()) {
                    LogicVector::fill(1, Logic4::from_bool(a >= b))
                } else {
                    LogicVector::fill(1, Logic4::X)
                }
            }
            BinaryOp::Shl | BinaryOp::ShlArith => {
                if let (Some(a), Some(b)) = (lhs.to_u64(), rhs.to_u64()) {
                    let shifted = if b < 64 { a << b } else { 0 };
                    LogicVector::from_u64(shifted, width)
                } else {
                    LogicVector::unknowns(width)
                }
            }
            BinaryOp::Shr | BinaryOp::ShrArith => {
                if let (Some(a), Some(b)) = (lhs.to_u64(), rhs.to_u64()) {
                    let shifted = if b < 64 { a >> b } else { 0 };
                    LogicVector::from_u64(shifted, width)
                } else {
                    LogicVector::unknowns(width)
                }
            }
            _ => LogicVector::zeros(width),
        }
    }

    fn normalize_widths(a: &LogicVector, b: &LogicVector) -> (LogicVector, LogicVector) {
        if a.width() == b.width() {
            (a.clone(), b.clone())
        } else if a.width() > b.width() {
            let mut ext = LogicVector::zeros(a.width());
            for i in 0..b.width() {
                ext.set_bit(i, b.get_bit(i));
            }
            (a.clone(), ext)
        } else {
            let mut ext = LogicVector::zeros(b.width());
            for i in 0..a.width() {
                ext.set_bit(i, a.get_bit(i));
            }
            (ext, b.clone())
        }
    }
}
