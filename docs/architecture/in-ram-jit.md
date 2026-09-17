# In-RAM Cranelift JIT Compilation

Traditional hardware simulators (such as Verilator, Synopsys VCS, and Vivado xsim) rely heavily on multi-stage file generation:
1. Lexing and parsing HDL source files to intermediate ASTs.
2. Emitting massive C++ or C source files (often gigabytes in size).
3. Invoking external host compilers (GCC / Clang) to compile and link shared object files.
4. Loading shared libraries back into memory to begin simulation.

This approach introduces **tens of seconds to minutes of dead compile time** on every design iteration.

---

## The Axiom Zero-Disk JIT Pipeline

Axiom bypasses intermediate disk dumps and external toolchains completely:

```
Verilog / SystemVerilog Source
              |
              v
     Streaming Lexer & Pratt Parser
              | (In-Memory AST)
              v
     Hierarchical Elaborator (BIR)
              | (Dataflow Netlist Graph)
              v
  Cranelift JIT Code Generator
              | (Machine Instructions)
              v
Native Machine Code in RAM (x86_64 / AArch64)
              |
              +--> Directly mutates SimStateArena in O(1)
```

1. **Direct Cranelift Function Generation**:
   - Continuous assignments (e.g. `assign c = a + b`) and combinational blocks are lowered directly into Cranelift Intermediate Representation (CLIF).
   - Arithmetic, bitwise, shift, and reduction operators are compiled to vectorized host machine instructions.
2. **Native Memory Pointer Execution**:
   - The compiled function accepts direct pointers to the `SimStateArena` memory buffer (`values: *mut u64, masks: *mut u64`).
   - Bit-level operations execute with single-cycle CPU instructions (`and`, `or`, `xor`, `add`, `sub`).
3. **Change Detection Flags**:
   - Compiled functions return a single boolean integer indicating whether the destination net underwent a state transition, enabling optimal downstream sensitivity scheduling.
