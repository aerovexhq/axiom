use betterado_core::SimTime;
use betterado_jit::SimStateArena;
use crate::event::StratifiedEventQueue;
use crate::glitch::GlitchDetector;

/// Unique identifier for an in-memory simulation checkpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CheckpointId(pub u64);

/// Full in-RAM snapshot of simulation state at a specific (time, delta) coordinate.
#[derive(Debug, Clone)]
pub struct SimSnapshot {
    pub id: CheckpointId,
    pub time: SimTime,
    pub delta: u32,
    pub arena: SimStateArena,
    pub event_queue: StratifiedEventQueue,
    pub glitch_detector: GlitchDetector,
}
