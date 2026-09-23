# Verilog HDL (IEEE 1364) サポート概要

Axiom EDAは、IEEE 1364-1995、IEEE 1364-2001、およびIEEE 1364-2005のVerilogハードウェア記述言語標準に対して、包括的かつネイティブなコンパイルとシミュレーションのサポートを提供します。

レガシーな多段階C++トランスパイルや重いディスクスナップショット生成に依存するのではなく、AxiomはVerilogをメモリ内中間表現（BIR）に直接変換し、Cranelift JITを介して3ミリ秒未満でネイティブ機械語（x86_64、AArch64）にコンパイルするか、WebAssemblyを介してブラウザ内でクライアントサイド実行します。

---

## Verilogコンパイル＆シミュレーションパイプライン

```
+-------------------------------------------------------------------------------+
| Axiom In-RAM HDL Processing Pipeline                                          |
+-------------------------------------------------------------------------------+
| Source Code (.v)                                                              |
|   |                                                                           |
|   v [Lexer & Tokenizer] (crates/syntax/src/lexer.rs)                          |
| IEEE 1364 Token Stream (Keywords, Identifiers, Sized Numbers, Directives)     |
|   |                                                                           |
|   v [Recursive Descent Parser] (crates/syntax/src/parser.rs)                  |
| Abstract Syntax Tree (AST) (Modules, Ports, Declarations, Processes, Assigns) |
|   |                                                                           |
|   v [Hardware Elaborator] (crates/ir/src/elaborator.rs)                       |
| Bound Intermediate Representation (BIR Netlist, Stratified Event Graph)       |
|   |                                                                           |
|   +---------------------------------------+-----------------------------------+
|   | (Desktop Native)                      | (In-Browser WebAssembly)          |
|   v                                       v                                   |
| [Cranelift JIT Backend]                   | [WASM Execution Engine]           |
| Machine Code in RAM (x86_64 / AArch64)    | Web Worker Sandbox (32-bit WASM)  |
|   |                                       |                                   |
|   +-------------------+-------------------+                                   |
|                       v                                                       |
|       [Stratified Event Scheduler] (crates/sim/src/engine.rs)                 |
|       Active -> Inactive -> NBA -> Monitor -> Future Events                   |
+-------------------------------------------------------------------------------+
```

### 1. インメモリ字句解析＆構文解析
高速レキサーおよび再帰下降パーサーは、すべてのIEEE 1364字句規則、サイズ指定数値リテラル、コンパイラディレクティブ（`` `include ``, `` `define ``, `` `ifdef ``）、およびマクロ展開をサブミリ秒の実行時間で処理します。

### 2. ネットリストエラボレーション
エラボレータは、モジュール階層を展開し、パラメータオーバーライド（`#(.WIDTH(8))`）を解決し、継続的代入をバインドし、ゲートプリミティブを配線し、有限状態機械を抽出し、階層化イベントスケジューリンググラフを構築します。

### 3. デュアルランタイム実行
- **デスクトップネイティブJIT**: ブール式、マルチプレクサ、算術演算子をネイティブ機械語命令に直接低レベル化し、毎秒780,000イベントを超えるシミュレーションスループットを達成します。
- **WebAssemblyサンドボックス**: SharedArrayBufferテレメトリを備えた隔離されたバックグラウンドWeb Worker内で動作し、サーバー依存ゼロで100%クライアントサイドのシミュレーションを提供します。

---

## 標準規格適合マトリックス

| IEEE標準 | 機能分野 | Axiomサポート状況 |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | 構造ゲートプリミティブ (`and`, `or`, `not`, `xor`, `buf`) | 完全サポート |
| **IEEE 1364-1995** | Non-ANSIポートヘッダー (`module foo (a, b); input a;`) | 完全サポート |
| **IEEE 1364-2001** | ANSIポートリストヘッダー (`module foo (input wire a, output reg b);`) | 完全サポート |
| **IEEE 1364-2001** | インデックス付きパートセレクト演算子 (`[base +: width]`, `[base -: width]`) | 完全サポート |
| **IEEE 1364-2001** | 多次元メモリアレイ (`reg [31:0] mem [0:1023]`) | 完全サポート |
| **IEEE 1364-2001** | 宣言と継続的代入の結合 (`wire [7:0] w = in;`) | 完全サポート |
| **IEEE 1364-2005** | プロシージャルループ構文 (`for`, `while`, `repeat`, `forever`) | 完全サポート |
| **IEEE 1364-2005** | システムタスク (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | 完全サポート |
| **IEEE 1364-2005** | メモリファイル読み込み (`$readmemb`, `$readmemh`) | 完全サポート |
