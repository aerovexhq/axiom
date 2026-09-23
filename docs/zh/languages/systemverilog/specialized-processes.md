# 专用过程块 (always_comb / always_ff / always_latch)

在传统 Verilog 中，通用的 `always` 关键字同时用于组合逻辑、时序寄存器和锁存器，当敏感列表不全或分支遗漏时极易引发隐蔽的设计缺陷。SystemVerilog 引入了显式专用过程块，在语法层面强制保证设计意图。

---

## `always_comb` (组合逻辑专用过程块)

`always_comb` 显式声明纯组合逻辑过程：
- **全自动敏感列表**：设计者无需手动书写 `@*` 或罗列输入。仿真器自动静态推断过程块内所有被读取变量的完整敏感列表。
- **仿真启动零时刻立即求值**：在仿真时间 $t=0$ 自动触发执行一次，确保输出在首个时钟有效沿到来之前处于有效确定状态。
- **严格防范意外锁存器**：若 `always_comb` 块因分支覆盖不全而推断出透明锁存器，Axiom 静态检查器会立即触发编译报错。

```verilog
always_comb begin
    case (alu_op)
        4'b0000: alu_result = operand_a + operand_b;
        4'b0001: alu_result = operand_a - operand_b;
        4'b0010: alu_result = operand_a & operand_b;
        4'b0011: alu_result = operand_a | operand_b;
        default: alu_result = 32'd0;
    endcase
end
```

---

## `always_ff` (时钟时序逻辑专用过程块)

`always_ff` 专门用于建模边沿触发的寄存器与触发器：
- 必须具备严格边沿触发的敏感列表（`@(posedge clk)` 或 `@(posedge clk or negedge rst_n)`）。
- 严禁在时序状态寄存器赋值中使用阻塞赋值 (`=`)。
- 禁止在同一块内混合多时钟沿或产生零延迟循环死锁。

```verilog
always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        q_reg <= 16'h0000;
    end else if (enable) begin
        q_reg <= d_in;
    end
end
```

---

## `always_latch` (电平敏感锁存器过程块)

当设计中明确需要异步电平敏感锁存器时（例如低功耗门控时钟集成单元）：

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
通过将锁存器严格隔离在显式的 `always_latch` 块内，设计者能够彻底消除主 RTL 模块中无意识推断出锁存器的隐患。
