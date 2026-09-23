# 桌面原生与 Web 架构

Axiom 采用统一的双目标架构：既是一个轻量级的原生桌面客户端，又是一个免安装、100% 运行在浏览器中的 WebAssembly 工程仪表板。

---

## 双目标架构概览

```
                        Axiom Core Architecture
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        Native Desktop Target                WebAssembly Target
        - Tauri v2 (Rust IPC)               - wasm32-unknown-unknown
        - Linux, macOS, Windows             - 100% Client-Side In-Browser
        - Direct Cranelift JIT in RAM       - Portable Evaluator in WebWorker
        - Sub-50 MB Binary                  - Zero Backend Server Dependencies
```

---

## 现代黑曜石深色主题界面

工程前端采用 **React 19**、**TypeScript 5.7**、**PostCSS** 与 **Vite 6** 构建，呈现灵感源自 Obsidian 和 Linear 的深色工程工作区：

1. **仿真控制顶部栏**：
   - 离散单步控制项：`自由运行`、`暂停`、`+1 ns`、`+100 ps` 以及 `单步 δ` (零时间 delta 周期 (δ周期))。
   - 实时遥测指标：仿真时间戳 ($ps / ns$)、当前 Delta 周期 ($\delta$)、瞬态峰值电流 ($mA$) 以及最大电压骤降 ($mV$)。
2. **例化展开网表层次资源管理器**：
   - 递归树形视图展示展开后的作用域、模块实例、寄存器、连线网表与过程块。
   - 内置测试用例切换器（ALU、带毛刺计数器、分层核心）。
3. **高性能 Canvas 2D 数字波形查看器**：
   - 虚拟化 60+ FPS 数字逻辑波形渲染。
   - 清晰醒目的 4 态逻辑色彩区分：0（板岩灰）、1（翡翠绿）、X（玫瑰红）、Z（琥珀黄）。
   - 多位宽总线菱形翻转包络线，居中显示十六进制数值。
   - **Delta 毛刺放大镜**：以粉色图标突出显示瞬态零时间冒险。
4. **物理硅芯片遥测图表**：
   - 模拟瞬态电流曲线 ($I(t)$)，配以青色渐变填充。
   - 供电轨电感性 PDN 电压骤降 (IR + L di/dt) ($V_{sag} = IR + L \frac{di}{dt}$)。
   - 动态数据卡片：平均功耗 ($mW$)、峰值电流 ($mA$)、最大电压骤降 ($mV$) 以及总损耗能量 ($nJ$)。
5. **仿真内核控制台与导出工具**：
   - 实时事件日志流。
   - 一键下载 IEEE 1364 `.vcd` 波形与 Synopsys `.saif` 功耗文件。
