# SystemVerilog (IEEE 1800) Support Overview

Axiom EDA provides native synthesis, simulation, and formal verification support for the **IEEE 1800 SystemVerilog** language standard. SystemVerilog extends classic Verilog with modern hardware design constructs (`logic`, `always_ff`, `always_comb`, `interface`, `package`) and verification capabilities, including SystemVerilog Assertions (SVA) and constrained random stimulus.

---

## The SystemVerilog Paradigm in Axiom

```
+-------------------------------------------------------------------------------+
| SystemVerilog Design & Verification Unified Engine                            |
+---------------------------------------+---------------------------------------+
| Hardware Design Enhancements          | Verification & Formal Proofs          |
|---------------------------------------+---------------------------------------|
| - Universal 'logic' data type         | - Immediate & Concurrent Assertions   |
| - Strict 'always_comb' / 'always_ff'  | - Temporal Sequences (##n, |->, |=>)   |
| - Typedefs, Structs & Enums           | - In-Engine Bounded Model Checker     |
| - Interfaces & Modports               | - Constrained Random Stimulus (rand)  |
| - Parameterized Packages              | - Automated Testbench Generators      |
+---------------------------------------+---------------------------------------+
| Unified Cranelift JIT & WebAssembly In-RAM Simulation Kernel                  |
+-------------------------------------------------------------------------------+
```

### Key Architectural Advantages in Axiom
1. **Zero-Overhead Elaboration**: Elaborates SystemVerilog interfaces, modports, and packages directly into flat BIR netlists without creating intermediate wrapper files.
2. **Explicit Intent Verification**: Enforces strict synthesis rules on `always_comb` and `always_ff` blocks, catching latch inference and race hazards at parse time.
3. **Formal Property Engine**: Natively compiles SVA temporal properties directly into boolean state transition relations verified by Axiom's in-engine Bounded Model Checker.
