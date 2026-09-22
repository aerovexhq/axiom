# Verilog Control Flow Statements

Procedural control flow statements (`if-else`, `case`, and loops) allow designers to express complex decision trees, condition priority encoders, and state transition logic inside procedural blocks.

---

## Conditional Statements (`if-else`)

The `if-else` statement evaluates boolean conditions in priority order:

```verilog
always @(*) begin
    if (interrupt_high) begin
        active_irq = 2'b11;
    end else if (interrupt_med) begin
        active_irq = 2'b10;
    end else if (interrupt_low) begin
        active_irq = 2'b01;
    end else begin
        active_irq = 2'b00;
    end
end
```

### The Unintended Latch Hazard
In a combinational process, if a variable is assigned in an `if` branch but omitted from the `else` branch, the hardware must retain its previous value when the condition is false. This forces synthesis tools to infer a **transparent level-sensitive latch**.
- Axiom's linter raises warning `AXIOM_W006_TRANSPARENT_LATCH` whenever an incomplete branch is detected in combinational blocks.

---

## Multi-Way Branching (`case`, `casez`, `casex`)

### 1. Standard `case`
Compares the selector expression against case item values:

```verilog
reg [1:0] state;
reg [7:0] data_out;

always @(*) begin
    case (state)
        2'b00:   data_out = 8'h00;
        2'b01:   data_out = 8'hAA;
        2'b10:   data_out = 8'h55;
        2'b11:   data_out = 8'hFF;
        default: data_out = 8'h00; // Always include default!
    endcase
end
```
- Axiom's linter raises `AXIOM_W007_MISSING_DEFAULT` if a `case` statement omits the `default:` branch.

### 2. `casez` (Don't-Care Bit Matching)
Treats `?` or `z` bits in case expressions as don't-care values. Ideal for address decoders and priority encoders:

```verilog
always @(*) begin
    casez (req_lines)
        4'b1???: grant = 4'b1000; // Bit 3 active, ignore lower bits
        4'b01??: grant = 4'b0100; // Bit 2 active
        4'b001?: grant = 4'b0010; // Bit 1 active
        4'b0001: grant = 4'b0001; // Bit 0 active
        default: grant = 4'b0000;
    endcase
end
```

---

## Procedural Loops (`for`, `while`, `repeat`, `forever`)

Loops inside synthesizable hardware unroll into parallel spatial logic:

```verilog
// 8-bit Population Count (Bit Counter) unrolled in parallel
integer i;
reg [3:0] ones_count;

always @(*) begin
    ones_count = 0;
    for (i = 0; i < 8; i = i + 1) begin
        if (input_byte[i])
            ones_count = ones_count + 1;
    end
end
```

In testbench code, `repeat` and `forever` loops model repetitive clock sequences:
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
