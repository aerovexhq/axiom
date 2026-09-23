# 専用プロシージャルブロック (`always_comb`, `always_ff`, `always_latch`)

従来のVerilogでは、汎用の `always` キーワードが組み合わせ論理、クロック同期レジスタ、ラッチのすべてに使用されていたため、感度リストの不備や分岐の記述漏れによる潜在的な設計ミスが発生していました。SystemVerilogは設計意図を強制する明示的なプロシージャルブロックを導入しています。

---

## `always_comb` (組み合わせ論理)

`always_comb` は組み合わせプロセスを明示的に宣言します:
- **自動感度リスト**: 設計者が `@*` を記述したり入力を列挙したりする必要はありません。シミュレータが読み取り対象となる全変数の完全な感度リストを自動推論します。
- **起動時の即時評価**: シミュレーション時刻 $t=0$ で自動的に実行され、最初のクロックエッジの前に出力が有効であることを保証します。
- **厳格なラッチ防止**: 不完全な分岐によって `always_comb` ブロックが透過ラッチを推論した場合、Axiomのリンターがエラーを発行します。

```verilog
always_comb begin
    case (alu_op)
        4'b0000: alu_result = operand_a + operand_b;
        4'b0001: alu_result = operand_a - operand_b;
        4'b0010: alu_result = operand_a & operand_b;
        4'b0011: alu_result = operand_a | operand_b;
        default: alu_result = 32'd0;
    endcase
end
```

---

## `always_ff` (クロック同期順序論理)

`always_ff` はエッジトリガ型レジスタおよびフリップフロップをモデル化します:
- エッジトリガ型の感度リスト（`@(posedge clk)` または `@(posedge clk or negedge rst_n)`）を持つ必要があります。
- 順序状態レジスタに対してブロッキング代入（`=`）を含めることはできません。
- 複数のクロックやゼロ遅延ループは禁止されています。

```verilog
always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        q_reg <= 16'h0000;
    end else if (enable) begin
        q_reg <= d_in;
    end
end
```

---

## `always_latch` (レベルセンスラッチ)

非同期のレベルセンスラッチが意図的に必要な場合（低消費電力クロックゲーティングセルなど）:

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
ラッチを明示的な `always_latch` ブロックに限定することで、設計者は主要なRTLモジュール全体における意図しないラッチの推論を排除できます。
