# Verilog制御フロー文

プロシージャル制御フロー文（`if-else`、`case`、ループ）により、設計者はプロシージャルブロック内で複雑な決定木、条件付き優先順位エンコーダ、状態遷移論理を記述できます。

---

## 条件文 (`if-else`)

`if-else` 文は、ブール条件を優先順位順に評価します:

```verilog
always @(*) begin
    if (interrupt_high) begin
        active_irq = 2'b11;
    end else if (interrupt_med) begin
        active_irq = 2'b10;
    end else if (interrupt_low) begin
        active_irq = 2'b01;
    end else begin
        active_irq = 2'b00;
    end
end
```

### 意図しないラッチハザード
組み合わせプロセスにおいて、ある変数が `if` 分岐で代入されているのに `else` 分岐で省略されている場合、条件が偽のときにハードウェアはその直前の値を保持しなければなりません。これにより、合成ツールは**透過型レベルセンスラッチ**を強制的に推論します。
- 組み合わせブロック内で不完全な分岐が検出された場合、Axiomのリンターは警告 `AXIOM_W006_TRANSPARENT_LATCH` を発行します。

---

## 多方向分岐 (`case`, `casez`, `casex`)

### 1. 標準 `case`
セレクタ式をcase項目の値と比較します:

```verilog
reg [1:0] state;
reg [7:0] data_out;

always @(*) begin
    case (state)
        2'b00:   data_out = 8'h00;
        2'b01:   data_out = 8'hAA;
        2'b10:   data_out = 8'h55;
        2'b11:   data_out = 8'hFF;
        default: data_out = 8'h00; // Always include default!
    endcase
end
```
- `case` 文で `default:` 分岐が省略されている場合、Axiomのリンターは `AXIOM_W007_MISSING_DEFAULT` を発行します。

### 2. `casez` (ドントケアビット一致)
case式内の `?` または `z` ビットをドントケア値として扱います。アドレスデコーダや優先順位エンコーダに最適です:

```verilog
always @(*) begin
    casez (req_lines)
        4'b1???: grant = 4'b1000; // Bit 3 active, ignore lower bits
        4'b01??: grant = 4'b0100; // Bit 2 active
        4'b001?: grant = 4'b0010; // Bit 1 active
        4'b0001: grant = 4'b0001; // Bit 0 active
        default: grant = 4'b0000;
    endcase
end
```

---

## プロシージャルループ (`for`, `while`, `repeat`, `forever`)

論理合成可能なハードウェア内のループは、並列空間論理に展開されます:

```verilog
// 8-bit Population Count (Bit Counter) unrolled in parallel
integer i;
reg [3:0] ones_count;

always @(*) begin
    ones_count = 0;
    for (i = 0; i < 8; i = i + 1) begin
        if (input_byte[i])
            ones_count = ones_count + 1;
    end
end
```

テストベンチコードでは、`repeat` および `forever` ループが反復的なクロックシーケンスをモデル化します:
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
