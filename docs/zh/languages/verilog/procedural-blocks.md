# 过程块与仿真时钟调度

过程块（`always` 与 `initial`）包含响应仿真事件或启动触发而执行的顺序语句。它们既可为时序状态寄存器（触发器、锁存器）建模，也可表达复杂的组合逻辑决策树。

---

## 分层事件调度器

Axiom 严格遵循 IEEE 1364 分层事件队列规范推进 Verilog 仿真执行：

```
+-------------------------------------------------------------------------------+
| Axiom Stratified Simulation Event Cycle (Time Step T)                         |
+-------------------------------------------------------------------------------+
| 1. Active Region                                                              |
|    - Evaluate continuous assignments (assign)                                 |
|    - Evaluate procedural blocking assignments (=)                             |
|    - Evaluate RHS of non-blocking assignments (<=)                            |
|    - Execute $display and system tasks                                        |
|   |                                                                           |
|   v                                                                           |
| 2. Inactive Region                                                            |
|    - Process explicit #0 delay procedural statements                          |
|   |                                                                           |
|   v                                                                           |
| 3. Non-Blocking Assignment (NBA) Region                                       |
|    - Update LHS of all non-blocking assignments (<=)                          |
|    - May trigger new Active events -> Advance Delta Cycle (delta -> delta + 1)|
|   |                                                                           |
|   v                                                                           |
| 4. Monitor & Post-Update Region                                               |
|    - Execute $monitor and $strobe tasks                                       |
|    - Sample waveform trace history                                            |
|   |                                                                           |
|   v                                                                           |
| 5. Future Time Region                                                         |
|    - Advance physical simulation time: t -> t + dt                            |
+-------------------------------------------------------------------------------+
```

---

## 阻塞赋值 (`=`) 对比 非阻塞赋值 (`<=`)

深刻理解 `=` 与 `<=` 之间的核心区别是设计无竞争冒险数字硬件的前提：

### 1. 阻塞赋值 (`=`)
按代码书写先后顺序串行执行。仿真器立即更新左侧变量值，并在当前赋值彻底完成之前阻塞后续语句的执行。
- **设计黄金准则**：在**纯组合逻辑**过程块中，必须一律使用阻塞赋值。

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. 非阻塞赋值 (`<=`)
在当前 Active 活跃区域求值右侧表达式，但推迟到 NBA (Non-Blocking Assignment) 调度区域才正式更新目标寄存器。
- **设计黄金准则**：在**时钟触发的时序逻辑**过程块中，必须一律使用非阻塞赋值。

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

Axiom 内存原生检查器实时严格执行上述准则：
- `AXIOM_W001`：在 `always @(posedge clk)` 中误用 `=` 时发出警告。
- `AXIOM_W002`：在 `always @*` 中误用 `<=` 时发出警告。

---

## 边沿触发时序过程 (寄存器与计数器)

```verilog
module counter_8bit (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       enable,
    output reg  [7:0] count
);
    // Asynchronous active-low reset, positive-edge clock
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 8'd0;
        end else if (enable) begin
            count <= count + 8'd1;
        end
    end
endmodule
```

---

## 仿真测试平台初始化 (`initial`)

`initial` 过程块在仿真启动零时刻 ($t=0$) 仅执行一次：

```verilog
initial begin
    // Initialize signals
    clk = 0;
    rst_n = 0;
    data_in = 8'h00;

    // Release reset after 20 nanoseconds
    #20 rst_n = 1;

    // Apply test vector after 10 nanoseconds
    #10 data_in = 8'hA5;

    // Finish simulation at t = 100 ns
    #70 $finish;
end

// Clock generator: 100 MHz (10 ns period)
always #5 clk = ~clk;
```
