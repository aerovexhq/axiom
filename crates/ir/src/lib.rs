pub mod bir;
pub mod elaborator;
pub mod primitives;

pub use bir::*;
pub use elaborator::{ElaborationError, Elaborator};
pub use primitives::*;
pub use axiom_syntax::EdgeKind;

use axiom_syntax::SourceFile;

/// Elaborates a parsed HDL source file into a concrete BIR circuit.
pub fn elaborate(source: &SourceFile, top_name: &str) -> Result<BirCircuit, ElaborationError> {
    Elaborator::elaborate(source, top_name)
}

#[cfg(test)]
mod tests;
