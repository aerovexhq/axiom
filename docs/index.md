---
layout: home

hero:
  name: "Axiom EDA"
  text: "High-Performance HDL Engine & Silicon Telemetry"
  tagline: "Ultra-fast in-RAM Cranelift JIT compilation, manual delta-cycle stepping, and physics-informed silicon telemetry. Built in Rust under Aerovex."
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
    - theme: brand
      text: Launch Web Studio
      link: https://axiom.aerovex.net
      target: _blank
    - theme: alt
      text: Quickstart & Install
      link: /guide/quickstart
    - theme: alt
      text: View on GitHub
      link: https://github.com/aerovexsim/axiom

features:
  - title: In-RAM Cranelift JIT
    details: Compiles Verilog & SystemVerilog designs directly into native machine code (x86_64, AArch64) in RAM in milliseconds, bypassing multi-minute C++ and snapshot disk overhead.
  - title: Granular Delta-Cycle Stepping
    details: Caller-controlled manual tick API exposing discrete zero-time δ-cycles (step_delta), uncovering combinational race conditions and glitches hidden by legacy simulators.
  - title: Physics Silicon Telemetry
    details: First-principles dynamic power modeling (0.5 * C * V^2 * f * α) coupled with inductive PDN voltage droop (IR + L di/dt), streaming live synchronized analog telemetry alongside digital traces.
  - title: Cross-Platform Desktop & Web
    details: Lightweight (<50 MB) desktop application built with Tauri v2, React 19, and Vite, compiling natively to WebAssembly for 100% in-browser client-side simulation.
  - title: High-Density Canvas Waveforms
    details: Virtualized 60+ FPS digital waveform viewer supporting multi-bit bus transition envelopes, time-cursor inspection, and delta glitch magnifiers.
  - title: 100% Vivado Interoperability
    details: Exports IEEE 1364 Value Change Dump (.vcd) waveforms and Synopsys SAIF 2.0 switching activity files directly consumable by Vivado read_saif.
---

## Single-Line Install

Install the standalone Axiom EDA binary in seconds without 100+ GB installer bloat:

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip Version Selection & Build from Source
To install a specific release version:
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

Or build directly from source using cargo:
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## Benchmark Highlights: Axiom vs. AMD Vivado

| Metric | Axiom EDA (Aerovex) | AMD Vivado Design Suite | Advantage |
| :--- | :--- | :--- | :--- |
| **End-to-End Compile Turnaround** | **2.81 ms** (In-RAM JIT) | 30.0 – 60.0 s (`xelab` snapshot) | **>10,000× faster** |
| **Simulation Event Throughput** | **780,840 events/sec** | ~100,000 – 250,000 events/sec | **3–7× faster** |
| **Zero-Time Delta Introspection** | Explicit $\delta$-stepping & glitch flags | Black-box zero-time collapse | **Full race visibility** |
| **Dynamic Energy Telemetry** | Real-time $P = \frac{1}{2} C V^2 f \alpha$ | Post-simulation static report | **Live synchronized waveforms** |
| **Installation Footprint** | **<50 MB** self-contained binary | **100+ GB** monolithic install | **>2,000× lighter** |
| **Platform Compatibility** | Linux, macOS (Apple Silicon), Windows, Web | Linux & Windows only | **Universal portability** |
