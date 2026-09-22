# Block RAM Embedded Memories (RAMB18 / RAMB36)

Xilinx FPGAs contain dedicated dual-port synchronous Static RAM blocks: `RAMB18E2` (18 Kilobits) and `RAMB36E2` (36 Kilobits).

---

## Key RAMB Features

- **True Dual-Port Operation**: Independent read and write ports (`Port A` and `Port B`) with separate clocks.
- **Configurable Data Widths**:
  - `RAMB36E2`: $32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$, or $512 \times 72$.
  - `RAMB18E2`: $16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$, or $512 \times 36$.
- **Byte-Wide Write Enables**: Individual 8-bit byte write strobes (`WEA[3:0]`).
- **Built-In FIFO Controller**: Dedicated hardware pointers and status flags (`FULL`, `EMPTY`) without consuming external CLB logic.

```verilog
RAMB36E2 #(
    .READ_WIDTH_A(36),
    .WRITE_WIDTH_A(36),
    .READ_WIDTH_B(36),
    .WRITE_WIDTH_B(36)
) u_bram (
    // Port A
    .CLKARDCLK (clk),
    .ADDRARDADDR({addr_a, 5'b0}),
    .DINADIN   (data_in_a),
    .DOUTADOUT (data_out_a),
    .WEA       (write_en_a),
    // Port B
    .CLKBWRCLK (clk),
    .ADDRBWRADDR({addr_b, 5'b0}),
    .DINBDIN   (data_in_b),
    .DOUTBDOUT (data_out_b),
    .WEBWE     (write_en_b)
);
```
