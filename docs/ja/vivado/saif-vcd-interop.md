# SAIF＆VCD相互運用性

既存の産業用検証環境とのシームレスな統合を確保するため、Axiomは標準の **IEEE 1364 4値論理 / Value Change Dump (VCD) (.vcd)** および **Synopsys SAIF 2.0 (.saif)** ファイルを生成します。

---

## 1. IEEE 1364 4値論理 / Value Change Dump (VCD)

Axiomの `VcdWriter` は、すべてのネットリスト状態遷移を標準VCD定義でフォーマットします:
- ヘッダー: `$date`, `$version`, `$timescale 1 ps`。
- 階層構造: 階層的な `$scope module` および `$upscope` ブロック。
- 変数: マルチビット `$var wire [width] [symbol] [name]` 宣言。
- 初期値: $t = 0$ における `$dumpvars` 状態ダンプ。
- 遷移: タイムスタンプマーカー（`#1000`）とインターリーブされたバイナリおよび16進数バス遷移。

Axiomが生成したVCDファイルは以下で直接開くことができます:
- **GTKWave**
- **Surfer**
- **AMD Vivado 波形ビューア**
- **Sigrok / PulseView**

---

## 2. スイッチングアクティビティ交換フォーマット (SAIF 2.0)

Vivadoの `report_power` における正確な電力見積もりには、静的なベクトルレス見積もりではなく、高精度のシミュレーションベクトルが必要です。

Axiomは、スイッチング確率を含む有効なSAIF 2.0ファイルを生成します:
```text
(SAIFILE
  (SAIFVERSION "2.0")
  (DIRECTION "backward")
  (DESIGN "counter")
  (DATE "Axiom HDL Engine")
  (VENDOR "Axiom")
  (PROGRAM_NAME "Axiom Simulator")
  (PROGRAM_VERSION "1.0.0")
  (DIVIDER /)
  (TIMESCALE 1 ps)
  (DURATION 50000)
  (INSTANCE counter
    (NET
      (clk (T0 25000) (T1 25000) (TX 0) (TZ 0) (TC 99))
      (rst_n (T0 1000) (T1 49000) (TX 0) (TZ 0) (TC 1))
      (count (T0 12000) (T1 38000) (TX 0) (TZ 0) (TC 48))
    )
  )
)
```

### AMD Vivadoへのロード
Vivado Tclでの実行:
```tcl
open_run impl_1
read_saif -strip_path /tb_top/u_dut -file power.saif
report_power -file post_sim_power.rpt
```
Vivadoは、Axiomが測定したSAIFトグル数から動的スイッチングアクティビティ行列を自動的に更新します。
