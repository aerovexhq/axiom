# Continuous Assignments & Gate Primitives

Continuous assignments and structural gate primitives represent static combinational hardware in Verilog. They execute concurrently and continuously: whenever any signal on the right-hand side changes, the output net updates immediately.

---

## Continuous Assignments (`assign`)

Continuous assignments drive values onto `wire` nets:

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### Assignment Rules
1. **Target Net Type**: The left-hand side must be a scalar or vector net (`wire`). It cannot be a register variable (`reg`).
2. **Dynamic Re-evaluation**: Whenever `a` or `b` changes, `sum` updates within the current simulation time step.
3. **Implicit Zero-Delay**: Changes propagate through continuous assignments in zero simulation time, generating intermediate delta cycles ($\delta$) until all nets reach steady state.

---

## Built-In Structural Gate Primitives

Verilog includes built-in gate primitives directly recognized by Axiom's elaborator and mapped into the Schematic DAG Visualizer:

```verilog
// Basic Boolean Gates
// Syntax: gate_type [instance_name] (output, input1, input2, ...);
and  and1 (out_and, in_a, in_b);
or   or1  (out_or,  in_a, in_b);
xor  xor1 (out_xor, in_a, in_b);
nand nand1(out_nand, in_a, in_b);
nor  nor1 (out_nor, in_a, in_b);
xnor xnor1(out_xnor, in_a, in_b);

// Inverters and Buffers
// Syntax: not/buf [instance_name] (output, input);
not  inv1 (out_not, in_a);
buf  buf1 (out_buf, in_a);

// Tristate Buffers
// Syntax: bufif0/bufif1 [instance_name] (output, input, control);
bufif1 tri_buf (bus_line, tx_data, enable); // Enabled when enable == 1
bufif0 tri_inv (bus_line, tx_data, n_en);   // Enabled when n_en == 0
```

---

## Combinational Logic Example: Gate-Level Full Adder

```verilog
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire s1, c1, c2;

    // First half adder stage
    xor xor1 (s1, a, b);
    and and1 (c1, a, b);

    // Second half adder stage
    xor xor2 (sum, s1, cin);
    and and2 (c2, s1, cin);

    // Carry out calculation
    or  or1  (cout, c1, c2);

endmodule
```

In Axiom Studio, opening this design automatically lays out all 5 gates with collision-free orthogonal wiring, zero-turn pin alignment, and real-time net valuations in the Schematic Viewer.
