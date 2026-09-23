# Planificateur d'événements stratifié et moteur de cycles delta

Les simulateurs logiques numériques reposent sur la planification d'événements discrets pour modéliser la concurrence et la propagation causale physique. Axiom implémente rigoureusement la **file d'événements stratifiée IEEE 1800** tout en offrant un contrôle fin à l'appelant.

---

## Hiérarchie des régions IEEE 1800

Chaque horodatage de simulation ($t$) contient un nombre arbitraire de cycle delta à temps nul (cycle δ), partitionnés en régions d'exécution :

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

## API granulaire contrôlée par l'appelant

Les outils hérités traitent les cycles delta à temps nul comme une boîte noire : `run 100ns` exécute tous les cycles delta en interne, masquant les glitchs transitoires.

Axiom expose deux primitives d'avancement granulaire :

### 1. `step_delta()`
Fait avancer la simulation d'exactement **un cycle delta discret** ($\delta \to \delta + 1$) sans faire avancer le temps physique :
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
Fait avancer le temps physique de simulation d'un incrément arbitraire :
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## Détection des aléas et glitchs combinatoires

Pendant les cycles delta, les délais de propagation asymétriques provoquent souvent plusieurs transitions d'une équipotentielle avant stabilisation (ex. $0 \to 1 \to 0$ ou $1 \to 0 \to 1$). Le `GlitchDetector` d'Axiom étiquette automatiquement ces événements :
- **Aléa statique-0** : Impulsion transitoire haute sur un signal qui commence et se termine à 0.
- **Aléa statique-1** : Chute transitoire basse sur un signal qui commence et se termine à 1.
- **Aléa dynamique** : Multiples basculements intermédiaires au cours d'une transition logique unique.

Ces aléas sont signalés en temps réel à la fois dans la CLI et dans le visualiseur de formes d'onde Canvas.
