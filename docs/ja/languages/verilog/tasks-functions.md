# Verilogタスク＆関数

タスクと関数は、Verilogにおける再利用可能なアルゴリズム文をカプセル化します。これによりコードのモジュール性が向上し、設計およびテストベンチ全体で反復的な手続き論理が削減されます。

---

## 関数 (`function`)

関数は、1つ以上の入力から戻り値を計算します。論理合成可能なVerilogでは、関数は純粋な組み合わせ論理をモデル化します:
- ゼロシミュレーション時間で実行されます（`#` 遅延や `@` イベント制御を含めることはできません）。
- 少なくとも1つの入力を持つ必要があります。
- ノンブロッキング代入（`<=`）を含めることはできません。
- 関数名に割り当てられた単一のスカラまたはベクター値を返します。

```verilog
module parity_checker (
    input  wire [7:0] data_byte,
    output wire       parity_bit
);
    // User-defined function calculating odd parity
    function calc_parity;
        input [7:0] val;
        integer i;
        begin
            calc_parity = 1'b0;
            for (i = 0; i < 8; i = i + 1) begin
                calc_parity = calc_parity ^ val[i];
            end
        end
    endfunction

    // Continuous assignment calling function
    assign parity_bit = calc_parity(data_byte);

endmodule
```

---

## タスク (`task`)

タスクは関数よりも汎用的です。入力を受け取り、`output` 引数を介して複数の出力を返し、時間遅延文（`#`、`@`）を含めることができます:
- `initial` または `always` ブロック内で手続き的に動作します。
- シミュレーション時間を制御できるため、タスクはテストベンチのバス機能モデル（BFM）に最適です。

```verilog
module tb_memory;
    reg clk;
    reg we;
    reg [7:0] addr;
    reg [15:0] wdata;
    wire [15:0] rdata;

    // Bus Functional Task modeling an SRAM write bus cycle
    task sram_write;
        input [7:0]  target_addr;
        input [15:0] write_val;
        begin
            @(posedge clk);
            addr  <= target_addr;
            wdata <= write_val;
            we    <= 1'b1;
            @(posedge clk);
            we    <= 1'b0;
        end
    endtask

    initial begin
        clk = 0;
        we  = 0;
        #20;
        // Invoke task with arguments
        sram_write(8'h04, 16'hDEAD);
        sram_write(8'h08, 16'hBEEF);
        #50 $finish;
    end

    always #5 clk = ~clk;
endmodule
```

---

## 自動（再入可能）タスク＆関数

IEEE 1364-1995のデフォルトでは、タスク変数は静的です。IEEE 1364-2001では、`function automatic` または `task automatic` を宣言することでスタック上にローカル変数を動的に割り当て、再帰アルゴリズムを可能にします:

```verilog
function automatic [31:0] factorial;
    input [31:0] n;
    begin
        if (n <= 1)
            factorial = 1;
        else
            factorial = n * factorial(n - 1);
    end
endfunction
```
