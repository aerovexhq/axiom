# Resumen de la biblioteca de primitivas Xilinx

Axiom EDA incorpora un catálogo nativo de biblioteca de primitivas integrado en el motor (`crates/ir/src/primitives/`). A diferencia de las herramientas EDA heredadas que obligan a los diseñadores a compilar bibliotecas externas de varios gigabytes de código fuente Verilog como `unisims` o `unimacro`, Axiom intercepta y reduce primitivas estándar de hardware AMD/Xilinx directamente en RAM.

---

## Arquitectura integrada de reducción de primitivas

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

### Familias de hardware soportadas
- **AMD Serie 7**: Artix-7, Kintex-7, Virtex-7, Zynq-7000 (`CARRY4`, `DSP48E1`, `RAMB36E1`).
- **AMD UltraScale y UltraScale+**: Kintex UltraScale+, Virtex UltraScale+, Zynq UltraScale+ (`CARRY8`, `DSP48E2`, `RAMB36E2`).
