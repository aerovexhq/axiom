# Verilog-Operatoren & Ausdrücke

Axiom EDA implementiert die vollständige IEEE 1364-Operatorrangfolge in seinen Cranelift-JIT- und WebAssembly-Engines und generiert optimierte Maschinenbefehle für bitweise, arithmetische, Reduktions- und relationale Operationen.

---

## Tabelle der Operatorrangfolge

Operatoren sind von der höchsten Rangfolge (zuerst ausgewertet) zur niedrigsten Rangfolge aufgeführt:

| Rangfolge | Operator | Kategorie | Beschreibung |
| :--- | :--- | :--- | :--- |
| 1 (Höchste) | `+`, `-`, `!`, `~` | Unär | Unäres Plus, Minus, logisches NICHT, bitweises NICHT |
| 2 | `**` | Arithmetik | Potenzierung |
| 3 | `*`, `/`, `%` | Arithmetik | Multiplikation, Division, Modulo |
| 4 | `+`, `-` | Binär | Binäre Addition, Subtraktion |
| 5 | `<<`, `>>`, `<<<`, `>>>` | Verschiebung | Logische und arithmetische Verschiebungen |
| 6 | `<`, `<=`, `>`, `>=` | Relational | Vergleichs-Ungleichheit |
| 7 | `==`, `!=`, `===`, `!==` | Gleichheit | Logische Gleichheit, Case-Gleichheit |
| 8 | `&`, `~&` | Bitweise / Reduktion | Bitweises UND, Reduktions-NAND |
| 9 | `^`, `~^`, `^~` | Bitweise / Reduktion | Bitweises XOR, bitweises XNOR |
| 10 | `\ | `, `~\ | ` | Bitweise / Reduktion | Bitweises ODER, Reduktions-NOR |
| 11 | `&&` | Logisch | Logisches UND |
| 12 | `\ | \ | ` | Logisch | Logisches ODER |
| 13 (Niedrigste) | `? :` | Bedingt | Ternärer bedingter Multiplexer |

---

## Bitweise vs. Logische Operatoren

Eine häufige Fehlerquelle beim HDL-Design ist die Verwechslung von bitweisen und logischen Operationen:

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

## Reduktionsoperatoren

Reduktionsoperatoren nehmen einen einzelnen Multi-Bit-Vektoroperanden und führen eine bitweise Operation über alle seine Bits durch, was ein 1-Bit-Ergebnis liefert:

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

## Konkatenation & Replikation

Verilog bietet die Klammernotation `{ ... }`, um kleinere Busse zu breiteren Vektoren zusammenzusetzen:

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

## Bedingter ternärer Operator (`? :`)

Der ternäre Operator modelliert Multiplexer-Logik in kontinuierlichen Zuweisungen:

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
