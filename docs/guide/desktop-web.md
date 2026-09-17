# Desktop & Web Architecture

Axiom features a unified dual-target architecture: a lightweight native desktop application and a zero-install, 100% in-browser WebAssembly engineering dashboard.

---

## Dual-Target Overview

```
                        Axiom Core Architecture
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        Native Desktop Target                WebAssembly Target
        - Tauri v2 (Rust IPC)               - wasm32-unknown-unknown
        - Linux, macOS, Windows             - 100% Client-Side In-Browser
        - Direct Cranelift JIT in RAM       - Portable Evaluator in WebWorker
        - Sub-50 MB Binary                  - Zero Backend Server Dependencies
```

---

## Modern Obsidian Dark Theme UI

The engineering frontend is built using **React 19**, **TypeScript 5.7**, **PostCSS**, and **Vite 6**, delivering an Obsidian/Linear-inspired dark workspace:

1. **Simulation Control Header**:
   - Discrete stepping controls: `Run Free`, `Pause`, `+1 ns`, `+100 ps`, and `Step δ` (Zero-Time Delta Cycle).
   - Live telemetry indicators: Simulation Timestamp ($ps / ns$), Active Delta Cycle ($\delta$), Peak Transient Current ($mA$), and Maximum Voltage Sag ($mV$).
2. **Elaborated Netlist Hierarchy Explorer**:
   - Recursive tree view of elaborated scopes, module instances, registers, wires, and procedural processes.
   - Built-in fixture switcher (ALU, Counter with Glitches, Hierarchical Core).
3. **High-Performance Canvas 2D Waveform Viewer**:
   - Virtualized 60+ FPS digital logic rendering.
   - Distinct 4-state logic colors: 0 (slate), 1 (emerald), X (rose), Z (amber).
   - Multi-bit bus diamond transition envelopes with centered hex values.
   - **Delta Glitch Magnifier**: Highlights transient zero-time hazards with pink bug flags.
4. **Physics Silicon Telemetry Charts**:
   - Analog transient current curve ($I(t)$) with cyan gradient fill.
   - Inductive supply rail voltage sag ($V_{sag} = IR + L \frac{di}{dt}$).
   - Dynamic summary cards: Average Power ($mW$), Peak Current ($mA$), Maximum Sag ($mV$), and Total Dissipated Energy ($nJ$).
5. **Simulation Kernel Console & Exporters**:
   - Real-time event log stream.
   - One-click downloads for IEEE 1364 `.vcd` and Synopsys `.saif` files.
