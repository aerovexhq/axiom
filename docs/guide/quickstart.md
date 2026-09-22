# Quickstart & Installation

Get up and running with **Axiom EDA** in less than 60 seconds.

---

## 1. Single-Line Install

Axiom provides lightweight, self-contained standalone binaries (<50 MB) with zero external toolchain requirements.

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

The installer automatically detects your operating system and architecture (`x86_64` or `aarch64` / Apple Silicon), installs the `axiom` binary into `~/.axiom/bin` (or `%USERPROFILE%\.axiom\bin`), and configures your `$PATH`.

---

## 2. Release Versioning & Custom Flags

You can specify a custom release version or override the destination path.

### Target a Specific Version

::: code-group

```bash [Linux & macOS (Env Var)]
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```bash [Linux & macOS (Flag)]
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --version v1.0.0
```

```powershell [Windows (Env Var)]
$env:AXIOM_VERSION="v1.0.0"; irm https://axiom.aerovex.net/install.ps1 | iex
```

```powershell [Windows (Parameter)]
& ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v1.0.0
```

:::

### Custom Installation Directory

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. Dedicated Build from Source Script

If you prefer compiling from source or modifying the engine, Axiom includes an automated build driver in `scripts/`:

### Linux & macOS (`scripts/build_from_source.sh`)

Clone the repository and run the automated driver:

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**Build Script Options:**

- `--cli-only`: Skip Node/UI and build only the headless Rust CLI:
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>`: Install to a custom system or user directory:
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug`: Fast unoptimized debug compilation:
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

In PowerShell:
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. Manual Cargo Compilation

You can also invoke Cargo directly:

```bash
cargo build --release --bin axiom
```

The output binary will be located at `target/release/axiom`.

Verify your installation:
```bash
axiom --version
```

Output:
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. Compile Your First HDL Design

Axiom includes standard verified hardware fixtures in `tests/fixtures/`. Compile a 32-bit ALU directly into native machine code in RAM:

```bash
axiom compile tests/fixtures/alu.v -t alu
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

## 6. Run Batch Simulation with Waveform & SAIF Export

Execute 100 clock ticks, exporting standard IEEE 1364 VCD waveforms and Synopsys SAIF 2.0 switching activity files:

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
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

## 7. Run High-Resolution Benchmarks

Stress test the simulation kernel and measure event throughput:

```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 8. Launch Modern Desktop Studio & Web UI

### Standalone Native Desktop App
Launch the native desktop window directly (powered by Tauri v2 with zero port hosting and direct Cranelift JIT in RAM):
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### In-Browser WebAssembly Studio
Open the live zero-install studio deployed at **[https://axiom.aerovex.net](https://axiom.aerovex.net)**.

### Local UI Development Server
```bash
cd ui
npm install
npm run dev
```

Key capabilities:
- **Unified Omnibar (`Ctrl+K`)**: Instant fuzzy search across signals, netlist hierarchy, actions, and documentation.
- **High-Density Waveform Viewer**: Multi-radix bus exploder, dual cursors ($\Delta t$), and zero-time $\delta$-cycle hazard drawer.
- **GPU-Accelerated Schematic DAG**: 60+ FPS Canvas 2D engine with 1-click critical logic cone slicers (`F` / `O`).
- **Virtual Instrument Rack**: 8-bit DIP switch bank, tactile buttons, rotary hex dial, 7-seg displays, and test pattern generator.
- **Timing Radar & Silicon Energy Treemap**: STA critical path waterfall and dynamic power decomposition ($P = \frac{1}{2} C V^2 f \alpha$).
- **Embedded Scripting Shell**: Direct in-RAM simulation REPL (`run`, `step delta`, `force`, `get`).
