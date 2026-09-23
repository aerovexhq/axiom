# AMD VivadoからAxiomへの移行

Axiomは、AMD Vivado Design Suiteにおけるシミュレーションおよび検証ワークフローを完全に置き換えるドロップインリプレースメントとして第一原理から構築されました。

---

## コマンドマッピング概要

| タスク | AMD Vivado コマンド | Axiom CLI 対応コマンド |
| :--- | :--- | :--- |
| **Verilogの構文解析** | `xvlog design.v` | `axiom compile` に内蔵 |
| **設計のエラボレーション** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **シミュレーション実行** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **VCD波形の出力** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **SAIFアクティビティのエクスポート** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **ベンチマークレイテンシ測定** | 手動ストップウォッチ / プロファイルログ | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## ディスクスナップショットオーバーヘッドゼロ

Vivadoでは、エラボレーションによってディスク上にスナップショットディレクトリが生成されます:
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

Axiomでは、コンパイルとシミュレーションが100%メモリ内で実行されます:
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
`xsim.dir` キャッシュディレクトリなし、数ギガバイトのスナップショットファイルなし、古くなったバイナリアーティファクトなし。
