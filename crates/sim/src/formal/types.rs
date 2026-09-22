use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Classification of verification goals in formal analysis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FormalGoalKind {
    Assert,
    Assume,
    Cover,
}

/// Outcome status of a formal verification goal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FormalResultStatus {
    /// Property is proven to hold up to the specified bounded depth (or unconditionally via k-induction).
    Proven,
    /// Property was violated; counterexample sequence has been generated.
    Falsified,
    /// Precondition of an implication property was never satisfied along any reachable path.
    Vacuous,
    /// Cover property target state was reached; witness execution trace has been generated.
    Covered,
    /// Cover property target state was not reached within the specified bounded depth.
    Unreached,
    /// Analysis was terminated due to timeout or resource limit before a conclusive result.
    Inconclusive,
}

/// Formal verification engine mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FormalEngineKind {
    /// Bounded Model Checking: unrolls transitions for k = 0..K cycles from initial state.
    Bmc,
    /// k-Induction: combines BMC base case with inductive step for unbounded proof.
    KInduction,
}

impl Default for FormalEngineKind {
    fn default() -> Self {
        Self::Bmc
    }
}

/// Configuration parameters for formal verification run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormalConfig {
    /// Maximum unrolling depth in clock cycles (default: 20).
    pub max_depth: u32,
    /// Timeout in milliseconds (0 for unlimited).
    pub timeout_ms: u64,
    /// Active engine mode.
    pub engine: FormalEngineKind,
    /// Number of initialization / reset cycles before active property checking.
    pub reset_cycles: u32,
    /// Name of clock net to drive sequential steps.
    pub clock_name: Option<String>,
    /// Name of active-low or active-high reset net.
    pub reset_name: Option<String>,
}

impl Default for FormalConfig {
    fn default() -> Self {
        Self {
            max_depth: 20,
            timeout_ms: 5000,
            engine: FormalEngineKind::Bmc,
            reset_cycles: 1,
            clock_name: None,
            reset_name: None,
        }
    }
}

/// Snapshot of circuit signal valuations at a specific formal execution cycle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FormalTraceStep {
    /// Cycle index (0, 1, ..., k).
    pub cycle: u32,
    /// Elapsed simulation time in picoseconds.
    pub time_ps: u64,
    /// Valuations of all active nets, keyed by net name (e.g. "rst_n" -> "1'b1", "state" -> "2'b01").
    pub signals: HashMap<String, String>,
}

/// Counterexample or witness trace documenting a verification sequence.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CounterexampleTrace {
    /// Target goal identifier.
    pub goal_id: String,
    /// Target goal name / label.
    pub goal_name: String,
    /// Cycle at which assertion failed or cover goal was witnessed.
    pub cycle_index: u32,
    /// Human-readable explanation of the violation or witness event.
    pub message: String,
    /// Ordered sequence of execution steps from cycle 0 to violation/witness cycle.
    pub steps: Vec<FormalTraceStep>,
}

/// Individual verification goal with outcome metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormalGoal {
    /// Unique identifier for the goal.
    pub id: String,
    /// Name or label (e.g. "req_grant_assert" or "p_fifo_overflow").
    pub name: String,
    /// Goal classification: Assert, Assume, Cover.
    pub kind: FormalGoalKind,
    /// Outcome status.
    pub status: FormalResultStatus,
    /// Verilog source code snippet defining the property.
    pub source_text: String,
    /// 1-indexed source line number, if available.
    pub line: Option<u32>,
    /// 1-indexed source column number, if available.
    pub col: Option<u32>,
    /// Maximum depth reached or cycle of falsification/witness.
    pub depth_reached: u32,
    /// Counterexample sequence if falsified, or witness sequence if covered.
    pub trace: Option<CounterexampleTrace>,
    /// Informational note / diagnostic summary.
    pub note: Option<String>,
}

/// Comprehensive formal verification report returned to studio.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FormalReport {
    /// Evaluated goals with status and counterexamples.
    pub goals: Vec<FormalGoal>,
    /// Total number of goals processed.
    pub total_goals: usize,
    /// Count of proven properties.
    pub proven_count: usize,
    /// Count of falsified properties.
    pub falsified_count: usize,
    /// Count of covered properties.
    pub covered_count: usize,
    /// Count of vacuous properties.
    pub vacuous_count: usize,
    /// Count of unreached cover goals.
    pub unreached_count: usize,
    /// Count of inconclusive goals.
    pub inconclusive_count: usize,
    /// Maximum search depth executed.
    pub max_depth: u32,
    /// Wall-clock execution time in milliseconds.
    pub execution_time_ms: f64,
    /// Top module verified.
    pub top_module: String,
}
