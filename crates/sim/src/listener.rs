use betterado_core::{LogicVector, SimTime};
use betterado_ir::NetId;
use crate::glitch::GlitchEvent;

/// Callback interface for observing discrete simulation events and state transitions.
pub trait SimEventListener: Send + Sync {
    fn on_signal_change(
        &mut self,
        _net: NetId,
        _net_name: &str,
        _val: &LogicVector,
        _time: SimTime,
        _delta: u32,
    ) {}

    fn on_delta_cycle_finished(&mut self, _time: SimTime, _delta: u32) {}

    fn on_glitch_detected(&mut self, _glitch: &GlitchEvent) {}
}

/// In-memory trace recorder that captures transition history for verification and waveforms.
#[derive(Debug, Default, Clone)]
pub struct SimTraceRecorder {
    pub traces: Vec<TraceEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraceEntry {
    pub time: SimTime,
    pub delta: u32,
    pub net: NetId,
    pub net_name: String,
    pub value: LogicVector,
}

impl SimTraceRecorder {
    pub fn new() -> Self {
        Self { traces: Vec::new() }
    }

    pub fn clear(&mut self) {
        self.traces.clear();
    }
}

impl SimEventListener for SimTraceRecorder {
    fn on_signal_change(
        &mut self,
        net: NetId,
        net_name: &str,
        val: &LogicVector,
        time: SimTime,
        delta: u32,
    ) {
        self.traces.push(TraceEntry {
            time,
            delta,
            net,
            net_name: net_name.to_string(),
            value: val.clone(),
        });
    }
}
