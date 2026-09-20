use serde::{Deserialize, Serialize};

/// Strongly typed identifier for a timing graph node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct TimingNodeId(pub u32);

/// Strongly typed identifier for a cell/primitive pin.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct TimingPinId(pub u32);

/// Strongly typed identifier for a timing graph edge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct TimingEdgeId(pub u32);

/// Role of a pin within a sequential cell, primitive, or net.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PinRole {
    Clock,
    DataIn,
    DataOut,
    Reset,
    Enable,
    LogicIn,
    LogicOut,
}

/// Early and late corner delay pair in picoseconds.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct DelayPair {
    pub min_ps: f32, // Early corner (Fast silicon / Hold check)
    pub max_ps: f32, // Late corner (Slow silicon / Setup check)
}

impl DelayPair {
    pub const ZERO: Self = Self {
        min_ps: 0.0,
        max_ps: 0.0,
    };

    pub fn new(min_ps: f32, max_ps: f32) -> Self {
        Self { min_ps, max_ps }
    }

    pub fn uniform(ps: f32) -> Self {
        Self {
            min_ps: ps,
            max_ps: ps,
        }
    }

    pub fn add(&self, other: &DelayPair) -> DelayPair {
        DelayPair {
            min_ps: self.min_ps + other.min_ps,
            max_ps: self.max_ps + other.max_ps,
        }
    }
}

/// Analysis corner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimingCorner {
    Early,
    Late,
}

/// Visual segment in the Critical Path Slack Waterfall.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathSegment {
    pub name: String,
    pub segment_type: String, // "clock", "cell", "net", "port"
    pub delay_ps: f32,
    pub total_delay_ps: f32,
    pub fanout: u32,
    pub details: String,
}

/// Complete startpoint-to-endpoint timing path with segment details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingPath {
    pub id: String,
    pub startpoint: String,
    pub endpoint: String,
    pub launch_clock: String,
    pub capture_clock: String,
    pub slack_ps: f32,
    pub hold_slack_ps: f32,
    pub data_delay_ps: f32,
    pub logic_delay_ps: f32,
    pub wire_delay_ps: f32,
    pub logic_levels: u32,
    pub clock_period_ps: f32,
    pub segments: Vec<PathSegment>,
    pub is_multicycle: bool,
    pub is_false_path: bool,
}

/// Histogram bin for slack distribution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistogramBin {
    pub range_label: String,
    pub count: u32,
    pub is_negative: bool,
}

/// Clock Domain Crossing (CDC) classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CdcClassification {
    Safe,
    Hazard,
    Constrained,
}

/// Verified CDC Crossing record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CdcCrossing {
    pub id: String,
    pub source_clk: String,
    pub dest_clk: String,
    pub source_reg: String,
    pub dest_reg: String,
    pub stages: u32,
    pub classification: CdcClassification,
    pub latency_ns: f32,
}

/// Comprehensive Static Timing Analysis Radar Summary payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackRadarSummary {
    pub worst_negative_slack_ps: f32,
    pub total_negative_slack_ps: f32,
    pub worst_hold_slack_ps: f32,
    pub total_hold_slack_ps: f32,
    pub fmax_mhz: f32,
    pub clock_period_ps: f32,
    pub logic_levels: u32,
    pub logic_delay_percent: f32,
    pub wire_delay_percent: f32,
    pub critical_path: TimingPath,
    pub all_paths: Vec<TimingPath>,
    pub histogram: Vec<HistogramBin>,
    pub cdc_crossings: Vec<CdcCrossing>,
}

/// Options to configure the Static Timing Analysis pass.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaOptions {
    pub default_clock_period_ps: f32,
    pub target_device: String,
    pub enable_wire_load_model: bool,
}

impl Default for StaOptions {
    fn default() -> Self {
        Self {
            default_clock_period_ps: 10_000.0, // 100 MHz
            target_device: "ultrascale".to_string(),
            enable_wire_load_model: true,
        }
    }
}
