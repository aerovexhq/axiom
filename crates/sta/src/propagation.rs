use crate::constraints::TimingConstraints;
use crate::delay_model::DelayModel;
use crate::graph::{TimingGraph, TimingNodeKind};
use crate::types::{DelayPair, TimingEdgeId, TimingNodeId};

/// Forward and backward topological timing propagation engine.
pub struct TimingPropagator<'a> {
    pub graph: &'a mut TimingGraph,
    pub constraints: &'a TimingConstraints,
    pub delay_model: &'a DelayModel,
    pub default_clock_period_ps: f32,
    pub worst_incoming_edges: Vec<Option<TimingEdgeId>>,
}

impl<'a> TimingPropagator<'a> {
    pub fn new(
        graph: &'a mut TimingGraph,
        constraints: &'a TimingConstraints,
        delay_model: &'a DelayModel,
        default_clock_period_ps: f32,
    ) -> Self {
        let node_count = graph.nodes.len();
        Self {
            graph,
            constraints,
            delay_model,
            default_clock_period_ps,
            worst_incoming_edges: vec![None; node_count],
        }
    }

    /// Execute forward and backward propagation passes.
    pub fn propagate(&mut self) {
        let topo_order = self.compute_topological_order();

        // 1. Forward Pass: Arrival Times (Early / Late)
        self.propagate_forward(&topo_order);

        // 2. Backward Pass: Required Times (Early / Late)
        self.propagate_backward(&topo_order);
    }

    fn compute_topological_order(&self) -> Vec<TimingNodeId> {
        let mut in_degrees = vec![0u32; self.graph.nodes.len()];
        for edge in &self.graph.edges {
            in_degrees[edge.to.0 as usize] += 1;
        }

        let mut queue = Vec::new();
        // Seed queue with nodes having in-degree 0 (includes startpoints)
        for (idx, &deg) in in_degrees.iter().enumerate() {
            if deg == 0 {
                queue.push(TimingNodeId(idx as u32));
            }
        }

        let mut order = Vec::with_capacity(self.graph.nodes.len());
        let mut head = 0;

        while head < queue.len() {
            let u = queue[head];
            head += 1;
            order.push(u);

            for &edge_id in &self.graph.nodes[u.0 as usize].outgoing_edges {
                let v = self.graph.edges[edge_id.0 as usize].to;
                let v_deg = &mut in_degrees[v.0 as usize];
                *v_deg = v_deg.saturating_sub(1);
                if *v_deg == 0 {
                    queue.push(v);
                }
            }
        }

        // Handle any disconnected or cyclic nodes
        if order.len() < self.graph.nodes.len() {
            for idx in 0..self.graph.nodes.len() {
                let id = TimingNodeId(idx as u32);
                if !order.contains(&id) {
                    order.push(id);
                }
            }
        }

        order
    }

    fn propagate_forward(&mut self, topo_order: &[TimingNodeId]) {
        // Initialize startpoints
        for &u in topo_order {
            let node_kind = self.graph.nodes[u.0 as usize].kind.clone();
            match &node_kind {
                TimingNodeKind::PortInput { name, .. } => {
                    // Check if input delay is defined in constraints
                    let input_delay = self
                        .constraints
                        .io_delays
                        .iter()
                        .find(|io| io.is_input && (io.port_name == *name || io.port_name == "*"))
                        .map(|io| io.delay_ps)
                        .unwrap_or(0.0);

                    let ibuf_delay = self.delay_model.ibuf_delay();
                    self.graph.nodes[u.0 as usize].arr_time = DelayPair::new(
                        input_delay + ibuf_delay.min_ps,
                        input_delay + ibuf_delay.max_ps,
                    );
                    self.graph.nodes[u.0 as usize].logic_depth = 0;
                    self.graph.nodes[u.0 as usize].startpoint = Some(u);
                }
                TimingNodeKind::RegLaunch { .. } => {
                    // Launch Clock Skew + Clock-to-Q Delay
                    let t_co = self.delay_model.ff_clock_to_q();
                    let clk_skew = self.delay_model.clock_tree_skew();
                    self.graph.nodes[u.0 as usize].arr_time = DelayPair::new(
                        0.0 + t_co.min_ps,
                        clk_skew + t_co.max_ps,
                    );
                    self.graph.nodes[u.0 as usize].logic_depth = 0;
                    self.graph.nodes[u.0 as usize].startpoint = Some(u);
                }
                _ => {}
            }

            // Propagate forward to destination nodes
            let u_arr = self.graph.nodes[u.0 as usize].arr_time;
            let u_depth = self.graph.nodes[u.0 as usize].logic_depth;
            let u_startpoint = self.graph.nodes[u.0 as usize].startpoint;
            let from_name = self.graph.nodes[u.0 as usize].name.clone();
            let outgoing_edges = self.graph.nodes[u.0 as usize].outgoing_edges.clone();

            for edge_id in outgoing_edges {
                let edge = self.graph.edges[edge_id.0 as usize].clone();
                let v = edge.to;

                let to_name = self.graph.nodes[v.0 as usize].name.clone();
                if self.constraints.is_false_path(&from_name, &to_name, None) {
                    continue;
                }

                let edge_delay = edge.delay;
                let cand_arr_late = u_arr.max_ps + edge_delay.max_ps;
                let cand_arr_early = u_arr.min_ps + edge_delay.min_ps;

                let v_node = &mut self.graph.nodes[v.0 as usize];

                if cand_arr_late > v_node.arr_time.max_ps || v_node.arr_time.max_ps == 0.0 {
                    v_node.arr_time.max_ps = cand_arr_late;
                    v_node.startpoint = u_startpoint;
                    self.worst_incoming_edges[v.0 as usize] = Some(edge_id);
                }
                if cand_arr_early < v_node.arr_time.min_ps || v_node.arr_time.min_ps == 0.0 {
                    v_node.arr_time.min_ps = cand_arr_early;
                }

                let new_depth = u_depth + if edge.is_wire { 0 } else { 1 };
                if new_depth > v_node.logic_depth {
                    v_node.logic_depth = new_depth;
                }
            }
        }
    }

    fn propagate_backward(&mut self, topo_order: &[TimingNodeId]) {
        // Initialize endpoints
        for &v in topo_order.iter().rev() {
            let node_kind = self.graph.nodes[v.0 as usize].kind.clone();

            match &node_kind {
                TimingNodeKind::PortOutput { name, .. } => {
                    let out_delay = self
                        .constraints
                        .io_delays
                        .iter()
                        .find(|io| !io.is_input && (io.port_name == *name || io.port_name == "*"))
                        .map(|io| io.delay_ps)
                        .unwrap_or(0.0);

                    let clk_period = self.get_target_clock_period();
                    // T_req_late = T_clk - T_out_delay
                    let req_late = clk_period - out_delay;
                    let req_early = out_delay;
                    self.graph.nodes[v.0 as usize].req_time = DelayPair::new(req_early, req_late);
                }
                TimingNodeKind::RegCapture { reg_name, clk_name, .. } => {
                    let clk_period = self
                        .constraints
                        .find_clock(clk_name)
                        .map(|c| c.period_ps)
                        .unwrap_or(self.default_clock_period_ps);

                    let start_name = self.graph.nodes[v.0 as usize]
                        .startpoint
                        .map(|id| self.graph.nodes[id.0 as usize].name.clone())
                        .unwrap_or_default();

                    let setup_mult = self.constraints.get_setup_multicycle(&start_name, reg_name).max(
                        self.constraints.get_setup_multicycle(&start_name, &self.graph.nodes[v.0 as usize].name)
                    ) as f32;
                    let hold_mult = self.constraints.get_hold_multicycle(&start_name, reg_name).max(
                        self.constraints.get_hold_multicycle(&start_name, &self.graph.nodes[v.0 as usize].name)
                    ) as f32;

                    let t_setup = self.delay_model.ff_setup_time();
                    let t_hold = self.delay_model.ff_hold_time();
                    let clk_skew = self.delay_model.clock_tree_skew();

                    // T_req_late = (T_clk * M_setup) + Skew - T_setup
                    let req_late = (clk_period * setup_mult) + clk_skew - t_setup;
                    // T_req_early = (T_clk * M_hold) + Skew + T_hold
                    let req_early = (clk_period * hold_mult) + clk_skew + t_hold;

                    self.graph.nodes[v.0 as usize].req_time = DelayPair::new(req_early, req_late);
                }
                _ => {}
            }

            // Backward propagation along incoming edges
            let v_req = self.graph.nodes[v.0 as usize].req_time;
            let incoming_edges = self.graph.nodes[v.0 as usize].incoming_edges.clone();

            for edge_id in incoming_edges {
                let edge = self.graph.edges[edge_id.0 as usize].clone();
                let u = edge.from;
                let u_node = &mut self.graph.nodes[u.0 as usize];

                let cand_req_late = v_req.max_ps - edge.delay.max_ps;
                let cand_req_early = v_req.min_ps - edge.delay.min_ps;

                if cand_req_late < u_node.req_time.max_ps || u_node.req_time.max_ps == 0.0 {
                    u_node.req_time.max_ps = cand_req_late;
                }
                if cand_req_early > u_node.req_time.min_ps || u_node.req_time.min_ps == 0.0 {
                    u_node.req_time.min_ps = cand_req_early;
                }
            }
        }
    }

    pub fn get_target_clock_period(&self) -> f32 {
        self.constraints
            .clocks
            .first()
            .map(|c| c.period_ps)
            .unwrap_or(self.default_clock_period_ps)
    }
}
