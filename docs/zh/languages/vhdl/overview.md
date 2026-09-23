# VHDL (IEEE 1076) 语言概览

Axiom EDA 为 **IEEE 1076 VHDL** 标准提供原生语法解析、网表展开例化以及 LSP 语言服务诊断（`crates/lsp/src/vhdl.rs`）。VHDL 强调强类型约束、清晰的结构分离以及高度确定性的硬件行为建模。

---

## Axiom 中的 VHDL 架构

```
+-------------------------------------------------------------------------------+
| Axiom Multi-Language HDL Processing Core                                      |
+---------------------------------------+---------------------------------------+
| Verilog / SystemVerilog Frontend      | VHDL Frontend (IEEE 1076-1993/2008)   |
| (IEEE 1364 / IEEE 1800)               | (Entity, Architecture, Port Maps)     |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|             +-------------------------------------------+                     |
|             | Unified Bound Intermediate Representation  |                    |
|             | (BIR Netlist & Technology Mapping Engine) |                     |
|             +-------------------------------------------+                     |
|                                   |                                           |
|                                   v                                           |
|       Cranelift JIT Compiler & WebAssembly Simulation Backends                |
+-------------------------------------------------------------------------------+
```

### 支持的 VHDL 标准
- **IEEE 1076-1993**：全面支持实体、架构体、组件声明、顺序进程以及标准 IEEE 程序包。
- **IEEE 1076-2008**：支持端口列表中无界数组、简化敏感列表（`process(all)`）以及现代扩展运算符。
- **双语言协同混合设计**：Axiom 例化展开引擎允许在同一设计层次中互相嵌套例化 Verilog 与 VHDL 模块。
