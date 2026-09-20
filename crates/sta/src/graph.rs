use crate::delay_model::DelayModel;
use crate::types::{DelayPair, TimingEdgeId, TimingNodeId};
use axiom_ir::{
    BirCircuit, BirExpr, BirProcessKind, BirStatement, NetId, PrimitiveKind,
};
use hashbrown::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

/// Type of timing node in the graph.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TimingNodeKind {
    PortInput {
        net_id: NetId,
        name: String,
    },
    PortOutput {
        net_id: NetId,
        name: String,
    },
    RegLaunch {
        reg_name: String,
        clk_name: String,
        q_net: NetId,
    },
    RegCapture {
        reg_name: String,
        clk_name: String,
        d_net: NetId,
    },
    CellLogic {
        name: String,
        out_net: NetId,
        op: String,
    },
    Primitive {
        name: String,
        kind: PrimitiveKind,
        out_net: NetId,
    },
}

/// A node (vertex) in the timing Directed Acyclic Graph (DAG).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingNode {
    pub id: TimingNodeId,
    pub name: String,
    pub kind: TimingNodeKind,
    pub incoming_edges: Vec<TimingEdgeId>,
    pub outgoing_edges: Vec<TimingEdgeId>,
    /// Arrival time calculated during forward pass (early/late) in ps
    pub arr_time: DelayPair,
    /// Required time calculated during backward pass (early/late) in ps
    pub req_time: DelayPair,
    /// Logic depth from nearest startpoint
    pub logic_depth: u32,
    /// Originating startpoint node ID for the critical path arriving here
    pub startpoint: Option<TimingNodeId>,
}

/// A directed edge connecting two timing nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingEdge {
    pub id: TimingEdgeId,
    pub from: TimingNodeId,
    pub to: TimingNodeId,
    pub delay: DelayPair,
    pub is_wire: bool,
    pub fanout: u32,
    pub label: String,
    pub is_inter_die: bool,
    pub boundary_id: Option<String>,
}

/// Directed Acyclic Graph of all timing paths in the circuit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingGraph {
    pub nodes: Vec<TimingNode>,
    pub edges: Vec<TimingEdge>,
    pub startpoints: Vec<TimingNodeId>,
    pub endpoints: Vec<TimingNodeId>,
    pub net_to_launch_node: HashMap<NetId, TimingNodeId>,
    pub net_to_driver_node: HashMap<NetId, TimingNodeId>,
    pub net_fanouts: HashMap<NetId, u32>,
}

impl TimingGraph {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            edges: Vec::new(),
            startpoints: Vec::new(),
            endpoints: Vec::new(),
            net_to_launch_node: HashMap::new(),
            net_to_driver_node: HashMap::new(),
            net_fanouts: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, name: impl Into<String>, kind: TimingNodeKind) -> TimingNodeId {
        let id = TimingNodeId(self.nodes.len() as u32);
        let node = TimingNode {
            id,
            name: name.into(),
            kind,
            incoming_edges: Vec::new(),
            outgoing_edges: Vec::new(),
            arr_time: DelayPair::ZERO,
            req_time: DelayPair::ZERO,
            logic_depth: 0,
            startpoint: None,
        };
        self.nodes.push(node);
        id
    }

    pub fn add_edge(
        &mut self,
        from: TimingNodeId,
        to: TimingNodeId,
        delay: DelayPair,
        is_wire: bool,
        fanout: u32,
        label: impl Into<String>,
    ) -> TimingEdgeId {
        let id = TimingEdgeId(self.edges.len() as u32);
        let edge = TimingEdge {
            id,
            from,
            to,
            delay,
            is_wire,
            fanout,
            label: label.into(),
            is_inter_die: false,
            boundary_id: None,
        };
        self.edges.push(edge);
        self.nodes[from.0 as usize].outgoing_edges.push(id);
        self.nodes[to.0 as usize].incoming_edges.push(id);
        id
    }

    pub fn add_inter_die_edge(
        &mut self,
        from: TimingNodeId,
        to: TimingNodeId,
        delay: DelayPair,
        fanout: u32,
        label: impl Into<String>,
        boundary_id: impl Into<String>,
    ) -> TimingEdgeId {
        let id = TimingEdgeId(self.edges.len() as u32);
        let edge = TimingEdge {
            id,
            from,
            to,
            delay,
            is_wire: true,
            fanout,
            label: label.into(),
            is_inter_die: true,
            boundary_id: Some(boundary_id.into()),
        };
        self.edges.push(edge);
        self.nodes[from.0 as usize].outgoing_edges.push(id);
        self.nodes[to.0 as usize].incoming_edges.push(id);
        id
    }

    /// Build TimingGraph directly from an elaborated BirCircuit.
    pub fn build_from_circuit(circuit: &BirCircuit, delay_model: &DelayModel) -> Self {
        let mut graph = Self::new();

        // 1. Calculate fanout for all nets in the circuit
        let mut net_readers: HashMap<NetId, u32> = HashMap::new();
        for ca in &circuit.continuous_assigns {
            let mut read_nets = Vec::new();
            collect_expr_nets(&ca.expr, &mut read_nets);
            for rn in read_nets {
                *net_readers.entry(rn).or_insert(0) += 1;
            }
        }
        for proc in &circuit.processes {
            for trig in &proc.triggers {
                *net_readers.entry(trig.net).or_insert(0) += 1;
            }
            let mut read_nets = Vec::new();
            for stmt in &proc.body {
                collect_stmt_read_nets(stmt, &mut read_nets);
            }
            for rn in read_nets {
                *net_readers.entry(rn).or_insert(0) += 1;
            }
        }
        for prim in &circuit.primitive_instances {
            for (pin, net_id) in &prim.ports {
                if !is_primitive_output_pin(prim.primitive_kind, pin) {
                    *net_readers.entry(*net_id).or_insert(0) += 1;
                }
            }
        }
        graph.net_fanouts = net_readers;

        // 2. Identify Primary Inputs, Outputs, and Clock Nets
        let mut written_nets = HashSet::new();
        for ca in &circuit.continuous_assigns {
            written_nets.insert(ca.target);
        }
        for proc in &circuit.processes {
            let mut w_nets = Vec::new();
            for stmt in &proc.body {
                collect_stmt_written_nets(stmt, &mut w_nets);
            }
            for wn in w_nets {
                written_nets.insert(wn);
            }
        }
        for prim in &circuit.primitive_instances {
            for (pin, net_id) in &prim.ports {
                if is_primitive_output_pin(prim.primitive_kind, pin) {
                    written_nets.insert(*net_id);
                }
            }
        }

        let mut clock_nets = HashSet::new();
        for proc in &circuit.processes {
            if proc.kind == BirProcessKind::Clocked {
                for trig in &proc.triggers {
                    clock_nets.insert(trig.net);
                }
            }
        }

        // Register primary input nodes
        for net in &circuit.nets {
            let is_clk = clock_nets.contains(&net.id) || net.name.contains("clk");
            let is_undriven = !written_nets.contains(&net.id);

            if is_undriven && !is_clk {
                // Primary data input port
                let node_id = graph.add_node(
                    format!("port_in:{}", net.name),
                    TimingNodeKind::PortInput {
                        net_id: net.id,
                        name: net.name.clone(),
                    },
                );
                graph.startpoints.push(node_id);
                graph.net_to_driver_node.insert(net.id, node_id);
            }
        }

        // 3. Process Primitives (FDRE, LUT, DSP, BRAM, BUFG, CARRY)
        for prim in &circuit.primitive_instances {
            match prim.primitive_kind {
                PrimitiveKind::Fdre
                | PrimitiveKind::Fdse
                | PrimitiveKind::Fdce
                | PrimitiveKind::Fdpe => {
                    let clk_net_id = prim.ports.get("C").copied();
                    let clk_name = clk_net_id
                        .and_then(|id| circuit.get_net(id))
                        .map(|n| n.name.clone())
                        .unwrap_or_else(|| "clk".to_string());

                    if let Some(q_net) = prim.ports.get("Q").copied() {
                        let launch_id = graph.add_node(
                            format!("{}:Q", prim.name),
                            TimingNodeKind::RegLaunch {
                                reg_name: prim.name.clone(),
                                clk_name: clk_name.clone(),
                                q_net,
                            },
                        );
                        graph.startpoints.push(launch_id);
                        graph.net_to_launch_node.insert(q_net, launch_id);
                        graph.net_to_driver_node.insert(q_net, launch_id);
                    }

                    if let Some(d_net) = prim.ports.get("D").copied() {
                        let capture_id = graph.add_node(
                            format!("{}:D", prim.name),
                            TimingNodeKind::RegCapture {
                                reg_name: prim.name.clone(),
                                clk_name: clk_name.clone(),
                                d_net,
                            },
                        );
                        graph.endpoints.push(capture_id);
                    }
                }

                PrimitiveKind::Dsp48e2 | PrimitiveKind::Dsp48e1 => {
                    let clk_name = prim
                        .ports
                        .get("CLK")
                        .and_then(|id| circuit.get_net(*id))
                        .map(|n| n.name.clone())
                        .unwrap_or_else(|| "clk".to_string());

                    if let Some(p_net) = prim.ports.get("P").copied() {
                        let launch_id = graph.add_node(
                            format!("{}:P", prim.name),
                            TimingNodeKind::RegLaunch {
                                reg_name: prim.name.clone(),
                                clk_name,
                                q_net: p_net,
                            },
                        );
                        graph.startpoints.push(launch_id);
                        graph.net_to_launch_node.insert(p_net, launch_id);
                        graph.net_to_driver_node.insert(p_net, launch_id);
                    }
                }

                PrimitiveKind::Ramb36e2 | PrimitiveKind::Ramb18e2 => {
                    let clk_name = prim
                        .ports
                        .get("CLKARDCLK")
                        .or_else(|| prim.ports.get("CLK"))
                        .and_then(|id| circuit.get_net(*id))
                        .map(|n| n.name.clone())
                        .unwrap_or_else(|| "clk".to_string());

                    for (pin, &out_net) in &prim.ports {
                        if pin.starts_with("DOUT") {
                            let launch_id = graph.add_node(
                                format!("{}:{}", prim.name, pin),
                                TimingNodeKind::RegLaunch {
                                    reg_name: format!("{}_{}", prim.name, pin),
                                    clk_name: clk_name.clone(),
                                    q_net: out_net,
                                },
                            );
                            graph.startpoints.push(launch_id);
                            graph.net_to_launch_node.insert(out_net, launch_id);
                            graph.net_to_driver_node.insert(out_net, launch_id);
                        }
                    }
                }

                PrimitiveKind::Lut1
                | PrimitiveKind::Lut2
                | PrimitiveKind::Lut3
                | PrimitiveKind::Lut4
                | PrimitiveKind::Lut5
                | PrimitiveKind::Lut6
                | PrimitiveKind::Lut6_2
                | PrimitiveKind::Carry4
                | PrimitiveKind::Carry8 => {
                    for (pin, &out_net) in &prim.ports {
                        if pin == "O" || pin == "O5" || pin == "O6" || pin == "CO" {
                            let prim_node = graph.add_node(
                                format!("{}:{}", prim.name, pin),
                                TimingNodeKind::Primitive {
                                    name: prim.name.clone(),
                                    kind: prim.primitive_kind,
                                    out_net,
                                },
                            );
                            graph.net_to_driver_node.insert(out_net, prim_node);
                        }
                    }
                }

                PrimitiveKind::Bufg | PrimitiveKind::Bufgce | PrimitiveKind::Ibuf | PrimitiveKind::Obuf => {
                    if let Some(out_net) = prim.ports.get("O").copied() {
                        let prim_node = graph.add_node(
                            format!("{}:O", prim.name),
                            TimingNodeKind::Primitive {
                                name: prim.name.clone(),
                                kind: prim.primitive_kind,
                                out_net,
                            },
                        );
                        graph.net_to_driver_node.insert(out_net, prim_node);
                    }
                }
            }
        }

        // 4. Process Combinational Logic & Continuous Assignments
        for ca in &circuit.continuous_assigns {
            let target_net = ca.target;
            let target_name = circuit
                .get_net(target_net)
                .map(|n| n.name.clone())
                .unwrap_or_else(|| format!("net_{}", target_net.0));

            let (op_name, read_nets, logic_delay) = analyze_bir_expr(&ca.expr, delay_model, circuit);

            let logic_node = graph.add_node(
                format!("gate:{}", target_name),
                TimingNodeKind::CellLogic {
                    name: format!("assign_{}", target_name),
                    out_net: target_net,
                    op: op_name.clone(),
                },
            );
            graph.net_to_driver_node.insert(target_net, logic_node);

            // Connect inputs to logic node
            for rn in read_nets {
                if let Some(&driver_node) = graph.net_to_driver_node.get(&rn) {
                    let fanout = *graph.net_fanouts.get(&rn).unwrap_or(&1);
                    let wire_delay = delay_model.wire_delay(fanout);
                    let total_edge_delay = wire_delay.add(&logic_delay);

                    graph.add_edge(
                        driver_node,
                        logic_node,
                        total_edge_delay,
                        false,
                        fanout,
                        format!("{} -> {}", rn.0, target_name),
                    );
                }
            }
        }

        // 5. Process Sequential Registers from Clocked Processes
        for proc in &circuit.processes {
            if proc.kind == BirProcessKind::Clocked {
                let clk_net_id = proc.triggers.first().map(|t| t.net);
                let clk_name = clk_net_id
                    .and_then(|id| circuit.get_net(id))
                    .map(|n| n.name.clone())
                    .unwrap_or_else(|| "clk".to_string());

                for stmt in &proc.body {
                    process_clocked_stmt(stmt, &mut graph, &clk_name, circuit, delay_model, None);
                }
            }
        }

        // 6. Connect Primary Outputs
        for net in &circuit.nets {
            let is_clk = clock_nets.contains(&net.id) || net.name.contains("clk");
            // If net is driven and is not read by anything else or has output naming convention
            let fanout = *graph.net_fanouts.get(&net.id).unwrap_or(&0);
            if (!is_clk && fanout == 0 && written_nets.contains(&net.id))
                || net.name.starts_with("led")
                || net.name.starts_with("tx")
                || net.name == "F"
                || net.name.starts_with("out")
            {
                let out_node = graph.add_node(
                    format!("port_out:{}", net.name),
                    TimingNodeKind::PortOutput {
                        net_id: net.id,
                        name: net.name.clone(),
                    },
                );
                graph.endpoints.push(out_node);

                if let Some(&driver_node) = graph.net_to_driver_node.get(&net.id) {
                    let obuf_delay = delay_model.obuf_delay();
                    let wire_delay = delay_model.wire_delay(fanout);
                    let total_delay = wire_delay.add(&obuf_delay);

                    graph.add_edge(
                        driver_node,
                        out_node,
                        total_delay,
                        false,
                        fanout,
                        format!("net_{} -> out_port", net.name),
                    );
                }
            }
        }

        graph
    }
}

fn collect_expr_nets(expr: &BirExpr, out: &mut Vec<NetId>) {
    match expr {
        BirExpr::Net(id) => out.push(*id),
        BirExpr::Const(_) => {}
        BirExpr::Binary { lhs, rhs, .. } => {
            collect_expr_nets(lhs, out);
            collect_expr_nets(rhs, out);
        }
        BirExpr::Unary { expr, .. } => {
            collect_expr_nets(expr, out);
        }
        BirExpr::Slice { target, .. } => {
            collect_expr_nets(target, out);
        }
        BirExpr::Concat(items) => {
            for item in items {
                collect_expr_nets(item, out);
            }
        }
    }
}

fn collect_stmt_read_nets(stmt: &BirStatement, out: &mut Vec<NetId>) {
    match stmt {
        BirStatement::Assign { expr, .. } => {
            collect_expr_nets(expr, out);
        }
        BirStatement::If {
            cond,
            then_body,
            else_body,
        } => {
            collect_expr_nets(cond, out);
            for s in then_body {
                collect_stmt_read_nets(s, out);
            }
            for s in else_body {
                collect_stmt_read_nets(s, out);
            }
        }
        BirStatement::Block(stmts) => {
            for s in stmts {
                collect_stmt_read_nets(s, out);
            }
        }
    }
}

fn collect_stmt_written_nets(stmt: &BirStatement, out: &mut Vec<NetId>) {
    match stmt {
        BirStatement::Assign { target, .. } => {
            out.push(*target);
        }
        BirStatement::If {
            then_body,
            else_body,
            ..
        } => {
            for s in then_body {
                collect_stmt_written_nets(s, out);
            }
            for s in else_body {
                collect_stmt_written_nets(s, out);
            }
        }
        BirStatement::Block(stmts) => {
            for s in stmts {
                collect_stmt_written_nets(s, out);
            }
        }
    }
}

fn is_primitive_output_pin(kind: PrimitiveKind, pin: &str) -> bool {
    match kind {
        PrimitiveKind::Fdre
        | PrimitiveKind::Fdse
        | PrimitiveKind::Fdce
        | PrimitiveKind::Fdpe => pin == "Q",
        PrimitiveKind::Lut1
        | PrimitiveKind::Lut2
        | PrimitiveKind::Lut3
        | PrimitiveKind::Lut4
        | PrimitiveKind::Lut5
        | PrimitiveKind::Lut6 => pin == "O",
        PrimitiveKind::Lut6_2 => pin == "O" || pin == "O5" || pin == "O6",
        PrimitiveKind::Bufg | PrimitiveKind::Bufgce | PrimitiveKind::Ibuf | PrimitiveKind::Obuf => {
            pin == "O"
        }
        PrimitiveKind::Carry4 | PrimitiveKind::Carry8 => pin == "CO" || pin == "O",
        PrimitiveKind::Dsp48e2 | PrimitiveKind::Dsp48e1 => pin == "P",
        PrimitiveKind::Ramb36e2 | PrimitiveKind::Ramb18e2 => pin.starts_with("DOUT"),
    }
}

fn analyze_bir_expr(
    expr: &BirExpr,
    delay_model: &DelayModel,
    circuit: &BirCircuit,
) -> (String, Vec<NetId>, DelayPair) {
    let mut read_nets = Vec::new();
    collect_expr_nets(expr, &mut read_nets);

    let (op_name, delay) = match expr {
        BirExpr::Net(id) => {
            let name = circuit.get_net(*id).map(|n| n.name.as_str()).unwrap_or("net");
            (format!("buf({})", name), DelayPair::ZERO)
        }
        BirExpr::Const(_) => ("const".to_string(), DelayPair::ZERO),
        BirExpr::Binary { op, lhs, .. } => {
            let bit_width = match &**lhs {
                BirExpr::Net(id) => circuit.get_net(*id).map(|n| n.width).unwrap_or(1),
                _ => 1,
            };
            (format!("{:?}", op), delay_model.binary_op_delay(*op, bit_width))
        }
        BirExpr::Unary { op, .. } => (format!("{:?}", op), delay_model.lut_delay(1)),
        BirExpr::Slice { .. } => ("slice".to_string(), DelayPair::ZERO),
        BirExpr::Concat(_) => ("concat".to_string(), DelayPair::ZERO),
    };

    (op_name, read_nets, delay)
}

fn process_clocked_stmt(
    stmt: &BirStatement,
    graph: &mut TimingGraph,
    clk_name: &str,
    circuit: &BirCircuit,
    delay_model: &DelayModel,
    cond_driver: Option<TimingNodeId>,
) {
    match stmt {
        BirStatement::Assign { target, expr, .. } => {
            let target_name = circuit
                .get_net(*target)
                .map(|n| n.name.clone())
                .unwrap_or_else(|| format!("reg_{}", target.0));

            // Launch Node
            let _launch_id = if let Some(&existing_launch) = graph.net_to_launch_node.get(target) {
                existing_launch
            } else {
                let lid = graph.add_node(
                    format!("reg_q:{}", target_name),
                    TimingNodeKind::RegLaunch {
                        reg_name: target_name.clone(),
                        clk_name: clk_name.to_string(),
                        q_net: *target,
                    },
                );
                graph.startpoints.push(lid);
                graph.net_to_launch_node.insert(*target, lid);
                graph.net_to_driver_node.insert(*target, lid);
                lid
            };

            // Capture Node
            let capture_id = graph.add_node(
                format!("reg_d:{}", target_name),
                TimingNodeKind::RegCapture {
                    reg_name: target_name.clone(),
                    clk_name: clk_name.to_string(),
                    d_net: *target,
                },
            );
            graph.endpoints.push(capture_id);

            // Connect RHS expr to capture_id
            match expr {
                BirExpr::Net(rn) => {
                    if let Some(&driver_node) = graph.net_to_driver_node.get(rn) {
                        let fanout = *graph.net_fanouts.get(rn).unwrap_or(&1);
                        let wire_delay = delay_model.wire_delay(fanout);
                        graph.add_edge(
                            driver_node,
                            capture_id,
                            wire_delay,
                            true,
                            fanout,
                            format!("net_{} -> reg_d:{}", rn.0, target_name),
                        );
                    }
                }
                BirExpr::Const(_) => {
                    // Constant assignment, self loop or zero delay
                }
                _ => {
                    let (op_name, read_nets, logic_delay) = analyze_bir_expr(expr, delay_model, circuit);
                    let logic_node = graph.add_node(
                        format!("d_gate:{}", target_name),
                        TimingNodeKind::CellLogic {
                            name: format!("{}_eval", target_name),
                            out_net: *target,
                            op: op_name,
                        },
                    );

                    for rn in read_nets {
                        if let Some(&driver_node) = graph.net_to_driver_node.get(&rn) {
                            let fanout = *graph.net_fanouts.get(&rn).unwrap_or(&1);
                            let wire_delay = delay_model.wire_delay(fanout);
                            let total_delay = wire_delay.add(&logic_delay);
                            graph.add_edge(
                                driver_node,
                                logic_node,
                                total_delay,
                                false,
                                fanout,
                                format!("{} -> {}", rn.0, target_name),
                            );
                        }
                    }

                    // Connect logic_node to capture_id
                    let wire_delay = delay_model.wire_delay(1);
                    graph.add_edge(
                        logic_node,
                        capture_id,
                        wire_delay,
                        true,
                        1,
                        format!("logic -> reg_d:{}", target_name),
                    );
                }
            }

            // If inside If block, connect mux select delay from cond_driver
            if let Some(cd) = cond_driver {
                let mux_delay = delay_model.lut_delay(2);
                graph.add_edge(
                    cd,
                    capture_id,
                    mux_delay,
                    false,
                    1,
                    format!("cond_mux -> reg_d:{}", target_name),
                );
            }
        }
        BirStatement::If {
            cond,
            then_body,
            else_body,
        } => {
            let mut cond_nets = Vec::new();
            collect_expr_nets(cond, &mut cond_nets);
            let first_cond_driver = cond_nets
                .first()
                .and_then(|rn| graph.net_to_driver_node.get(rn).copied());

            for s in then_body {
                process_clocked_stmt(s, graph, clk_name, circuit, delay_model, first_cond_driver);
            }
            for s in else_body {
                process_clocked_stmt(s, graph, clk_name, circuit, delay_model, first_cond_driver);
            }
        }
        BirStatement::Block(stmts) => {
            for s in stmts {
                process_clocked_stmt(s, graph, clk_name, circuit, delay_model, cond_driver);
            }
        }
    }
}
