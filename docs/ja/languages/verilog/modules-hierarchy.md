# モジュール、階層構造＆パラメータオーバーライド

`module` は、Verilogにおけるデジタルハードウェアの基本的な構成単位です。定義された入出力ポートインターフェースの背後にある内部レジスタ、継続的代入、子インスタンスをカプセル化します。

---

## モジュールヘッダー: ANSI vs. Non-ANSI

### 1. IEEE 1364-2001 ANSI ポートヘッダー (推奨)
モジュールパラメータ括弧内で、ポートの方向、ネット型、ビット幅の宣言を直接結合します:

```verilog
module uart_tx #(
    parameter integer CLK_FREQ  = 100_000_000,
    parameter integer BAUD_RATE = 115_200
)(
    input  wire       clk,
    input  wire       rst_n,
    input  wire [7:0] tx_data,
    input  wire       tx_start,
    output reg        tx_line,
    output reg        tx_busy
);
    // Module internal logic...
endmodule
```

### 2. IEEE 1364-1995 Non-ANSI ポートヘッダー
ポート識別子リストを後続の方向宣言から分離します:

```verilog
module full_adder (a, b, cin, sum, cout);
    input  wire a;
    input  wire b;
    input  wire cin;
    output wire sum;
    output wire cout;

    assign {cout, sum} = a + b + cin;
endmodule
```
Axiomのパーサーは、ANSI宣言とNon-ANSI宣言の両方をシームレスにサポートします。

---

## モジュールインスタンス化＆ポート接続

### 1. 名前付きポート接続 (業界標準)
`.port_name(parent_net)` 構文を使用して、子モジュールのポートを親ネットに明示的にバインドします:

```verilog
module top_system (
    input  wire       sys_clk,
    input  wire       sys_rst,
    output wire       uart_tx_pin
);
    wire tx_busy_flag;

    // Instantiate uart_tx with explicit port mapping and parameter override
    uart_tx #(
        .CLK_FREQ(50_000_000), // Override 100MHz default with 50MHz
        .BAUD_RATE(9600)       // Override 115200 default with 9600
    ) u_uart_tx (
        .clk     (sys_clk),
        .rst_n   (~sys_rst),
        .tx_data (8'h41),
        .tx_start(1'b1),
        .tx_line (uart_tx_pin),
        .tx_busy (tx_busy_flag)
    );

endmodule
```

### 2. 位置指定ポート接続
宣言順に厳密に従ってポートをバインドします:
```verilog
full_adder fa0 (in_a, in_b, carry_in, sum_out, carry_out);
```
*注意: 位置指定バインドは、子モジュールのポート定義が変更された場合に暗黙の配線バグを引き起こしやすくなります。*

---

## ジェネレートブロック (`generate`)

Axiomは、ハードウェアインスタンスを条件付きまたは繰り返し生成するための `for` および `if` ジェネレートブロックをサポートしています:

```verilog
module ripple_carry_adder #(
    parameter WIDTH = 8
)(
    input  wire [WIDTH-1:0] a,
    input  wire [WIDTH-1:0] b,
    input  wire             cin,
    output wire [WIDTH-1:0] sum,
    output wire             cout
);
    wire [WIDTH:0] carry;
    assign carry[0] = cin;
    assign cout = carry[WIDTH];

    genvar i;
    generate
        for (i = 0; i < WIDTH; i = i + 1) begin : gen_adder_slice
            full_adder fa_inst (
                .a   (a[i]),
                .b   (b[i]),
                .cin (carry[i]),
                .sum (sum[i]),
                .cout(carry[i+1])
            );
        end
    endgenerate
endmodule
```
