# VHDL (IEEE 1076) Support Overview

Axiom EDA incorporates native parsing, elaboration, and Language Server Protocol diagnostics for the **IEEE 1076 VHDL** standard (`crates/lsp/src/vhdl.rs`). VHDL (VHSIC Hardware Description Language) emphasizes strong typing, strict structural separation, and deterministic hardware modeling.

---

## The VHDL Architecture in Axiom

```
+-------------------------------------------------------------------------------+
| Axiom Multi-Language HDL Processing Core                                      |
+---------------------------------------+---------------------------------------+
| Verilog / SystemVerilog Frontend      | VHDL Frontend (IEEE 1076-1993/2008)   |
| (IEEE 1364 / IEEE 1800)               | (Entity, Architecture, Port Maps)     |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|             +-------------------------------------------+                     |
|             | Unified Bound Intermediate Representation  |                    |
|             | (BIR Netlist & Technology Mapping Engine) |                     |
|             +-------------------------------------------+                     |
|                                   |                                           |
|                                   v                                           |
|       Cranelift JIT Compiler & WebAssembly Simulation Backends                |
+-------------------------------------------------------------------------------+
```

### Supported VHDL Standards
- **IEEE 1076-1993**: Full support for entities, architectures, component declarations, processes, and standard packages.
- **IEEE 1076-2008**: Unconstrained arrays in port lists, simplified sensitivity lists (`process(all)`), and standard operators.
- **Dual-Language Co-Design**: Axiom's elaborator allows Verilog and VHDL modules to be instantiated within the same design hierarchy.
