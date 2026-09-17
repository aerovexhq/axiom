# Quickstart (60-Second Setup)

Get up and running with Axiom in less than a minute.

---

## Prerequisites

- **Rust toolchain** (1.80+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** (v20+): For building the desktop GUI and WebAssembly frontend.

---

## 1. Clone & Build

Clone the repository and build the headless CLI binary:

```bash
git clone https://github.com/larvance/axiom.git
cd axiom
cargo build --release -p betterado-cli
```

*(Note: The CLI binary is generated at `target/release/betterado-cli` or via cargo run).*

---

## 2. Compile Your First HDL Design

Axiom includes standard test fixtures in `tests/fixtures/`. Compile a 32-bit ALU directly into machine code in RAM:

```bash
cargo run -p betterado-cli -- compile tests/fixtures/alu.v -t alu
```

Output:
```text
============================================================
 Axiom HDL In-RAM Compiler: tests/fixtures/alu.v
 Top-Level Target: alu
============================================================
  [1/3] Lexing & Parsing in 172.70µs
  [2/3] Elaboration: 6 nets, 1 processes, 1 continuous assigns in 218.86µs
  [3/3] In-RAM Cranelift JIT Compilation in 2.41ms
------------------------------------------------------------
 Compilation successful! Total latency: 2.81ms
 In-RAM Arena Footprint: 6 64-bit words (48 bytes)
============================================================
```

---

## 3. Run Batch Simulation with Waveform & SAIF Export

Execute 100 clock ticks, exporting standard IEEE 1364 VCD waveforms and Synopsys SAIF 2.0 switching activity files:

```bash
cargo run -p betterado-cli -- run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

Output:
```text
============================================================
 Axiom In-RAM Batch Simulator: tests/fixtures/counter.v
 Target: counter | Steps: 100 ticks
============================================================
 Simulation completed in 410.15µs
 Final SimTime: 50000 ps (50.000 ns) | Total Deltas: 0
 Glitches Detected: 0
 Exported IEEE 1364 VCD to: waveforms.vcd
 Exported SAIF 2.0 to: power.saif
============================================================
```

---

## 4. Run High-Resolution Benchmarks

Stress test the simulation kernel and measure event throughput:

```bash
cargo run -p betterado-cli -- benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 5. Launch Modern Desktop / Web UI

```bash
cd ui
npm install
npm run dev
```

Open your browser at `http://localhost:5173` to interactively step simulation time, inspect delta-cycle glitches, and view live physics power telemetry.
