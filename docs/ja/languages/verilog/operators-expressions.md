# Verilog演算子＆式

Axiom EDAは、Cranelift JITおよびWebAssemblyエンジンにおいて完全なIEEE 1364演算子優先順位階層を実装し、ビット単位、算術、リダクション、関係演算に対して最適化されたマシン命令を生成します。

---

## 演算子優先順位テーブル

演算子は最も高い優先順位（最初に評価）から最も低い優先順位へとリストされています:

| 優先順位 | 演算子 | カテゴリ | 説明 |
| :--- | :--- | :--- | :--- |
| 1 (最高) | `+`, `-`, `!`, `~` | 単項 | 単項プラス、マイナス、論理否定、ビット否定 |
| 2 | `**` | 算術 | べき乗 |
| 3 | `*`, `/`, `%` | 算術 | 乗算、除算、剰余 |
| 4 | `+`, `-` | 2進数 | 2項加算、減算 |
| 5 | `<<`, `>>`, `<<<`, `>>>` | シフト | 論理シフトおよび算術シフト |
| 6 | `<`, `<=`, `>`, `>=` | 関係 | 比較不等号 |
| 7 | `==`, `!=`, `===`, `!==` | 等価 | 論理等価、case等価 |
| 8 | `&`, `~&` | ビット単位 / リダクション | ビットAND、リダクションNAND |
| 9 | `^`, `~^`, `^~` | ビット単位 / リダクション | ビットXOR、ビットXNOR |
| 10 | `\ | `, `~\ | ` | ビット単位 / リダクション | ビットOR、リダクションNOR |
| 11 | `&&` | 論理 | 論理AND |
| 12 | `\ | \ | ` | 論理 | 論理OR |
| 13 (最低) | `? :` | 条件 | 三項条件マルチプレクサ |

---

## ビット単位演算子 vs. 論理演算子

HDL設計における一般的なバグの原因は、ビット単位演算と論理演算の混同です:

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

## リダクション演算子

リダクション演算子は、単一のマルチビットベクターオペランドを受け取り、その全ビットにわたってビット単位演算を実行して1ビットの結果を生成します:

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

## 結合＆複製

Verilogは、小さなバスをより広いベクターに組み立てるための波括弧表記 `{ ... }` を提供します:

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

## 条件付き三項演算子 (`? :`)

三項演算子は継続的代入においてマルチプレクサ論理をモデル化します:

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
