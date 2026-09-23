# 断言系统 (SVA) 与形式化验证

SystemVerilog 断言 (SVA) 以数学方式精确规范预期硬件行为与时序协议。Axiom EDA 将 SVA 与引擎内置的限界模型检查器 (BMC) (`crates/sim/src/formal/`) 深度融合，支持在瞬态仿真中动态检验属性，或通过形式化方法进行全局数学证明。

---

## 立即断言与并发断言

### 1. 立即断言
作为过程性语句在单一仿真时间步内立即求值：

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. 并发断言
在跨越多个周期的时序序列中，在时钟有效跳变沿同步采样评估：

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## 时序序列与时态运算符

| 运算符 | 语法形式 | 功能描述 |
| :--- | :--- | :--- |
| **周期延迟** | `##n` | 精确在 $n$ 个时钟周期后 |
| **有界周期范围** | `##[min:max]` | 在 $min$ 到 $max$ 个时钟周期之间 |
| **连续重复发生** | `expr [*n]` | 表达式连续 $n$ 个周期成立 |
| **重叠蕴涵 (Overlapping)** | `ante \ | -> cons` | 若前项成立，则后项必须在**同一**周期成立 |
| **非重叠蕴涵 (Non-Overlapping)** | `ante \ | => cons` | 若前项成立，则后项必须在**下一**周期成立 |
| **系统采样函数** | `$rose(signal)` | 当信号发生 0 到 1 上升沿跳变时返回真 |
| **系统采样函数** | `$fell(signal)` | 当信号发生 1 到 0 下降沿跳变时返回真 |
| **系统采样函数** | `$stable(signal)` | 若信号值相比上一时钟周期保持未变则返回真 |

---

## 验证指令：`assert`, `assume`, `cover`

- **`assert property`**：证明硬件设计逻辑永不违反该属性。一旦违例，将在 Axiom 形式化工作台生成反例反思波形。
- **`assume property`**：在形式化限界模型检查 (BMC) 过程中，约束主输入端口处于有效工作环境之内。
- **`cover property`**：证明目标功能状态是数学可达的，并生成见证执行波形轨迹。
