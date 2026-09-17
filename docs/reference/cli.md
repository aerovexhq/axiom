# CLI Reference Manual

Axiom includes a fast, standalone command-line driver for CI/CD pipelines, headless testing, and benchmark regression runs.

---

## Global Usage

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### Global Flags
- `-h, --help`: Displays help and usage information.
- `-v, --version`: Displays the current version of Axiom EDA.

---

## Subcommands

### 1. `compile`
Performs in-memory lexical analysis, Pratt parsing, hierarchical netlist elaboration, and Cranelift JIT compilation without disk serialization.

```bash
axiom compile <FILE> -t <TOP>
```

#### Arguments
- `<FILE>`: Path to the Verilog or SystemVerilog HDL file (`.v` or `.sv`).
- `-t, --top <TOP>`: Identifier of the top-level module to elaborate.

#### Example
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run`
Compiles the specified HDL design and simulates it for a designated number of clock ticks, with optional real-time VCD and SAIF output generation.

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### Options
- `-t, --top <TOP>`: Name of top-level module (required).
- `--ticks <N>`: Number of clock ticks to simulate (default: 100).
- `--vcd <FILE>`: File path to dump IEEE 1364 Value Change Dump waveforms.
- `--saif <FILE>`: File path to dump SAIF 2.0 switching activity data.

#### Example
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark`
Executes statistical micro-benchmarks measuring end-to-end JIT compile turnaround and raw simulation event throughput.

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### Options
- `-t, --top <TOP>`: Name of top-level module (required).
- `--cycles <N>`: Number of simulated clock cycles (default: 5000).

#### Example
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
