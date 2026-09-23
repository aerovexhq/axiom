# Modules, hiérarchie et substitution de paramètres

Le `module` est le bloc fonctionnel fondamental du matériel numérique en Verilog. Il encapsule les registres internes, les assignations continues et les instances enfants derrière une interface de ports d'entrée/sortie définie.

---

## En-têtes de modules : ANSI vs Non-ANSI

### 1. En-têtes de ports ANSI IEEE 1364-2001 (recommandé)
Combine la direction des ports, le type d'équipotentielle et les déclarations de largeur de bits directement entre les parenthèses de paramètres du module :

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

### 2. En-têtes de ports Non-ANSI IEEE 1364-1995
Sépare la liste des identifiants de ports des déclarations de direction ultérieures :

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
L'analyseur d'Axiom prend en charge les déclarations ANSI et Non-ANSI en toute transparence.

---

## Instanciation de modules et liaisons de ports

### 1. Liaison de ports nommée (standard de l'industrie)
Lie explicitement les ports du module enfant aux équipotentielles du parent avec la syntaxe `.nom_de_port(fil_parent)` :

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

### 2. Liaison de ports positionnelle
Lie les ports strictement selon l'ordre de leur déclaration :
```verilog
full_adder fa0 (in_a, in_b, carry_in, sum_out, carry_out);
```
*Remarque : La liaison positionnelle est sujette à des erreurs de câblage silencieuses si les définitions de ports du module enfant changent.*

---

## Blocs generate (`generate`)

Axiom prend en charge les blocs generate `for` et `if` pour instancier du matériel de manière conditionnelle ou répétée :

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
