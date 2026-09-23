# Axiom Studio 工作区概览

Axiom Studio 是采用 Rust 与 React 19 原生构建的航天级跨平台电子设计自动化 (EDA) 界面。它提供了统一的高性能工作区，将响应敏捷的 Monaco HDL 代码编辑器与同步门级原理图、数字波形、触觉硬件实验面包板、静态时序分析仪以及物理芯片布局规划无缝集成。

---

## 工作区整体架构

Axiom Studio 摒弃了传统 EDA 工具迟缓且碎片化的多窗口界面，采用了高内聚的双窗格工作区：

```
+-------------------------------------------------------------------------------+
| Header: Brand | File Sets | Simulation Ribbon (Run, Step, Reset) | PDN Gauges |
+---------------------------------------+---------------------------------------+
| Left Pane (Monaco HDL Editor)         | Right Pane (Dynamic Visualizers)      |
|                                       | - Schematic DAG Visualizer            |
| - Verilog / SystemVerilog / VHDL      | - Virtual Lab & Basys 3 FPGA Bay      |
| - In-RAM LSP Real-Time Linter         | - Waveforms & Logic Analyzer          |
| - Monarch Tokenizer & Autocomplete    | - Timing Radar & Static Timing        |
| - AST Hover Cards & Breadcrumbs       | - Technology Mapping Studio           |
|                                       | - Floorplanning & Silicon Die         |
|                                       | - Formal Verification (BMC)           |
|                                       | - Protocol Analyzer & Dissector       |
|                                       | - Microarchitecture & Multi-Die       |
+---------------------------------------+---------------------------------------+
| Unified Bottom Dock: Console & REPL | Problems & Linter | Telemetry Radar     |
+-------------------------------------------------------------------------------+
```

### 1. 顶部标头与仿真命令功能区
顶部导航标头容纳了工程标识标签、Vivado 文件集选择器以及仿真执行命令功能区。它支持即时编译、运行、暂停、离散 delta 周期步进以及仿真时间倒回。实时配电网络 (PDN) 遥测仪表报告以毫瓦为单位的动态功耗 ($P$)、电感性 PDN 电压骤降 (IR + L di/dt) ($V_{\text{sag}}$) 以及总供电电流 ($I$)。

### 2. 左侧窗格：Monaco HDL 代码编辑器
深度定制的 Microsoft Monaco 编辑器实例，配置了 Axiom Monarch Verilog/SystemVerilog 分词器、暗色亚克力主题 (`axiom-dark`)、实时 AST 悬停提示以及内存原生语言服务器协议 (LSP) 诊断。

### 3. 右侧窗格：可视化分析舱
全高度、全宽度的绘图画布，容纳 Axiom 的可视化分析工具：
- **原理图 DAG**：实时 IEEE 门级网表可视化分析器，支持无碰撞正交通道布线。
- **虚拟硬件实验台**：配备 Digilent Basys 3 Artix-7 开发板开关、LED 和七段数码管的触觉硬件面包板。
- **波形视图**：60+ FPS 数字逻辑分析仪，支持拖拽测量窗口与零时间 delta 周期检测。
- **时序雷达**：拓扑静态时序分析 (STA)，展示关键路径瀑布图与建立/保持时间裕量直方图。
- **技术映射**：门级技术映射，将 RTL 逻辑降阶映射至目标 FPGA 原语（LUT、DSP48E2、RAMB36E2）。
- **布局规划**：二维芯片 Die 布局规划工作台，展示 CLB 物理位置放置、热力图以及布线飞线。
- **形式化验证**：针对 SystemVerilog 断言的限界模型检查 (BMC) 与 $k$-归纳法验证。
- **协议分析仪**：针对 UART、SPI、I2C、CAN 总线、USB 和以太网的硬件串行协议解析器。
- **微架构检查**：自动化数据通路识别、ALU 检查器、寄存器堆内存视图与 FSM 状态气泡图。

### 4. 中央可调节分割栏
自适应分割栏，便于工程师调整编辑器与可视化工具之间的布局比例。Axiom 具备动态摄像机中心点锚定特性：拖动分割栏会持续重算画布世界坐标系中的摄像机中心点，防止原理图发生挤压变形或丢失缩放比例。

### 5. 底部统一样式面板
可折叠的操作面板，将辅助分析工具规整分类为清晰的标签页：
- **控制台与 REPL**：交互式 Verilog 编译器输出、`$display` 语句日志与仿真执行状态。
- **问题与静态检查**：活动诊断卡片，支持一键跳转至语法错误与设计规则警告的代码行。
- **芯片遥测**：模拟芯片遥测仪表，监测核心供电电压、电感电压骤降与动态开关电流。
- **波形预览**：在原理图分割模式下工作的紧凑型波形视图。

---

## 全局键盘快捷键

| 快捷键 | 操作 | 功能描述 |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | **保存工程** | 将所有设计源文件与元数据持久化保存至本地磁盘或 IndexedDB |
| `Ctrl + Enter` / `Cmd + Enter` | **编译并运行** | 通过内存中 Cranelift JIT 编译将活动硬件设计载入 RAM 并启动时钟 |
| `Space` | **运行 / 暂停** | 切换仿真引擎的运行与暂停状态 |
| `F10` | **步进 +1 ns** | 将物理仿真时间精确向前推进 1,000 皮秒 |
| `Shift + F10` | **步进 +100 ps** | 将物理仿真时间精确向前推进 100 皮秒 |
| `F11` | **步进 Delta (\(\delta\)) 周期** | 步进单个离散零时间 delta 周期 (δ周期) 评估，不推进物理仿真时间 |
| `Ctrl + R` / `Cmd + R` | **重置仿真** | 将仿真时钟倒回至 \(t=0\) 并恢复初始信号向量 |
| `Ctrl + Alt + F` | **布局规划工作台** | 打开物理 FPGA 芯片布局规划可视化分析器 |
| `Ctrl + P` / `Cmd + P` | **快速打开文件** | 打开全局搜索面板以快速跳转浏览工程源码文件 |
| `Ctrl + \`` | **切换底部面板** | 展开或折叠底部统一操作面板 |
| `Ctrl + B` / `Cmd + B` | **切换侧边栏** | 显示或隐藏 Vivado 工程文件集侧边栏 |
| `Escape` | **关闭弹窗 / 取消选中** | 关闭活动对话框、检查器或取消当前网线选中状态 |

---

## 移动端 Studio 与响应式抽屉

当在移动设备或窄屏浏览器窗口（宽度 \(\le 768\text{px}\)）中运行时，Axiom Studio 会自动自适应调整：
- 禁用多窗格可调整分割栏，消除拥挤狭窄的视口体验。
- 画布外滑出式抽屉 (`MobileDrawer.tsx`) 提供对工程文件集、仿真控制选项以及视图选择的快速访问。
- 界面以 **单面板独占** 模式渲染，将 100% 的屏幕宽度和高度完整分配给当前活动视图。
- 便于拇指单手操作的移动端底部导航栏 (`MobileBottomBar.tsx`) 提供 5 个核心导航标签页：**代码**、**原理图**、**实验台**、**波形** 与 **控制台**，并附带实时错误/警告徽标。
