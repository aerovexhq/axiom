use std::cmp::Ordering;
use std::collections::BinaryHeap;
use axiom_core::{LogicVector, SimTime};
use axiom_ir::{NetId, ProcessId};
use serde::{Deserialize, Serialize};

/// IEEE 1800 Stratified Event Queue regions ordered by execution precedence within a delta cycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum SchedRegion {
    /// Pre-Active region
    PreActive = 0,
    /// Active region: continuous assignments, combinational logic, blocking assignments, RHS evaluations
    Active = 1,
    /// Inactive region: `#0` procedural statements
    Inactive = 2,
    /// NBA (Non-Blocking Assignment) region: LHS variable/net updates
    Nba = 3,
    /// Observed region: concurrent assertions
    Observed = 4,
    /// Reactive region: program blocks, testbench verification
    Reactive = 5,
    /// Postponed region: value sampling for VCD, waveforms, and telemetry
    Postponed = 6,
}

/// Payload of a scheduled simulation event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventPayload {
    /// Evaluate continuous assignment at index in `circuit.continuous_assigns`
    EvalContinuousAssign(usize),
    /// Evaluate procedural process
    EvalProcess(ProcessId),
    /// Apply scheduled Non-Blocking Assignment
    ApplyNba {
        target: NetId,
        value: LogicVector,
    },
    /// Propagate value changes on a net to sensitive processes
    PropagateNet(NetId),
    /// Periodic clock generator toggle
    ClockToggle {
        net: NetId,
        half_period: SimTime,
    },
}

/// A discrete scheduled event in the simulation kernel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimEvent {
    /// Physical simulation time when event occurs
    pub time: SimTime,
    /// Discrete delta cycle within `time`
    pub delta: u32,
    /// IEEE 1800 queue region
    pub region: SchedRegion,
    /// Monotonically increasing sequence ID for FIFO order among identical keys
    pub seq_id: u64,
    /// Event action payload
    pub payload: EventPayload,
}

impl Ord for SimEvent {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse order so BinaryHeap acts as a min-heap:
        // Smallest time, then delta, then region, then seq_id pops first
        other.time.cmp(&self.time)
            .then_with(|| other.delta.cmp(&self.delta))
            .then_with(|| (other.region as u8).cmp(&(self.region as u8)))
            .then_with(|| other.seq_id.cmp(&self.seq_id))
    }
}

impl PartialOrd for SimEvent {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Priority min-heap managing stratified discrete events.
#[derive(Debug, Default, Clone)]
pub struct StratifiedEventQueue {
    heap: BinaryHeap<SimEvent>,
    next_seq_id: u64,
}

impl StratifiedEventQueue {
    pub fn new() -> Self {
        Self {
            heap: BinaryHeap::new(),
            next_seq_id: 0,
        }
    }

    /// Schedules an event into the stratified queue.
    pub fn schedule(
        &mut self,
        time: SimTime,
        delta: u32,
        region: SchedRegion,
        payload: EventPayload,
    ) -> u64 {
        let seq_id = self.next_seq_id;
        self.next_seq_id += 1;

        self.heap.push(SimEvent {
            time,
            delta,
            region,
            seq_id,
            payload,
        });

        seq_id
    }

    /// Peeks at the earliest pending event without removing it.
    pub fn peek(&self) -> Option<&SimEvent> {
        self.heap.peek()
    }

    /// Pops the earliest pending event from the queue.
    pub fn pop(&mut self) -> Option<SimEvent> {
        self.heap.pop()
    }

    pub fn is_empty(&self) -> bool {
        self.heap.is_empty()
    }

    pub fn len(&self) -> usize {
        self.heap.len()
    }

    pub fn clear(&mut self) {
        self.heap.clear();
        self.next_seq_id = 0;
    }
}
