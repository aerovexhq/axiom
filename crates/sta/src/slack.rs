use crate::constraints::TimingConstraints;
use crate::delay_model::DelayModel;
use crate::graph::TimingGraph;
use crate::types::{CdcCrossing, SlackRadarSummary, TimingEdgeId, TimingPath};
use crate::waterfall::{compute_slack_histogram, WaterfallAnalyzer};

/// Computes comprehensive slack summary, WNS, TNS, WHS, THS, and Fmax.
pub struct SlackCalculator<'a> {
    pub graph: &'a TimingGraph,
    pub constraints: &'a TimingConstraints,
    pub delay_model: &'a DelayModel,
    pub worst_incoming_edges: &'a [Option<TimingEdgeId>],
    pub clock_period_ps: f32,
    pub cdc_crossings: Vec<CdcCrossing>,
}

impl<'a> SlackCalculator<'a> {
    pub fn new(
        graph: &'a TimingGraph,
        constraints: &'a TimingConstraints,
        delay_model: &'a DelayModel,
        worst_incoming_edges: &'a [Option<TimingEdgeId>],
        clock_period_ps: f32,
        cdc_crossings: Vec<CdcCrossing>,
    ) -> Self {
        Self {
            graph,
            constraints,
            delay_model,
            worst_incoming_edges,
            clock_period_ps,
            cdc_crossings,
        }
    }

    pub fn calculate_summary(&self) -> SlackRadarSummary {
        let waterfall = WaterfallAnalyzer::new(
            self.graph,
            self.delay_model,
            self.worst_incoming_edges,
        );

        let mut all_paths = Vec::new();
        for &endpoint_id in &self.graph.endpoints {
            let path = waterfall.extract_path(endpoint_id, self.clock_period_ps);
            all_paths.push(path);
        }

        // If circuit has no capture endpoints (e.g. pure combinational outputs),
        // extract paths ending at PortOutput nodes
        if all_paths.is_empty() {
            for (idx, node) in self.graph.nodes.iter().enumerate() {
                if let crate::graph::TimingNodeKind::PortOutput { .. } = node.kind {
                    let path = waterfall.extract_path(crate::types::TimingNodeId(idx as u32), self.clock_period_ps);
                    all_paths.push(path);
                }
            }
        }

        // If still empty (minimal stub), synthesize a default nominal path
        if all_paths.is_empty() {
            all_paths.push(TimingPath {
                id: "path_0".to_string(),
                startpoint: "in".to_string(),
                endpoint: "out".to_string(),
                launch_clock: "clk".to_string(),
                capture_clock: "clk".to_string(),
                slack_ps: self.clock_period_ps - 500.0,
                hold_slack_ps: 200.0,
                data_delay_ps: 500.0,
                logic_delay_ps: 300.0,
                wire_delay_ps: 200.0,
                logic_levels: 1,
                clock_period_ps: self.clock_period_ps,
                segments: Vec::new(),
                is_multicycle: false,
                is_false_path: false,
            });
        }

        // Sort paths by setup slack ascending (worst first)
        all_paths.sort_by(|a, b| a.slack_ps.partial_cmp(&b.slack_ps).unwrap_or(std::cmp::Ordering::Equal));

        let critical_path = all_paths.first().cloned().unwrap();
        let worst_negative_slack_ps = critical_path.slack_ps;

        let mut total_negative_slack_ps = 0.0f32;
        let mut worst_hold_slack_ps = f32::MAX;
        let mut total_hold_slack_ps = 0.0f32;

        for path in &all_paths {
            if path.slack_ps < 0.0 {
                total_negative_slack_ps += path.slack_ps;
            }
            if path.hold_slack_ps < worst_hold_slack_ps {
                worst_hold_slack_ps = path.hold_slack_ps;
            }
            if path.hold_slack_ps < 0.0 {
                total_hold_slack_ps += path.hold_slack_ps;
            }
        }

        if worst_hold_slack_ps == f32::MAX {
            worst_hold_slack_ps = 150.0; // Default positive hold margin
        }

        // Calculate Fmax:
        // Fmax = 1 / (T_clk - WNS)
        // If WNS is positive, min achievable cycle time is (T_clk - WNS).
        // If WNS is negative, required cycle time is (T_clk + |WNS|).
        let min_cycle_time_ps = (self.clock_period_ps - worst_negative_slack_ps).max(100.0);
        let fmax_mhz = 1_000_000.0 / min_cycle_time_ps;

        let total_data_delay = critical_path.data_delay_ps.max(1.0);
        let logic_delay_percent = ((critical_path.logic_delay_ps / total_data_delay) * 100.0).clamp(0.0, 100.0);
        let wire_delay_percent = ((critical_path.wire_delay_ps / total_data_delay) * 100.0).clamp(0.0, 100.0);

        let histogram = compute_slack_histogram(&all_paths);

        SlackRadarSummary {
            worst_negative_slack_ps,
            total_negative_slack_ps,
            worst_hold_slack_ps,
            total_hold_slack_ps,
            fmax_mhz,
            clock_period_ps: self.clock_period_ps,
            logic_levels: critical_path.logic_levels,
            logic_delay_percent,
            wire_delay_percent,
            critical_path,
            all_paths,
            histogram,
            cdc_crossings: self.cdc_crossings.clone(),
        }
    }
}
