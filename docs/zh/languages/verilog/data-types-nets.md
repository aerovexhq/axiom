# 数据类型与连线网表

在 Verilog HDL 中，物理硬件连接与存储元件被划分为两大基础类型：**网线 (Nets)**（代表芯片内部的物理实体导线）与**变量 (Variables)**（代表行为级过程存储容器）。

---

## 网线数据类型 (Nets)

网线代表硬件元件之间的物理电气连线。网线本身不具备记忆功能，其逻辑电平由连接在其上的驱动源持续决定。

### 1. `wire` 与 `tri`
最基础的网线类型，代表物理互连走线。在逻辑综合中 `wire` 与 `tri` 功能完全等价，均表示标准的片内互连线。

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. 驱动强度与多驱动总线冲突
若多个活动的持续赋值语句同时以冲突电平（`1` 与 `0`）驱动同一根 `wire`，Axiom 将冲突解析为未知态 (`X`)，并触发静态检查错误 `AXIOM_E002_MULTI_DRIVER_NET`。

---

## 变量数据类型 (Variables)

变量能够保持上一次过程性赋值的数值，直到下一次赋值发生。

### 1. `reg` 寄存器变量
标准过程变量。尽管名为 `reg`，但它并不必然综合为物理触发器；若在纯组合逻辑过程块（`always @*`）中对其赋值，它将被综合为组合逻辑。

```verilog
// 1-bit register variable
reg state;

// 32-bit register vector
reg [31:0] accumulator;

// Sequential clocked assignment
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        accumulator <= 32'd0;
    else
        accumulator <= accumulator + 32'd1;
end
```

### 2. `integer` 与 `time`
- `integer`：32 位有符号整数变量，常用于 `for` 循环计数与测试平台迭代控制。
- `time`：64 位无符号变量，用于存储通过 `$time` 捕获的仿真物理时间戳。

---

## 多位宽向量与索引部分位选

向量代表多位宽总线，使用 `[MSB:LSB]` 范围进行声明：

```verilog
wire [15:0] packet;

// Static slice part-select
wire [7:0] lower_byte = packet[7:0];
wire [7:0] upper_byte = packet[15:8];

// IEEE 1364-2001 Variable Indexed Part-Select (+: and -:)
// Syntax: [base_expr +: width]  (starts at base, selects width bits upward)
// Syntax: [base_expr -: width]  (starts at base, selects width bits downward)
wire [7:0] byte_0 = packet[0 +: 8];   // Selects packet[7:0]
wire [7:0] byte_1 = packet[8 +: 8];   // Selects packet[15:8]
wire [3:0] nibble = packet[7 -: 4];   // Selects packet[7:4]
```

---

## 非打包内存存储器数组

Axiom 支持多维非打包数组，用于对寄存器堆 (Register File)、查找表 (LUT) 以及片上 SRAM 内存块建模：

```verilog
// Array of 1024 registers, each 32 bits wide (4 KB RAM block)
reg [31:0] memory_array [0:1023];

// Synchronous memory write
always @(posedge clk) begin
    if (write_enable)
        memory_array[addr] <= write_data;
end

// Continuous read
assign read_data = memory_array[addr];
```

Axiom 综合引擎会自动识别非打包同步存储器数组，并在技术映射阶段将其推断映射为 Xilinx `RAMB18E2` 或 `RAMB36E2` 硬件块状 RAM。

---

## 带位宽的数字常数字面量

Verilog 数字常数可声明为未定宽十进制数，或带有显式位宽与进制前缀的定宽常数：

$$\text{Format: } <\text{size}>'<\text{base}><\text{value}>$$

| 常数字面量 | 位宽 | 进制 | 等效数值 |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | 二进制 | `0xAC` |
| `8'hFF` | 8 | 十六进制 | `255` |
| `16'd1024` | 16 | 十进制 | `1024` |
| `4'o17` | 4 | 八进制 | `15` |
| `'d50` | 未定宽 (32位) | 十进制 | `50` |
| `1'b1` | 1 | 二进制 | 高电平 1 |
