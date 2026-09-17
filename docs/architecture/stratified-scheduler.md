# Stratified Event Scheduler & Delta-Cycle Engine

Digital logic simulators rely on discrete event scheduling to model concurrency and physical causal propagation. Axiom strictly implements the **IEEE 1800 Stratified Event Queue** while providing fine-grained caller control.

---

## IEEE 1800 Region Hierarchy

Each simulation timestamp ($t$) contains an arbitrary number of zero-time delta cycles ($\delta$), partitioned into execution regions:

```
+-------------------------------------------------------------------------------+
| Active Region                                                                 |
| - Evaluate continuous assignments                                             |
| - Execute blocking statements (=)                                             |
| - Evaluate right-hand side of non-blocking assignments (NBAs)                 |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Inactive Region (#0 Delays)                                                   |
| - Process explicit #0 procedural delays                                       |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| NBA Region (Non-Blocking Assignments)                                         |
| - Apply queued non-blocking assignment updates to flip-flop registers (<=)    |
| - Net transitions trigger sensitivity for next delta cycle: δ -> δ + 1        |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Postponed Region                                                              |
| - Sample steady-state values for VCD waveform dump and SAIF activity          |
+-------------------------------------------------------------------------------+
```

---

## Granular Caller-Controlled API

Legacy tools treat zero-time delta cycles as a black box: `run 100ns` executes all delta cycles internally, hiding transient glitches.

Axiom exposes two granular stepping primitives:

### 1. `step_delta()`
Advances the simulation by exactly **one discrete delta cycle** ($\delta \to \delta + 1$) without advancing physical time:
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
Advances physical simulation time by an arbitrary increment:
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## Combinational Glitch Hazard Detection

During delta cycles, asymmetric path delays often cause a net to transition multiple times before settling (e.g., $0 \to 1 \to 0$ or $1 \to 0 \to 1$). Axiom's `GlitchDetector` automatically tags these events:
- **Static-0 Hazard**: Transient pulse high on a signal that starts and ends at 0.
- **Static-1 Hazard**: Transient drop low on a signal that starts and ends at 1.
- **Dynamic Hazard**: Multiple intermediate toggles during a single logic transition.

These hazards are flagged in real time in both the CLI and the Canvas waveform viewer.
