# Aperçu de la bibliothèque de primitives Xilinx

Axiom EDA intègre un catalogue natif de bibliothèque de primitives au cœur du moteur (`crates/ir/src/primitives/`). Contrairement aux outils EDA hérités qui imposent la compilation de bibliothèques sources Verilog externes `unisims` ou `unimacro` de plusieurs gigaoctets, Axiom intercepte et convertit les primitives matérielles AMD/Xilinx standard directement en RAM.

---

## Architecture de conversion des primitives intégrée au moteur

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

### Familles matérielles prises en charge
- **AMD Série 7** : Artix-7, Kintex-7, Virtex-7, Zynq-7000 (`CARRY4`, `DSP48E1`, `RAMB36E1`).
- **AMD UltraScale et UltraScale+** : Kintex UltraScale+, Virtex UltraScale+, Zynq UltraScale+ (`CARRY8`, `DSP48E2`, `RAMB36E2`).
