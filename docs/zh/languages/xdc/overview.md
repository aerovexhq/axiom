# Xilinx 设计约束 (XDC / SDC) 概览

Axiom EDA 为 **Xilinx 设计约束 (XDC)** 文件提供原生解析、静态验证与约束执行支持（`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`）。XDC 基于业界标准的 Synopsys 设计约束 (SDC) 语法，并扩展了针对 FPGA 物理器件配置的 Tcl 属性。

---

## XDC 在 Axiom 中的双重角色

```
+-------------------------------------------------------------------------------+
| XDC Constraints File (constrs_1/timing.xdc)                                   |
+---------------------------------------+---------------------------------------+
| Physical Constraints                  | Static Timing Constraints             |
|---------------------------------------+---------------------------------------|
| - Package pin allocation (PACKAGE_PIN)| - Clock definitions (create_clock)    |
| - I/O electrical standard (IOSTANDARD)| - I/O setup/hold delays               |
| - Drive strength & slew rate          | - False paths & multicycle exceptions |
| - Pull-up & pull-down resistors       | - Asynchronous clock domain isolation |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|       [Floorplanning & Virtual Lab]       [Static Timing Analysis Engine]     |
|       - Physical die placement            - Critical path waterfall           |
|       - Basys 3 board mapping             - Setup & hold slack calculation    |
+-------------------------------------------------------------------------------+
```

### Axiom 中的核心支持能力
1. **零误报 LSP 服务**：Axiom 内存原生 XDC 语言服务器能够正确解析 `#` 注释行，校验命令关键字，提供端口自动补全，绝不将合规约束误报为语法错误。
2. **虚拟实验台直接绑定**：物理引脚映射（`PACKAGE_PIN V17`, `PACKAGE_PIN U16`）动态绑定至 Axiom 虚拟实验机架，将仿真 RTL 端口直接连通至 Basys 3 拨码开关与 LED 发光管。
3. **静态时序分析引擎集成**：时钟定义（`create_clock -period 10.0`）为静态时序分析 (STA) 引擎与时序雷达确立了核心时序基准频率。
