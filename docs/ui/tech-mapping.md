# Gate-Level Technology Mapping Studio

Axiom's Technology Mapping Studio (`crates/ir/src/synth/`) bridges behavioral RTL and physical FPGA architectures. It decomposes generic boolean logic equations, multiplexers, and arithmetic operators into silicon primitives native to AMD/Xilinx 7-Series and UltraScale+ devices.

---

## Architecture-Specific Primitive Lowering

```
+-------------------------------------------------------------------------------+
| RTL Verilog Code:                       | Mapped Silicon Primitives:          |
|                                         |                                     |
| assign F = (cond) ? (a + b) : (c & d);  | - LUT6_2 (INIT = 64'hE2E2_0000_...) |
|                                         | - CARRY4 (Fast Arithmetic)          |
|                                         | - FDRE   (D Flip-Flop with Enable)  |
+-------------------------------------------------------------------------------+
```

### Supported FPGA Silicon Targets
Engineers can select from pre-configured hardware architectures:
1. **AMD Artix-7 (XC7A35T / XC7A100T)**: 6-input LUTs, CARRY4 arithmetic, DSP48E1 slices, RAMB36E1 memories.
2. **AMD Kintex-7 (XC7K325T)**: High-speed 7-Series architecture.
3. **AMD Zynq-7000 (XC7Z020)**: Dual ARM Cortex-A9 SoC with 7-Series programmable logic fabric.
4. **AMD Kintex UltraScale+ (XCKU5P)**: Modern 16nm FinFET architecture with CARRY8 chains, DSP48E2 slices, and UltraRAM blocks.
5. **Axiom Virtual Silicon**: Generic high-capacity virtual architecture optimized for education and rapid prototyping.

---

## Boolean Network Decomposition & K-LUT Mapping

### 1. $K$-LUT Decomposition
Axiom decomposes arbitrary boolean logic expressions into Look-Up Tables with $K$ inputs (where $K=6$ for modern Xilinx FPGAs):
- Sub-functions with $\le 6$ unique inputs map directly into a single `LUT6`.
- Dual-output logic functions sharing up to 5 inputs map into dual-output `LUT6_2` primitives (`O5`, `O6`).
- Wide logic functions ($N > 6$) are partitioned using Shannon expansion into cascading LUT networks.

### 2. Exact `INIT` Hex Parameter Calculation
Every mapped LUT has its truth table serialized into a 64-bit hexadecimal `INIT` parameter:
$$\text{INIT}[i] = f(i_5, i_4, i_3, i_2, i_1, i_0)$$
For instance, a 2-input AND gate maps to `LUT6` with `INIT = 64'h0000_0000_0000_0008`.

---

## Macro Primitive Inference

The synthesis engine automatically identifies high-level structural patterns:
- **DSP Slice Inference (`DSP48E1` / `DSP48E2`)**: Multi-bit multiplications (`a * b`), multiply-accumulate operations (`P = P + (A * B)`), and pre-adder sequences are mapped directly to dedicated hardware DSP blocks rather than consuming hundreds of logic LUTs.
- **Block RAM Inference (`RAMB18E2` / `RAMB36E2`)**: Unpacked arrays with synchronous clocking (`reg [31:0] mem [0:1023]`) are automatically lowered into true dual-port or simple dual-port hardware Block RAMs.

---

## Mapped Netlist Inspection & Structural Verilog Export

The Technology Mapping Viewer features:
- **Resource Utilization Bar Chart**: Displays counts and percentages for Slice LUTs, Slice Registers (FFs), CARRY chains, DSP slices, and Block RAMs.
- **Cell Inspector Table**: Search and filter mapped primitive instances.
- **Truth Table HUD**: Inspect the exact boolean truth table represented by any mapped LUT.
- **Structural Verilog Export**: 1-click generation of pure structural gate netlists (`.v`) instantiated with standard Xilinx primitives.
