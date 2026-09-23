# Xilinx Primitif Kütüphanesine Genel Bakış

Axiom EDA, yerel motor içi primitif kütüphanesi kataloğu içerir (`crates/ir/src/primitives/`). Tasarımcıları çok gigabaytlık harici `unisims` veya `unimacro` Verilog kaynak kütüphanelerini derlemeye zorlayan eski EDA araçlarının aksine Axiom, standart AMD/Xilinx donanım primitiflerini doğrudan RAM'de yakalar ve indirger.

---

## Motor İçi Primitif İndirgeme Mimarisi

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

### Desteklenen Donanım Aileleri
- **AMD 7-Serisi**: Artix-7, Kintex-7, Virtex-7, Zynq-7000 (`CARRY4`, `DSP48E1`, `RAMB36E1`).
- **AMD UltraScale & UltraScale+**: Kintex UltraScale+, Virtex UltraScale+, Zynq UltraScale+ (`CARRY8`, `DSP48E2`, `RAMB36E2`).
