# Verilog HDL (IEEE 1364) Support Overview

Axiom EDA provides comprehensive, native compilation and simulation support for the IEEE 1364-1995, IEEE 1364-2001, and IEEE 1364-2005 Verilog Hardware Description Language standards. 

Rather than relying on legacy multi-stage C++ transpilations or disk-heavy snapshot generation, Axiom translates Verilog directly into an in-RAM Intermediate Representation (BIR) that compiles into native machine code (x86_64, AArch64) via Cranelift JIT in under 3 milliseconds, or executes client-side in browsers via WebAssembly.

---

## Verilog Compilation & Simulation Pipeline

```
+-------------------------------------------------------------------------------+
| Axiom In-RAM HDL Processing Pipeline                                          |
+-------------------------------------------------------------------------------+
| Source Code (.v)                                                              |
|   |                                                                           |
|   v [Lexer & Tokenizer] (crates/syntax/src/lexer.rs)                          |
| IEEE 1364 Token Stream (Keywords, Identifiers, Sized Numbers, Directives)     |
|   |                                                                           |
|   v [Recursive Descent Parser] (crates/syntax/src/parser.rs)                  |
| Abstract Syntax Tree (AST) (Modules, Ports, Declarations, Processes, Assigns) |
|   |                                                                           |
|   v [Hardware Elaborator] (crates/ir/src/elaborator.rs)                       |
| Bound Intermediate Representation (BIR Netlist, Stratified Event Graph)       |
|   |                                                                           |
|   +---------------------------------------+-----------------------------------+
|   | (Desktop Native)                      | (In-Browser WebAssembly)          |
|   v                                       v                                   |
| [Cranelift JIT Backend]                   | [WASM Execution Engine]           |
| Machine Code in RAM (x86_64 / AArch64)    | Web Worker Sandbox (32-bit WASM)  |
|   |                                       |                                   |
|   +-------------------+-------------------+                                   |
|                       v                                                       |
|       [Stratified Event Scheduler] (crates/sim/src/engine.rs)                 |
|       Active -> Inactive -> NBA -> Monitor -> Future Events                   |
+-------------------------------------------------------------------------------+
```

### 1. In-RAM Lexing & Parsing
The high-speed lexer and recursive descent parser handle all IEEE 1364 lexical conventions, sized number literals, compiler directives (`\`include\`, `\`define\`, `\`ifdef\`), and macro expansions with sub-millisecond execution times.

### 2. Netlist Elaboration
The elaborator unrolls module hierarchies, resolves parameter overrides (`#(.WIDTH(8))`), binds continuous assignments, wires gate primitives, extracts finite state machines, and constructs a stratified event scheduling graph.

### 3. Dual-Runtime Execution
- **Desktop Native JIT**: Directly lowers boolean expressions, multiplexers, and arithmetic operators to native machine instructions, achieving simulation throughput exceeding 780,000 events/second.
- **WebAssembly Sandbox**: Runs in an isolated background Web Worker with SharedArrayBuffer telemetry, delivering 100% client-side simulation with zero server dependencies.

---

## Standards Compliance Matrix

| IEEE Standard | Feature Area | Axiom Support Status |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | Structural gate primitives (`and`, `or`, `not`, `xor`, `buf`) | Fully Supported |
| **IEEE 1364-1995** | Non-ANSI port headers (`module foo (a, b); input a;`) | Fully Supported |
| **IEEE 1364-2001** | ANSI port list headers (`module foo (input wire a, output reg b);`) | Fully Supported |
| **IEEE 1364-2001** | Indexed part-select operators (`[base +: width]`, `[base -: width]`) | Fully Supported |
| **IEEE 1364-2001** | Multi-dimensional memory arrays (`reg [31:0] mem [0:1023]`) | Fully Supported |
| **IEEE 1364-2001** | Combined declaration and continuous assign (`wire [7:0] w = in;`) | Fully Supported |
| **IEEE 1364-2005** | Procedural loop constructs (`for`, `while`, `repeat`, `forever`) | Fully Supported |
| **IEEE 1364-2005** | System tasks (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | Fully Supported |
| **IEEE 1364-2005** | Memory file loading (`$readmemb`, `$readmemh`) | Fully Supported |
