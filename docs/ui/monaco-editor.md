# Monaco HDL Code Editor & Language Server

The Axiom HDL Code Editor integrates Microsoft's Monaco Editor with an in-RAM Verilog, SystemVerilog, and VHDL Language Server Protocol (LSP) daemon (`crates/lsp`). It combines syntax highlighting, real-time static design rule checking, AST hover tooltips, and autocompletion snippets into an aerospace-grade IDE.

---

## The Monarch HDL Tokenizer

Axiom features a custom Monarch tokenizer engineered specifically for IEEE 1364 Verilog, IEEE 1800 SystemVerilog, and IEEE 1076 VHDL.

### Visual Styling (`axiom-dark`)
The editor is styled with Axiom's dark palette:
- **Keywords** (`module`, `always_ff`, `assign`, `wire`, `reg`): High-contrast cyan (`#00f0ff`)
- **System Tasks & Functions** (`$display`, `$finish`, `$time`, `$clog2`): Violet (`#a855f7`)
- **Strings**: Amber (`#fbbf24`)
- **Numbers & Sized Literals** (`8'hFF`, `1'b0`, `32'd100`): Emerald green (`#34d399`)
- **Comments** (`//`, `/* ... */`): Muted slate (`#64748b`)
- **Identifiers & Signal Names**: Soft white (`#f1f5f9`)

---

## Real-Time In-RAM Static Linter

Unlike legacy tools that require multi-minute compilation pipelines to flag syntax mistakes or design hazards, Axiom's linter operates continuously in RAM with a 250ms debounce window.

### Built-In Static Design Rules

| Rule ID | Severity | Name | Description & Hazard Prevented |
| :--- | :--- | :--- | :--- |
| `AXIOM_W001` | Warning | **Blocking in Sequential** | Using blocking assignments (`=`) inside clocked blocks (`always @(posedge clk)`) introduces simulation synthesis race conditions. |
| `AXIOM_W002` | Warning | **Non-Blocking in Combinational** | Using non-blocking assignments (`<=`) in combinational blocks (`always @*`) creates multi-delta race hazards and synthesis mismatches. |
| `AXIOM_W003` | Warning | **Undriven Net** | A declared wire or net has no continuous driver (`assign`), primitive output, or submodule driver connected. |
| `AXIOM_W004` | Warning | **Unused Signal** | A declared register or net is written or defined but never read in any downstream logic cone. |
| `AXIOM_E002` | Error | **Multi-Driver Contention** | Multiple continuous assignments or simultaneous drivers drive the same net, causing electric shorts and `X` contention. |
| `AXIOM_W006` | Warning | **Transparent Latch Inferred** | Incomplete conditional branches (`if` without `else`, or `case` without all arms) infer unintended transparent latches. |
| `AXIOM_W007` | Warning | **Missing Case Default** | A `case` statement does not include a `default:` arm, risking state trapping in non-covered vectors. |
| `AXIOM_W008` | Warning | **Bit-Width Mismatch** | Net or port assignment width differs between left-hand and right-hand expressions, leading to silent bit truncation. |

Squiggly underlines appear directly under violating tokens in the editor. Clicking any error card in the **Problems & Linter** dock immediately jumps the editor cursor to the exact line and column.

---

## AST Hover Cards

Hovering the mouse cursor over any identifier in the editor opens an interactive AST metadata tooltip:
- **Signal Declaration**: Displays net type (`wire`, `reg`, `logic`), bit range (`[31:0]`), and signedness.
- **Driver Location**: Shows the exact line number where the signal is assigned or driven.
- **Xilinx Primitive Documentation**: Hovering over hardware primitives (`LUT6_2`, `DSP48E2`, `RAMB36E2`, `BUFG`, `CARRY8`) renders full pinout documentation, truth table parameters, and behavioral descriptions.

---

## Intelligent Autocompletion

Axiom's Language Server delivers instant autocompletions:
- **IEEE 1364/1800 Keywords**: Automatic skeleton generation for `module`, `always_ff`, `always_comb`, `case`, and `generate`.
- **System Tasks**: Formatted argument templates for `$display`, `$monitor`, `$finish`, and `$dumpvars`.
- **In-Scope Signals**: Suggests nets, registers, and parameters declared within the active module hierarchy.
- **Xilinx 7-Series / UltraScale+ Primitives**: Complete port-mapping instantiation templates for hardware cells.

---

## Editor Ergonomics & Persistence

- **Multi-Tab File Management**: Open multiple design sources simultaneously. Active file tabs persist across browser reloads.
- **Breadcrumb Navigation**: Path bar above the editor displays current project, file set, active file, and parent module.
- **Viewport Position Persistence**: Monaco editor scroll position (vertical line and horizontal offset) is cached per file in `localStorage` so returning to a file restores the exact viewpoint.
