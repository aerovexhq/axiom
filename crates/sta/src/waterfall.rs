use crate::delay_model::DelayModel;
use crate::graph::{TimingGraph, TimingNodeKind};
use crate::types::{HistogramBin, PathSegment, TimingEdgeId, TimingNodeId, TimingPath};

/// Critical path extractor and segment decomposer.
pub struct WaterfallAnalyzer<'a> {
    pub graph: &'a TimingGraph,
    pub delay_model: &'a DelayModel,
    pub worst_incoming_edges: &'a [Option<TimingEdgeId>],
}

impl<'a> WaterfallAnalyzer<'a> {
    pub fn new(
        graph: &'a TimingGraph,
        delay_model: &'a DelayModel,
        worst_incoming_edges: &'a [Option<TimingEdgeId>],
    ) -> Self {
        Self {
            graph,
            delay_model,
            worst_incoming_edges,
        }
    }

    /// Extract complete timing path ending at `endpoint_id`.
    pub fn extract_path(&self, endpoint_id: TimingNodeId, clock_period_ps: f32) -> TimingPath {
        let endpoint_node = &self.graph.nodes[endpoint_id.0 as usize];
        let slack_ps = endpoint_node.req_time.max_ps - endpoint_node.arr_time.max_ps;
        let hold_slack_ps = endpoint_node.arr_time.min_ps - endpoint_node.req_time.min_ps;

        let mut segments: Vec<PathSegment> = Vec::new();
        let mut curr_node_id = endpoint_id;
        let mut logic_delay_ps = 0.0f32;
        let mut wire_delay_ps = 0.0f32;
        let mut logic_levels = 0u32;
        let mut launch_clock = "clk".to_string();
        let mut capture_clock = "clk".to_string();

        if let TimingNodeKind::RegCapture { clk_name, .. } = &endpoint_node.kind {
            capture_clock = clk_name.clone();
        }

        // Backtrack from endpoint to startpoint
        let mut visited = hashbrown::HashSet::new();
        let mut path_edges = Vec::new();

        while let Some(Some(edge_id)) = self.worst_incoming_edges.get(curr_node_id.0 as usize) {
            if visited.contains(&curr_node_id) {
                break; // Prevent infinite cycle
            }
            visited.insert(curr_node_id);

            let edge = &self.graph.edges[edge_id.0 as usize];
            path_edges.push((edge, curr_node_id));
            curr_node_id = edge.from;
        }

        path_edges.reverse();

        // Check startpoint
        let start_node = &self.graph.nodes[curr_node_id.0 as usize];
        let startpoint_name = start_node.name.clone();

        match &start_node.kind {
            TimingNodeKind::RegLaunch { clk_name, .. } => {
                launch_clock = clk_name.clone();
                let clk_skew = self.delay_model.clock_tree_skew();
                let t_co = self.delay_model.ff_clock_to_q().max_ps;

                segments.push(PathSegment {
                    name: format!("Clock Skew ({})", launch_clock),
                    segment_type: "clock".to_string(),
                    delay_ps: clk_skew,
                    total_delay_ps: clk_skew,
                    fanout: 1,
                    details: "Launch clock distribution tree skew".to_string(),
                });

                segments.push(PathSegment {
                    name: format!("{} (Tco)", start_node.name),
                    segment_type: "cell".to_string(),
                    delay_ps: t_co,
                    total_delay_ps: clk_skew + t_co,
                    fanout: 1,
                    details: "Flip-flop clock-to-output propagation delay".to_string(),
                });
            }
            TimingNodeKind::PortInput { name, .. } => {
                let ibuf = self.delay_model.ibuf_delay().max_ps;
                segments.push(PathSegment {
                    name: format!("Port Input ({})", name),
                    segment_type: "port".to_string(),
                    delay_ps: ibuf,
                    total_delay_ps: ibuf,
                    fanout: 1,
                    details: "FPGA input pad & IBUF propagation delay".to_string(),
                });
            }
            _ => {}
        }

        let mut running_delay = segments.last().map(|s| s.total_delay_ps).unwrap_or(0.0);

        for (edge, to_node_id) in path_edges {
            let to_node = &self.graph.nodes[to_node_id.0 as usize];
            let delay = edge.delay.max_ps;
            running_delay += delay;

            if edge.is_wire {
                wire_delay_ps += delay;
                if edge.is_inter_die {
                    segments.push(PathSegment {
                        name: format!("Inter-Die SLL ({})", edge.label),
                        segment_type: "interposer".to_string(),
                        delay_ps: delay,
                        total_delay_ps: running_delay,
                        fanout: edge.fanout,
                        details: format!(
                            "Silicon Interposer SLL Boundary Crossing [{}] (fanout: {})",
                            edge.boundary_id.as_deref().unwrap_or("SLL"),
                            edge.fanout
                        ),
                    });
                } else {
                    segments.push(PathSegment {
                        name: format!("Net ({})", edge.label),
                        segment_type: "net".to_string(),
                        delay_ps: delay,
                        total_delay_ps: running_delay,
                        fanout: edge.fanout,
                        details: format!("Interconnect routing delay (fanout: {})", edge.fanout),
                    });
                }
            } else {
                logic_delay_ps += delay;
                logic_levels += 1;
                segments.push(PathSegment {
                    name: to_node.name.clone(),
                    segment_type: "cell".to_string(),
                    delay_ps: delay,
                    total_delay_ps: running_delay,
                    fanout: edge.fanout,
                    details: format!("Logic cell evaluation ({})", edge.label),
                });
            }
        }

        // Add capture setup window segment if RegCapture
        if let TimingNodeKind::RegCapture { .. } = &endpoint_node.kind {
            let t_setup = self.delay_model.ff_setup_time();
            segments.push(PathSegment {
                name: format!("{} (Tsetup)", endpoint_node.name),
                segment_type: "cell".to_string(),
                delay_ps: t_setup,
                total_delay_ps: running_delay + t_setup,
                fanout: 1,
                details: "Capture register data setup window requirement".to_string(),
            });
        }

        let total_data_delay = logic_delay_ps + wire_delay_ps;

        TimingPath {
            id: format!("path_{}", endpoint_id.0),
            startpoint: startpoint_name,
            endpoint: endpoint_node.name.clone(),
            launch_clock,
            capture_clock,
            slack_ps,
            hold_slack_ps,
            data_delay_ps: total_data_delay,
            logic_delay_ps,
            wire_delay_ps,
            logic_levels,
            clock_period_ps,
            segments,
            is_multicycle: false,
            is_false_path: false,
        }
    }
}

/// Compute 5-bin histogram classifying slack margins.
pub fn compute_slack_histogram(paths: &[TimingPath]) -> Vec<HistogramBin> {
    let mut bin_neg = 0;
    let mut bin_crit = 0;
    let mut bin_warn = 0;
    let mut bin_health = 0;
    let mut bin_rob = 0;

    for path in paths {
        let slack_ns = path.slack_ps / 1000.0;
        if slack_ns < 0.0 {
            bin_neg += 1;
        } else if slack_ns < 1.0 {
            bin_crit += 1;
        } else if slack_ns < 3.0 {
            bin_warn += 1;
        } else if slack_ns < 5.0 {
            bin_health += 1;
        } else {
            bin_rob += 1;
        }
    }

    vec![
        HistogramBin {
            range_label: "< 0.0 ns (VIOLATION)".to_string(),
            count: bin_neg,
            is_negative: true,
        },
        HistogramBin {
            range_label: "0.0 - 1.0 ns (CRITICAL)".to_string(),
            count: bin_crit,
            is_negative: false,
        },
        HistogramBin {
            range_label: "1.0 - 3.0 ns (WARNING)".to_string(),
            count: bin_warn,
            is_negative: false,
        },
        HistogramBin {
            range_label: "3.0 - 5.0 ns (HEALTHY)".to_string(),
            count: bin_health,
            is_negative: false,
        },
        HistogramBin {
            range_label: "> 5.0 ns (ROBUST)".to_string(),
            count: bin_rob,
            is_negative: false,
        },
    ]
}
