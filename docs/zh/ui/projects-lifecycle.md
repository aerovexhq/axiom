# 工程管理与文件集生命周期

Axiom EDA 实现了原汁原味的 Vivado 级工程管理系统，结合轻量级网页持久化与桌面文件系统原生集成。工程严格分离设计 RTL 源码、仿真测试激励 (Testbench) 以及物理与时序约束。

---

## 欢迎启动台 (Welcome Launchpad)

当在未打开任何工程的情况下启动时，Axiom 会呈现清爽专业的航天级欢迎启动台：

```
+-------------------------------------------------------------------------------+
| Axiom EDA v1.0.0 — In-RAM Cranelift JIT & Silicon Telemetry Engine            |
+---------------------------------------+---------------------------------------+
| [ Create New Project ]                | [ Open Project from File ]            |
| Wizard with device selection          | Import serialized .json bundle        |
+---------------------------------------+---------------------------------------+
| Starter Engineering Blueprints (1-Click Launch):                              |
| 1. Logic Circuit (Gate-Level Booleans)| 5. SPI Master Controller              |
| 2. UART Transceiver (115200 Baud)     | 6. FSM Traffic Controller             |
| 3. Synchronous FIFO Buffer (32x8)     | 7. IUC Cerrahpasa Digital Logic Lab   |
| 4. 32-Bit Arithmetic Logic Unit (ALU) |                                       |
+-------------------------------------------------------------------------------+
| Recent Projects: [ Active Projects (3) ]  |  [ Trashed Projects (1) ]         |
+-------------------------------------------------------------------------------+
```

### 初始工程模板
Axiom 提供 7 种经过工业界实测验证的初始设计蓝图：
1. **组合逻辑电路**：门级布尔逻辑系统，计算 \(F = ((\neg A \land B) \land C) \lor \neg B\)，包含 9 个门级单元（`inv1`、`inv2`、`and1`、`and2`、`or1`）以及专属虚拟硬件实验台。
2. **UART 收发器**：完整的发送器与接收器流水线，支持 8 个数据位、1 个停止位、过采样时钟发生器以及状态寄存器。
3. **同步 FIFO 缓冲器**：双指针 32x8 循环内存缓冲器，具备满、空、将满与将空水位指示标志。
4. **32位 ALU 算术逻辑单元**：实现 IEEE 有符号加法、减法、桶形移位、比较及布尔逻辑运算，带有零标志与溢出检测。
5. **SPI 主机**：电机控制级串行外设接口，支持模式 0、1、2 和 3，配备可编程时钟分频器。
6. **FSM 交通信号控制器**：四向交叉路口有限状态机，具备绿/黄/红时序转换、行人通行请求锁存器与定时计数器。
7. **IUC Cerrahpasa 数字逻辑实验**：伊斯坦布尔大学 - 杰拉赫帕夏课程实验工程，包含 `uygulama_0.v`、自动化测试激励与 Basys 3 Artix-7 物理约束。

---

## Vivado 文件集结构

Axiom 按照标准 Vivado 文件集类别组织工程文件：

```
project_root/
|-- sources_1/           # Design Sources
|   |-- logic_circuit.v  # Primary RTL implementation [TOP]
|   `-- uart_tx.v        # Submodules
|-- sim_1/               # Simulation Sources
|   `-- tb_circuit.v     # Testbench harness
`-- constrs_1/           # Physical & Timing Constraints
    `-- timing.xdc       # XDC pinouts and clock declarations
```

### 1. 设计源码集 (`sources_1`)
包含使用 Verilog、SystemVerilog 或 VHDL 实现的所有可综合硬件模块。
- **顶层模块标记 (`[TOP]`)**：综合、原理图生成和物理布局规划的活动根模块。您可以通过文件卡片上的三点菜单将任意模块指定为顶层。
- **添加源码 (`+`) 操作**：点击设计源码集标头上的 `+` 按钮可打开 `AddSourceModal`，并默认预选 `sources_1` 类别。

### 2. 仿真源文件集 (`sim_1`)
包含测试激励框架 (`tb_*.v`)、激励向量与验证序列。测试文件会自动从物理综合与技术映射中排除，以防止产生误报的多驱动或未约束管脚警告。

### 3. 约束文件集 (`constrs_1`)
包含 Xilinx 设计约束 (`.xdc`) 文件，用于定义 FPGA 封装管脚绑定（`PACKAGE_PIN`、`IOSTANDARD`）与静态时序分析 (STA) 时钟目标（`create_clock`）。

---

## 工程标头菜单 (`ProjectDropdown`)

左上角工程下拉菜单徽标提供对核心生命周期操作的直接访问：
- **保存工程 (`Ctrl + S`)**：将所有编辑器缓冲区刷新写入磁盘（桌面端）或 IndexedDB（网页端），并伴随即时视觉确认。
- **导出工程打包文件 (`.json`)**：生成自包含的便携式 JSON 文件，打包所有文件集、目标 FPGA 型号、活动顶层模块与安全标志。
- **添加源文件...**：启动支持多种格式的源码创建向导。
- **工程设置与安全性...**：配置工程信任模式、存储配额、数据隔离与仿真安全边界。
- **新建工程向导**：启动工程创建向导。
- **关闭工程**：安全保存活动状态并返回欢迎启动台，不会丢失未提交的修改。

---

## 工程回收站与恢复生命周期

为防止数据意外丢失，Axiom 实现了两阶段删除生命周期：
1. **移至回收站**：可通过启动台上任意工程卡片的三点菜单访问。被移至回收站的工程立即持久化 `isTrashed: true`，从活动标签页中移除，并增加回收站徽标计数。
2. **访问已回收工程**：点击启动台上的 **回收站** 标签页可查看所有已删除的设计及其删除日期。
3. **恢复工程**：将工程恢复至活动标签页，所有文件与配置完好如初。
4. **永久删除**：弹出亚克力确认模态框 (`ConfirmModal.tsx`)。一旦确认，将永久抹除工程记录并从文件系统中移除关联的存储目录。
