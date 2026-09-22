use crate::bir::{BirCircuit, BirContinuousAssign, BirExpr, NetId, PrimitiveKind};
use crate::synth::types::SynthesizedCell;
use axiom_syntax::{BinaryOp, UnaryOp};
use hashbrown::{HashMap, HashSet};

/// Maps combinational assignments into K-input Look-Up Tables (LUT1..6).
pub struct LutMapper;

pub struct MappedLutResult {
    pub cells: Vec<SynthesizedCell>,
}

impl LutMapper {
    /// Maps a single continuous assignment to one or more FPGA LUT primitive cells.
    pub fn map_continuous_assign(
        circuit: &BirCircuit,
        assign: &BirContinuousAssign,
        cell_index: usize,
    ) -> MappedLutResult {
        let target_net = match circuit.get_net(assign.target) {
            Some(n) => n,
            None => return MappedLutResult { cells: Vec::new() },
        };

        let mut input_net_ids = Vec::new();
        Self::collect_unique_nets(&assign.expr, &mut input_net_ids);

        // Remove self-references if any
        input_net_ids.retain(|&id| id != assign.target);

        let k = input_net_ids.len();

        // Multi-bit bus bit-blasting into parallel slice LUTs
        if target_net.width > 1 && !input_net_ids.is_empty() {
            let mut cells = Vec::new();
            for bit in 0..target_net.width {
                let bit_target = format!("{}[{bit}]", target_net.name);
                let mut ports = HashMap::new();
                let mut net_to_pin = HashMap::new();

                for (idx, &net_id) in input_net_ids.iter().enumerate() {
                    let pin_name = format!("I{idx}");
                    let net = circuit.get_net(net_id);
                    let net_name = if let Some(n) = net {
                        if n.width > 1 && bit < n.width {
                            format!("{}[{bit}]", n.name)
                        } else {
                            n.name.clone()
                        }
                    } else {
                        format!("net_{}_{bit}", net_id.0)
                    };
                    ports.insert(pin_name.clone(), net_name);
                    net_to_pin.insert(net_id, pin_name);
                }

                let k = input_net_ids.len().max(1);
                let num_combinations = 1usize << k;
                let mut init: u64 = 0;
                for combo in 0..num_combinations {
                    let mut env = HashMap::new();
                    for (idx, &net_id) in input_net_ids.iter().enumerate() {
                        let bit_val = ((combo >> idx) & 1) == 1;
                        env.insert(net_id, bit_val);
                    }
                    if Self::eval_bir_expr(&assign.expr, &env) {
                        init |= 1u64 << combo;
                    }
                }

                let kind = match k {
                    1 => PrimitiveKind::Lut1,
                    2 => PrimitiveKind::Lut2,
                    3 => PrimitiveKind::Lut3,
                    4 => PrimitiveKind::Lut4,
                    5 => PrimitiveKind::Lut5,
                    _ => PrimitiveKind::Lut6,
                };

                let mut params = HashMap::new();
                params.insert("INIT".to_string(), init);
                ports.insert("O".to_string(), bit_target.clone());

                let eq = format!("O = {}", Self::format_boolean_equation(&assign.expr, &net_to_pin));
                let cell_name = format!("lut_{}_bit{}", target_net.name.replace('.', "_"), bit);

                cells.push(SynthesizedCell {
                    id: format!("cell_{cell_name}"),
                    name: cell_name,
                    kind,
                    scope: "top".to_string(),
                    ports,
                    params,
                    equation: Some(eq),
                    source_line: None,
                    delay_ps: 45.0 + (k as f32 * 5.0),
                });
            }
            return MappedLutResult { cells };
        }

        if k <= 6 {
            let cell = Self::build_single_lut(
                circuit,
                &assign.expr,
                target_net.name.as_str(),
                &input_net_ids,
                cell_index,
            );
            MappedLutResult { cells: vec![cell] }
        } else {
            // Decompose into tree of 4-input LUTs feeding a 2-input LUT
            Self::decompose_wide_lut(circuit, &assign.expr, target_net.name.as_str(), &input_net_ids, cell_index)
        }
    }

    fn build_single_lut(
        circuit: &BirCircuit,
        expr: &BirExpr,
        target_net_name: &str,
        input_net_ids: &[NetId],
        cell_index: usize,
    ) -> SynthesizedCell {
        let k = input_net_ids.len().max(1);
        let num_combinations = 1usize << k;
        let mut init: u64 = 0;

        let mut ports = HashMap::new();
        let mut net_to_pin = HashMap::new();

        for (idx, &net_id) in input_net_ids.iter().enumerate() {
            let pin_name = format!("I{idx}");
            let net_name = circuit.get_net(net_id).map(|n| n.name.clone()).unwrap_or_else(|| format!("net_{}", net_id.0));
            ports.insert(pin_name.clone(), net_name);
            net_to_pin.insert(net_id, pin_name);
        }

        // If K=0, dummy pin I0
        if input_net_ids.is_empty() {
            ports.insert("I0".to_string(), "1'b0".to_string());
        }

        ports.insert("O".to_string(), target_net_name.to_string());

        // Truth table extraction: evaluate for all combinations
        for combo in 0..num_combinations {
            let mut env = HashMap::new();
            for (idx, &net_id) in input_net_ids.iter().enumerate() {
                let bit_val = ((combo >> idx) & 1) == 1;
                env.insert(net_id, bit_val);
            }
            if Self::eval_bir_expr(expr, &env) {
                init |= 1u64 << combo;
            }
        }

        let kind = match k {
            1 => PrimitiveKind::Lut1,
            2 => PrimitiveKind::Lut2,
            3 => PrimitiveKind::Lut3,
            4 => PrimitiveKind::Lut4,
            5 => PrimitiveKind::Lut5,
            _ => PrimitiveKind::Lut6,
        };

        let mut params = HashMap::new();
        params.insert("INIT".to_string(), init);

        let equation = format!("O = {}", Self::format_boolean_equation(expr, &net_to_pin));

        let cell_name = if let Some((_, leaf)) = target_net_name.rsplit_once('.') {
            format!("lut_{leaf}_{cell_index}")
        } else {
            format!("lut_{target_net_name}_{cell_index}")
        };

        let delay_ps = 45.0 + (k as f32 * 6.5);

        SynthesizedCell {
            id: format!("cell_{cell_name}"),
            name: cell_name,
            kind,
            scope: "top".to_string(),
            ports,
            params,
            equation: Some(equation),
            source_line: None,
            delay_ps,
        }
    }

    fn decompose_wide_lut(
        circuit: &BirCircuit,
        expr: &BirExpr,
        target_net_name: &str,
        input_net_ids: &[NetId],
        cell_index: usize,
    ) -> MappedLutResult {
        // Partition inputs into chunks of up to 4
        let chunk1 = &input_net_ids[..4];
        let chunk2 = &input_net_ids[4..];

        let intermediate_net1 = format!("{target_net_name}_lut_stage1_0");
        let intermediate_net2 = format!("{target_net_name}_lut_stage1_1");

        let cell1 = Self::build_single_lut(circuit, expr, &intermediate_net1, chunk1, cell_index * 10 + 1);
        let cell2 = Self::build_single_lut(circuit, expr, &intermediate_net2, chunk2, cell_index * 10 + 2);

        // Final combining LUT2
        let mut final_ports = HashMap::new();
        final_ports.insert("I0".to_string(), intermediate_net1);
        final_ports.insert("I1".to_string(), intermediate_net2);
        final_ports.insert("O".to_string(), target_net_name.to_string());

        let mut final_params = HashMap::new();
        final_params.insert("INIT".to_string(), 0x8); // AND combination default

        let final_cell = SynthesizedCell {
            id: format!("cell_lut_{target_net_name}_out"),
            name: format!("lut_{target_net_name}_out"),
            kind: PrimitiveKind::Lut2,
            scope: "top".to_string(),
            ports: final_ports,
            params: final_params,
            equation: Some("O = I0 & I1".to_string()),
            source_line: None,
            delay_ps: 58.0,
        };

        MappedLutResult {
            cells: vec![cell1, cell2, final_cell],
        }
    }

    fn collect_unique_nets(expr: &BirExpr, out: &mut Vec<NetId>) {
        let mut seen = HashSet::new();
        Self::collect_nets_inner(expr, out, &mut seen);
    }

    fn collect_nets_inner(expr: &BirExpr, out: &mut Vec<NetId>, seen: &mut HashSet<NetId>) {
        match expr {
            BirExpr::Net(id) => {
                if seen.insert(*id) {
                    out.push(*id);
                }
            }
            BirExpr::Const(_) => {}
            BirExpr::Unary { expr, .. } => Self::collect_nets_inner(expr, out, seen),
            BirExpr::Binary { lhs, rhs, .. } => {
                Self::collect_nets_inner(lhs, out, seen);
                Self::collect_nets_inner(rhs, out, seen);
            }
            BirExpr::Slice { target, .. } => Self::collect_nets_inner(target, out, seen),
            BirExpr::Concat(items) => {
                for it in items {
                    Self::collect_nets_inner(it, out, seen);
                }
            }
        }
    }

    pub fn eval_bir_expr(expr: &BirExpr, env: &HashMap<NetId, bool>) -> bool {
        match expr {
            BirExpr::Net(id) => *env.get(id).unwrap_or(&false),
            BirExpr::Const(vec) => vec.to_u64().unwrap_or(0) != 0,
            BirExpr::Unary { op, expr } => match op {
                UnaryOp::Not | UnaryOp::LogicNot => !Self::eval_bir_expr(expr, env),
                _ => Self::eval_bir_expr(expr, env),
            },
            BirExpr::Binary { op, lhs, rhs } => {
                let l = Self::eval_bir_expr(lhs, env);
                let r = Self::eval_bir_expr(rhs, env);
                match op {
                    BinaryOp::BitAnd | BinaryOp::LogicAnd => l && r,
                    BinaryOp::BitOr | BinaryOp::LogicOr => l || r,
                    BinaryOp::BitXor => l ^ r,
                    BinaryOp::Eq => l == r,
                    BinaryOp::Neq => l != r,
                    _ => l,
                }
            }
            BirExpr::Slice { target, .. } => Self::eval_bir_expr(target, env),
            BirExpr::Concat(items) => items.iter().any(|item| Self::eval_bir_expr(item, env)),
        }
    }

    pub fn format_boolean_equation(expr: &BirExpr, net_to_pin: &HashMap<NetId, String>) -> String {
        match expr {
            BirExpr::Net(id) => net_to_pin.get(id).cloned().unwrap_or_else(|| "0".to_string()),
            BirExpr::Const(vec) => {
                if vec.to_u64().unwrap_or(0) == 0 {
                    "0".to_string()
                } else {
                    "1".to_string()
                }
            }
            BirExpr::Unary { op, expr } => {
                let sub = Self::format_boolean_equation(expr, net_to_pin);
                match op {
                    UnaryOp::Not | UnaryOp::LogicNot => format!("~{sub}"),
                    _ => sub,
                }
            }
            BirExpr::Binary { op, lhs, rhs } => {
                let l = Self::format_boolean_equation(lhs, net_to_pin);
                let r = Self::format_boolean_equation(rhs, net_to_pin);
                match op {
                    BinaryOp::BitAnd | BinaryOp::LogicAnd => format!("({l} & {r})"),
                    BinaryOp::BitOr | BinaryOp::LogicOr => format!("({l} | {r})"),
                    BinaryOp::BitXor => format!("({l} ^ {r})"),
                    _ => format!("({l} & {r})"),
                }
            }
            BirExpr::Slice { target, .. } => Self::format_boolean_equation(target, net_to_pin),
            BirExpr::Concat(items) => {
                let parts: Vec<String> = items
                    .iter()
                    .map(|i| Self::format_boolean_equation(i, net_to_pin))
                    .collect();
                format!("{{{}}}", parts.join(", "))
            }
        }
    }
}
