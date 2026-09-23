# 时钟缓冲器与 I/O 原语

时钟与 I/O 原语用于控制全局时钟分配网络以及外部物理引脚的电气接口。

---

## 全局时钟缓冲器 (`BUFG`, `BUFGCE`)

全局时钟缓冲器驱动贯穿整个 FPGA 芯片的专用高扇出、低偏斜时钟分配主干网络：

### 1. `BUFG`
基础全局时钟缓冲器，将晶振引脚或 PLL 输出连接到全局时钟网络：
```verilog
BUFG u_bufg (
    .O (sys_clk_global),
    .I (sys_clk_pin)
);
```

### 2. `BUFGCE` (带时钟使能缓冲器)
无毛刺门控时钟缓冲器。撤销 `CE` 会使时钟输出门控为低电平，而不会产生危险的残波脉冲：
```verilog
BUFGCE u_bufgce (
    .O  (gated_clk),
    .I  (sys_clk),
    .CE (clock_enable)
);
```

---

## 输入与输出缓冲器 (`IBUF`, `OBUF`)

输入与输出缓冲器将芯片内部逻辑与物理封装管脚相连接：
- **`IBUF`**：标准单端输入缓冲器 (`.O(internal_wire), .I(external_pin)`)。
- **`OBUF`**：标准单端输出缓冲器 (`.O(external_pin), .I(internal_wire)`)。
- **`OBUFT`**：带低电平有效使能端 (`.T`) 的三态输出缓冲器。
