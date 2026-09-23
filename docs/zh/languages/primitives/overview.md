# Xilinx 原语库概览

Axiom EDA 内置了引擎原生的原语库目录（`crates/ir/src/primitives/`）。不同于强制设计者编译数 GB 外部 `unisims` 或 `unimacro` Verilog 源码库的传统 EDA 工具，Axiom 直接在内存中拦截并降解标准 AMD/Xilinx 硬件原语。

---

## 引擎内置原语降解架构

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

### 支持的芯片器件族
- **AMD 7系列**：Artix-7, Kintex-7, Virtex-7, Zynq-7000 (`CARRY4`, `DSP48E1`, `RAMB36E1`)。
- **AMD UltraScale 与 UltraScale+**：Kintex UltraScale+, Virtex UltraScale+, Zynq UltraScale+ (`CARRY8`, `DSP48E2`, `RAMB36E2`)。
