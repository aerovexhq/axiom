<div align="center">

<img src="docs/public/logo.png" alt="Axiom EDA Logo" width="128" height="128" />

# Axiom EDA

**High-Performance In-RAM HDL Processor, Cranelift JIT Hardware Simulator & Silicon Telemetry Engine**

[![Documentation](https://img.shields.io/badge/docs-axiom.aerovex.net-blue?style=flat-square)](https://axiom.aerovex.net)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.80%2B-orange?style=flat-square&logo=rust)](https://www.rust-lang.org)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square&logo=tauri)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react)](https://react.dev)

*Built natively in Rust by [Aerovex](https://aerovex.net).*

</div>

---

## 🚀 Overview

**Axiom EDA** is a ground-up, high-performance, cross-platform remake of AMD Vivado's Hardware Description Language (HDL) processing, simulation, and verification engine.

Vivado is the industry standard for FPGA development, yet it carries decades of legacy bloat: 100+ GB installations, sluggish Java Swing interfaces, multi-minute file-based elaboration snapshots, and zero support for macOS (Apple Silicon) or modern web browsers. Furthermore, legacy simulators treat zero-time delta cycles as a black box, hiding critical combinational race conditions from engineers.

**Axiom eliminates these bottlenecks**:
- ⚡ **In-RAM Cranelift JIT Compilation**: Compiles Verilog and SystemVerilog netlists directly into native machine code (x86_64, AArch64) in RAM in **under 3 milliseconds** — bypassing intermediate C++ files and disk snapshots.
- 🔬 **Granular Delta-Cycle Stepping**: Caller-controlled stepping API (`step_delta`) exposing discrete zero-time $\delta$-cycles and static/dynamic glitch hazards before signals settle.
- 🔋 **Physics-Informed Silicon Telemetry**: Real-time dynamic power modeling ($P = \frac{1}{2} C V^2 f \alpha$) and Power Distribution Network (PDN) inductive voltage droop ($V_{\text{sag}} = IR + L \frac{di}{dt}$) streamed alongside digital traces.
- 🌐 **Dual-Target Desktop & Web UI**: Sub-50 MB desktop application built with Tauri v2 + React 19, compiling directly to WebAssembly (`wasm32-unknown-unknown`) for 100% client-side in-browser simulation.
- 🔄 **100% Vivado Interoperability**: Direct export to standard IEEE 1364 Value Change Dump (`.vcd`) and Synopsys SAIF 2.0 (`.saif`) for Vivado `read_saif`.

---

## 📊 Benchmark Highlights: Axiom vs. AMD Vivado

| Metric | Axiom EDA (Aerovex) | AMD Vivado Design Suite | Advantage |
| :--- | :--- | :--- | :--- |
| **End-to-End Compile Turnaround** | **2.81 ms** (In-RAM JIT) | 30.0 – 60.0 s (`xelab` snapshot) | **>10,000× faster** |
| **Simulation Event Throughput** | **780,840 events/sec** | ~100,000 – 250,000 events/sec | **3–7× faster** |
| **Zero-Time Delta Introspection** | Explicit $\delta$-stepping & glitch flags | Black-box zero-time collapse | **Full race visibility** |
| **Dynamic Energy Telemetry** | Real-time $P = \frac{1}{2} C V^2 f \alpha$ | Post-simulation static report | **Live synchronized waveforms** |
| **Installation Footprint** | **<50 MB** self-contained binary | **100+ GB** monolithic install | **>2,000× lighter** |
| **Platform Compatibility** | Linux, macOS (Apple Silicon), Windows, Web | Linux & Windows only | **Universal portability** |

---

## 🏗️ Architecture

```
HDL Source Text (.v / .sv)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Streaming Lexer & Pratt AST Parser                       │
│    - Zero-allocation token stream over UTF-8 slices         │
│    - Preprocessor directives (`timescale, `define)          │
│    - Operator precedence parsing for complex expressions    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Hierarchical Elaborator (Axiom IR / BIR)             │
│    - Top-level scope instantiation & parameter propagation  │
│    - Netlist resolution & signal width inference            │
│    - Sensitivity map derivation: NetId -> [ProcessId]       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. In-RAM Cranelift JIT Compiler & 4-State Arena            │
│    - Continuous assignments lowered to native machine code  │
│    - Contiguous 64-bit dual vectors (values & masks)        │
│    - Portable WebAssembly fallback (wasm32-unknown-unknown) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Stratified Event Scheduler & Telemetry Engine            │
│    - IEEE 1800 Regions: Active, Inactive (#0), NBA          │
│    - Manual stepping: tick(delta_time) & step_delta()       │
│    - Glitch detector: Static-0, Static-1 & Dynamic hazards  │
│    - Physics PDN Droop: V_sag = IR + L di/dt                │
│    - Exporters: IEEE 1364 VCD & SAIF 2.0                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Presentation Layer (Tauri v2 + React 19 Desktop & Web)   │
│    - 60+ FPS Canvas 2D digital waveforms & bus envelopes    │
│    - Synchronized analog power/current curves               │
│    - Verilog code editor with live hierarchy explorer       │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Instant Install

Install the standalone Axiom EDA binary in seconds (<50 MB) without monolithic 100+ GB installers:

#### Linux & macOS
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

#### Windows (PowerShell)
```powershell
irm https://axiom.aerovex.net/install.ps1 | iex
```

### Build from Source Driver

```bash
./scripts/build_from_source.sh
```

### Headless CLI Usage

Compile a Verilog module in RAM with microsecond timing:
```bash
axiom compile tests/fixtures/alu.v -t alu
```

Run batch simulation with VCD & SAIF export:
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd wave.vcd --saif power.saif
```

Benchmark simulation throughput:
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

### Launch Interactive GUI (Desktop / Web)

```bash
cd ui
npm install
npm run dev
```

Visit `http://localhost:5173` to explore waveforms, single-step delta cycles, and analyze real-time power dissipation.

---

## 📖 Documentation

Comprehensive guides, architectural specifications, and Vivado migration manuals are available on the official documentation portal:

👉 **[https://axiom.aerovex.net](https://axiom.aerovex.net)**

- [Getting Started & Quickstart](https://axiom.aerovex.net/guide/quickstart)
- [In-RAM Cranelift JIT Architecture](https://axiom.aerovex.net/architecture/in-ram-jit)
- [Stratified Event Scheduler & Delta Stepping](https://axiom.aerovex.net/architecture/stratified-scheduler)
- [Physics Power & PDN Telemetry](https://axiom.aerovex.net/architecture/power-pdn-telemetry)
- [Vivado Migration Guide](https://axiom.aerovex.net/vivado/migration)
- [CLI Reference Manual](https://axiom.aerovex.net/reference/cli)

---

## 🗺️ Vivado Feature Roadmap

Axiom delivers next-generation alternatives to AMD Vivado's monolithic toolchain:
- [x] In-RAM HDL Compilation & Cranelift JIT Simulation Kernel
- [x] IEEE 1800 Stratified Event Queue & Granular Delta-Cycle Inspection
- [x] Physics-Informed Power Telemetry & PDN Inductive Voltage Droop
- [x] IEEE 1364 VCD & SAIF 2.0 Exporters
- [x] Modern Dark Desktop (Tauri v2) & Web (WASM) Application
- [x] Interactive RTL Schematic & Netlist DAG Graph Viewer (60+ FPS Canvas 2D with 3-way cross-probing & logic cone slicer)
- [x] Static Timing Analysis (STA) & SDC/XDC Constraint Engine (Setup/Hold slack waterfall, WNS, TNS, CDC matrix)
- [x] Virtual Lab & Instrument Rack (8-bit DIP switches, tactile buttons, hex dial, 7-seg displays, testbench painter)
- [x] Unified Omnibar (Ctrl+K) & In-UI Scripting REPL Console
- [ ] **[P2] WebAssembly Multithreaded Worker Isolation** (SharedArrayBuffer)
- [ ] **[P2] Xilinx 7-Series & UltraScale+ Primitive Library Emulation** (LUT6, DSP48E2, RAMB36E2)

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

Copyright © 2026 [Aerovex](https://aerovex.net).