# プロシージャルブロック＆階層化スケジューリング

プロシージャルブロック（`always` および `initial`）には、イベントやシミュレーションの開始に応答して実行される逐次文が含まれます。これらは順序状態レジスタ（フリップフロップ、ラッチ）だけでなく、複雑な組み合わせ決定木もモデル化します。

---

## 階層化イベントスケジューラ

Axiomは、IEEE 1364階層化イベントキューに従ってVerilogシミュレーションを実行します:

```
+-------------------------------------------------------------------------------+
| Axiom Stratified Simulation Event Cycle (Time Step T)                         |
+-------------------------------------------------------------------------------+
| 1. Active Region                                                              |
|    - Evaluate continuous assignments (assign)                                 |
|    - Evaluate procedural blocking assignments (=)                             |
|    - Evaluate RHS of non-blocking assignments (<=)                            |
|    - Execute $display and system tasks                                        |
|   |                                                                           |
|   v                                                                           |
| 2. Inactive Region                                                            |
|    - Process explicit #0 delay procedural statements                          |
|   |                                                                           |
|   v                                                                           |
| 3. Non-Blocking Assignment (NBA) Region                                       |
|    - Update LHS of all non-blocking assignments (<=)                          |
|    - May trigger new Active events -> Advance Delta Cycle (delta -> delta + 1)|
|   |                                                                           |
|   v                                                                           |
| 4. Monitor & Post-Update Region                                               |
|    - Execute $monitor and $strobe tasks                                       |
|    - Sample waveform trace history                                            |
|   |                                                                           |
|   v                                                                           |
| 5. Future Time Region                                                         |
|    - Advance physical simulation time: t -> t + dt                            |
+-------------------------------------------------------------------------------+
```

---

## ブロッキング代入 (`=`) vs. ノンブロッキング代入 (`<=`)

`=` と `<=` の違いを理解することは、競合のないデジタル回路設計にとって極めて重要です:

### 1. ブロッキング代入 (`=`)
プログラム順に逐次実行されます。シミュレータは左辺の変数を即座に更新し、代入が終了するまで後続の文をブロックします。
- **ルール**: ブロッキング代入は**組み合わせ**プロセス内でのみ使用してください。

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. ノンブロッキング代入 (`<=`)
アクティブ領域中に右辺の式を評価しますが、ターゲットレジスタの更新はノンブロッキング代入（NBA）領域まで遅延させます。
- **ルール**: ノンブロッキング代入は**クロック同期順序**プロセス内でのみ使用してください。

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

Axiomのインメモリリンターは、これらの規則を積極的に強制します:
- `AXIOM_W001`: `always @(posedge clk)` 内で `=` が使用された場合に警告します。
- `AXIOM_W002`: `always @*` 内で `<=` が使用された場合に警告します。

---

## エッジトリガ型プロセス (レジスタ＆カウンタ)

```verilog
module counter_8bit (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       enable,
    output reg  [7:0] count
);
    // Asynchronous active-low reset, positive-edge clock
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 8'd0;
        end else if (enable) begin
            count <= count + 8'd1;
        end
    end
endmodule
```

---

## シミュレーションテストベンチ初期化 (`initial`)

`initial` ブロックは、シミュレーション起動時（$t=0$）に一度だけ実行されます:

```verilog
initial begin
    // Initialize signals
    clk = 0;
    rst_n = 0;
    data_in = 8'h00;

    // Release reset after 20 nanoseconds
    #20 rst_n = 1;

    // Apply test vector after 10 nanoseconds
    #10 data_in = 8'hA5;

    // Finish simulation at t = 100 ns
    #70 $finish;
end

// Clock generator: 100 MHz (10 ns period)
always #5 clk = ~clk;
```
