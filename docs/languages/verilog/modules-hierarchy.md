# Modules, Hierarchy & Parameter Overrides

The `module` is the fundamental building block of digital hardware in Verilog. It encapsulates internal registers, continuous assignments, and child instances behind a defined input/output port interface.

---

## Module Headers: ANSI vs. Non-ANSI

### 1. IEEE 1364-2001 ANSI Port Headers (Recommended)
Combines port direction, net type, and bit width declarations directly within the module parameter parentheses:

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

### 2. IEEE 1364-1995 Non-ANSI Port Headers
Separates the port identifier list from subsequent direction declarations:

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
Axiom's parser supports both ANSI and Non-ANSI declarations seamlessly.

---

## Module Instantiation & Port Bindings

### 1. Named Port Binding (Industry Standard)
Explicitly binds child module ports to parent nets using `.port_name(parent_net)` syntax:

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

### 2. Positional Port Binding
Binds ports strictly by order of declaration:
```verilog
full_adder fa0 (in_a, in_b, carry_in, sum_out, carry_out);
```
*Note: Positional binding is prone to silent wiring bugs if child module port definitions change.*

---

## Generate Blocks (`generate`)

Axiom supports `for` and `if` generate blocks to conditionally or repeatedly stamp out hardware instances:

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
