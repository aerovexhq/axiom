---
layout: home
hero:
  name: Axiom EDA
  text: 高性能 HDL 引擎与芯片遥测
  tagline: 极速内存中 Cranelift JIT 编译、手动零时间 delta 周期 (δ周期) 单步推进与物理建模芯片遥测。由 Aerovex 基于
    Rust 构建。
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
  - theme: brand
    text: 启动网页版 Studio
    link: /studio/
    target: _blank
  - theme: alt
    text: 下载桌面版客户端
    link: '#download-desktop-studio-msi-deb-dmg'
  - theme: alt
    text: 快速开始与安装
    link: /zh/guide/quickstart
  - theme: alt
    text: 在 GitHub 上查看
    link: https://github.com/aerovexsim/axiom
features:
- title: 内存中 Cranelift JIT 编译
  details: 在数毫秒内将 Verilog 与 SystemVerilog 设计直接在内存中编译为原生机器码 (x86_64, AArch64)，彻底省去长达数分钟的
    C++ 生成与快照磁盘 I/O 开销。
- title: 细粒度 Delta 周期单步推进
  details: 调用方可控的手动 tick API，暴露离散的零时间 delta 周期 (δ周期) (step_delta)，揭示传统仿真器掩盖的组合逻辑竞争冒险与毛刺。
- title: 物理芯片遥测
  details: 基于第一性原理的动态功耗建模 (0.5 * C * V^2 * f * α) 与电感性 PDN 电压骤降 (IR + L di/dt) 耦合，在数字波形旁实时同步流式传输模拟遥测数据。
- title: 跨平台桌面与网页架构
  details: 基于 Tauri v2、React 19 和 Vite 构建的轻量级（小于 50 MB）桌面应用，并能原生编译为 WebAssembly，实现
    100% 纯浏览器客户端仿真。
- title: 高密度 Canvas 数字波形
  details: 虚拟化 60+ FPS 数字波形查看器，支持多位宽总线翻转包络线、时间游标测量与 delta 毛刺放大镜。
- title: 100% Vivado 互操作性
  details: 导出 IEEE 1364 Value Change Dump (VCD) 波形与 Synopsys SAIF 2.0 翻转活动文件，可直接供
    Vivado read_saif 读取分析。
---


## 下载桌面版 Studio (.msi, .deb, .dmg)

下载原生高性能桌面安装包，享受直接在内存中 Cranelift JIT 编译且无浏览器沙箱限制的极致体验。发布版本自动从 GitHub 获取：

<ReleaseDownloader />

::: tip GitHub Releases 与 SHA256 校验
所有发布资产、SHA256 校验和与发行说明均可在 [Axiom GitHub Releases 页面](https://github.com/aerovexsim/axiom/releases) 获取。
:::

## 单行一键安装

数秒内安装独立的 Axiom EDA 二进制程序，告别 100+ GB 的庞大安装包：

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip 版本选择与源码构建
安装特定发行版本：
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

或者使用 cargo 直接从源码构建：
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## 基准性能对比：Axiom 对比 AMD Vivado

| 指标 | Axiom EDA (Aerovex) | AMD Vivado 设计套件 | 优势 |
| :--- | :--- | :--- | :--- |
| **端到端编译周转耗时** | **2.81 ms** (内存中 JIT) | 30.0 – 60.0 s (`xelab` 快照) | **提速超 10,000 倍** |
| **仿真事件吞吐量** | **780,840 事件/秒** | 约 100,000 – 250,000 事件/秒 | **提速 3–7 倍** |
| **零时间 Delta 周期自省能力** | 显式零时间 delta 周期 (δ周期) 单步与毛刺标记 | 黑盒折叠零时间 | **竞争冒险完全可见** |
| **动态能量遥测** | 实时 $P = \frac{1}{2} C V^2 f \alpha$ | 仿真后静态报告 | **实时同步动态波形** |
| **安装体积占用** | **<50 MB** 独立二进制文件 | **100+ GB** 庞大单体安装包 | **体积缩减超 2,000 倍** |
| **平台兼容性** | Linux, macOS (Apple Silicon), Windows, Web | 仅支持 Linux 与 Windows | **全平台通用可移植** |
