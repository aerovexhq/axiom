# SystemVerilog (IEEE 1800) 语言概览

Axiom EDA 为 **IEEE 1800 SystemVerilog** 语言标准提供原生综合、仿真与形式化验证支持。SystemVerilog 在传统 Verilog 的基础上扩展了现代硬件设计构造（`logic`, `always_ff`, `always_comb`, `interface`, `package`）以及高级验证功能，包括断言系统 (SVA) 与约束随机激励生成。

---

## Axiom 中的 SystemVerilog 范式

```
+-------------------------------------------------------------------------------+
| SystemVerilog Design & Verification Unified Engine                            |
+---------------------------------------+---------------------------------------+
| Hardware Design Enhancements          | Verification & Formal Proofs          |
|---------------------------------------+---------------------------------------|
| - Universal 'logic' data type         | - Immediate & Concurrent Assertions   |
| - Strict 'always_comb' / 'always_ff'  | - Temporal Sequences (##n, |->, |=>)   |
| - Typedefs, Structs & Enums           | - In-Engine Bounded Model Checker     |
| - Interfaces & Modports               | - Constrained Random Stimulus (rand)  |
| - Parameterized Packages              | - Automated Testbench Generators      |
+---------------------------------------+---------------------------------------+
| Unified Cranelift JIT & WebAssembly In-RAM Simulation Kernel                  |
+-------------------------------------------------------------------------------+
```

### Axiom 中的核心架构优势
1. **零开销例化展开**：将 SystemVerilog 接口、modport 与包直接展开为平坦的 BIR 网表，无需生成中间胶水层包装文件。
2. **设计意图显式校验**：对 `always_comb` 与 `always_ff` 强制执行严格综合检查规则，在解析阶段即可捕获意外锁存器推断与竞争冒险。
3. **形式化属性引擎**：将 SVA 时序属性原生编译为布尔状态跳变转移关系，直接由 Axiom 内置限界模型检查器 (BMC) 求解验证。
