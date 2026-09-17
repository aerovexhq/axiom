# Introduction & Project Manifesto

## The Mission of Axiom EDA

**Axiom** is a ground-up, high-performance, cross-platform remake and modernization of AMD Vivado's Hardware Description Language (HDL) processing, simulation, and analysis engine, built natively in **Rust** by **Aerovex**.

Vivado is the undisputed industry standard for FPGA development, yet it suffers from decades of technical bloat:
- **100+ GB installations** requiring complex licensing daemons and lengthy setup.
- **Sluggish Java Swing interfaces** that consume gigabytes of memory and freeze during waveform rendering.
- **Multi-stage file-based compilation pipelines** (`xvlog` $\to$ library database $\to$ `xelab` $\to$ snapshot binary $\to$ `xsim`) that take minutes even for trivial HDL modifications.
- **Complete lack of support for modern platforms** such as macOS (Apple Silicon M1/M2/M3/M4) or standard web browsers.
- **Opaque zero-time delta cycles** that hide transient combinational race conditions and glitches from digital designers.

**Axiom dismantles these limitations.** It delivers a sub-50 MB, instantaneous, and deeply introspectable hardware simulation engine paired with an Obsidian-inspired desktop and web application.

---

## Core Architectural Pillars

### 1. In-RAM Cranelift JIT Compilation
Axiom eliminates intermediate C++ file dumps, external GCC/Clang invocations, and snapshot serialization. Elaborated hardware netlists and procedural processes are compiled directly into native machine code in RAM using **Cranelift** (x86_64, AArch64) in under 3 milliseconds.

### 2. Manual Delta-Time Tick & Event Queue API
Unlike traditional simulators that force simulation time to advance blindly or collapse delta cycles into a single timestamp, Axiom exposes an embeddable caller-controlled stepping API:
- `engine.tick(delta_time)`: Advance physical time by picoseconds or nanoseconds.
- `engine.step_delta()`: Step a single discrete delta cycle ($\delta \to \delta + 1$) within zero simulation time, exposing transient hazards before signals settle.

### 3. Physics-Informed Voltage, Energy & Power Telemetry
Axiom embeds first-principles physics equations into every signal transition:
- **Dynamic Power**: $P_{\text{dynamic}} = \frac{1}{2} C_{\text{net}} V_{\text{dd}}^2 f \alpha$
- **PDN Inductive Voltage Sag**: $V_{\text{sag}} = IR + L \frac{di}{dt}$
- Captures micro-current spikes during clock edges that Vivado's static estimation reports miss.

### 4. Cross-Platform Desktop & Web Architecture
Built with **Tauri v2**, **React 19**, **TypeScript**, and **Vite**, Axiom runs natively as a desktop application across Linux, macOS, and Windows, while compiling seamlessly to **WebAssembly** (`wasm32-unknown-unknown`) for 100% in-browser simulation.
