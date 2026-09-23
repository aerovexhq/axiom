# 快速开始与安装指南

在不到 60 秒内快速上手并运行 **Axiom EDA**。

---

## 1. 单行一键安装

Axiom 提供轻量级、完全自包含的独立二进制文件（小于 50 MB），无需任何外部工具链依赖。

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

安装程序会自动检测您的操作系统与架构（`x86_64` 或 `aarch64` / Apple Silicon），将 `axiom` 二进制程序安装到 `~/.axiom/bin`（或 `%USERPROFILE%\.axiom\bin`）并配置环境变量 `$PATH`。

---

## 2. 版本选择与自定义安装参数

您可以指定特定的发布版本或自定义安装目标路径。

### 指定特定安装版本

::: code-group

```bash [Linux & macOS (Env Var)]
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```bash [Linux & macOS (Flag)]
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --version v1.0.0
```

```powershell [Windows (Env Var)]
$env:AXIOM_VERSION="v1.0.0"; irm https://axiom.aerovex.net/install.ps1 | iex
```

```powershell [Windows (Parameter)]
& ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v1.0.0
```

:::

### 自定义安装目录

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. 专用的源码构建脚本

如果您倾向于从源码编译或对内核进行修改，Axiom 在 `scripts/` 中提供了全自动构建驱动脚本：

### Linux 与 macOS (`scripts/build_from_source.sh`)

克隆代码仓库并运行自动化构建驱动：

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**构建脚本参数选项：**

- `--cli-only`：跳过 Node/UI 前端，仅构建无界面的 Rust 命令行工具：
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>`：安装到自定义系统或用户目录：
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug`：快速未优化的调试版本编译：
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

在 PowerShell 中运行：
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. 手动 Cargo 编译

您也可以直接调用 Cargo 进行编译：

```bash
cargo build --release --bin axiom
```

编译输出的二进制可执行文件位于 `target/release/axiom`。

验证安装是否成功：
```bash
axiom --version
```

输出：
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. 编译您的首个 HDL 硬件设计

Axiom 在 `tests/fixtures/` 中提供了经过严格验证的标准硬件测试用例。将 32 位 ALU 直接在内存中编译为原生机器码：

```bash
axiom compile tests/fixtures/alu.v -t alu
```

输出：
```text
============================================================
 Axiom HDL In-RAM Compiler: tests/fixtures/alu.v
 Top-Level Target: alu
============================================================
  [1/3] Lexing & Parsing in 172.70µs
  [2/3] Elaboration: 6 nets, 1 processes, 1 continuous assigns in 218.86µs
  [3/3] In-RAM Cranelift JIT Compilation in 2.41ms
------------------------------------------------------------
 Compilation successful! Total latency: 2.81ms
 In-RAM Arena Footprint: 6 64-bit words (48 bytes)
============================================================
```

---

## 6. 运行批量仿真并导出波形与 SAIF 文件

执行 100 个时钟时标仿真，导出标准 IEEE 1364 Value Change Dump (VCD) 波形以及 Synopsys SAIF 2.0 翻转活动文件：

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

输出：
```text
============================================================
 Axiom In-RAM Batch Simulator: tests/fixtures/counter.v
 Target: counter | Steps: 100 ticks
============================================================
 Simulation completed in 410.15µs
 Final SimTime: 50000 ps (50.000 ns) | Total Deltas: 0
 Glitches Detected: 0
 Exported IEEE 1364 VCD to: waveforms.vcd
 Exported SAIF 2.0 to: power.saif
============================================================
```

---

## 7. 运行高精度性能基准测试

对仿真内核进行压力测试并测量事件吞吐量：

```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 8. 启动现代桌面 Studio 与 Web 前端

### 独立原生桌面端应用
直接启动原生桌面窗口（由 Tauri v2 强力驱动，无需占用网络端口，直接在内存中 Cranelift JIT 编译）：
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### 浏览器 WebAssembly Studio
打开已部署的零安装在线 Studio：**[https://axiom.aerovex.net/studio/](https://axiom.aerovex.net/studio/)**。

### 本地 UI 开发服务器
```bash
cd ui
npm install
npm run dev
```

核心功能特性：
- **全局统一命令面板 (`Ctrl+K`)**：跨信号、网表层次、快捷操作与技术文档的即时模糊搜索。
- **高密度数字波形查看器**：多进制总线展开、双时间游标 ($\Delta t$) 与零时间 delta 周期 (δ周期) 冒险抽屉。
- **GPU 加速门级原理图 DAG**：60+ FPS Canvas 2D 引擎，支持一键关键逻辑锥切片查看 (`F` / `O`)。
- **虚拟硬件实验台**：8 位拨码开关组、触控按键、旋转十六进制旋钮、数码管显示与测试激励发生器。
- **时序雷达与芯片能耗树状图**：静态时序分析 (STA) 关键路径瀑布图与动态功耗分解图 ($P = \frac{1}{2} C V^2 f \alpha$)。
- **内嵌脚本交互终端**：直接在内存中执行的仿真交互式 REPL 控制台（`run`、`step delta`、`force`、`get`）。
