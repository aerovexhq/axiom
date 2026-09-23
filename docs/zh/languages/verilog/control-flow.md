# 分支与循环流程控制语句

过程流程控制语句（`if-else`、`case` 以及循环结构）允许设计者在过程块内表达复杂的决策树、条件优先级编码器以及状态转移控制逻辑。

---

## 条件分支语句 (`if-else`)

`if-else` 语句按严格优先级顺序对布尔条件进行逐级求值：

```verilog
always @(*) begin
    if (interrupt_high) begin
        active_irq = 2'b11;
    end else if (interrupt_med) begin
        active_irq = 2'b10;
    end else if (interrupt_low) begin
        active_irq = 2'b01;
    end else begin
        active_irq = 2'b00;
    end
end
```

### 意外推断出锁存器的致命风险
在纯组合逻辑进程中，如果某个变量在 `if` 分支内被赋值，却在 `else` 分支中被遗漏，硬件为了在条件为假时保持旧值，将强制综合工具推断出一个**电平敏感的透明锁存器**。
- 每当在组合逻辑块中检测到分支覆盖不全时，Axiom 静态代码检查器都会触发 `AXIOM_W006_TRANSPARENT_LATCH` 警告。

---

## 多路选择分支 (`case`, `casez`, `casex`)

### 1. 标准 `case` 语句
将选择器表达式与各个分支项的常量值进行严格精确比较：

```verilog
reg [1:0] state;
reg [7:0] data_out;

always @(*) begin
    case (state)
        2'b00:   data_out = 8'h00;
        2'b01:   data_out = 8'hAA;
        2'b10:   data_out = 8'h55;
        2'b11:   data_out = 8'hFF;
        default: data_out = 8'h00; // Always include default!
    endcase
end
```
- 若 `case` 语句遗漏了 `default:` 分支，Axiom 静态检查器会触发 `AXIOM_W007_MISSING_DEFAULT` 警告。

### 2. `casez` (忽略无关位的高阻匹配)
将分支项表达式中的 `?` 或 `z` 位视为无关位 (Don't-Care)。非常适用于地址总线译码器与优先级编码器：

```verilog
always @(*) begin
    casez (req_lines)
        4'b1???: grant = 4'b1000; // Bit 3 active, ignore lower bits
        4'b01??: grant = 4'b0100; // Bit 2 active
        4'b001?: grant = 4'b0010; // Bit 1 active
        4'b0001: grant = 4'b0001; // Bit 0 active
        default: grant = 4'b0000;
    endcase
end
```

---

## 过程循环语句 (`for`, `while`, `repeat`, `forever`)

可综合硬件内部的循环语句在例化展开时会被展开为平行的空间硬件逻辑：

```verilog
// 8-bit Population Count (Bit Counter) unrolled in parallel
integer i;
reg [3:0] ones_count;

always @(*) begin
    ones_count = 0;
    for (i = 0; i < 8; i = i + 1) begin
        if (input_byte[i])
            ones_count = ones_count + 1;
    end
end
```

在测试平台代码中，`repeat` 与 `forever` 循环常用于生成周期性时钟激励序列：
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
