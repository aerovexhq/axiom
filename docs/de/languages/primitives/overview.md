# Übersicht der Xilinx-Primitiven-Bibliothek

Axiom EDA enthält einen nativen, Engine-internen Primitiven-Bibliothekskatalog (`crates/ir/src/primitives/`). Im Gegensatz zu herkömmlichen EDA-Tools, die Entwickler zwingen, externe Verilog-Quellbibliotheken wie `unisims` oder `unimacro` von mehreren Gigabyte zu kompilieren, fängt Axiom standardmäßige AMD/Xilinx-Hardwareprimitiven ab und senkt sie direkt im RAM ab.

---

## Engine-interne Primitiven-Absenkungsarchitektur

```
+-------------------------------------------------------------------------------+
| User Verilog Design with Instantiated Hardware Primitives                     |
| (LUT6_2, FDRE, BUFG, CARRY8, DSP48E2, RAMB36E2)                               |
+-------------------------------------------------------------------------------+
|                                   |                                           |
|                                   v                                           |
|       +-------------------------------------------------------+               |
|       | Axiom Primitive Catalog (crates/ir/src/primitives/)  |               |
|       | - Built-in pin definitions & direction maps           |               |
|       | - Cycle- and delta-accurate functional emulation     |               |
|       | - Exact truth table parameter evaluation (INIT)       |               |
|       +-------------------------------------------------------+               |
|                                   |                                           |
|                                   v                                           |
|       +-------------------------------------------------------+               |
|       | Direct JIT & WASM Code Generation                     |               |
|       | - Native Cranelift 64-bit machine code in RAM         |               |
|       | - Zero intermediate files & zero disk turnaround      |               |
|       +-------------------------------------------------------+               |
+-------------------------------------------------------------------------------+
```

### Unterstützte Hardware-Familien
- **AMD 7-Series**: Artix-7, Kintex-7, Virtex-7, Zynq-7000 (`CARRY4`, `DSP48E1`, `RAMB36E1`).
- **AMD UltraScale & UltraScale+**: Kintex UltraScale+, Virtex UltraScale+, Zynq UltraScale+ (`CARRY8`, `DSP48E2`, `RAMB36E2`).
