pub mod autopipeline;
pub mod cdc;
pub mod constraints;
pub mod delay_model;
pub mod graph;
pub mod propagation;
pub mod report;
pub mod sdc_parser;
pub mod slack;
pub mod types;
pub mod waterfall;

pub use autopipeline::{AutoPipelineRecommendation, AutoPipeliner, PipelineCutCandidate};
pub use cdc::CdcAnalyzer;
pub use constraints::{ClockConstraint, TimingConstraints};
pub use delay_model::DelayModel;
pub use graph::{TimingEdge, TimingGraph, TimingNode, TimingNodeKind};
pub use propagation::TimingPropagator;
pub use report::format_ascii_report;
pub use sdc_parser::SdcParser;
pub use slack::SlackCalculator;
pub use types::{
    CdcClassification, CdcCrossing, DelayPair, HistogramBin, PathSegment, PinRole,
    SlackRadarSummary, StaOptions, TimingCorner, TimingEdgeId, TimingNodeId, TimingPath,
};
pub use waterfall::WaterfallAnalyzer;

use axiom_ir::BirCircuit;

/// Comprehensive Static Timing Analysis entrypoint for an elaborated circuit.
pub fn analyze_circuit(
    circuit: &BirCircuit,
    sdc_content: &str,
    options: Option<StaOptions>,
) -> SlackRadarSummary {
    let options = options.unwrap_or_default();
    let constraints = SdcParser::parse(sdc_content);
    let delay_model = DelayModel::new(&options.target_device);

    let mut graph = TimingGraph::build_from_circuit(circuit, &delay_model);

    let target_clock_period_ps = constraints
        .clocks
        .first()
        .map(|c| c.period_ps)
        .unwrap_or(options.default_clock_period_ps);

    let mut propagator = TimingPropagator::new(
        &mut graph,
        &constraints,
        &delay_model,
        target_clock_period_ps,
    );
    propagator.propagate();
    let worst_incoming = propagator.worst_incoming_edges;

    let cdc_analyzer = CdcAnalyzer::new(circuit, &constraints);
    let cdc_crossings = cdc_analyzer.analyze();

    let calculator = SlackCalculator::new(
        &graph,
        &constraints,
        &delay_model,
        &worst_incoming,
        target_clock_period_ps,
        cdc_crossings,
    );

    calculator.calculate_summary()
}
