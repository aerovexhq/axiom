# CLI 命令行参考手册

Axiom 包含一个快速、独立的命令行驱动程序，专为 CI/CD 流水线、无头自动化测试以及基准回归测试而设计。

---

## 全局用法

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### 全局选项标志
- `-h, --help`：显示帮助与用法信息。
- `-v, --version`：显示 Axiom EDA 的当前版本号。

---

## 子命令

### 1. `compile` 编译
执行内存中词法分析、Pratt 语法解析、层次化网表例化展开以及无需磁盘序列化的内存中 Cranelift JIT 编译。

```bash
axiom compile <FILE> -t <TOP>
```

#### 参数
- `<FILE>`：Verilog 或 SystemVerilog HDL 源文件路径（`.v` 或 `.sv`）。
- `-t, --top <TOP>`：要展开的顶层模块标识符。

#### 示例
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run` 运行
编译指定的 HDL 硬件设计并运行指定时钟周期数的仿真，可选择实时生成 Value Change Dump (VCD) 波形与 SAIF 翻转率文件。

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### 选项
- `-t, --top <TOP>`：顶层模块名称（必填）。
- `--ticks <N>`：要仿真的时钟时标数（默认：100）。
- `--vcd <FILE>`：导出 IEEE 1364 Value Change Dump (VCD) 波形的文件路径。
- `--saif <FILE>`：导出 SAIF 2.0 开关活动率数据的文件路径。

#### 示例
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark` 基准测试
执行统计微基准测试，精确测量端到端 JIT 编译周转耗时与原始仿真事件吞吐量。

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### 选项
- `-t, --top <TOP>`：顶层模块名称（必填）。
- `--cycles <N>`：仿真的时钟周期数（默认：5000）。

#### 示例
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
