# 模块定义与层次化例化

`module` 是 Verilog 数字硬件设计的核心构建单元。它将内部寄存器、持续赋值与子模块实例封装在明确定义的输入/输出端口接口之后。

---

## 模块端口头部：ANSI 对比 Non-ANSI

### 1. IEEE 1364-2001 ANSI 端口风格 (推荐)
直接在模块参数圆括号内合并声明端口方向、网线类型与数据位宽：

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

### 2. IEEE 1364-1995 Non-ANSI 端口风格
将端口标识符列表与后续方向声明彻底分开书写：

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
Axiom 语法解析引擎无缝兼容支持 ANSI 与 Non-ANSI 两种风格声明。

---

## 模块例化与端口绑定方式

### 1. 显式具名端口绑定 (工业推荐标准)
采用 `.port_name(parent_net)` 语法将子模块形参端口显式绑定至父模块网线：

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

### 2. 位置顺序端口绑定
严格按照子模块声明的先后顺序进行位置匹配绑定：
```verilog
full_adder fa0 (in_a, in_b, carry_in, sum_out, carry_out);
```
*注：一旦子模块端口顺序调整，位置绑定极易引发静默的接错线 Bug。*

---

## 条件与循环生成块 (`generate`)

Axiom 完全支持 `for` 与 `if` 硬件生成块，用于按条件或循环批量例化硬件结构：

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
