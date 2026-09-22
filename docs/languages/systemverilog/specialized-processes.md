# Specialized Procedural Blocks (`always_comb`, `always_ff`, `always_latch`)

In classic Verilog, the generic `always` keyword was used for combinational logic, clocked registers, and latches, leading to subtle design errors when sensitivity lists were incomplete or branches were omitted. SystemVerilog introduces explicit procedural blocks that enforce design intent.

---

## `always_comb` (Combinational Logic)

`always_comb` explicitly declares a combinational process:
- **Automatic Sensitivity**: Designers no longer write `@*` or list inputs. The simulator automatically infers the complete sensitivity list of all read variables.
- **Immediate Startup Evaluation**: Executes automatically at simulation time $t=0$ to ensure outputs are valid before the first clock edge.
- **Strict Latch Prevention**: Axiom's linter raises an error if an `always_comb` block infers a transparent latch due to incomplete branches.

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

## `always_ff` (Clocked Sequential Logic)

`always_ff` models edge-triggered registers and flip-flops:
- Must have an edge-triggered sensitivity list (`@(posedge clk)` or `@(posedge clk or negedge rst_n)`).
- Cannot contain blocking assignments (`=`) for sequential state registers.
- Prohibits multiple clocks or zero-delay loops.

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

## `always_latch` (Level-Sensitive Latches)

When an asynchronous level-sensitive latch is genuinely intended (e.g., in low-power clock gating cells):

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
By isolating latches to explicit `always_latch` blocks, designers eliminate unintentional latch inference across their primary RTL modules.
