# Módulos, jerarquía y sobreescritura de parámetros

El `module` es el bloque de construcción fundamental del hardware digital en Verilog. Encapsula registros internos, asignaciones continuas e instancias secundarias detrás de una interfaz de puertos de entrada/salida definida.

---

## Cabeceras de módulos: ANSI frente a no ANSI

### 1. Cabeceras de puertos ANSI IEEE 1364-2001 (recomendado)
Combina declaraciones de dirección de puerto, tipo de red y ancho de bits directamente dentro de los paréntesis de parámetros del módulo:

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

### 2. Cabeceras de puertos no ANSI IEEE 1364-1995
Separa la lista de identificadores de puerto de las declaraciones de dirección posteriores:

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
El analizador sintáctico de Axiom admite declaraciones tanto ANSI como no ANSI sin problemas.

---

## Instanciación de módulos y vinculación de puertos

### 1. Vinculación de puertos por nombre (estándar de la industria)
Vincula explícitamente los puertos del módulo secundario a redes del módulo principal mediante la sintaxis `.port_name(parent_net)`:

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

### 2. Vinculación de puertos por posición
Vincula los puertos estrictamente por el orden de declaración:
```verilog
full_adder fa0 (in_a, in_b, carry_in, sum_out, carry_out);
```
*Nota: La vinculación posicional es propensa a errores silenciosos de cableado si cambian las definiciones de puertos del módulo secundario.*

---

## Bloques de generación (`generate`)

Axiom admite bloques generate `for` e `if` para instanciar condicionalmente o repetidamente bloques de hardware:

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
