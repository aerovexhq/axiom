pub mod bir;
pub mod elaborator;

pub use bir::*;
pub use elaborator::{ElaborationError, Elaborator};
pub use betterado_syntax::EdgeKind;

use betterado_syntax::SourceFile;

/// Elaborates a parsed HDL source file into a concrete BIR circuit.
pub fn elaborate(source: &SourceFile, top_name: &str) -> Result<BirCircuit, ElaborationError> {
    Elaborator::elaborate(source, top_name)
}

#[cfg(test)]
mod tests;
