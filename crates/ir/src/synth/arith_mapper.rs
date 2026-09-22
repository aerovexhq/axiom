use crate::bir::{BirCircuit, BirContinuousAssign, BirExpr, PrimitiveKind};
use crate::synth::types::{FpgaFamily, SynthesizedCell};
use axiom_syntax::BinaryOp;
use hashbrown::HashMap;

/// Maps multi-bit additions and subtractions to dedicated FPGA carry chains (CARRY4 / CARRY8).
pub struct ArithMapper;

pub struct MappedArithResult {
    pub carry_cells: Vec<SynthesizedCell>,
    pub lut_cells: Vec<SynthesizedCell>,
}

impl ArithMapper {
    pub fn try_map_arithmetic(
        circuit: &BirCircuit,
        assign: &BirContinuousAssign,
        family: FpgaFamily,
        _index: usize,
    ) -> Option<MappedArithResult> {
        let (op, lhs, rhs) = match &assign.expr {
            BirExpr::Binary { op, lhs, rhs } => match op {
                BinaryOp::Add | BinaryOp::Sub => (*op, lhs.as_ref(), rhs.as_ref()),
                _ => return None,
            },
            _ => return None,
        };

        let target_net = circuit.get_net(assign.target)?;
        let width = target_net.width;
        if width <= 1 {
            return None; // 1-bit arithmetic is handled directly by LUT2
        }

        let is_sub = op == BinaryOp::Sub;
        let lhs_name = Self::expr_name(circuit, lhs);
        let rhs_name = Self::expr_name(circuit, rhs);

        let mut carry_cells = Vec::new();
        let mut lut_cells = Vec::new();

        if family.supports_carry8() {
            // UltraScale+ CARRY8 mapping
            let num_blocks = width.div_ceil(8);
            for blk in 0..num_blocks {
                let cell_name = format!("carry8_{}_{blk}", target_net.name);
                let mut ports = HashMap::new();

                // Connect carry-in
                if blk == 0 {
                    ports.insert("CI".to_string(), "1'b0".to_string());
                    ports.insert("CYINIT".to_string(), if is_sub { "1'b1".to_string() } else { "1'b0".to_string() });
                } else {
                    let prev_cell = format!("carry8_{}_{}", target_net.name, blk - 1);
                    ports.insert("CI".to_string(), format!("{prev_cell}_CO7"));
                    ports.insert("CYINIT".to_string(), "1'b0".to_string());
                }

                for bit in 0..8 {
                    let global_bit = blk * 8 + bit;
                    if global_bit < width {
                        let s_lut_name = format!("lut_prop_{}_{global_bit}", target_net.name);
                        ports.insert(format!("S[{bit}]"), format!("{s_lut_name}_O"));
                        ports.insert(format!("DI[{bit}]"), format!("{lhs_name}[{global_bit}]"));
                        ports.insert(format!("O[{bit}]"), format!("{}[{global_bit}]", target_net.name));

                        // Generate LUT2 for propagate bit S = A ^ B
                        let mut lut_ports = HashMap::new();
                        lut_ports.insert("I0".to_string(), format!("{lhs_name}[{global_bit}]"));
                        lut_ports.insert("I1".to_string(), format!("{rhs_name}[{global_bit}]"));
                        lut_ports.insert("O".to_string(), format!("{s_lut_name}_O"));

                        let mut lut_params = HashMap::new();
                        lut_params.insert("INIT".to_string(), 0x6); // XOR

                        lut_cells.push(SynthesizedCell {
                            id: format!("cell_{s_lut_name}"),
                            name: s_lut_name,
                            kind: PrimitiveKind::Lut2,
                            scope: "top".to_string(),
                            ports: lut_ports,
                            params: lut_params,
                            equation: Some("O = I0 ^ I1".to_string()),
                            source_line: None,
                            delay_ps: 45.0,
                        });
                    } else {
                        ports.insert(format!("S[{bit}]"), "1'b0".to_string());
                        ports.insert(format!("DI[{bit}]"), "1'b0".to_string());
                    }
                }

                carry_cells.push(SynthesizedCell {
                    id: format!("cell_{cell_name}"),
                    name: cell_name,
                    kind: PrimitiveKind::Carry8,
                    scope: "top".to_string(),
                    ports,
                    params: HashMap::new(),
                    equation: None,
                    source_line: None,
                    delay_ps: 85.0,
                });
            }
        } else {
            // 7-Series / Zynq CARRY4 mapping
            let num_blocks = width.div_ceil(4);
            for blk in 0..num_blocks {
                let cell_name = format!("carry4_{}_{blk}", target_net.name);
                let mut ports = HashMap::new();

                if blk == 0 {
                    ports.insert("CI".to_string(), "1'b0".to_string());
                    ports.insert("CYINIT".to_string(), if is_sub { "1'b1".to_string() } else { "1'b0".to_string() });
                } else {
                    let prev_cell = format!("carry4_{}_{}", target_net.name, blk - 1);
                    ports.insert("CI".to_string(), format!("{prev_cell}_CO3"));
                    ports.insert("CYINIT".to_string(), "1'b0".to_string());
                }

                for bit in 0..4 {
                    let global_bit = blk * 4 + bit;
                    if global_bit < width {
                        let s_lut_name = format!("lut_prop_{}_{global_bit}", target_net.name);
                        ports.insert(format!("S[{bit}]"), format!("{s_lut_name}_O"));
                        ports.insert(format!("DI[{bit}]"), format!("{lhs_name}[{global_bit}]"));
                        ports.insert(format!("O[{bit}]"), format!("{}[{global_bit}]", target_net.name));

                        let mut lut_ports = HashMap::new();
                        lut_ports.insert("I0".to_string(), format!("{lhs_name}[{global_bit}]"));
                        lut_ports.insert("I1".to_string(), format!("{rhs_name}[{global_bit}]"));
                        lut_ports.insert("O".to_string(), format!("{s_lut_name}_O"));

                        let mut lut_params = HashMap::new();
                        lut_params.insert("INIT".to_string(), 0x6); // XOR

                        lut_cells.push(SynthesizedCell {
                            id: format!("cell_{s_lut_name}"),
                            name: s_lut_name,
                            kind: PrimitiveKind::Lut2,
                            scope: "top".to_string(),
                            ports: lut_ports,
                            params: lut_params,
                            equation: Some("O = I0 ^ I1".to_string()),
                            source_line: None,
                            delay_ps: 45.0,
                        });
                    } else {
                        ports.insert(format!("S[{bit}]"), "1'b0".to_string());
                        ports.insert(format!("DI[{bit}]"), "1'b0".to_string());
                    }
                }

                carry_cells.push(SynthesizedCell {
                    id: format!("cell_{cell_name}"),
                    name: cell_name,
                    kind: PrimitiveKind::Carry4,
                    scope: "top".to_string(),
                    ports,
                    params: HashMap::new(),
                    equation: None,
                    source_line: None,
                    delay_ps: 70.0,
                });
            }
        }

        Some(MappedArithResult {
            carry_cells,
            lut_cells,
        })
    }

    fn expr_name(circuit: &BirCircuit, expr: &BirExpr) -> String {
        match expr {
            BirExpr::Net(id) => circuit.get_net(*id).map(|n| n.name.clone()).unwrap_or_else(|| "wire".to_string()),
            BirExpr::Const(vec) => format!("{}'h{:x}", vec.width(), vec.to_u64().unwrap_or(0)),
            _ => "expr".to_string(),
        }
    }
}
