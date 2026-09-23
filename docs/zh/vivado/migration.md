# 从 AMD Vivado 迁移至 Axiom

Axiom 基于第一性原理构建，旨在无缝平替 AMD Vivado 设计套件中的仿真与验证工作流。

---

## 命令对照映射概览

| 任务目标 | AMD Vivado 命令 | Axiom CLI 等效命令 |
| :--- | :--- | :--- |
| **解析 Verilog** | `xvlog design.v` | 内置于 `axiom compile` |
| **例化展开设计** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **运行仿真** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **导出 VCD 波形** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **导出 SAIF 翻转活动** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **测试延迟基准** | 手动秒表 / 性能分析日志 | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## 零磁盘快照开销

在 Vivado 中，展开例化会在磁盘上生成一个庞大的快照目录：
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

在 Axiom 中，编译和仿真 100% 在内存中执行：
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
无需 `xsim.dir` 缓存目录，没有数 GB 的快照文件，更无陈旧二进制伪影。
