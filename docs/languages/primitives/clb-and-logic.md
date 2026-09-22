# Configurable Logic Block (CLB) & Logic Primitives

Configurable Logic Blocks contain the core Look-Up Tables, carry logic, and sequential storage elements of Xilinx FPGAs.

---

## Look-Up Tables (`LUT1` to `LUT6`, `LUT6_2`)

### 1. `LUT6_2` (Dual-Output 6-Input LUT)
The foundation of modern Xilinx CLBs. It can implement any single 6-input boolean function (`O6`), or two distinct 5-input boolean functions sharing inputs `I0` through `I4` (`O5` and `O6`):

```verilog
LUT6_2 #(
    .INIT(64'h8000_0000_0000_0000) // 6-input AND gate
) u_lut (
    .O6 (and_out),
    .O5 (), // Unused in single-output mode
    .I0 (in0), .I1 (in1), .I2 (in2),
    .I3 (in3), .I4 (in4), .I5 (in5)
);
```

---

## Fast Carry Logic (`CARRY4`, `CARRY8`)

Dedicated fast-carry chains implement high-speed adders and accumulators without routing carry signals through slower general interconnect:
- **`CARRY4` (7-Series)**: 4-bit lookahead carry macro with propagate (`S[3:0]`), generate (`DI[3:0]`), carry-in (`CI`), and carry-outs (`CO[3:0]`, `O[3:0]`).
- **`CARRY8` (UltraScale+)**: 8-bit lookahead carry macro providing twice the carry density per CLB slice.

---

## Flip-Flops & Latches (`FDRE`, `FDSE`, `FDCE`, `FDPE`)

Xilinx slice registers support dedicated clock enables and prioritized sets/resets:

| Primitive | Trigger | Reset Type | Priority | Description |
| :--- | :--- | :--- | :--- | :--- |
| `FDRE` | `posedge C` | Synchronous Reset (`R`) | Reset priority | D Flip-Flop with Clock Enable (`CE`) and Synchronous Reset |
| `FDSE` | `posedge C` | Synchronous Set (`S`) | Set priority | D Flip-Flop with Clock Enable (`CE`) and Synchronous Set |
| `FDCE` | `posedge C` | Asynchronous Clear (`CLR`)| Clear priority| D Flip-Flop with Clock Enable (`CE`) and Asynchronous Clear |
| `FDPE` | `posedge C` | Asynchronous Preset (`PRE`)| Preset priority| D Flip-Flop with Clock Enable (`CE`) and Asynchronous Preset |

```verilog
FDRE #(
    .INIT(1'b0) // Power-on initial value
) u_ff (
    .Q  (q_out),
    .C  (clk),
    .CE (clk_en),
    .R  (sync_rst),
    .D  (d_in)
);
```
