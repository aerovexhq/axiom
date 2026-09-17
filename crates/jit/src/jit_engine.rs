use crate::arena::SimStateArena;
#[cfg(feature = "native-jit")]
use crate::compiler::{CraneliftJit, NativeBlockFn};
use crate::portable::{PortableEvaluator, ProcessEvalOutput};
use axiom_core::LogicVector;
use axiom_ir::{BirCircuit, ProcessId};

/// Fully compiled, executable hardware circuit in RAM.
pub struct CompiledCircuit {
    pub circuit: BirCircuit,
    pub arena: SimStateArena,
    #[cfg(feature = "native-jit")]
    pub compiled_assigns: Vec<Option<NativeBlockFn>>,
}

impl CompiledCircuit {
    /// Evaluates a continuous assignment by index.
    /// Runs native machine code if compiled, falling back to portable evaluator.
    /// Returns `true` if the target net changed state.
    pub fn eval_continuous_assign(&mut self, assign_idx: usize) -> bool {
        #[cfg(feature = "native-jit")]
        {
            if let Some(Some(native_fn)) = self.compiled_assigns.get(assign_idx) {
                let changed = unsafe {
                    native_fn(self.arena.values_ptr(), self.arena.masks_ptr())
                };
                return changed != 0;
            }
        }

        if let Some(assign) = self.circuit.continuous_assigns.get(assign_idx) {
            PortableEvaluator::eval_continuous_assign(assign, &self.circuit, &mut self.arena)
        } else {
            false
        }
    }

    /// Evaluates a procedural process by ID, returning scheduled Non-Blocking Assignments (NBAs) and blocking changes.
    pub fn eval_process(&mut self, proc_id: ProcessId) -> ProcessEvalOutput {
        if let Some(proc) = self.circuit.processes.get(proc_id.0 as usize) {
            PortableEvaluator::eval_process(proc, &self.circuit, &mut self.arena)
        } else {
            ProcessEvalOutput::default()
        }
    }

    /// Convenience helper to read a signal by hierarchical name.
    pub fn get_signal(&self, name: &str) -> Option<LogicVector> {
        let net = self.circuit.get_net_by_name(name)?;
        Some(self.arena.read_net(net))
    }

    /// Convenience helper to write stimulus to a signal by hierarchical name.
    pub fn set_signal(&mut self, name: &str, val: &LogicVector) -> bool {
        if let Some(net) = self.circuit.get_net_by_name(name).cloned() {
            self.arena.write_net(&net, val)
        } else {
            false
        }
    }
}

pub struct JitEngine;

impl JitEngine {
    /// In-RAM JIT compiler translating a `BirCircuit` into an executable `CompiledCircuit`.
    pub fn compile(circuit: BirCircuit) -> Result<CompiledCircuit, String> {
        let arena = SimStateArena::from_circuit(&circuit);

        #[cfg(feature = "native-jit")]
        {
            let mut jit = CraneliftJit::new()?;
            let mut compiled_assigns = Vec::with_capacity(circuit.continuous_assigns.len());

            for (idx, assign) in circuit.continuous_assigns.iter().enumerate() {
                let fn_name = format!("assign_{idx}");
                match jit.compile_continuous_assign(assign, &circuit, &fn_name) {
                    Ok(native_fn) => compiled_assigns.push(Some(native_fn)),
                    Err(_) => compiled_assigns.push(None),
                }
            }

            Ok(CompiledCircuit {
                circuit,
                arena,
                compiled_assigns,
            })
        }

        #[cfg(not(feature = "native-jit"))]
        {
            Ok(CompiledCircuit {
                circuit,
                arena,
            })
        }
    }
}
