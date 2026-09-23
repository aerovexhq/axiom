# 系统任务与文件输入输出

Verilog 提供了以美元符号 (`$`) 开头的标准内置系统任务与函数。Axiom EDA 直接在内存中原生拦截并执行这些例程，完全无需外部 C/C++ PLI 或 VPI 动态库支持。

---

## 控制台显示与格式化打印任务

### 1. `$display` 与 `$write`
直接将格式化文本输出至 Axiom 交互式**控制台与 REPL** 面板。`$display` 在末尾会自动换行，而 `$write` 则不会。

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### 支持的格式化转义符
- `%d` / `%0d`：十进制整数（未补零/紧凑输出）
- `%h` / `%0h`：十六进制数值
- `%b`：二进制向量
- `%o`：八进制数值
- `%c`：ASCII 字符
- `%s`：字符串
- `%t`：格式化仿真物理时间

### 2. `$monitor` 与 `$strobe`
- `$monitor`：持续监视参数中的信号列表，只要任意被监视信号数值跳变便自动打印消息。
- `$strobe`：将消息输出延迟到当前仿真时间步末尾的 Monitor 区域执行，确保此时所有非阻塞赋值 (NBA) 均已稳定结算。

---

## 仿真运行控制任务

### 1. `$finish` 退出仿真
彻底终止当前仿真运行，停止时钟步进，并在控制台中汇总显示最终执行统计指标。
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop` 暂停仿真
暂停当前仿真推进，将控制栏切换至**暂停**状态，完整保留所有信号波形轨迹与寄存器状态供交互检查。

### 3. `$time` 与 `$realtime` 时间读取
- `$time`：根据当前激活的 `` `timescale `` 刻度，以 64 位整型返回当前仿真物理时间。
- `$realtime`：以实数浮点格式返回当前仿真物理时间。

---

## 数学运算与实用工具函数

### 1. `$clog2` (以 2 为底向上取整对数)
计算 $\lceil \log_2(N) \rceil$。根据存储器深度自动推导地址总线位宽时不可或缺的核心函数：
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random` 伪随机数生成
生成一个 32 位有符号伪随机整数。通常通过按位掩码生成随机测试激励向量：
```verilog
test_byte = $random % 256;
```

---

## 波形导出转储任务

Axiom 原生拦截 Value Change Dump (VCD) 系统任务调用：
- `$dumpfile("waveform.vcd");`：指定导出波形的文件名称。
- `$dumpvars(0, top_tb);`：将整个设计层次内所有信号的状态翻转全量记录进内存追踪缓冲区，并导出为标准 IEEE 1364 Value Change Dump (VCD) 文件。

---

## 存储器内容外部文件初始化 (`$readmemb`, `$readmemh`)

直接从文本文件加载数据初始化存储器数组内容：
- `$readmemb("rom.bin", memory_array);`：加载二进制数据（`10101100`）。
- `$readmemh("rom.hex", memory_array);`：加载十六进制格式数据（`AF 04 C2`）。

在 Axiom Studio 中，存储器初始化文件在工程文件集安全范围内被沙箱隔离读取，绝不违反宿主系统文件安全边界。
