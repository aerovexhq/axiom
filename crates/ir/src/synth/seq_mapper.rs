use crate::bir::{BirCircuit, BirProcess, BirProcessKind, BirStatement, PrimitiveKind};
use crate::synth::types::SynthesizedCell;
use axiom_syntax::EdgeKind;
use hashbrown::HashMap;

/// Maps procedural clocked processes into physical Flip-Flop primitives (FDRE / FDCE).
pub struct SeqMapper;

pub struct MappedSeqResult {
    pub cells: Vec<SynthesizedCell>,
}

impl SeqMapper {
    pub fn map_clocked_process(
        circuit: &BirCircuit,
        proc: &BirProcess,
        proc_index: usize,
    ) -> MappedSeqResult {
        if proc.kind != BirProcessKind::Clocked {
            return MappedSeqResult { cells: Vec::new() };
        }

        let mut clk_net_name = "clk".to_string();
        let mut rst_net_name: Option<String> = None;
        let mut is_async_reset = false;

        for trigger in &proc.triggers {
            let net_name = circuit
                .get_net(trigger.net)
                .map(|n| n.name.clone())
                .unwrap_or_else(|| "clk".to_string());

            let is_clk_name = net_name.contains("clk") || net_name.contains("clock");
            if is_clk_name {
                clk_net_name = net_name;
            } else {
                rst_net_name = Some(net_name);
                if trigger.edge == EdgeKind::Posedge || trigger.edge == EdgeKind::Negedge {
                    is_async_reset = true;
                }
            }
        }

        let mut cells = Vec::new();

        // Extract assignments from process body
        let mut assigned_targets = Vec::new();
        Self::collect_assignments(&proc.body, &mut assigned_targets);

        for (target_id, maybe_en) in assigned_targets {
            let target_net = match circuit.get_net(target_id) {
                Some(n) => n,
                None => continue,
            };

            let width = target_net.width.max(1);
            let ce_pin_val = maybe_en.unwrap_or_else(|| "1'b1".to_string());
            let rst_pin_val = rst_net_name.clone().unwrap_or_else(|| "1'b0".to_string());

            let primitive_kind = if is_async_reset {
                PrimitiveKind::Fdce
            } else {
                PrimitiveKind::Fdre
            };

            if width == 1 {
                let cell_name = format!("{}_reg_{proc_index}", target_net.name);
                let mut ports = HashMap::new();
                ports.insert("C".to_string(), clk_net_name.clone());
                ports.insert("CE".to_string(), ce_pin_val.clone());
                if is_async_reset {
                    ports.insert("CLR".to_string(), rst_pin_val.clone());
                } else {
                    ports.insert("R".to_string(), rst_pin_val.clone());
                }
                ports.insert("D".to_string(), format!("{}_d", target_net.name));
                ports.insert("Q".to_string(), target_net.name.clone());

                let mut params = HashMap::new();
                params.insert("INIT".to_string(), 0);

                cells.push(SynthesizedCell {
                    id: format!("cell_{cell_name}"),
                    name: cell_name,
                    kind: primitive_kind,
                    scope: "top".to_string(),
                    ports,
                    params,
                    equation: None,
                    source_line: None,
                    delay_ps: 95.0,
                });
            } else {
                for bit in 0..width {
                    let cell_name = format!("{}_reg[{bit}]_{proc_index}", target_net.name);
                    let mut ports = HashMap::new();
                    ports.insert("C".to_string(), clk_net_name.clone());
                    ports.insert("CE".to_string(), ce_pin_val.clone());
                    if is_async_reset {
                        ports.insert("CLR".to_string(), rst_pin_val.clone());
                    } else {
                        ports.insert("R".to_string(), rst_pin_val.clone());
                    }
                    ports.insert("D".to_string(), format!("{}_d[{bit}]", target_net.name));
                    ports.insert("Q".to_string(), format!("{}[{bit}]", target_net.name));

                    let mut params = HashMap::new();
                    params.insert("INIT".to_string(), 0);

                    cells.push(SynthesizedCell {
                        id: format!("cell_{cell_name}"),
                        name: cell_name,
                        kind: primitive_kind,
                        scope: "top".to_string(),
                        ports,
                        params,
                        equation: None,
                        source_line: None,
                        delay_ps: 95.0,
                    });
                }
            }
        }

        MappedSeqResult { cells }
    }

    fn collect_assignments(
        stmts: &[BirStatement],
        out: &mut Vec<(crate::bir::NetId, Option<String>)>,
    ) {
        for stmt in stmts {
            match stmt {
                BirStatement::Assign { target, .. } => {
                    if !out.iter().any(|(t, _)| *t == *target) {
                        out.push((*target, None));
                    }
                }
                BirStatement::If {
                    then_body,
                    else_body,
                    ..
                } => {
                    Self::collect_assignments(then_body, out);
                    Self::collect_assignments(else_body, out);
                }
                BirStatement::Block(inner) => {
                    Self::collect_assignments(inner, out);
                }
            }
        }
    }
}
