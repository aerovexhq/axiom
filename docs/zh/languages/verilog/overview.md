# Verilog HDL (IEEE 1364) 语言概览

Axiom EDA 为 IEEE 1364-1995、IEEE 1364-2001 与 IEEE 1364-2005 Verilog 硬件描述语言标准提供全面、原生的编译与仿真支持。

不同于依赖多阶段 C++ 源码转译或磁盘快照生成的传统工具，Axiom 将 Verilog 直接解析为内存中中间表示 (BIR)，并在 3 毫秒内通过 Cranelift JIT 编译为原生机器码 (x86_64, AArch64)，亦可通过 WebAssembly 运行于客户端浏览器中。

---

## Verilog 编译与仿真流水线

```
+-------------------------------------------------------------------------------+
| Axiom In-RAM HDL Processing Pipeline                                          |
+-------------------------------------------------------------------------------+
| Source Code (.v)                                                              |
|   |                                                                           |
|   v [Lexer & Tokenizer] (crates/syntax/src/lexer.rs)                          |
| IEEE 1364 Token Stream (Keywords, Identifiers, Sized Numbers, Directives)     |
|   |                                                                           |
|   v [Recursive Descent Parser] (crates/syntax/src/parser.rs)                  |
| Abstract Syntax Tree (AST) (Modules, Ports, Declarations, Processes, Assigns) |
|   |                                                                           |
|   v [Hardware Elaborator] (crates/ir/src/elaborator.rs)                       |
| Bound Intermediate Representation (BIR Netlist, Stratified Event Graph)       |
|   |                                                                           |
|   +---------------------------------------+-----------------------------------+
|   | (Desktop Native)                      | (In-Browser WebAssembly)          |
|   v                                       v                                   |
| [Cranelift JIT Backend]                   | [WASM Execution Engine]           |
| Machine Code in RAM (x86_64 / AArch64)    | Web Worker Sandbox (32-bit WASM)  |
|   |                                       |                                   |
|   +-------------------+-------------------+                                   |
|                       v                                                       |
|       [Stratified Event Scheduler] (crates/sim/src/engine.rs)                 |
|       Active -> Inactive -> NBA -> Monitor -> Future Events                   |
+-------------------------------------------------------------------------------+
```

### 1. 内存中词法与语法解析
极速词法分析器与递归下降语法分析器在亚毫秒时间内处理所有 IEEE 1364 词法规则、带位宽数字、编译预处理指令（`` `include ``、`` `define ``、`` `ifdef ``）与宏展开。

### 2. 网表展开与例化
展开引擎负责展开模块层次、解析参数覆盖（`#(.WIDTH(8))`）、绑定持续赋值、连通逻辑门原语、提取有限状态机并构建分层事件调度图。

### 3. 双运行时执行环境
- **桌面原生 JIT 引擎**：将布尔逻辑、多路复用器和算术运算符直接降解为 CPU 机器指令，仿真吞吐量超过 780,000 事件/秒。
- **WebAssembly 沙箱**：运行于带 SharedArrayBuffer 遥测的独立后台 Web Worker 中，实现 100% 零服务端依赖的纯客户端仿真。

---

## IEEE 标准支持兼容性矩阵

| IEEE 标准 | 功能领域 | Axiom 支持状态 |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | 结构化基础门级原语 (`and`, `or`, `not`, `xor`, `buf`) | 完全原生支持 |
| **IEEE 1364-1995** | Non-ANSI 端口声明头部 (`module foo (a, b); input a;`) | 完全原生支持 |
| **IEEE 1364-2001** | ANSI 端口列表声明头部 (`module foo (input wire a, output reg b);`) | 完全原生支持 |
| **IEEE 1364-2001** | 索引部分位选运算符 (`[base +: width]`, `[base -: width]`) | 完全原生支持 |
| **IEEE 1364-2001** | 多维非打包存储器数组 (`reg [31:0] mem [0:1023]`) | 完全原生支持 |
| **IEEE 1364-2001** | 声明与持续赋值一体化语法 (`wire [7:0] w = in;`) | 完全原生支持 |
| **IEEE 1364-2005** | 过程性循环控制语句 (`for`, `while`, `repeat`, `forever`) | 完全原生支持 |
| **IEEE 1364-2005** | 标准系统任务与函数 (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | 完全原生支持 |
| **IEEE 1364-2005** | 外部存储器文件加载 (`$readmemb`, `$readmemh`) | 完全原生支持 |
