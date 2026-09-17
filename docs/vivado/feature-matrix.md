# Vivado vs. Axiom Feature Matrix

A detailed comparison between the legacy AMD Vivado simulation environment and the next-generation Axiom EDA engine.

---

## Technical Capability Comparison

| Capability | AMD Vivado Design Suite | Axiom EDA (Aerovex) |
| :--- | :--- | :--- |
| **Primary Execution Engine** | Disk-compiled `xsimk` snapshot | In-RAM Cranelift JIT machine code |
| **Typical Compile Latency** | 30 – 120 seconds | **1 – 3 milliseconds** |
| **Simulation Throughput** | 100k – 250k events/sec | **780k+ events/sec** |
| **Delta Cycle Control** | Opaque (collapses delta steps) | **Caller-controlled `step_delta`** |
| **Glitch / Hazard Tracking** | Hidden | **Static & dynamic hazard detection** |
| **Silicon Power Modeling** | Post-simulation static estimation | **Real-time dynamic $P = \frac{1}{2} C V^2 f \alpha$** |
| **PDN Voltage Sag** | Requires external SPICE modeling | **Built-in $IR + L \frac{di}{dt}$ sag modeling** |
| **Memory State Arena** | Fragmented C++ structs | **Contiguous 64-bit dual vectors** |
| **Waveform Exporters** | Proprietary `.wdb` + `.vcd` | **Standard IEEE 1364 `.vcd`** |
| **Power Exporters** | SAIF generation | **Standard SAIF 2.0 interoperability** |
| **GUI Framework** | Java Swing (Heavy, memory-bound) | **Tauri v2 + React 19 (Dark obsidian)** |
| **Web Browser Execution** | Impossible | **100% Client-Side WebAssembly** |
| **Installation Footprint** | 60 – 110 GB | **< 50 MB** |
| **macOS Native Support** | No (requires Linux VM) | **Native Apple Silicon (AArch64)** |
| **License Cost** | Monolithic seat licenses ($$$) | **Open-source Core (MIT License)** |
