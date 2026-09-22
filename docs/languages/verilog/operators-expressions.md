# Verilog Operators & Expressions

Axiom EDA implements the full IEEE 1364 operator precedence hierarchy in its Cranelift JIT and WebAssembly engines, generating optimized machine instructions for bitwise, arithmetic, reduction, and relational operations.

---

## Operator Precedence Table

Operators are listed from highest precedence (evaluated first) to lowest precedence:

| Precedence | Operator | Category | Description |
| :--- | :--- | :--- | :--- |
| 1 (Highest) | `+`, `-`, `!`, `~` | Unary | Unary plus, minus, logical NOT, bitwise NOT |
| 2 | `**` | Arithmetic | Exponentiation (power) |
| 3 | `*`, `/`, `%` | Arithmetic | Multiply, Divide, Modulus |
| 4 | `+`, `-` | Binary | Binary addition, subtraction |
| 5 | `<<`, `>>`, `<<<`, `>>>` | Shift | Logical and arithmetic shifts |
| 6 | `<`, `<=`, `>`, `>=` | Relational | Comparison inequality |
| 7 | `==`, `!=`, `===`, `!==` | Equality | Logical equality, case equality |
| 8 | `&`, `~&` | Bitwise / Red | Bitwise AND, reduction NAND |
| 9 | `^`, `~^`, `^~` | Bitwise / Red | Bitwise XOR, bitwise XNOR |
| 10 | `\|`, `~\|` | Bitwise / Red | Bitwise OR, reduction NOR |
| 11 | `&&` | Logical | Logical AND |
| 12 | `\|\|` | Logical | Logical OR |
| 13 (Lowest) | `? :` | Conditional | Ternary conditional multiplexer |

---

## Bitwise vs. Logical Operators

A common source of bugs in HDL design is confusing bitwise and logical operations:

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

## Reduction Operators

Reduction operators take a single multi-bit vector operand and perform a bitwise operation across all its bits, producing a 1-bit result:

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

## Concatenation & Replication

Verilog provides bracket notation `{ ... }` to assemble smaller buses into wider vectors:

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

## Conditional Ternary Operator (`? :`)

The ternary operator models multiplexer logic in continuous assignments:

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
