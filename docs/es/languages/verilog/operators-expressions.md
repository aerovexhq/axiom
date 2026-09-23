# Operadores y expresiones en Verilog

Axiom EDA implementa la jerarquía completa de precedencia de operadores IEEE 1364 en sus motores Cranelift JIT y WebAssembly, generando instrucciones de máquina optimizadas para operaciones bit a bit, aritméticas, de reducción y relacionales.

---

## Tabla de precedencia de operadores

Los operadores se enumeran desde la mayor precedencia (evaluados primero) hasta la menor:

| Precedencia | Operador | Categoría | Descripción |
| :--- | :--- | :--- | :--- |
| 1 (Más alta) | `+`, `-`, `!`, `~` | Unario | Más unario, menos unario, NOT lógico, NOT bit a bit |
| 2 | `**` | Aritmética | Exponenciación (potencia) |
| 3 | `*`, `/`, `%` | Aritmética | Multiplicación, división, módulo |
| 4 | `+`, `-` | Binario | Suma y resta binaria |
| 5 | `<<`, `>>`, `<<<`, `>>>` | Desplazamiento | Desplazamientos lógicos y aritméticos |
| 6 | `<`, `<=`, `>`, `>=` | Relacional | Desigualdad de comparación |
| 7 | `==`, `!=`, `===`, `!==` | Igualdad | Igualdad lógica, igualdad de caso |
| 8 | `&`, `~&` | Bit a bit / Reducción | AND bit a bit, NAND de reducción |
| 9 | `^`, `~^`, `^~` | Bit a bit / Reducción | XOR bit a bit, XNOR bit a bit |
| 10 | `\ | `, `~\ | ` | Bit a bit / Reducción | OR bit a bit, NOR de reducción |
| 11 | `&&` | Lógico | AND lógico |
| 12 | `\ | \ | ` | Lógico | OR lógico |
| 13 (Más baja) | `? :` | Condicional | Multiplexor condicional ternario |

---

## Operadores bit a bit frente a lógicos

Una fuente común de errores en el diseño HDL es confundir operaciones bit a bit y lógicas:

```verilog
wire [3:0] a = 4'b1010;
wire [3:0] b = 4'b0101;

// Bitwise AND (&): operates bit-by-bit -> 4'b0000
wire [3:0] bitwise_and = a & b;

// Logical AND (&&): evaluates truthiness of operands -> 1'b1
wire logical_and = (a != 0) && (b != 0);

// Bitwise NOT (~): inverts each individual bit -> 4'b0101
wire [3:0] bitwise_inv = ~a;

// Logical NOT (!): evaluates whether operand is zero -> 1'b0
wire logical_inv = !a;
```

---

## Operadores de reducción

Los operadores de reducción toman un único operando vectorial multibit y realizan una operación bit a bit en todos sus bits, produciendo un resultado de 1 bit:

```verilog
wire [7:0] bus = 8'b1111_0000;

// Reduction AND (&): 1 & 1 & 1 & 1 & 0 & 0 & 0 & 0 -> 1'b0
wire all_ones = &bus;

// Reduction OR (|): 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 -> 1'b1
wire any_one = |bus;

// Reduction XOR (^): Parity generator -> 1'b0 (even parity)
wire odd_parity = ^bus;
```

---

## Concatenación y replicación

Verilog proporciona la notación de llaves `{ ... }` para ensamblar buses más pequeños en vectores más anchos:

```verilog
wire [3:0] high_nibble = 4'hA;
wire [3:0] low_nibble  = 4'h5;

// Concatenation: assemble two 4-bit vectors into an 8-bit byte
wire [7:0] full_byte = {high_nibble, low_nibble}; // 8'hA5

// Sign extension via replication {N{expr}}
wire [7:0] signed_val = 8'b1000_0011;
// Replicate MSB 8 times to sign-extend from 8 bits to 16 bits
wire [15:0] sign_extended = {{8{signed_val[7]}}, signed_val};
```

---

## Operador condicional ternario (`? :`)

El operador ternario modela lógica de multiplexor en asignaciones continuas:

```verilog
wire sel;
wire [15:0] in_0, in_1;

// 2-to-1 Multiplexer
wire [15:0] mux_out = (sel) ? in_1 : in_0;

// Priority Encoder / Cascaded Multiplexers
wire [1:0] mode;
wire [7:0] result = (mode == 2'b00) ? 8'h00 :
                    (mode == 2'b01) ? 8'hAA :
                    (mode == 2'b10) ? 8'h55 : 8'hFF;
```
