# Planificador de eventos estratificado y motor de ciclos delta

Los simuladores de lógica digital dependen de la planificación de eventos discretos para modelar la concurrencia y la propagación causal física. Axiom implementa estrictamente la **cola de eventos estratificada IEEE 1800** a la vez que proporciona un control minucioso por parte del llamador.

---

## Jerarquía de regiones IEEE 1800

Cada marca de tiempo de simulación ($t$) contiene un número arbitrario de ciclos delta de tiempo cero (ciclo δ), particionados en regiones de ejecución:

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

## API granular controlada por el llamador

Las herramientas heredadas tratan los ciclos delta de tiempo cero como una caja negra: `run 100ns` ejecuta todos los ciclos delta internamente, ocultando los fallos transitorios.

Axiom expone dos primitivas de avance granular:

### 1. `step_delta()`
Avanza la simulación exactamente **un ciclo delta discreto** (ciclo delta de tiempo cero (ciclo δ): $\delta \to \delta + 1$) sin avanzar el tiempo físico:
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
Avanza el tiempo físico de simulación en un incremento arbitrario:
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## Detección de riesgos de fallos combinacionales

Durante los ciclos delta, los retardos asimétricos de las rutas a menudo hacen que una red transicione múltiples veces antes de estabilizarse (ej. $0 \to 1 \to 0$ o $1 \to 0 \to 1$). El `GlitchDetector` de Axiom etiqueta automáticamente estos eventos:
- **Riesgo estático-0**: Pulso alto transitorio en una señal que comienza y termina en 0.
- **Riesgo estático-1**: Caída baja transitoria en una señal que comienza y termina en 1.
- **Riesgo dinámico**: Múltiples conmutaciones intermedias durante una única transición lógica.

Estos riesgos se señalan en tiempo real tanto en la CLI como en el visor de formas de onda en Canvas.
