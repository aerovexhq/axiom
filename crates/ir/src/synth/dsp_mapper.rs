use crate::bir::{BirCircuit, BirExpr, BirStatement, PrimitiveKind};
use crate::synth::types::{FpgaFamily, SynthesizedCell};
use axiom_syntax::ast::EdgeKind;
use axiom_syntax::BinaryOp;
use hashbrown::HashMap;

/// Maps multiplication and multiply-accumulate (MAC) patterns into dedicated DSP slices (DSP48E1 / DSP48E2).
pub struct DspMapper;

pub struct MappedDspResult {
    pub cells: Vec<SynthesizedCell>,
    pub mapped_assign_targets: Vec<crate::bir::NetId>,
}

impl DspMapper {
    /// Inspects continuous assignments and clocked processes for multiplier and MAC patterns.
    pub fn map_dsp_blocks(
        circuit: &BirCircuit,
        family: FpgaFamily,
    ) -> MappedDspResult {
        let mut cells = Vec::new();
        let mut mapped_assign_targets = Vec::new();

        let prim_kind = if family.supports_carry8() || family == FpgaFamily::VirtualSilicon {
            PrimitiveKind::Dsp48e2
        } else {
            PrimitiveKind::Dsp48e1
        };

        // 1. Continuous Assignments: assign p = a * b; or assign p = c + (a * b);
        for (idx, assign) in circuit.continuous_assigns.iter().enumerate() {
            let target_net = match circuit.get_net(assign.target) {
                Some(n) => n,
                None => continue,
            };

            // Only infer DSP if target or operand width is >= 4 bits
            if target_net.width < 4 {
                continue;
            }

            if let Some((lhs_name, rhs_name, addend_name)) = Self::extract_mult_or_mac(circuit, &assign.expr) {
                let cell_name = format!("dsp_{}_{}", target_net.name, idx);
                let mut ports = HashMap::new();
                ports.insert("A".to_string(), lhs_name.clone());
                ports.insert("B".to_string(), rhs_name.clone());
                ports.insert("P".to_string(), target_net.name.clone());
                ports.insert("CLK".to_string(), "1'b0".to_string());
                ports.insert("CE".to_string(), "1'b1".to_string());
                ports.insert("RST".to_string(), "1'b0".to_string());

                let mut params = HashMap::new();
                params.insert("AREG".to_string(), 0);
                params.insert("BREG".to_string(), 0);
                params.insert("PREG".to_string(), 0);

                let equation = if let Some(c_name) = addend_name {
                    ports.insert("C".to_string(), c_name.clone());
                    params.insert("USE_MULT".to_string(), 1);
                    Some(format!("P = {c_name} + ({lhs_name} * {rhs_name})"))
                } else {
                    params.insert("USE_MULT".to_string(), 1);
                    Some(format!("P = {lhs_name} * {rhs_name}"))
                };

                cells.push(SynthesizedCell {
                    id: format!("cell_{cell_name}"),
                    name: cell_name,
                    kind: prim_kind,
                    scope: "top".to_string(),
                    ports,
                    params,
                    equation,
                    source_line: None,
                    delay_ps: 850.0,
                });

                mapped_assign_targets.push(assign.target);
            }
        }

        // 2. Clocked Processes: always @(posedge clk) p <= a * b; or p <= p + a * b;
        for (proc_idx, proc) in circuit.processes.iter().enumerate() {
            let clk_net_name = proc.triggers.iter().find_map(|t| {
                if t.edge == EdgeKind::Posedge || t.edge == EdgeKind::Negedge {
                    circuit.get_net(t.net).map(|n| n.name.clone())
                } else {
                    None
                }
            }).unwrap_or_else(|| "clk".to_string());

            Self::extract_dsp_from_statements(circuit, &proc.body, &clk_net_name, proc_idx, prim_kind, &mut cells);
        }

        MappedDspResult {
            cells,
            mapped_assign_targets,
        }
    }

    fn extract_mult_or_mac(
        circuit: &BirCircuit,
        expr: &BirExpr,
    ) -> Option<(String, String, Option<String>)> {
        match expr {
            BirExpr::Binary { op: BinaryOp::Mul, lhs, rhs } => {
                let l = Self::expr_net_name(circuit, lhs);
                let r = Self::expr_net_name(circuit, rhs);
                Some((l, r, None))
            }
            BirExpr::Binary { op: BinaryOp::Add, lhs, rhs } => {
                if let BirExpr::Binary { op: BinaryOp::Mul, lhs: ml, rhs: mr } = lhs.as_ref() {
                    let l = Self::expr_net_name(circuit, ml);
                    let r = Self::expr_net_name(circuit, mr);
                    let c = Self::expr_net_name(circuit, rhs);
                    Some((l, r, Some(c)))
                } else if let BirExpr::Binary { op: BinaryOp::Mul, lhs: ml, rhs: mr } = rhs.as_ref() {
                    let l = Self::expr_net_name(circuit, ml);
                    let r = Self::expr_net_name(circuit, mr);
                    let c = Self::expr_net_name(circuit, lhs);
                    Some((l, r, Some(c)))
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    fn extract_dsp_from_statements(
        circuit: &BirCircuit,
        stmts: &[BirStatement],
        clk_name: &str,
        proc_idx: usize,
        prim_kind: PrimitiveKind,
        cells: &mut Vec<SynthesizedCell>,
    ) {
        for stmt in stmts {
            match stmt {
                BirStatement::Assign { target, expr, .. } => {
                    let target_net = match circuit.get_net(*target) {
                        Some(n) => n,
                        None => continue,
                    };
                    if target_net.width < 4 {
                        continue;
                    }

                    if let Some((lhs_name, rhs_name, addend)) = Self::extract_mult_or_mac(circuit, expr) {
                        let cell_name = format!("dsp_reg_{}_{}", target_net.name, proc_idx);
                        let mut ports = HashMap::new();
                        ports.insert("A".to_string(), lhs_name.clone());
                        ports.insert("B".to_string(), rhs_name.clone());
                        ports.insert("P".to_string(), target_net.name.clone());
                        ports.insert("CLK".to_string(), clk_name.to_string());
                        ports.insert("CE".to_string(), "1'b1".to_string());
                        ports.insert("RST".to_string(), "1'b0".to_string());

                        let mut params = HashMap::new();
                        params.insert("AREG".to_string(), 1);
                        params.insert("BREG".to_string(), 1);
                        params.insert("PREG".to_string(), 1);
                        params.insert("USE_MULT".to_string(), 1);

                        let equation = if let Some(c_name) = addend {
                            ports.insert("C".to_string(), c_name.clone());
                            Some(format!("P <= {c_name} + ({lhs_name} * {rhs_name})"))
                        } else {
                            Some(format!("P <= {lhs_name} * {rhs_name}"))
                        };

                        cells.push(SynthesizedCell {
                            id: format!("cell_{cell_name}"),
                            name: cell_name,
                            kind: prim_kind,
                            scope: "top".to_string(),
                            ports,
                            params,
                            equation,
                            source_line: None,
                            delay_ps: 450.0,
                        });
                    }
                }
                BirStatement::If { then_body, else_body, .. } => {
                    Self::extract_dsp_from_statements(circuit, then_body, clk_name, proc_idx, prim_kind, cells);
                    Self::extract_dsp_from_statements(circuit, else_body, clk_name, proc_idx, prim_kind, cells);
                }
                BirStatement::Block(inner) => {
                    Self::extract_dsp_from_statements(circuit, inner, clk_name, proc_idx, prim_kind, cells);
                }
            }
        }
    }

    fn expr_net_name(circuit: &BirCircuit, expr: &BirExpr) -> String {
        match expr {
            BirExpr::Net(id) => circuit.get_net(*id).map(|n| n.name.clone()).unwrap_or_else(|| format!("net_{}", id.0)),
            BirExpr::Const(vec) => format!("{}'h{:x}", vec.width(), vec.to_u64().unwrap_or(0)),
            BirExpr::Slice { target, lsb, width } => {
                let base = Self::expr_net_name(circuit, target);
                if *width == 1 {
                    format!("{base}[{lsb}]")
                } else {
                    format!("{base}[{}:{lsb}]", lsb + width - 1)
                }
            }
            _ => "wire".to_string(),
        }
    }
}
