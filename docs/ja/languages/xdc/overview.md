# Xilinx設計制約 (XDC / SDC) 概要

Axiom EDAは、**Xilinx設計制約 (XDC)** ファイル（`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`）に対するネイティブな構文解析、検証、実行サポートを提供します。XDCは業界標準のSynopsys設計制約（SDC）構文をベースに、物理FPGAデバイス設定用のTclプロパティで拡張されています。

---

## AxiomにおけるXDCの二重の役割

```
+-------------------------------------------------------------------------------+
| XDC Constraints File (constrs_1/timing.xdc)                                   |
+---------------------------------------+---------------------------------------+
| Physical Constraints                  | Static Timing Constraints             |
|---------------------------------------+---------------------------------------|
| - Package pin allocation (PACKAGE_PIN)| - Clock definitions (create_clock)    |
| - I/O electrical standard (IOSTANDARD)| - I/O setup/hold delays               |
| - Drive strength & slew rate          | - False paths & multicycle exceptions |
| - Pull-up & pull-down resistors       | - Asynchronous clock domain isolation |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|       [Floorplanning & Virtual Lab]       [Static Timing Analysis Engine]     |
|       - Physical die placement            - Critical path waterfall           |
|       - Basys 3 board mapping             - Setup & hold slack calculation    |
+-------------------------------------------------------------------------------+
```

### Axiomにおける主要機能
1. **誤検知ゼロのLSP**: Axiomのメモリ内XDC言語サーバーは、`#` コメントを解析し、コマンドキーワードを検証し、有効な制約を構文エラーとすることなくポートの自動補全を提供します。
2. **バーチャルラボへの直接バインド**: 物理ピンマッピング（`PACKAGE_PIN V17`, `PACKAGE_PIN U16`）はAxiomの触感型バーチャルラボラックに動的にバインドされ、シミュレーションされたRTLをBasys 3のスライドスイッチやLEDに直接接続します。
3. **STAエンジン統合**: クロック定義（`create_clock -period 10.0`）は、静的タイミング解析 (STA) エンジンおよびタイミングレーダーの基準周波数を確立します。
