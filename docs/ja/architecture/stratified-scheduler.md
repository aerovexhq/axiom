# 階層化イベントスケジューラ＆デルタサイクルエンジン

デジタル論理シミュレータは、並行性と物理的な因果伝播をモデル化するために離散イベントスケジューリングに依存しています。Axiomは、きめ細かな呼び出し元制御を提供しながら、**IEEE 1800 階層化イベントキュー** を厳密に実装しています。

---

## IEEE 1800 領域階層

各シミュレーションタイムスタンプ（$t$）は、実行領域に分割された任意の数のゼロ時間デルタサイクル (δサイクル)（$\delta$）を含みます:

```
+-------------------------------------------------------------------------------+
| Active Region                                                                 |
| - Evaluate continuous assignments                                             |
| - Execute blocking statements (=)                                             |
| - Evaluate right-hand side of non-blocking assignments (NBAs)                 |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Inactive Region (#0 Delays)                                                   |
| - Process explicit #0 procedural delays                                       |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| NBA Region (Non-Blocking Assignments)                                         |
| - Apply queued non-blocking assignment updates to flip-flop registers (<=)    |
| - Net transitions trigger sensitivity for next delta cycle: δ -> δ + 1        |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Postponed Region                                                              |
| - Sample steady-state values for VCD waveform dump and SAIF activity          |
+-------------------------------------------------------------------------------+
```

---

## きめ細かな呼び出し元制御API

レガシーツールはゼロ時間デルタサイクルをブラックボックスとして扱います。`run 100ns` は内部ですべてのデルタサイクルを実行し、過渡的なグリッチを隠蔽します。

Axiomは、2つのきめ細かなステッピングプリミティブを提供します:

### 1. `step_delta()`
物理時間を進めることなく、シミュレーションを正確に**1つの離散ゼロ時間デルタサイクル (δサイクル)**（$\delta \to \delta + 1$）進めます:
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
任意の増分で物理シミュレーション時間を進めます:
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## 組み合わせ回路のグリッチハザード検出

デルタサイクルの進行中、非対称なパス遅延によって、信号が整定する前にネットが複数回遷移することがよくあります（例: $0 \to 1 \to 0$ や $1 \to 0 \to 1$）。Axiomの `GlitchDetector` はこれらのイベントを自動的にタグ付けします:
- **スタティック0ハザード**: 0で始まり0で終わる信号上の一時的なHighパルス。
- **スタティック1ハザード**: 1で始まり1で終わる信号上の一時的なLowドロップ。
- **ダイナミックハザード**: 単一の論理遷移中に発生する複数回の中間トグル。

これらのハザードは、CLIおよびCanvas波形ビューアの両方でリアルタイムにフラグ付けされます。
