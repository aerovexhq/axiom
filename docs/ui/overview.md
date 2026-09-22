# Axiom Studio Workspace Overview

Axiom Studio is an aerospace-grade, cross-platform Electronic Design Automation (EDA) interface engineered natively in Rust and React 19. It delivers a unified, high-performance workspace pairing a responsive Monaco HDL code editor with synchronized gate-level schematics, digital waveforms, tactile hardware breadboards, static timing analyzers, and physical silicon floorplanning.

---

## Workspace Architecture

Axiom Studio abandons the sluggish, fragmented multi-window interfaces of legacy EDA tools in favor of a cohesive dual-pane workspace:

```
+-------------------------------------------------------------------------------+
| Header: Brand | File Sets | Simulation Ribbon (Run, Step, Reset) | PDN Gauges |
+---------------------------------------+---------------------------------------+
| Left Pane (Monaco HDL Editor)         | Right Pane (Dynamic Visualizers)      |
|                                       | - Schematic DAG Visualizer            |
| - Verilog / SystemVerilog / VHDL      | - Virtual Lab & Basys 3 FPGA Bay      |
| - In-RAM LSP Real-Time Linter         | - Waveforms & Logic Analyzer          |
| - Monarch Tokenizer & Autocomplete    | - Timing Radar & Static Timing        |
| - AST Hover Cards & Breadcrumbs       | - Technology Mapping Studio           |
|                                       | - Floorplanning & Silicon Die         |
|                                       | - Formal Verification (BMC)           |
|                                       | - Protocol Analyzer & Dissector       |
|                                       | - Microarchitecture & Multi-Die       |
+---------------------------------------+---------------------------------------+
| Unified Bottom Dock: Console & REPL | Problems & Linter | Telemetry Radar     |
+-------------------------------------------------------------------------------+
```

### 1. Header & Simulation Command Ribbon
The top navigation header hosts project identity tags, the Vivado file set selector, and the simulation execution ribbon. It allows instant compilation, running, pausing, discrete delta-cycle stepping, and simulation time rewinding. Real-time Power Distribution Network (PDN) telemetry gauges report dynamic power in milliwatts ($P$), inductive voltage sag ($V_{\text{sag}}$), and total supply current ($I$).

### 2. Left Pane: Monaco HDL Code Editor
A customized instance of Microsoft Monaco Editor configured with Axiom's Monarch Verilog/SystemVerilog tokenizer, dark acrylic theme (`axiom-dark`), real-time AST hover tooltips, and in-RAM Language Server Protocol (LSP) diagnostics.

### 3. Right Pane: Visualizer Bay
A full-height, full-width canvas accommodating Axiom's visual analysis tools:
- **Schematic DAG**: Real-time IEEE gate-level netlist visualizer with collision-free orthogonal channel routing.
- **Virtual Lab**: Tactile hardware breadboard with Digilent Basys 3 Artix-7 board switches, LEDs, and 7-segment displays.
- **Waveforms**: 60+ FPS digital logic analyzer with drag-to-measure measurement windows and zero-time delta cycle inspection.
- **Timing Radar**: Topological static timing analysis displaying critical path waterfalls and setup/hold slack histograms.
- **Tech Mapping**: Gate-level technology mapping lowering RTL to target FPGA primitives (LUTs, DSP48E2, RAMB36E2).
- **Floorplanning**: 2D silicon die floorplanning studio displaying CLB site placement, thermal heatmaps, and routing flightlines.
- **Formal Verification**: Bounded Model Checking (BMC) and $k$-induction verification for SystemVerilog Assertions.
- **Protocol Analyzer**: Hardware serial dissectors for UART, SPI, I2C, CAN Bus, USB, and Ethernet.
- **Microarchitecture**: Automated datapath detection, ALU inspectors, RegFile memory views, and FSM state bubble graphs.

### 4. Center Resizable Splitter
A responsive divider allowing engineers to adjust the editor vs. visualizer balance. Axiom features dynamic camera midpoint anchoring: dragging the splitter recalculates the canvas world-space camera midpoint continuously, preventing schematic squishing or zoom loss.

### 5. Unified Bottom Dock
A collapsible dock organizing secondary analysis tools into clean tabs:
- **Console & REPL**: Interactive Verilog compiler outputs, `$display` statement logging, and simulation status.
- **Problems & Linter**: Active diagnostic cards with 1-click line navigation to syntax and design rule warnings.
- **Telemetry**: Analog silicon telemetry meters for core supply voltage, inductive sag, and switching current.
- **Waveforms Preview**: Compact waveform view when working in split schematic modes.

---

## Global Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | **Save Project** | Persists all design files and metadata to disk or IndexedDB |
| `Ctrl + Enter` / `Cmd + Enter` | **Compile & Run** | Compiles active design into RAM via Cranelift JIT and starts clock |
| `Space` | **Run / Pause** | Toggles simulation engine execution |
| `F10` | **Step +1 ns** | Advances physical simulation time by exactly 1,000 picoseconds |
| `Shift + F10` | **Step +100 ps** | Advances physical simulation time by exactly 100 picoseconds |
| `F11` | **Step Delta (\(\delta\))** | Steps a single discrete zero-time evaluation cycle without advancing physical time |
| `Ctrl + R` / `Cmd + R` | **Reset Simulation** | Rewinds simulation clock to \(t=0\) and restores initial signal vectors |
| `Ctrl + Alt + F` | **Floorplan Studio** | Opens the physical FPGA silicon floorplanning visualizer |
| `Ctrl + P` / `Cmd + P` | **Quick Open File** | Opens the Omnibar search palette to jump across project sources |
| `Ctrl + \`` | **Toggle Bottom Dock** | Expands or collapses the unified bottom dock |
| `Ctrl + B` / `Cmd + B` | **Toggle Sidebar** | Shows or hides the Vivado project file set sidebar |
| `Escape` | **Close Modal / Deselect** | Dismisses active dialogs, inspectors, or clears net selection |

---

## Mobile Studio & Responsive Drawer

When operating on mobile devices or narrow browser windows (width \(\le 768\text{px}\)), Axiom Studio automatically adapts:
- Multi-pane resizable splitters are disabled to eliminate cramped viewports.
- An off-canvas slide-out drawer (`MobileDrawer.tsx`) provides access to project file sets, simulation controls, and view selection.
- The interface renders in **1-Panel-at-a-Time** mode, allocating 100% of the screen width and height to the active view.
- A thumb-friendly mobile bottom bar (`MobileBottomBar.tsx`) provides 5 core navigation tabs: **Code**, **Schematic**, **Lab**, **Waves**, and **Console**, complete with live problem badges.
