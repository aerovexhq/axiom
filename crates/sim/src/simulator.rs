use axiom_core::{Logic4, LogicVector, SimTime};
use axiom_ir::{BirCircuit, BirExpr, EdgeKind, NetId};
use axiom_jit::{CompiledCircuit, JitEngine};
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::event::{EventPayload, SchedRegion, SimEvent, StratifiedEventQueue};
use crate::glitch::GlitchDetector;
use crate::listener::SimEventListener;
use crate::snapshot::{CheckpointId, SimSnapshot};

#[derive(Debug, Error)]
pub enum SimError {
    #[error("Signal '{0}' not found in circuit netlist")]
    SignalNotFound(String),
    #[error("Infinite delta loop detected at time {time:?}, delta cycle {delta} (limit: {limit})")]
    InfiniteDeltaLoopDetected {
        time: SimTime,
        delta: u32,
        limit: u32,
    },
    #[error("Checkpoint {0:?} not found")]
    CheckpointNotFound(CheckpointId),
    #[error("JIT compilation failed: {0}")]
    CompileError(String),
}

/// Execution summary returned by `tick(delta_time)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickSummary {
    pub start_time: SimTime,
    pub end_time: SimTime,
    pub delta_cycles_executed: u32,
    pub events_executed: u64,
    pub glitches_detected: usize,
}

/// Execution summary returned by `step_delta()`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaSummary {
    pub time: SimTime,
    pub delta: u32,
    pub events_processed: usize,
    pub active_nbas: usize,
    pub settled: bool,
}

/// High-performance, IEEE 1800-compliant simulation kernel with manual delta stepping.
pub struct AxiomSimulator {
    pub compiled: CompiledCircuit,
    pub current_time: SimTime,
    pub current_delta: u32,
    pub event_queue: StratifiedEventQueue,
    pub glitch_detector: GlitchDetector,
    pub listeners: Vec<Box<dyn SimEventListener>>,
    pub max_delta_cycles: u32,

    /// Reverse map: NetId -> indices of continuous assignments reading this net
    assign_sensitivity: HashMap<NetId, Vec<usize>>,
    /// Previous net values for edge detection: NetId -> LogicVector
    prev_net_values: HashMap<NetId, LogicVector>,
    /// Checkpoints in RAM for instant rewind / timeline scrubbing
    checkpoints: HashMap<CheckpointId, SimSnapshot>,
    next_checkpoint_id: u64,
}

impl AxiomSimulator {
    /// Creates and initializes a simulator from an elaborated `BirCircuit`.
    pub fn new(circuit: BirCircuit) -> Result<Self, SimError> {
        let compiled = JitEngine::compile(circuit).map_err(SimError::CompileError)?;
        Self::from_compiled(compiled)
    }

    /// Creates and initializes a simulator from a pre-compiled circuit.
    pub fn from_compiled(compiled: CompiledCircuit) -> Result<Self, SimError> {
        // Build reverse dependency map for continuous assignments
        let mut assign_sensitivity: HashMap<NetId, Vec<usize>> = HashMap::new();
        for (idx, assign) in compiled.circuit.continuous_assigns.iter().enumerate() {
            let mut read_nets = Vec::new();
            Self::collect_expr_nets(&assign.expr, &mut read_nets);
            for net in read_nets {
                assign_sensitivity.entry(net).or_default().push(idx);
            }
        }

        // Snapshot initial net values for edge detection
        let mut prev_net_values = HashMap::new();
        for net in &compiled.circuit.nets {
            let val = compiled.arena.read_net(net);
            prev_net_values.insert(net.id, val);
        }

        let mut sim = Self {
            compiled,
            current_time: SimTime::ZERO,
            current_delta: 0,
            event_queue: StratifiedEventQueue::new(),
            glitch_detector: GlitchDetector::new(),
            listeners: Vec::new(),
            max_delta_cycles: 10_000,
            assign_sensitivity,
            prev_net_values,
            checkpoints: HashMap::new(),
            next_checkpoint_id: 1,
        };

        // Initialize design at t=0, delta=0
        sim.initialize_circuit();

        Ok(sim)
    }

    fn collect_expr_nets(expr: &BirExpr, nets: &mut Vec<NetId>) {
        match expr {
            BirExpr::Net(id) => nets.push(*id),
            BirExpr::Unary { expr, .. } => Self::collect_expr_nets(expr, nets),
            BirExpr::Binary { lhs, rhs, .. } => {
                Self::collect_expr_nets(lhs, nets);
                Self::collect_expr_nets(rhs, nets);
            }
            BirExpr::Slice { target, .. } => Self::collect_expr_nets(target, nets),
            BirExpr::Concat(items) => {
                for item in items {
                    Self::collect_expr_nets(item, nets);
                }
            }
            BirExpr::Const(_) => {}
        }
    }

    /// Evaluates initial equations to settle state at time 0.
    fn initialize_circuit(&mut self) {
        // Enqueue all continuous assignments
        for idx in 0..self.compiled.circuit.continuous_assigns.len() {
            self.event_queue.schedule(
                SimTime::ZERO,
                0,
                SchedRegion::Active,
                EventPayload::EvalContinuousAssign(idx),
            );
        }

        // Enqueue combinational always @* blocks
        for proc in &self.compiled.circuit.processes {
            if proc.triggers.is_empty() {
                self.event_queue.schedule(
                    SimTime::ZERO,
                    0,
                    SchedRegion::Active,
                    EventPayload::EvalProcess(proc.id),
                );
            }
        }

        // Run until settled at time 0
        let _ = self.settle_current_time();
    }

    /// Settles delta cycles at current_time until no more events exist for current_time.
    pub fn settle_current_time(&mut self) -> Result<u32, SimError> {
        let mut deltas = 0;
        loop {
            let has_events_now = self.event_queue.peek().map(|e| e.time == self.current_time).unwrap_or(false);
            if !has_events_now {
                break;
            }

            if self.current_delta >= self.max_delta_cycles {
                return Err(SimError::InfiniteDeltaLoopDetected {
                    time: self.current_time,
                    delta: self.current_delta,
                    limit: self.max_delta_cycles,
                });
            }

            self.step_delta()?;
            deltas += 1;
        }

        self.finalize_current_time_step();
        Ok(deltas)
    }

    /// Registers a simulation event listener.
    pub fn add_listener(&mut self, listener: Box<dyn SimEventListener>) {
        self.listeners.push(listener);
    }

    /// Configures the periodic toggle of a clock net.
    pub fn add_clock(&mut self, net_name: &str, half_period: SimTime) -> Result<(), SimError> {
        let net = self
            .compiled
            .circuit
            .get_net_by_name(net_name)
            .ok_or_else(|| SimError::SignalNotFound(net_name.to_string()))?;
        let net_id = net.id;

        self.event_queue.schedule(
            self.current_time + half_period,
            0,
            SchedRegion::Active,
            EventPayload::ClockToggle {
                net: net_id,
                half_period,
            },
        );

        Ok(())
    }

    /// Advances physical simulation time by `delta_time`.
    /// Executes all scheduled events, delta cycles, and settles intermediate transitions.
    pub fn tick(&mut self, delta_time: SimTime) -> Result<TickSummary, SimError> {
        let start_time = self.current_time;
        let target_time = self.current_time + delta_time;
        let mut delta_cycles_executed = 0;
        let mut events_executed = 0;

        while self.current_time <= target_time {
            let next_evt_time = self.event_queue.peek().map(|e| e.time);
            if let Some(next_time) = next_evt_time {
                if next_time > target_time {
                    break;
                }
                if next_time > self.current_time {
                    self.finalize_current_time_step();
                    self.current_time = next_time;
                    self.current_delta = 0;
                }
            } else {
                break;
            }

            let summary = self.step_delta()?;
            delta_cycles_executed += 1;
            events_executed += summary.events_processed as u64;

            if self.current_delta >= self.max_delta_cycles {
                return Err(SimError::InfiniteDeltaLoopDetected {
                    time: self.current_time,
                    delta: self.current_delta,
                    limit: self.max_delta_cycles,
                });
            }
        }

        self.finalize_current_time_step();
        self.current_time = target_time;
        self.current_delta = 0;

        let glitches = self.glitch_detector.glitches().len();

        Ok(TickSummary {
            start_time,
            end_time: target_time,
            delta_cycles_executed,
            events_executed,
            glitches_detected: glitches,
        })
    }

    /// Advances simulation by exactly ONE discrete delta cycle ($\delta \to \delta + 1$) within zero physical time.
    pub fn step_delta(&mut self) -> Result<DeltaSummary, SimError> {
        let mut events_processed = 0;
        let mut nbas_applied = 0;

        // 1. Process Active Region
        while let Some(evt) = self.event_queue.peek() {
            if evt.time != self.current_time || evt.delta != self.current_delta || evt.region != SchedRegion::Active {
                break;
            }
            let event = self.event_queue.pop().unwrap();
            events_processed += 1;
            self.execute_event(event, &mut nbas_applied)?;
        }

        // 2. Process Inactive Region (#0 delays)
        while let Some(evt) = self.event_queue.peek() {
            if evt.time != self.current_time || evt.delta != self.current_delta || evt.region != SchedRegion::Inactive {
                break;
            }
            let event = self.event_queue.pop().unwrap();
            events_processed += 1;
            self.execute_event(event, &mut nbas_applied)?;
        }

        // 3. Process NBA Region (Non-Blocking Assignments)
        while let Some(evt) = self.event_queue.peek() {
            if evt.time != self.current_time || evt.delta != self.current_delta || evt.region != SchedRegion::Nba {
                break;
            }
            let event = self.event_queue.pop().unwrap();
            events_processed += 1;
            self.execute_event(event, &mut nbas_applied)?;
        }

        // 4. Process Postponed Region
        while let Some(evt) = self.event_queue.peek() {
            if evt.time != self.current_time || evt.delta != self.current_delta || evt.region != SchedRegion::Postponed {
                break;
            }
            let event = self.event_queue.pop().unwrap();
            events_processed += 1;
            self.execute_event(event, &mut nbas_applied)?;
        }

        // Notify listeners that delta cycle completed
        for listener in &mut self.listeners {
            listener.on_delta_cycle_finished(self.current_time, self.current_delta);
        }

        self.current_delta += 1;

        let settled = !self.event_queue.peek().map(|e| e.time == self.current_time && e.delta == self.current_delta).unwrap_or(false);

        Ok(DeltaSummary {
            time: self.current_time,
            delta: self.current_delta - 1,
            events_processed,
            active_nbas: nbas_applied,
            settled,
        })
    }

    /// Advances to the very next discrete event in the scheduler queue.
    pub fn step_event(&mut self) -> Result<Option<SimEvent>, SimError> {
        let event = match self.event_queue.pop() {
            Some(e) => e,
            None => return Ok(None),
        };

        if event.time > self.current_time {
            self.finalize_current_time_step();
            self.current_time = event.time;
            self.current_delta = event.delta;
        } else {
            self.current_delta = event.delta;
        }

        let mut nbas = 0;
        self.execute_event(event.clone(), &mut nbas)?;
        Ok(Some(event))
    }

    fn execute_event(&mut self, event: SimEvent, nbas_count: &mut usize) -> Result<(), SimError> {
        match event.payload {
            EventPayload::EvalContinuousAssign(idx) => {
                let changed = self.compiled.eval_continuous_assign(idx);
                if changed {
                    let assign = &self.compiled.circuit.continuous_assigns[idx];
                    let new_val = self.compiled.arena.read_net(self.compiled.circuit.get_net(assign.target).unwrap());
                    self.on_net_changed(assign.target, new_val, false);
                }
            }
            EventPayload::EvalProcess(proc_id) => {
                let output = self.compiled.eval_process(proc_id);
                for target in output.changed_blocking_nets {
                    let new_val = self.compiled.arena.read_net(self.compiled.circuit.get_net(target).unwrap());
                    self.on_net_changed(target, new_val, false);
                }
                for (target, value) in output.scheduled_nbas {
                    *nbas_count += 1;
                    self.event_queue.schedule(
                        self.current_time,
                        self.current_delta,
                        SchedRegion::Nba,
                        EventPayload::ApplyNba { target, value },
                    );
                }
            }
            EventPayload::ApplyNba { target, value } => {
                let target_net = match self.compiled.circuit.get_net(target) {
                    Some(n) => n.clone(),
                    None => return Ok(()),
                };

                let changed = self.compiled.arena.write_net(&target_net, &value);
                if changed {
                    // NBA changes trigger downstream processes in the NEXT delta cycle
                    self.on_net_changed(target, value, true);
                }
            }
            EventPayload::PropagateNet(net) => {
                let val = self.compiled.arena.read_net(self.compiled.circuit.get_net(net).unwrap());
                self.on_net_changed(net, val, false);
            }
            EventPayload::ClockToggle { net, half_period } => {
                let net_obj = self.compiled.circuit.get_net(net).unwrap().clone();
                let cur_val = self.compiled.arena.read_net(&net_obj);
                let toggled_bit = if cur_val.get_bit(0) == Logic4::One {
                    Logic4::Zero
                } else {
                    Logic4::One
                };
                let new_val = LogicVector::fill(net_obj.width, toggled_bit);

                self.compiled.arena.write_net(&net_obj, &new_val);
                self.on_net_changed(net, new_val, false);

                // Schedule next toggle
                self.event_queue.schedule(
                    self.current_time + half_period,
                    0,
                    SchedRegion::Active,
                    EventPayload::ClockToggle { net, half_period },
                );
            }
        }
        Ok(())
    }

    /// Handles net value transition, records glitch history, notifies listeners, and enqueues sensitive processes.
    fn on_net_changed(&mut self, net: NetId, new_val: LogicVector, is_nba: bool) {
        let net_name = self.compiled.circuit.get_net(net).map(|n| n.name.as_str()).unwrap_or("unknown");

        // Record transition for glitch detection
        self.glitch_detector.record_transition(net, new_val.clone(), self.current_time, self.current_delta);

        // Notify listeners
        for listener in &mut self.listeners {
            listener.on_signal_change(net, net_name, &new_val, self.current_time, self.current_delta);
        }

        // Determine edge (posedge, negedge, or value change)
        let prev_val = self.prev_net_values.get(&net).cloned();
        let is_posedge = match &prev_val {
            Some(prev) => prev.get_bit(0) == Logic4::Zero && new_val.get_bit(0) == Logic4::One,
            None => new_val.get_bit(0) == Logic4::One,
        };
        let is_negedge = match &prev_val {
            Some(prev) => prev.get_bit(0) == Logic4::One && new_val.get_bit(0) == Logic4::Zero,
            None => new_val.get_bit(0) == Logic4::Zero,
        };
        self.prev_net_values.insert(net, new_val);

        // If triggered from NBA, downstream logic evaluates in NEXT delta cycle (delta + 1).
        // Otherwise, evaluates in CURRENT delta cycle.
        let target_delta = if is_nba {
            self.current_delta + 1
        } else {
            self.current_delta
        };

        // 1. Trigger sensitive processes
        if let Some(proc_ids) = self.compiled.circuit.sensitivity_map.get(&net) {
            for &proc_id in proc_ids {
                if let Some(proc) = self.compiled.circuit.processes.get(proc_id.0 as usize) {
                    let should_trigger = if proc.triggers.is_empty() {
                        true // Combinational always @*
                    } else {
                        proc.triggers.iter().any(|t| {
                            if t.net == net {
                                match t.edge {
                                    EdgeKind::AnyChange => true,
                                    EdgeKind::Posedge => is_posedge,
                                    EdgeKind::Negedge => is_negedge,
                                }
                            } else {
                                false
                            }
                        })
                    };

                    if should_trigger {
                        self.event_queue.schedule(
                            self.current_time,
                            target_delta,
                            SchedRegion::Active,
                            EventPayload::EvalProcess(proc_id),
                        );
                    }
                }
            }
        }

        // 2. Trigger sensitive continuous assignments
        if let Some(assign_indices) = self.assign_sensitivity.get(&net) {
            for &idx in assign_indices {
                self.event_queue.schedule(
                    self.current_time,
                    target_delta,
                    SchedRegion::Active,
                    EventPayload::EvalContinuousAssign(idx),
                );
            }
        }
    }

    fn finalize_current_time_step(&mut self) {
        let glitches = self.glitch_detector.finalize_time_step();
        for glitch in &glitches {
            for listener in &mut self.listeners {
                listener.on_glitch_detected(glitch);
            }
        }
    }

    /// Queries the current 4-state value of a signal by hierarchical name.
    pub fn get_signal(&self, name: &str) -> Option<LogicVector> {
        self.compiled.get_signal(name)
    }

    /// Injects user stimulus into a signal, enqueuing downstream sensitive events in the current delta cycle.
    pub fn force_signal(&mut self, name: &str, val: &LogicVector) -> Result<(), SimError> {
        let net = self
            .compiled
            .circuit
            .get_net_by_name(name)
            .ok_or_else(|| SimError::SignalNotFound(name.to_string()))?
            .clone();

        let changed = self.compiled.arena.write_net(&net, val);
        if changed {
            self.on_net_changed(net.id, val.clone(), false);
        }
        Ok(())
    }

    /// Injects stimulus and immediately settles all delta cycles until equilibrium.
    pub fn force_signal_and_settle(&mut self, name: &str, val: &LogicVector) -> Result<u32, SimError> {
        self.force_signal(name, val)?;
        self.settle_current_time()
    }

    /// Captures a full snapshot of simulation state in RAM for instant rewind / scrubbing.
    pub fn create_checkpoint(&mut self) -> CheckpointId {
        let id = CheckpointId(self.next_checkpoint_id);
        self.next_checkpoint_id += 1;

        let snapshot = SimSnapshot {
            id,
            time: self.current_time,
            delta: self.current_delta,
            arena: self.compiled.arena.clone(),
            event_queue: self.event_queue.clone(),
            glitch_detector: self.glitch_detector.clone(),
        };

        self.checkpoints.insert(id, snapshot);
        id
    }

    /// Restores simulation state to an earlier checkpoint.
    pub fn restore_checkpoint(&mut self, id: CheckpointId) -> Result<(), SimError> {
        let snap = self
            .checkpoints
            .get(&id)
            .ok_or(SimError::CheckpointNotFound(id))?
            .clone();

        self.current_time = snap.time;
        self.current_delta = snap.delta;
        self.compiled.arena = snap.arena;
        self.event_queue = snap.event_queue;
        self.glitch_detector = snap.glitch_detector;

        // Resync prev_net_values
        for net in &self.compiled.circuit.nets {
            let val = self.compiled.arena.read_net(net);
            self.prev_net_values.insert(net.id, val);
        }

        Ok(())
    }
}
