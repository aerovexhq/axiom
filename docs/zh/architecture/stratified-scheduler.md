# 分层事件调度器与 Delta 周期引擎

数字逻辑仿真器依赖离散事件调度来对并发性与物理因果传播进行建模。Axiom 严格实现了 **IEEE 1800 分层事件队列**，同时为调用方提供了细粒度控制。

---

## IEEE 1800 调度区域层次

每个仿真时间戳 ($t$) 都包含任意数量的零时间 delta 周期 (δ周期) ($\delta$)，划分为若干执行区域：

```
+-------------------------------------------------------------------------------+
| Active Region                                                                 |
| - Evaluate continuous assignments                                             |
| - Execute blocking statements (=)                                             |
| - Evaluate right-hand side of non-blocking assignments (NBAs)                 |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Inactive Region (#0 Delays)                                                   |
| - Process explicit #0 procedural delays                                       |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| NBA Region (Non-Blocking Assignments)                                         |
| - Apply queued non-blocking assignment updates to flip-flop registers (<=)    |
| - Net transitions trigger sensitivity for next delta cycle: δ -> δ + 1        |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Postponed Region                                                              |
| - Sample steady-state values for VCD waveform dump and SAIF activity          |
+-------------------------------------------------------------------------------+
```

---

## 细粒度调用方控制 API

传统工具将零时间 delta 周期视为黑盒：`run 100ns` 在内部执行完所有 delta 周期，向设计者隐藏了瞬态毛刺。

Axiom 提供了两个细粒度的步进原语：

### 1. `step_delta()`
在不推移物理时间的情况下，将仿真精确推移**一个离散的零时间 delta 周期 (δ周期)** ($\delta \to \delta + 1$)：
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
以任意增量推移物理仿真时间：
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## 组合逻辑毛刺冒险检测

在零时间 delta 周期 (δ周期) 内，非对称路径延迟通常会导致网线在稳定前发生多次翻转（例如 $0 \to 1 \to 0$ 或 $1 \to 0 \to 1$）。Axiom 的 `GlitchDetector` 会自动标记这些事件：
- **静态 0 冒险**：起始和终止均为 0 的信号上出现的瞬态高电平脉冲。
- **静态 1 冒险**：起始和终止均为 1 的信号上出现的瞬态低电平跌落。
- **动态冒险**：在单次逻辑跳变过程中发生多次中间翻转。

这些冒险在 CLI 命令行和 Canvas 波形查看器中都会被实时标记。
