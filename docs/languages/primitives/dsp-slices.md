# DSP48 Arithmetic Processing Slices

Xilinx FPGAs embed high-speed hardware digital signal processing slices: `DSP48E1` (7-Series) and `DSP48E2` (UltraScale+).

---

## DSP48E2 Architecture (UltraScale+)

The `DSP48E2` slice features:
- **$27 \times 18$-bit Two's-Complement Multiplier**: Supports wide operand arithmetic in a single clock cycle.
- **48-bit Accumulator & ALU**: Performs addition, subtraction, logic operations, and accumulation.
- **Dedicated Pre-Adder**: 27-bit pre-adder for symmetric finite impulse response (FIR) filters.
- **Pattern Detector**: Detects terminal counts, zero flags, and overflow/underflow conditions.

```verilog
DSP48E2 #(
    .USE_MULT("MULTIPLY")
) u_dsp (
    .P      (product_48bit),
    .A      ({3'b0, operand_a_27bit}),
    .B      (operand_b_18bit),
    .C      (48'h0),
    .CLK    (clk),
    .ALUMODE(4'b0000), // ADD
    .OPMODE (9'b000000101)
);
```

In Axiom EDA, behavioral multiplications (`assign P = A * B;`) are automatically inferred into `DSP48E2` hardware slices during technology mapping.
