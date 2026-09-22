pub mod bmc;
pub mod types;

pub use bmc::BoundedModelChecker;
pub use types::{
    CounterexampleTrace, FormalConfig, FormalEngineKind, FormalGoal, FormalGoalKind, FormalReport,
    FormalResultStatus, FormalTraceStep,
};

use axiom_ir::BirCircuit;
use crate::assertion::AssertionDef;

/// Runs formal property verification and bounded model checking on an elaborated circuit.
pub fn run_formal_verification(
    circuit: &BirCircuit,
    config: &FormalConfig,
    assertions: &[AssertionDef],
) -> FormalReport {
    let mut checker = BoundedModelChecker::new(circuit, config, assertions.to_vec());
    checker.check()
}
