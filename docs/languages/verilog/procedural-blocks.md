# Procedural Blocks & Stratified Scheduling

Procedural blocks (`always` and `initial`) contain sequential statements that execute in response to events or simulation startup. They model sequential state registers (flip-flops, latches) as well as complex combinational decision trees.

---

## The Stratified Event Scheduler

Axiom executes Verilog simulation according to the IEEE 1364 Stratified Event Queue:

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

## Blocking (`=`) vs. Non-Blocking (`<=`) Assignments

Understanding the distinction between `=` and `<=` is critical for race-free digital design:

### 1. Blocking Assignment (`=`)
Executes sequentially in program order. The simulator updates the left-hand variable immediately and blocks subsequent statements until the assignment finishes.
- **Rule**: Use blocking assignments exclusively in **combinational** processes.

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. Non-Blocking Assignment (`<=`)
Evaluates the right-hand expression during the Active region, but defers updating the target register until the Non-Blocking Assignment (NBA) region.
- **Rule**: Use non-blocking assignments exclusively in **clocked sequential** processes.

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

Axiom's in-RAM linter actively enforces these rules:
- `AXIOM_W001`: Warns if `=` is used inside `always @(posedge clk)`.
- `AXIOM_W002`: Warns if `<=` is used inside `always @*`.

---

## Edge-Triggered Processes (Registers & Counters)

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

## Simulation Testbench Initialization (`initial`)

`initial` blocks execute once at simulation startup ($t=0$):

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
