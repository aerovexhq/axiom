# VHDL (IEEE 1076) サポート概要

Axiom EDAは、**IEEE 1076 VHDL** 標準（`crates/lsp/src/vhdl.rs`）のネイティブ構文解析、エラボレーション、言語サーバープロトコル診断を組み込んでいます。VHDL（VHSIC Hardware Description Language）は、厳格な型付け、厳密な構造分離、決定論的なハードウェアモデリングを重視しています。

---

## AxiomにおけるVHDLアーキテクチャ

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

### サポートされるVHDL標準規格
- **IEEE 1076-1993**: エンティティ、アーキテクチャ、コンポーネント宣言、プロセス、標準パッケージの完全サポート。
- **IEEE 1076-2008**: ポートリスト内の未制約配列、簡略化された感度リスト（`process(all)`）、標準演算子のサポート。
- **デュアル言語協調設計**: Axiomのエラボレータにより、VerilogとVHDLのモジュールを同一の設計階層内でインスタンス化可能です。
