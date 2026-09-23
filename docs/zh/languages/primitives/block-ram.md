# 块状双端口静态内存 (RAMB18 / RAMB36)

Xilinx FPGA 内部集成了专用的双端口同步静态 RAM 块：`RAMB18E2`（18 Kb）与 `RAMB36E2`（36 Kb）。

---

## RAMB 核心特性

- **真双端口操作**：独立的读写端口（`Port A` 与 `Port B`），具备完全独立的时钟域。
- **可配置数据位宽**：
  - `RAMB36E2`：$32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$ 或 $512 \times 72$。
  - `RAMB18E2`：$16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$ 或 $512 \times 36$。
- **字节级写使能**：独立的 8 位字节写入选通信号 (`WEA[3:0]`)。
- **内置硬件 FIFO 控制器**：专用硬件读写指针与状态标志 (`FULL`, `EMPTY`)，无需消耗外部 CLB 逻辑资源。

```verilog
RAMB36E2 #(
    .READ_WIDTH_A(36),
    .WRITE_WIDTH_A(36),
    .READ_WIDTH_B(36),
    .WRITE_WIDTH_B(36)
) u_bram (
    // Port A
    .CLKARDCLK (clk),
    .ADDRARDADDR({addr_a, 5'b0}),
    .DINADIN   (data_in_a),
    .DOUTADOUT (data_out_a),
    .WEA       (write_en_a),
    // Port B
    .CLKBWRCLK (clk),
    .ADDRBWRADDR({addr_b, 5'b0}),
    .DINBDIN   (data_in_b),
    .DOUTBDOUT (data_out_b),
    .WEBWE     (write_en_b)
);
```
