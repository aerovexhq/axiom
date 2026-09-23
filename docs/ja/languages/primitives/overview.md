# Xilinxプリミティブライブラリ概要

Axiom EDAには、エンジン内蔵のネイティブプリミティブライブラリカタログが組み込まれています（`crates/ir/src/primitives/`）。数ギガバイトに及ぶ外部の `unisims` や `unimacro` Verilogソースライブラリのコンパイルを強制するレガシーEDAツールとは異なり、Axiomは標準のAMD/Xilinxハードウェアプリミティブをメモリ内で直接インターセプトして低レベル化します。

---

## エンジン内蔵プリミティブ低レベル化アーキテクチャ

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

### サポートされるハードウェアファミリ
- **AMD 7-Series**: Artix-7, Kintex-7, Virtex-7, Zynq-7000 (`CARRY4`, `DSP48E1`, `RAMB36E1`)。
- **AMD UltraScale & UltraScale+**: Kintex UltraScale+, Virtex UltraScale+, Zynq UltraScale+ (`CARRY8`, `DSP48E2`, `RAMB36E2`)。
