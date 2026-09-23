# Module, Hierarchie & Parameter-Überschreibungen

Das `module` ist der fundamentale Baustein digitaler Hardware in Verilog. Es kapselt interne Register, kontinuierliche Zuweisungen und untergeordnete Instanzen hinter einer definierten Ein-/Ausgangs-Portschnittstelle.

---

## Modul-Header: ANSI vs. Nicht-ANSI

### 1. IEEE 1364-2001 ANSI-Port-Header (Empfohlen)
Kombiniert Portrichtung, Netztyp und Bitbreitendeklarationen direkt innerhalb der Modulparameter-Klammern:

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

### 2. IEEE 1364-1995 Nicht-ANSI-Port-Header
Trennt die Port-Bezeichnerliste von nachfolgenden Richtungsdeklarationen:

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
Der Parser von Axiom unterstützt sowohl ANSI- als auch Nicht-ANSI-Deklarationen nahtlos.

---

## Modulinstanziierung & Port-Verbindungen

### 1. Benannte Port-Verbindung (Industriestandard)
Bindet Ports untergeordneter Module explizit über die Syntax `.port_name(parent_net)` an übergeordnete Netze:

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

### 2. Positionale Port-Verbindung
Bindet Ports strikt nach der Reihenfolge ihrer Deklaration:
```verilog
full_adder fa0 (in_a, in_b, carry_in, sum_out, carry_out);
```
*Hinweis: Positionale Bindung ist anfällig für unbemerkte Verdrahtungsfehler, wenn sich die Portdefinitionen des untergeordneten Moduls ändern.*

---

## Generate-Blöcke (`generate`)

Axiom unterstützt `for`- und `if`-Generate-Blöcke, um Hardware-Instanzen bedingt oder wiederholt zu instanziieren:

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
