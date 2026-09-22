# Microarchitecture & Multi-Die Viewers

Axiom EDA provides dedicated microarchitectural inspection tools (`crates/ir/src/microarch/`, `MicroarchViewer.tsx`, `MultiDieViewer.tsx`, `PpaParetoViewer.tsx`). These tools automatically detect processor datapaths, arithmetic logic units, register files, and state machines, as well as modern 2.5D/3D multi-die chiplet packages.

---

## Automated Datapath Detection

The RTL elaborator inspects module structure and infers standard microarchitectural blocks:

```
+-------------------------------------------------------------------------------+
| Microarchitecture Datapath Detector:                                          |
| Detected: 1 ALU (32-Bit) | 1 RegFile (32x32) | 1 FSM Controller (5 States)     |
+-------------------------------------------------------------------------------+
| ALU Inspector Modal:                                                          |
| - Opcode: 4'b0010 (ADD) | Operand A: 0x0000_0020 | Operand B: 0x0000_0014     |
| - Result: 0x0000_0034   | Zero Flag: 0           | Overflow: 0                |
+-------------------------------------------------------------------------------+
| FSM Bubble Diagram: [IDLE] --start--> [READ] --ready--> [EXEC] --done--> [IDLE]
+-------------------------------------------------------------------------------+
```

### 1. ALU Operation Inspector
Automatically detects multiplexer-driven arithmetic blocks. Displays active opcode selections (ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT) and live register operand valuations.

### 2. Register File (RegFile) Inspector
Detects multi-port memory arrays (`reg [31:0] registers [0:31]`). Provides an interactive 32-row grid displaying live hexadecimal contents of all architectural registers with real-time write-strobe highlights.

### 3. FSM State Bubble Visualizer (`FsmViewer.tsx`)
Automatically extracts Finite State Machine state vectors and transition matrices:
- Renders an interactive directed graph with state bubbles and transition arrows.
- Illuminates the currently active state bubble during live simulation.
- Audits FSM structure: detects unreachable states, terminal trap states, and missing default recovery branches.

---

## 2.5D & 3D Multi-Die Silicon Packaging

For modern chiplet and multi-die architectures (such as AMD UltraScale+ Stacked Silicon Interconnect):
- **Interposer Die Layout**: Visualizes silicon interposers connecting multiple active logic dies (SLRs).
- **Die-to-Die Interconnect (Super Long Lines - SLL)**: Analyzes bandwidth, propagation latency, and skew across micro-bumps bridging physical dies.

---

## PPA Pareto Trade-off Explorer

The PPA Viewer analyzes the design's trade-offs across three fundamental engineering metrics:
- **Power (mW)**: Total dynamic and leakage energy consumption.
- **Performance (MHz)**: Maximum achievable clock frequency derived from Static Timing Analysis.
- **Area (LUTs / FFs)**: Total silicon resource footprint.

The visualizer plots Pareto-optimal configuration frontiers, allowing designers to select the optimal pipeline balance for high-throughput or low-power operating profiles.
