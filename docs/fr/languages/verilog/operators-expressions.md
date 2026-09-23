# Opérateurs et expressions Verilog

Axiom EDA implémente la hiérarchie complète de priorité des opérateurs IEEE 1364 dans ses moteurs Cranelift JIT et WebAssembly, générant des instructions machine optimisées pour les opérations bit à bit, arithmétiques, de réduction et relationnelles.

---

## Table de priorité des opérateurs

Les opérateurs sont listés de la priorité la plus élevée (évaluée en premier) à la plus faible :

| Priorité | Opérateur | Catégorie | Description |
| :--- | :--- | :--- | :--- |
| 1 (La plus haute) | `+`, `-`, `!`, `~` | Unaire | Plus unaire, moins, NON logique, NON bit à bit |
| 2 | `**` | Arithmétique | Exponentiation (puissance) |
| 3 | `*`, `/`, `%` | Arithmétique | Multiplication, Division, Modulo |
| 4 | `+`, `-` | Binaire | Addition binaire, soustraction |
| 5 | `<<`, `>>`, `<<<`, `>>>` | Décalage | Décalages logiques et arithmétiques |
| 6 | `<`, `<=`, `>`, `>=` | Relationnel | Inégalité de comparaison |
| 7 | `==`, `!=`, `===`, `!==` | Égalité | Égalité logique, égalité de cas |
| 8 | `&`, `~&` | Bit à bit / Réd | ET bit à bit, NON-ET de réduction |
| 9 | `^`, `~^`, `^~` | Bit à bit / Réd | OU exclusif bit à bit, NON-OU exclusif bit à bit |
| 10 | `\ | `, `~\ | ` | Bit à bit / Réd | OU bit à bit, NON-OU de réduction |
| 11 | `&&` | Logique | ET logique |
| 12 | `\ | \ | ` | Logique | OU logique |
| 13 (La plus basse) | `? :` | Conditionnel | Multiplexeur conditionnel ternaire |

---

## Opérateurs bit à bit vs logiques

Une source fréquente de bugs en conception HDL est la confusion entre opérations logiques et bit à bit :

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

## Opérateurs de réduction

Les opérateurs de réduction prennent un unique opérande vectoriel multibit et effectuent une opération bit à bit sur tous ses bits, produisant un résultat sur 1 bit :

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

## Concaténation et réplication

Verilog fournit la notation entre accolades `{ ... }` pour assembler des bus plus étroits en vecteurs plus larges :

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

## Opérateur conditionnel ternaire (`? :`)

L'opérateur ternaire modélise la logique de multiplexeur dans les assignations continues :

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
