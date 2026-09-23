# DSP48 乘加硬件算术单元

Xilinx FPGA 内部嵌入了高速硬件数字信号处理切片：`DSP48E1`（7系列）与 `DSP48E2`（UltraScale+）。

---

## DSP48E2 架构 (UltraScale+)

`DSP48E2` 切片具备以下核心特性：
- **$27 \times 18$ 位二进制补码乘法器**：支持单时钟周期内宽操作数高速算术运算。
- **48 位累加器与 ALU**：执行高速加法、减法、位逻辑运算以及多级累加。
- **专用预加器**：27 位预加器，专为对称有限冲激响应 (FIR) 滤波器优化。
- **模式检测器**：实时检测终止计数、零标志以及上溢/下溢异常条件。

```verilog
DSP48E2 #(
    .USE_MULT("MULTIPLY")
) u_dsp (
    .P      (product_48bit),
    .A      ({3'b0, operand_a_27bit}),
    .B      (operand_b_18bit),
    .C      (48'h0),
    .CLK    (clk),
    .ALUMODE(4'b0000), // ADD
    .OPMODE (9'b000000101)
);
```

在 Axiom EDA 中，行为级乘法语句（`assign P = A * B;`）在技术映射阶段会自动推断映射为 `DSP48E2` 硬件切片。
