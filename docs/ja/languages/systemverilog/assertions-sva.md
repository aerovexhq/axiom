# SystemVerilogアサーション (SVA)＆形式検証

SystemVerilogアサーション（SVA）は、期待される振る舞いや時間的プロトコルを数学的に規定します。Axiom EDAはSVAをエンジン内蔵の限界モデルチェッカー（`crates/sim/src/formal/`）と統合しており、過渡シミュレーション中のプロパティ検証や全時間にわたる形式証明を可能にします。

---

## 即時アサーション vs. 並行アサーション

### 1. 即時アサーション
単一のシミュレーション時間ステップでプロシージャル文として評価されます:

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. 並行アサーション
クロックエッジにおいて複数サイクルの時間的シーケンスにわたり同期サンプリングされます:

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## 時間的シーケンス＆演算子

| 演算子 | 構文 | 説明 |
| :--- | :--- | :--- |
| **サイクル遅延** | `##n` | 正確に $n$ クロックサイクル後 |
| **有界範囲遅延** | `##[min:max]` | $min$ から $max$ クロックサイクルの間 |
| **連続反復** | `expr [*n]` | 式が $n$ 連続サイクル真を維持 |
| **オーバーラップ含意** | `ante \ | -> cons` | 先行条件が成立した場合、後続条件は**同一**サイクルで成立が必要 |
| **非オーバーラップ含意** | `ante \ | => cons` | 先行条件が成立した場合、後続条件は**次**サイクルで成立が必要 |
| **システム関数** | `$rose(signal)` | 0から1への立ち上がりエッジ遷移で真と評価 |
| **システム関数** | `$fell(signal)` | 1から0への立ち下がりエッジ遷移で真と評価 |
| **システム関数** | `$stable(signal)` | 直前サイクルから信号値が変化していない場合に真と評価 |

---

## 検証ディレクティブ: `assert`, `assume`, `cover`

- **`assert property`**: 設計論理がプロパティに決して違反しないことを証明します。違反時はAxiomの形式検証スタジオで反例トレースが生成されます。
- **`assume property`**: 形式限界モデル検査（BMC）中にプライマリ入力を有効な動作環境に制約します。
- **`cover property`**: 目標とする機能状態が到達可能であることを証明し、証拠実行トレースを生成します。
