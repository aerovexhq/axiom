# Monaco XDC 语言服务器与约束校验

Axiom EDA 为 Xilinx 设计约束 (XDC) 提供了专用的语言服务器协议 (LSP) 实现与高亮器（`crates/lsp/src/xdc.rs`）。

---

## 实时 XDC 约束语法校验

Monaco XDC 语言服务在编辑器打开 `.xdc` 文件时直接生效：
- **Tcl 命令有效性校验**：原生识别并解析 `set_property`、`create_clock`、`create_generated_clock`、`set_input_delay`、`set_output_delay`、`set_false_path`、`set_clock_groups` 与 `set_multicycle_path`。
- **精准注释解析**：精准处理以 `#` 开头的行注释，彻底杜绝已注释管脚配置上的虚假语法报错。
- **端口对象存在性校验**：实时核对 `[get_ports <name>]` 中引用的端口名称是否真实存在于当前工程激活的顶层模块中。

---

## 智能上下文代码补全

在编辑 `.xdc` 文件时输入关键字将触发上下文补全代码段：
- **物理管脚绑定**：`set_property PACKAGE_PIN <PIN> [get_ports <PORT>]`
- **电气标准分配**：`set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **主时钟约束**：`create_clock -period 10.000 -name <NAME> [get_ports <PORT>]`
- **伪路径声明**：`set_false_path -from [get_ports <PORT>]`
