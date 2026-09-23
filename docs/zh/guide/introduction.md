# 产品介绍与核心使命宣言

## Axiom EDA 的核心使命

**Axiom** 是由 **Aerovex** 采用 **Rust** 原生从零构建的高性能、跨平台硬件描述语言 (HDL) 处理、仿真与分析引擎，旨在实现对 AMD Vivado 相关流程的彻底重构与现代化升级。

Vivado 是 FPGA 开发领域公认的行业标准，但数十年的技术积累也带来了严重的软件臃肿：
- **超过 100 GB 的庞大安装包**，需要繁琐复杂的许可证守护进程与漫长的安装配置。
- **迟缓的 Java Swing 界面**，消耗数 GB 内存且在波形渲染时频繁卡顿冻结。
- **多阶段基于文件的编译流水线**（`xvlog` $\to$ 库数据库 $\to$ `xelab` $\to$ 快照二进制 $\to$ `xsim`），即使最微小的 HDL 代码修改也需要等待数分钟。
- **完全缺乏对现代平台的支持**，例如 macOS (Apple Silicon M1/M2/M3/M4) 或现代标准网页浏览器。
- **黑盒不透明的零时间 delta 周期**，向数字电路设计工程师掩盖了瞬态组合逻辑竞争冒险与毛刺。

**Axiom 彻底打破了这些局限。** 它提供了一个体积小于 50 MB、启动即用且具备深度自省能力的硬件仿真引擎，并辅以黑曜石风格的桌面端与网页端应用。

---

## 核心架构支柱

### 1. 内存中 Cranelift JIT 编译
Axiom 消除了中间 C++ 文件转储、外部 GCC/Clang 调用以及快照序列化。例化展开后的硬件网表与过程块在 3 毫秒内通过 **Cranelift** 直接在内存中编译为原生机器码 (x86_64, AArch64)。

### 2. 手动 Delta 时间步进与事件队列 API
不同于盲目推进仿真时间或将 delta 周期压缩进单一时间戳的传统仿真器，Axiom 提供了调用方可控的嵌入式步进 API：
- `engine.tick(delta_time)`：以皮秒或纳秒为单位推移物理时间。
- `engine.step_delta()`：在零仿真时间内单步推移一个离散的零时间 delta 周期 (δ周期) ($\delta \to \delta + 1$)，在信号稳定之前暴露瞬态冒险。

### 3. 物理规律驱动的电压、能量与功耗遥测
Axiom 将第一性原理物理方程嵌入到每一次信号跳变中：
- **动态功耗**：$P_{\text{dynamic}} = \frac{1}{2} C_{\text{net}} V_{\text{dd}}^2 f \alpha$
- **电感性 PDN 电压骤降 (IR + L di/dt)**：$V_{\text{sag}} = IR + L \frac{di}{dt}$
- 精准捕获时钟沿处的微电流浪涌尖峰，这些是 Vivado 静态估算报告所无法察觉的。

### 4. 跨平台桌面与 Web 架构
基于 **Tauri v2**、**React 19**、**TypeScript** 和 **Vite** 构建，Axiom 原生作为桌面端应用运行于 Linux、macOS 和 Windows，同时无缝编译为 **WebAssembly** (`wasm32-unknown-unknown`)，实现 100% 浏览器内本地仿真。
