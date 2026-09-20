pub mod alu_detector;
pub mod datapath_detector;
pub mod fsm_detector;
pub mod layout;
pub mod mem_detector;
pub mod types;

#[cfg(test)]
mod tests;

pub use alu_detector::AluDetector;
pub use datapath_detector::DatapathDetector;
pub use fsm_detector::FsmDetector;
pub use layout::LayoutEngine;
pub use mem_detector::MemDetector;
pub use types::*;

use crate::bir::BirCircuit;
use axiom_syntax::ast::SourceFile;

/// Synthesizes a high-level micro-architectural block diagram from an elaborated BIR circuit and optional AST.
pub fn synthesize_microarch(circuit: &BirCircuit, source: Option<&SourceFile>) -> MicroarchGraph {
    let mut blocks = Vec::new();

    if let Some(src) = source {
        if let Some(top_mod) = src.modules.iter().find(|m| m.name == circuit.top_name) {
            // 1. Detect FSMs
            blocks.extend(FsmDetector::detect_fsms(top_mod, circuit));

            // 2. Detect ALUs
            blocks.extend(AluDetector::detect_alus(top_mod, circuit));

            // 3. Detect Register Files & Memories
            blocks.extend(MemDetector::detect_memories(top_mod, circuit));

            // 4. Detect Datapath Elements (PC, Decoders, Counters, DSP)
            blocks.extend(DatapathDetector::detect_datapath_elements(top_mod, circuit));
        }
    }

    // Fallback if no macros were detected (e.g. pure combinational gate circuit like logic_circuit)
    if blocks.is_empty() {
        let mut inputs = Vec::new();
        let mut outputs = Vec::new();

        for net in &circuit.nets {
            if !net.name.contains('.') {
                if net.name.starts_with('A') || net.name.starts_with('B') || net.name.starts_with('C') || net.name.contains("in") {
                    inputs.push(MacroPort {
                        id: format!("in_{}", net.name),
                        name: net.name.clone(),
                        width: net.width,
                        direction: MacroPortDirection::In,
                        is_clock: net.name.contains("clk"),
                        is_reset: net.name.contains("rst"),
                        is_datapath: net.width > 1,
                        offset_x: 0.0,
                        offset_y: 20.0 + (inputs.len() as f32 * 20.0),
                    });
                } else if net.name == "F" || net.name.contains("out") {
                    outputs.push(MacroPort {
                        id: format!("out_{}", net.name),
                        name: net.name.clone(),
                        width: net.width,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: net.width > 1,
                        offset_x: 180.0,
                        offset_y: 40.0,
                    });
                }
            }
        }

        blocks.push(MacroBlock {
            id: "comb_logic_system".to_string(),
            name: circuit.top_name.clone(),
            label: "Combinational Logic System".to_string(),
            sublabel: format!("Boolean Network ({} Nets)", circuit.nets.len()),
            category: MacroCategory::Datapath,
            kind: MacroKind::Generic(GenericMacro {
                name: circuit.top_name.clone(),
                description: "Optimized gate-level logic network".to_string(),
            }),
            inputs,
            outputs,
            x: 50.0,
            y: 100.0,
            width: 180.0,
            height: 100.0,
            clock_domain: None,
            latency_cycles: 0,
            source_line: None,
        });
    }

    LayoutEngine::layout_graph(&circuit.top_name, blocks)
}
