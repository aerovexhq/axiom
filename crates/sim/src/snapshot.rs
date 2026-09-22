use std::collections::VecDeque;
use axiom_core::SimTime;
use axiom_jit::SimStateArena;
use crate::assertion::AssertionEvaluator;
use crate::event::StratifiedEventQueue;
use crate::glitch::GlitchDetector;

/// Unique identifier for an in-memory simulation checkpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
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
    pub assertion_evaluator: AssertionEvaluator,
}

/// A circular bounded buffer of simulation snapshots for time-travel replay.
#[derive(Debug, Clone)]
pub struct SnapshotRingBuffer {
    pub capacity: usize,
    pub min_interval_ps: u64,
    snapshots: VecDeque<SimSnapshot>,
    next_id: u64,
}

impl SnapshotRingBuffer {
    pub fn new(capacity: usize, min_interval_ps: u64) -> Self {
        Self {
            capacity: capacity.max(8),
            min_interval_ps,
            snapshots: VecDeque::with_capacity(capacity.min(512)),
            next_id: 1,
        }
    }

    pub fn push(
        &mut self,
        time: SimTime,
        delta: u32,
        arena: SimStateArena,
        event_queue: StratifiedEventQueue,
        glitch_detector: GlitchDetector,
        assertion_evaluator: AssertionEvaluator,
    ) -> CheckpointId {
        let id = CheckpointId(self.next_id);
        self.next_id += 1;

        if self.snapshots.len() >= self.capacity {
            self.snapshots.pop_front();
        }

        self.snapshots.push_back(SimSnapshot {
            id,
            time,
            delta,
            arena,
            event_queue,
            glitch_detector,
            assertion_evaluator,
        });

        id
    }

    pub fn should_record_time(&self, time: SimTime) -> bool {
        if let Some(last) = self.snapshots.back() {
            if time.as_ps() < last.time.as_ps() {
                return true;
            }
            time.as_ps().saturating_sub(last.time.as_ps()) >= self.min_interval_ps
        } else {
            true
        }
    }

    pub fn find_prev_delta(&self, current_time: SimTime, current_delta: u32) -> Option<&SimSnapshot> {
        self.snapshots
            .iter()
            .rev()
            .find(|snap| snap.time < current_time || (snap.time == current_time && snap.delta < current_delta))
    }

    pub fn find_prev_time(&self, current_time: SimTime, dt_ps: u64) -> Option<&SimSnapshot> {
        let target_ps = current_time.as_ps().saturating_sub(dt_ps);
        self.find_closest_before(SimTime::from_ps(target_ps))
    }

    pub fn find_closest_before(&self, target_time: SimTime) -> Option<&SimSnapshot> {
        let mut best: Option<&SimSnapshot> = None;
        for snap in &self.snapshots {
            if snap.time <= target_time {
                best = Some(snap);
            } else {
                break;
            }
        }
        best
    }

    pub fn get_by_id(&self, id: CheckpointId) -> Option<&SimSnapshot> {
        self.snapshots.iter().find(|s| s.id == id)
    }

    pub fn len(&self) -> usize {
        self.snapshots.len()
    }

    pub fn is_empty(&self) -> bool {
        self.snapshots.is_empty()
    }

    pub fn clear(&mut self) {
        self.snapshots.clear();
    }

    pub fn snapshots(&self) -> &VecDeque<SimSnapshot> {
        &self.snapshots
    }
}

impl Default for SnapshotRingBuffer {
    fn default() -> Self {
        Self::new(256, 100)
    }
}
