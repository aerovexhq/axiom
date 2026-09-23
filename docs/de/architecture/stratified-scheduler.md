# Schichten-Ereignis-Scheduler & Delta-Zyklus-Engine

Digitale Logiksimulatoren stützen sich auf diskretes Ereignis-Scheduling, um Nebenläufigkeit und physikalische Kausalitätsausbreitung zu modellieren. Axiom implementiert strikt die **IEEE 1800 Schichten-Ereignis-Warteschlange** und bietet gleichzeitig eine feingranulare Aufrufersteuerung.

---

## IEEE 1800 Regionshierarchie

Jeder Simulations-Zeitstempel ($t$) enthält eine beliebige Anzahl von Null-Zeit-Delta-Zyklen ($\delta$-Zyklen), unterteilt in Ausführungsregionen:

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

## Granulare aufrufergesteuerte API

Altsysteme behandeln Null-Zeit-Delta-Zyklen als Black Box: `run 100ns` führt alle Delta-Zyklen intern aus und verbirgt transiente Glitches.

Axiom stellt zwei granulare Stepping-Primitive bereit:

### 1. `step_delta()`
Schreitet in der Simulation um exakt **einen diskreten Null-Zeit-Delta-Zyklus (δ-Zyklus)** voran ($\delta \to \delta + 1$), ohne die physische Zeit voranzutreiben:
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
Schreitet in der physischen Simulationszeit um ein beliebiges Inkrement voran:
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## Erkennung kombinatorischer Glitch-Hazards

Während Delta-Zyklen führen asymmetrische Pfadverzögerungen häufig dazu, dass ein Netz mehrfach umschaltet, bevor es sich einschwingt (z. B. $0 \to 1 \to 0$ oder $1 \to 0 \to 1$). Der `GlitchDetector` von Axiom markiert diese Ereignisse automatisch:
- **Statischer 0-Hazard**: Transienter High-Impuls auf einem Signal, das bei 0 beginnt und endet.
- **Statischer 1-Hazard**: Transienter Low-Einbruch auf einem Signal, das bei 1 beginnt und endet.
- **Dynamischer Hazard**: Mehrere Zwischen-Umschaltungen während eines einzelnen Logikübergangs.

Diese Hazards werden in Echtzeit sowohl in der CLI als auch im Canvas-Signalverlaufsbetrachter gekennzeichnet.
