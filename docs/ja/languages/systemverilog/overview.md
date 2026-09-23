# SystemVerilog (IEEE 1800) サポート概要

Axiom EDAは、**IEEE 1800 SystemVerilog** 言語標準に対してネイティブな論理合成、シミュレーション、形式検証サポートを提供します。SystemVerilogは、モダンなハードウェア設計構文（`logic`, `always_ff`, `always_comb`, `interface`, `package`）や、SystemVerilogアサーション（SVA）や制約付きランダム刺激を含む検証機能によって、従来のVerilogを拡張しています。

---

## AxiomにおけるSystemVerilogパラダイム

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

### Axiomにおける主要なアーキテクチャ上の利点
1. **ゼロオーバーヘッドエラボレーション**: 中間ラッパーファイルを作成することなく、SystemVerilogインターフェース、モドポート、パッケージをフラットなBIRネットリストに直接エラボレートします。
2. **明示的な設計意図の検証**: `always_comb` および `always_ff` ブロックに厳格な合成ルールを適用し、ラッチ推論や競合ハザードをパース時に捕捉します。
3. **形式プロパティエンジン**: SVA時間プロパティをブール状態遷移関係に直接コンパイルし、Axiomの内蔵限界モデルチェッカーで検証します。
