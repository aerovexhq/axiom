# 运算符与表达式优先级

Axiom EDA 在 Cranelift JIT 和 WebAssembly 双执行引擎中均完整实现了 IEEE 1364 运算符优先级层次，为按位运算、算术运算、归约运算和关系比较生成高度优化的机器指令。

---

## 运算符优先级对照表

运算符按从最高优先级（最先求值）到最低优先级排列如下：

| 优先级 | 运算符 | 运算类别 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 1 (最高) | `+`, `-`, `!`, `~` | 单目运算 | 正号、负号、逻辑非、按位取反 |
| 2 | `**` | 算术运算 | 幂运算 |
| 3 | `*`, `/`, `%` | 算术运算 | 乘法、除法、取模 |
| 4 | `+`, `-` | 二进制 | 双目加法、减法 |
| 5 | `<<`, `>>`, `<<<`, `>>>` | 移位运算 | 逻辑左移/右移、算术左移/右移 |
| 6 | `<`, `<=`, `>`, `>=` | 关系比较 | 小于、小于等于、大于、大于等于 |
| 7 | `==`, `!=`, `===`, `!==` | 相等比较 | 逻辑相等/不等、全等比较（含 X/Z） |
| 8 | `&`, `~&` | 按位 / 归约 | 按位与、归约与非 |
| 9 | `^`, `~^`, `^~` | 按位 / 归约 | 按位异或、按位同或 |
| 10 | `\ | `, `~\ | ` | 按位 / 归约 | 按位或、归约或非 |
| 11 | `&&` | 逻辑运算 | 逻辑与 |
| 12 | `\ | \ | ` | 逻辑运算 | 逻辑或 |
| 13 (最低) | `? :` | 条件三目运算 | 三目条件多路选择器 |

---

## 按位运算符对比逻辑运算符

在硬件描述语言设计中，极易引起混淆的一个常见缺陷来源是将按位运算与逻辑运算相混淆：

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

## 归约运算符 (Reduction)

归约运算符接收单一多位宽向量操作数，并在其所有位之间执行折叠位运算，最终输出 1 位结果：

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

## 拼接与多重复制运算符

Verilog 提供大括号语法 `{ ... }` 将较窄的总线组合拼接为更宽的向量：

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

## 条件三目运算符 (`? :`)

三目运算符在持续赋值中是多路选择器 (MUX) 逻辑的理想表达形式：

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
