# 持续赋值 (assign) 与门级原语

持续赋值与结构化门级原语代表了 Verilog 中的静态组合逻辑硬件。它们并发且持续执行：只要右操作数表达式中的任意信号发生跳变，左侧输出网线就会立即求值更新。

---

## 持续赋值 (`assign`)

持续赋值用于向 `wire` 网线连续驱动逻辑值：

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### 持续赋值语法规则
1. **目标网线类型**：左侧被驱动目标必须是标量或矢量网线 (`wire`)，严禁使用寄存器变量 (`reg`)。
2. **动态重新求值**：每当 `a` 或 `b` 发生变化时，`sum` 会在当前仿真时间步内立即重新计算并更新。
3. **隐式零延迟传播**：信号变化在零仿真时间内通过持续赋值级联传播，产生离散的中间零时间 delta 周期 (δ周期) ($\delta$)，直到所有网线进入稳态。

---

## 内置结构化门级原语

Verilog 包含内置的底层门级原语，Axiom 例化展开引擎可直接识别并将其无缝映射至门级原理图 DAG 可视化查看器中：

```verilog
// Basic Boolean Gates
// Syntax: gate_type [instance_name] (output, input1, input2, ...);
and  and1 (out_and, in_a, in_b);
or   or1  (out_or,  in_a, in_b);
xor  xor1 (out_xor, in_a, in_b);
nand nand1(out_nand, in_a, in_b);
nor  nor1 (out_nor, in_a, in_b);
xnor xnor1(out_xnor, in_a, in_b);

// Inverters and Buffers
// Syntax: not/buf [instance_name] (output, input);
not  inv1 (out_not, in_a);
buf  buf1 (out_buf, in_a);

// Tristate Buffers
// Syntax: bufif0/bufif1 [instance_name] (output, input, control);
bufif1 tri_buf (bus_line, tx_data, enable); // Enabled when enable == 1
bufif0 tri_inv (bus_line, tx_data, n_en);   // Enabled when n_en == 0
```

---

## 组合逻辑示例：门级全加器

```verilog
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire s1, c1, c2;

    // First half adder stage
    xor xor1 (s1, a, b);
    and and1 (c1, a, b);

    // Second half adder stage
    xor xor2 (sum, s1, cin);
    and and2 (c2, s1, cin);

    // Carry out calculation
    or  or1  (cout, c1, c2);

endmodule
```

在 Axiom Studio 中打开该设计，原理图查看器会自动将全部 5 个逻辑门进行无碰撞正交走线布局、零转角引脚对齐并实时呈现网线电平数值。
