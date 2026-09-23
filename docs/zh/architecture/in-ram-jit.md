# 内存中 Cranelift JIT 编译

传统硬件仿真器（如 Verilator、Synopsys VCS 和 Vivado xsim）高度依赖多阶段文件生成：
1. 对 HDL 源码进行词法与语法解析，生成中间抽象语法树 (AST)。
2. 生成海量的 C++ 或 C 源码文件（体积往往高达数千兆字节）。
3. 调用外部宿主机编译器 (GCC / Clang) 编译并链接共享动态库文件。
4. 将共享库重新加载回内存以启动仿真。

这种方式在每一次硬件设计迭代中都会引入**长达数十秒甚至数分钟的无效编译等待时间**。

---

## Axiom 零磁盘 I/O JIT 流水线

Axiom 完全绕过了中间磁盘文件转储与外部工具链：

```
Verilog / SystemVerilog Source
              |
              v
     Streaming Lexer & Pratt Parser
              | (In-Memory AST)
              v
     Hierarchical Elaborator (BIR)
              | (Dataflow Netlist Graph)
              v
  Cranelift JIT Code Generator
              | (Machine Instructions)
              v
Native Machine Code in RAM (x86_64 / AArch64)
              |
              +--> Directly mutates SimStateArena in O(1)
```

1. **直接生成 Cranelift 函数**：
   - 持续赋值（例如 `assign c = a + b`）与组合逻辑块被直接降解为 Cranelift 中间表示 (CLIF)。
   - 算术、按位、移位和归约运算符被编译为向量化的宿主机机器指令。
2. **原生内存指针直接执行**：
   - 编译后的函数直接接收指向 `SimStateArena` 内存缓冲区的裸指针（`values: *mut u64, masks: *mut u64`）。
   - 位级操作以单周期 CPU 指令（`and`、`or`、`xor`、`add`、`sub`）直接执行。
3. **状态变化检测标志**：
   - 编译生成的函数返回一个布尔整数，指示目标网线是否发生了状态翻转，从而实现最优的下游敏感度事件调度。
