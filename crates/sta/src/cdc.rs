use crate::constraints::TimingConstraints;
use crate::types::{CdcClassification, CdcCrossing};
use axiom_ir::{BirCircuit, BirProcessKind, BirStatement, NetId};
use hashbrown::{HashMap, HashSet};

/// Clock Domain Crossing (CDC) Analyzer.
pub struct CdcAnalyzer<'a> {
    pub circuit: &'a BirCircuit,
    pub constraints: &'a TimingConstraints,
}

#[derive(Debug, Clone)]
struct RegisterInfo {
    pub name: String,
    pub clock_name: String,
    pub q_net: NetId,
    pub d_nets: Vec<NetId>,
}

impl<'a> CdcAnalyzer<'a> {
    pub fn new(circuit: &'a BirCircuit, constraints: &'a TimingConstraints) -> Self {
        Self {
            circuit,
            constraints,
        }
    }

    /// Analyze circuit and detect all Clock Domain Crossings.
    pub fn analyze(&self) -> Vec<CdcCrossing> {
        let registers = self.extract_registers();
        let mut crossings = Vec::new();

        // Map Q-net to source register
        let mut q_net_to_reg: HashMap<NetId, &RegisterInfo> = HashMap::new();
        for reg in &registers {
            q_net_to_reg.insert(reg.q_net, reg);
        }

        let mut crossing_idx = 0;
        let mut seen_pairs: HashSet<(String, String)> = HashSet::new();

        for dest_reg in &registers {
            for &d_net in &dest_reg.d_nets {
                // Find where d_net comes from
                let mut source_q_nets = Vec::new();
                self.trace_back_to_q_nets(d_net, &mut source_q_nets, &mut HashSet::new());

                for src_q in source_q_nets {
                    if let Some(src_reg) = q_net_to_reg.get(&src_q) {
                        if src_reg.clock_name != dest_reg.clock_name {
                            let pair = (src_reg.name.clone(), dest_reg.name.clone());
                            if seen_pairs.contains(&pair) {
                                continue;
                            }
                            seen_pairs.insert(pair);

                            // Determine synchronizer stages and classification
                            let (stages, classification) = self.classify_cdc(src_reg, dest_reg, &registers);

                            let dest_clk_period_ns = self
                                .constraints
                                .find_clock(&dest_reg.clock_name)
                                .map(|c| c.period_ps / 1000.0)
                                .unwrap_or(10.0);

                            let latency_ns = dest_clk_period_ns * (stages as f32);

                            crossings.push(CdcCrossing {
                                id: format!("cdc_{}", crossing_idx),
                                source_clk: src_reg.clock_name.clone(),
                                dest_clk: dest_reg.clock_name.clone(),
                                source_reg: src_reg.name.clone(),
                                dest_reg: dest_reg.name.clone(),
                                stages,
                                classification,
                                latency_ns,
                            });
                            crossing_idx += 1;
                        }
                    }
                }
            }
        }

        crossings
    }

    fn extract_registers(&self) -> Vec<RegisterInfo> {
        let mut registers = Vec::new();

        for proc in &self.circuit.processes {
            if proc.kind == BirProcessKind::Clocked {
                let clk_net_id = proc.triggers.first().map(|t| t.net);
                let clk_name = clk_net_id
                    .and_then(|id| self.circuit.get_net(id))
                    .map(|n| n.name.clone())
                    .unwrap_or_else(|| "clk".to_string());

                let mut reg_to_reads: HashMap<NetId, Vec<NetId>> = HashMap::new();
                for stmt in &proc.body {
                    collect_stmt_target_and_reads(stmt, &mut reg_to_reads);
                }

                for (q_net_id, d_nets) in reg_to_reads {
                    let reg_name = self
                        .circuit
                        .get_net(q_net_id)
                        .map(|n| n.name.clone())
                        .unwrap_or_else(|| format!("reg_{}", q_net_id.0));

                    registers.push(RegisterInfo {
                        name: reg_name,
                        clock_name: clk_name.clone(),
                        q_net: q_net_id,
                        d_nets,
                    });
                }
            }
        }

        // Also check primitives (FDRE, etc.)
        for prim in &self.circuit.primitive_instances {
            if prim.primitive_kind == axiom_ir::PrimitiveKind::Fdre
                || prim.primitive_kind == axiom_ir::PrimitiveKind::Fdse
                || prim.primitive_kind == axiom_ir::PrimitiveKind::Fdce
                || prim.primitive_kind == axiom_ir::PrimitiveKind::Fdpe
            {
                let clk_name = prim
                    .ports
                    .get("C")
                    .and_then(|id| self.circuit.get_net(*id))
                    .map(|n| n.name.clone())
                    .unwrap_or_else(|| "clk".to_string());

                if let (Some(&q_net), Some(&d_net)) = (prim.ports.get("Q"), prim.ports.get("D")) {
                    registers.push(RegisterInfo {
                        name: prim.name.clone(),
                        clock_name: clk_name,
                        q_net,
                        d_nets: vec![d_net],
                    });
                }
            }
        }

        registers
    }

    fn trace_back_to_q_nets(&self, net: NetId, out: &mut Vec<NetId>, visited: &mut HashSet<NetId>) {
        if visited.contains(&net) {
            return;
        }
        visited.insert(net);

        // Check if net is directly driven by a register Q
        out.push(net);

        // Also check if net is driven by a continuous assign
        for ca in &self.circuit.continuous_assigns {
            if ca.target == net {
                let mut read_nets = Vec::new();
                collect_expr_read_nets(&ca.expr, &mut read_nets);
                for rn in read_nets {
                    self.trace_back_to_q_nets(rn, out, visited);
                }
            }
        }
    }

    fn classify_cdc(
        &self,
        src_reg: &RegisterInfo,
        dest_reg: &RegisterInfo,
        all_regs: &[RegisterInfo],
    ) -> (u32, CdcClassification) {
        // 1. Check if asynchronous clock group constraint applies
        if self.constraints.are_clocks_asynchronous(&src_reg.clock_name, &dest_reg.clock_name)
            || self.constraints.is_false_path(&src_reg.name, &dest_reg.name, None)
        {
            return (2, CdcClassification::Constrained);
        }

        // 2. Check if dest_reg is part of a 2-FF or 3-FF synchronizer chain:
        // A synchronizer chain has dest_reg feeding another register in the same clock domain
        // with naming convention like "*_sync1", "*_sync2", "*_meta", "*_sync", "r1", "r2".
        let is_sync_named = dest_reg.name.contains("sync")
            || dest_reg.name.contains("meta")
            || dest_reg.name.contains("cdc")
            || dest_reg.name.ends_with("_r1")
            || dest_reg.name.ends_with("_r2");

        // Check if there is a second flop in the destination clock domain
        let has_second_stage = all_regs.iter().any(|r| {
            r.clock_name == dest_reg.clock_name && r.d_nets.contains(&dest_reg.q_net)
        });

        if is_sync_named || has_second_stage {
            let stages = 2;
            (stages, CdcClassification::Safe)
        } else {
            // Unsynchronized direct crossing: Metastability Hazard!
            (1, CdcClassification::Hazard)
        }
    }
}

fn collect_stmt_target_and_reads(stmt: &BirStatement, map: &mut HashMap<NetId, Vec<NetId>>) {
    match stmt {
        BirStatement::Assign { target, expr, .. } => {
            let entry = map.entry(*target).or_default();
            collect_expr_read_nets(expr, entry);
        }
        BirStatement::If {
            cond,
            then_body,
            else_body,
        } => {
            let mut cond_reads = Vec::new();
            collect_expr_read_nets(cond, &mut cond_reads);
            for s in then_body {
                collect_stmt_target_and_reads(s, map);
            }
            for s in else_body {
                collect_stmt_target_and_reads(s, map);
            }
            for entry in map.values_mut() {
                for cr in &cond_reads {
                    if !entry.contains(cr) {
                        entry.push(*cr);
                    }
                }
            }
        }
        BirStatement::Block(stmts) => {
            for s in stmts {
                collect_stmt_target_and_reads(s, map);
            }
        }
    }
}

fn collect_expr_read_nets(expr: &axiom_ir::BirExpr, out: &mut Vec<NetId>) {
    match expr {
        axiom_ir::BirExpr::Net(id) => out.push(*id),
        axiom_ir::BirExpr::Const(_) => {}
        axiom_ir::BirExpr::Binary { lhs, rhs, .. } => {
            collect_expr_read_nets(lhs, out);
            collect_expr_read_nets(rhs, out);
        }
        axiom_ir::BirExpr::Unary { expr, .. } => {
            collect_expr_read_nets(expr, out);
        }
        axiom_ir::BirExpr::Slice { target, .. } => {
            collect_expr_read_nets(target, out);
        }
        axiom_ir::BirExpr::Concat(items) => {
            for item in items {
                collect_expr_read_nets(item, out);
            }
        }
    }
}
