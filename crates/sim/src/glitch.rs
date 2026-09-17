use betterado_core::{LogicVector, SimTime};
use betterado_ir::NetId;
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Type of combinational glitch detected during zero-time delta cycles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GlitchKind {
    /// Signal momentarily pulsed and returned to its initial state (0 -> 1 -> 0 or 1 -> 0 -> 1)
    StaticHazard {
        initial: LogicVector,
        intermediate: LogicVector,
    },
    /// Signal underwent multiple transitions within delta cycles before settling
    DynamicHazard {
        transitions: u32,
    },
}

/// Information about a detected combinational glitch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GlitchEvent {
    pub net: NetId,
    pub net_name: String,
    pub time: SimTime,
    pub kind: GlitchKind,
    pub history: Vec<(u32, LogicVector)>,
}

/// Tracks zero-time delta transitions and identifies combinational glitches.
#[derive(Debug, Clone)]
pub struct GlitchDetector {
    current_time: SimTime,
    /// NetId -> history of (delta, value) within the current physical SimTime
    step_history: HashMap<NetId, Vec<(u32, LogicVector)>>,
    /// Glitches detected during simulation
    detected_glitches: Vec<GlitchEvent>,
}

impl Default for GlitchDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl GlitchDetector {
    pub fn new() -> Self {
        Self {
            current_time: SimTime::ZERO,
            step_history: HashMap::new(),
            detected_glitches: Vec::new(),
        }
    }

    /// Records a signal value change at a given (time, delta).
    pub fn record_transition(
        &mut self,
        net: NetId,
        val: LogicVector,
        time: SimTime,
        delta: u32,
    ) {
        if time != self.current_time {
            self.finalize_time_step();
            self.current_time = time;
        }

        let entry = self.step_history.entry(net).or_default();
        if entry.is_empty() || entry.last().map(|(_, v)| v != &val).unwrap_or(true) {
            entry.push((delta, val));
        }
    }

    /// Evaluates all recorded transitions for the current time step and returns newly detected glitches.
    pub fn finalize_time_step(&mut self) -> Vec<GlitchEvent> {
        let mut new_glitches = Vec::new();

        for (&net, history) in &self.step_history {
            if history.len() >= 3 {
                // If the signal started at A, transitioned to B, and returned to A:
                let first = &history.first().unwrap().1;
                let last = &history.last().unwrap().1;

                let kind = if first == last {
                    GlitchKind::StaticHazard {
                        initial: first.clone(),
                        intermediate: history[1].1.clone(),
                    }
                } else {
                    GlitchKind::DynamicHazard {
                        transitions: history.len() as u32 - 1,
                    }
                };

                let event = GlitchEvent {
                    net,
                    net_name: format!("net_{:?}", net),
                    time: self.current_time,
                    kind,
                    history: history.clone(),
                };

                new_glitches.push(event);
            }
        }

        self.detected_glitches.extend(new_glitches.clone());
        self.step_history.clear();
        new_glitches
    }

    pub fn glitches(&self) -> &[GlitchEvent] {
        &self.detected_glitches
    }

    pub fn clear(&mut self) {
        self.step_history.clear();
        self.detected_glitches.clear();
    }
}
