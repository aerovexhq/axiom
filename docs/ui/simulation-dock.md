# Simulation Command Ribbon & Unified Dock

The Axiom simulation control system combines a high-speed execution engine with an intuitive command ribbon and unified bottom dock (`BottomConsole.tsx`, `UnifiedBottomDock.tsx`). It provides immediate control over physical simulation time and discrete delta cycles.

---

## Header Simulation Command Ribbon

The top header bar displays simulation telemetry and controls:

```
+-------------------------------------------------------------------------------+
| [ Run ] [ Pause ] | [ +1 ns ] [ +100 ps ] [ Step Delta ] | [ Reset (t=0) ]    |
| Time: 125,400 ps (125.4 ns) | Delta: 0 | Core: 0.988 V | Power: 34.2 mW       |
+-------------------------------------------------------------------------------+
```

### Control Actions
- **Run (`Space` / `Ctrl + Enter`)**: Starts continuous autonomous clock ticking in the background Web Worker or Cranelift JIT engine at high frequency.
- **Pause (`Space`)**: Suspends simulation execution instantly, freezing all signal traces and register states for inspection.
- **+1 ns (`F10`)**: Advances physical simulation time by exactly 1,000 picoseconds.
- **+100 ps (`Shift + F10`)**: Advances physical simulation time by exactly 100 picoseconds for fine timing analysis.
- **Step Delta (`F11`)**: Advances a single discrete zero-time evaluation cycle ($\delta \to \delta + 1$) without incrementing physical simulation time, exposing combinational race conditions and intermediate gate transitions.
- **Reset (`Ctrl + R`)**: Rewinds simulation time to $t=0$, resets signal vectors to initial states, and keeps the design compiled so execution can resume immediately without re-elaboration.

---

## Unified Bottom Dock Tabs

The collapsible dock organizes essential secondary engineering tools:

### 1. Console & REPL
- Displays compiler passes, AST elaboration metrics, and active module instances.
- Streams real-time `$display`, `$write`, and `$monitor` output from Verilog simulation.
- Provides an interactive command prompt to evaluate signal expressions or query net values.

### 2. Problems & Linter
- Lists active static analysis warnings and syntax errors.
- Displays rule ID (`AXIOM_W001`, etc.), severity badges, and source filenames.
- Clicking any problem card instantly navigates the Monaco editor to the exact offending line.

### 3. Telemetry Radar
- Displays real-time analog meters for core voltage, inductive sag, supply current, and dynamic power dissipation.

### 4. Waveforms Dock
- Renders an auxiliary waveform preview while the primary visualizer pane is focused on Schematics, Virtual Lab, or Timing Radar.
