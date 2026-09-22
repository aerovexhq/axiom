pub mod bir;
pub mod elaborator;
pub mod primitives;
pub mod microarch;
pub mod multidie;
pub mod synth;
pub mod floorplan;

pub use bir::*;
pub use elaborator::{ElaborationError, Elaborator};
pub use primitives::*;
pub use microarch::*;
pub use multidie::{
    estimate_circuit_modules, get_device_profile, partition_circuit, BoundaryUtilization, CutNet,
    DieBoundary, DieInfo, DieKind, DieResourceBudget, DieUtilization, InterconnectKind,
    ModuleResourceEstimate, MultiDieDevice, PartitionConfig, PartitionResult,
};
pub use synth::{
    synthesize, synthesize_from_ast, FpgaFamily, SynthConfig, SynthError, SynthesisStats,
    SynthesizedCell, SynthesizedCircuit, SynthesizedNet, SynthesizedPort,
};
pub use floorplan::{
    generate_floorplan, ClockRegionDef, CriticalPathHop, DeviceGrid, DieFloorplan, DieSite,
    HeatmapTile, PlacedCell, PlacedCriticalPath, SiteColumnDef, SiteType,
};
pub use axiom_syntax::EdgeKind;

use axiom_syntax::SourceFile;

/// Elaborates a parsed HDL source file into a concrete BIR circuit.
pub fn elaborate(source: &SourceFile, top_name: &str) -> Result<BirCircuit, ElaborationError> {
    Elaborator::elaborate(source, top_name)
}

#[cfg(test)]
mod tests;
