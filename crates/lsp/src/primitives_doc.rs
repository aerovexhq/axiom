//! In-RAM documentation and completion templates for Xilinx 7-Series and UltraScale+ primitives.

use crate::types::CompletionItem;

/// Returns Markdown documentation for a Xilinx hardware primitive if recognized.
pub fn primitive_doc(name: &str) -> Option<&'static str> {
    let lower = name.to_ascii_lowercase();
    match lower.as_str() {
        "not" => return Some(NOT_GATE_DOC),
        "and" => return Some(AND_GATE_DOC),
        "nand" => return Some(NAND_GATE_DOC),
        "or" => return Some(OR_GATE_DOC),
        "nor" => return Some(NOR_GATE_DOC),
        "xor" => return Some(XOR_GATE_DOC),
        "xnor" => return Some(XNOR_GATE_DOC),
        "buf" => return Some(BUF_GATE_DOC),
        _ => {}
    }

    let upper = name.to_ascii_uppercase();
    match upper.as_str() {
        "LUT6_2" => Some(LUT6_2_DOC),
        "LUT6" => Some(LUT6_DOC),
        "LUT5" => Some(LUT5_DOC),
        "LUT4" => Some(LUT4_DOC),
        "LUT3" => Some(LUT3_DOC),
        "LUT2" => Some(LUT2_DOC),
        "LUT1" => Some(LUT1_DOC),
        "BUFG" => Some(BUFG_DOC),
        "BUFGCE" => Some(BUFGCE_DOC),
        "IBUF" => Some(IBUF_DOC),
        "OBUF" => Some(OBUF_DOC),
        "FDRE" => Some(FDRE_DOC),
        "FDSE" => Some(FDSE_DOC),
        "FDCE" => Some(FDCE_DOC),
        "FDPE" => Some(FDPE_DOC),
        "DSP48E2" => Some(DSP48E2_DOC),
        "DSP48E1" => Some(DSP48E1_DOC),
        "RAMB36E2" => Some(RAMB36E2_DOC),
        "RAMB18E2" => Some(RAMB18E2_DOC),
        "CARRY4" => Some(CARRY4_DOC),
        "CARRY8" => Some(CARRY8_DOC),
        _ => None,
    }
}

/// Returns completion items for Xilinx hardware primitives with port mapping snippets.
pub fn primitive_completions() -> Vec<CompletionItem> {
    vec![
        CompletionItem {
            label: "LUT6_2 instance".to_string(),
            kind: 27, // Snippet
            detail: "Xilinx 6-Input Dual-Output Look-Up Table".to_string(),
            insert_text: "LUT6_2 #(\n    .INIT(64'h${1:0000000000000000})\n) ${2:u_lut} (\n    .I0(${3:i0}),\n    .I1(${4:i1}),\n    .I2(${5:i2}),\n    .I3(${6:i3}),\n    .I4(${7:i4}),\n    .I5(${8:i5}),\n    .O5(${9:o5}),\n    .O6(${10:o6})\n);\n".to_string(),
            documentation: Some("Instantiates a Xilinx dual-output 6-input LUT (LUT6_2).".to_string()),
        },
        CompletionItem {
            label: "FDRE instance".to_string(),
            kind: 27, // Snippet
            detail: "D Flip-Flop with Clock Enable and Synchronous Reset".to_string(),
            insert_text: "FDRE #(\n    .INIT(1'b${1:0})\n) ${2:u_fdre} (\n    .C(${3:clk}),\n    .CE(${4:1'b1}),\n    .R(${5:rst}),\n    .D(${6:din}),\n    .Q(${7:dout})\n);\n".to_string(),
            documentation: Some("Instantiates a standard Xilinx D flip-flop with enable and sync reset.".to_string()),
        },
        CompletionItem {
            label: "BUFG instance".to_string(),
            kind: 27, // Snippet
            detail: "Global Primary Clock Buffer".to_string(),
            insert_text: "BUFG ${1:u_bufg} (\n    .I(${2:clk_in}),\n    .O(${3:clk_out})\n);\n".to_string(),
            documentation: Some("Routes an external or synthesized clock onto high-fanout global clock spine.".to_string()),
        },
        CompletionItem {
            label: "DSP48E2 instance".to_string(),
            kind: 27, // Snippet
            detail: "High-Speed UltraScale+ 27x18 DSP Slice".to_string(),
            insert_text: "DSP48E2 #(\n    .USE_MULT(\"MULTIPLY\"),\n    .CREG(1),\n    .MREG(1),\n    .PREG(1)\n) ${1:u_dsp} (\n    .CLK(${2:clk}),\n    .CEA2(1'b1),\n    .CEB2(1'b1),\n    .CEM(1'b1),\n    .CEP(1'b1),\n    .RSTA(1'b0),\n    .RSTB(1'b0),\n    .RSTM(1'b0),\n    .RSTP(1'b0),\n    .ALUMODE(4'b0000),\n    .OPMODE(9'b000000101),\n    .A(${3:a_in}),\n    .B(${4:b_in}),\n    .C(48'h0),\n    .D(27'h0),\n    .P(${5:p_out})\n);\n".to_string(),
            documentation: Some("Instantiates an UltraScale+ DSP48E2 arithmetic slice configured for multiply-accumulate.".to_string()),
        },
        CompletionItem {
            label: "RAMB36E2 instance".to_string(),
            kind: 27, // Snippet
            detail: "36 Kbit True Dual-Port Block RAM".to_string(),
            insert_text: "RAMB36E2 #(\n    .READ_WIDTH_A(36),\n    .WRITE_WIDTH_A(36),\n    .READ_WIDTH_B(36),\n    .WRITE_WIDTH_B(36)\n) ${1:u_bram} (\n    .CLKARDCLK(${2:clk}),\n    .ENARDEN(1'b1),\n    .WEA(4'b1111),\n    .ADDRARDADDR(${3:addr_a}),\n    .DINADIN(${4:din_a}),\n    .DOUTADOUT(${5:dout_a}),\n    .CLKBWRCLK(${2:clk}),\n    .ENBWREN(1'b1),\n    .WEB(4'b0000),\n    .ADDRBWRADDR(${6:addr_b}),\n    .DINBDIN(32'h0),\n    .DOUTBDOUT(${7:dout_b})\n);\n".to_string(),
            documentation: Some("Instantiates a 36 Kbit synchronous True Dual-Port Block RAM.".to_string()),
        },
        CompletionItem {
            label: "CARRY4 instance".to_string(),
            kind: 27, // Snippet
            detail: "Fast 4-Bit Carry Lookahead Arithmetic Chain".to_string(),
            insert_text: "CARRY4 ${1:u_carry} (\n    .CI(1'b0),\n    .CYINIT(1'b0),\n    .DI(${2:di}),\n    .S(${3:s}),\n    .O(${4:sum}),\n    .CO(${5:co})\n);\n".to_string(),
            documentation: Some("Instantiates a high-speed 4-bit carry lookahead arithmetic logic block.".to_string()),
        },
    ]
}

/// Returns true if a given port name of a primitive is an output driver.
pub fn is_primitive_output_port(prim_name: &str, port_name: &str) -> bool {
    let p_upper = port_name.to_ascii_uppercase();

    if axiom_syntax::is_gate_primitive(prim_name) {
        return p_upper == "OUT" || p_upper == "0" || p_upper == "Y";
    }

    let m_upper = prim_name.to_ascii_uppercase();

    match m_upper.as_str() {
        "LUT6_2" => p_upper == "O5" || p_upper == "O6",
        "LUT6" | "LUT5" | "LUT4" | "LUT3" | "LUT2" | "LUT1" => p_upper == "O",
        "BUFG" | "BUFGCE" | "IBUF" => p_upper == "O",
        "OBUF" => p_upper == "O",
        "FDRE" | "FDSE" | "FDCE" | "FDPE" => p_upper == "Q",
        "DSP48E2" | "DSP48E1" => p_upper == "P" || p_upper.starts_with("PCOUT") || p_upper.starts_with("CARRYOUT"),
        "RAMB36E2" | "RAMB18E2" => p_upper.starts_with("DOUTA") || p_upper.starts_with("DOUTB") || p_upper.starts_with("CASCDOUT"),
        "CARRY4" => p_upper == "O" || p_upper == "CO",
        "CARRY8" => p_upper == "O" || p_upper == "CO",
        _ => false,
    }
}

const LUT6_2_DOC: &str = r#"### Xilinx Primitive: `LUT6_2`
**6-Input Dual-Output Look-Up Table (7-Series / UltraScale / UltraScale+)**

The `LUT6_2` can implement any two 5-input logic functions that share the same five inputs (`I0`..`I4`), or a single 6-input logic function utilizing all inputs (`I0`..`I5`).

#### Ports:
- `I0`..`I4`: Five shared logic data inputs
- `I5`: Sixth logic input (selects upper vs lower 32-bit truth table)
- `O5`: 5-input logic output (evaluates `INIT[31:0]` with inputs `I0`..`I4`)
- `O6`: 6-input logic output (evaluates full `INIT[63:0]` with inputs `I0`..`I5`)

#### Parameters:
- `INIT`: 64-bit truth table bit-mask (e.g. `64'h8000000000000001`)"#;

const LUT6_DOC: &str = r#"### Xilinx Primitive: `LUT6`
**6-Input Single-Output Look-Up Table**
Implements arbitrary 6-input combinational logic using a 64-bit truth table vector.
- **Inputs:** `I0`, `I1`, `I2`, `I3`, `I4`, `I5`
- **Output:** `O`
- **Parameter:** `INIT` (64-bit hex)"#;

const LUT5_DOC: &str = r#"### Xilinx Primitive: `LUT5`
**5-Input Single-Output Look-Up Table**
Implements arbitrary 5-input combinational logic using a 32-bit truth table vector.
- **Inputs:** `I0`, `I1`, `I2`, `I3`, `I4`
- **Output:** `O`
- **Parameter:** `INIT` (32-bit hex)"#;

const LUT4_DOC: &str = r#"### Xilinx Primitive: `LUT4`
**4-Input Look-Up Table** (16-bit INIT)"#;

const LUT3_DOC: &str = r#"### Xilinx Primitive: `LUT3`
**3-Input Look-Up Table** (8-bit INIT)"#;

const LUT2_DOC: &str = r#"### Xilinx Primitive: `LUT2`
**2-Input Look-Up Table** (4-bit INIT)"#;

const LUT1_DOC: &str = r#"### Xilinx Primitive: `LUT1`
**1-Input Look-Up Table / Inverter / Buffer** (2-bit INIT)"#;

const BUFG_DOC: &str = r#"### Xilinx Primitive: `BUFG`
**High-Drive Global Clock Buffer**

Distributes an external clock pin or PLL output onto the low-skew, high-fanout global clock routing network spine across the entire FPGA fabric.
- **Input:** `I` (Source clock)
- **Output:** `O` (Balanced global clock spine)"#;

const BUFGCE_DOC: &str = r#"### Xilinx Primitive: `BUFGCE`
**Global Clock Buffer with Clock Enable**
Synchronously gates the global clock tree without introducing glitches or runt pulses.
- **Inputs:** `I` (Clock), `CE` (Active-high enable)
- **Output:** `O` (Gated global clock)"#;

const IBUF_DOC: &str = r#"### Xilinx Primitive: `IBUF`
**Input Buffer for Dedicated FPGA Package Pins**
- **Input:** `I` (Package pad input)
- **Output:** `O` (Internal fabric logic)"#;

const OBUF_DOC: &str = r#"### Xilinx Primitive: `OBUF`
**Output Buffer for Dedicated FPGA Package Pins**
- **Input:** `I` (Internal fabric logic)
- **Output:** `O` (Package pad output)"#;

const FDRE_DOC: &str = r#"### Xilinx Primitive: `FDRE`
**D Flip-Flop with Clock Enable and Synchronous Reset**

Standard edge-triggered sequential storage element in Xilinx slices.
- `C`: Clock input (positive edge triggered)
- `CE`: Active-high clock enable
- `R`: Active-high synchronous reset (clears `Q` to 0 on clock edge)
- `D`: Data input
- `Q`: Registered output

#### Parameters:
- `INIT`: Initial power-on value (`1'b0` or `1'b1`)"#;

const FDSE_DOC: &str = r#"### Xilinx Primitive: `FDSE`
**D Flip-Flop with Clock Enable and Synchronous Set**
Sets `Q` to 1 when `S` is asserted on clock edge."#;

const FDCE_DOC: &str = r#"### Xilinx Primitive: `FDCE`
**D Flip-Flop with Clock Enable and Asynchronous Clear**
Immediately resets `Q` to 0 when `CLR` is asserted independently of `C`."#;

const FDPE_DOC: &str = r#"### Xilinx Primitive: `FDPE`
**D Flip-Flop with Clock Enable and Asynchronous Preset**
Immediately sets `Q` to 1 when `PRE` is asserted independently of `C`."#;

const DSP48E2_DOC: &str = r#"### Xilinx UltraScale+ Primitive: `DSP48E2`
**Digital Signal Processing Arithmetic Slice**

Dedicated hardware unit featuring:
- **27 x 18 Multiplier**: High-precision signed two's complement multiplication
- **48-bit Accumulator / ALU**: Flexible adder, subtractor, logic unit, and accumulation
- **27-bit Pre-Adder**: Supports symmetric filtering, folding, and complex multiplication
- **Pattern Detector**: Zero/overflow/underflow detection and dynamic rounding

#### Primary Ports:
- `CLK`: Master pipeline clock
- `A[29:0]`: Primary 30-bit operand (upper 27 bits fed to multiplier or pre-adder)
- `B[17:0]`: Primary 18-bit multiplier operand
- `C[47:0]`: 48-bit input to third adder / post-accumulator stage
- `D[26:0]`: 27-bit pre-adder input operand
- `P[47:0]`: 48-bit primary product / accumulator output
- `ALUMODE[3:0]`: Dynamic ALU operation opcode
- `OPMODE[8:0]`: Dynamic multiplexer and dataflow interconnect control"#;

const DSP48E1_DOC: &str = r#"### Xilinx 7-Series Primitive: `DSP48E1`
**25 x 18 Multiplier and 48-Bit Accumulator Slice**
Standard 7-Series DSP hardware block with dual pipeline stages."#;

const RAMB36E2_DOC: &str = r#"### Xilinx UltraScale+ Primitive: `RAMB36E2`
**36 Kbit True Dual-Port Synchronous Block RAM**

Dedicated on-chip memory slice configurable into independent Port A and Port B interfaces with independent clocks, data widths, byte-write enables, and optional internal output registers.

#### Primary Ports:
- `CLKARDCLK`: Port A clock
- `ADDRARDADDR[14:0]`: Port A 15-bit address bus
- `DINADIN[31:0]`: Port A write data
- `DOUTADOUT[31:0]`: Port A read data output
- `WEA[3:0]`: Port A byte-wide write enable mask
- `ENARDEN`: Port A clock enable
- `CLKBWRCLK`: Port B clock
- `ADDRBWRADDR[14:0]`: Port B 15-bit address bus
- `DINBDIN[31:0]`: Port B write data
- `DOUTBDOUT[31:0]`: Port B read data output
- `WEB[3:0]`: Port B byte-wide write enable mask
- `ENBWREN`: Port B clock enable"#;

const RAMB18E2_DOC: &str = r#"### Xilinx UltraScale+ Primitive: `RAMB18E2`
**18 Kbit Synchronous Block RAM Slice**"#;

const CARRY4_DOC: &str = r#"### Xilinx 7-Series Primitive: `CARRY4`
**Fast 4-Bit Carry Lookahead Arithmetic Chain**

High-speed dedicated carry propagation logic for adders, subtractors, and comparators.
- `CI`: Carry-in from lower slice
- `CYINIT`: Carry initialization (used when `CI` is not connected)
- `DI[3:0]`: Data inputs (generate terms)
- `S[3:0]`: Select inputs (propagate terms, typically `A ^ B`)
- `O[3:0]`: XOR sum outputs (`S ^ C`)
- `CO[3:0]`: Carry outputs to next stage"#;

const CARRY8_DOC: &str = r#"### Xilinx UltraScale+ Primitive: `CARRY8`
**Fast 8-Bit Lookahead Carry Arithmetic Chain**
High-performance 8-bit carry lookahead block in UltraScale and UltraScale+ CLB slices."#;

const NOT_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `not`
**Inverter Gate (IEEE 1364 / IEEE 1800)**

Computes the bitwise inversion of its input logic value.
- **Output:** Terminal 0 (`out`)
- **Input:** Terminal 1 (`in`)"#;

const AND_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `and`
**N-Input AND Gate (IEEE 1364 / IEEE 1800)**

Computes the bitwise conjunction of all its inputs.
- **Output:** Terminal 0 (`out`)
- **Inputs:** Terminals 1..N (`in0`, `in1`, ...)"#;

const NAND_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `nand`
**N-Input NAND Gate (IEEE 1364 / IEEE 1800)**

Computes the inverted bitwise conjunction of all its inputs.
- **Output:** Terminal 0 (`out`)
- **Inputs:** Terminals 1..N (`in0`, `in1`, ...)"#;

const OR_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `or`
**N-Input OR Gate (IEEE 1364 / IEEE 1800)**

Computes the bitwise disjunction of all its inputs.
- **Output:** Terminal 0 (`out`)
- **Inputs:** Terminals 1..N (`in0`, `in1`, ...)"#;

const NOR_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `nor`
**N-Input NOR Gate (IEEE 1364 / IEEE 1800)**

Computes the inverted bitwise disjunction of all its inputs.
- **Output:** Terminal 0 (`out`)
- **Inputs:** Terminals 1..N (`in0`, `in1`, ...)"#;

const XOR_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `xor`
**N-Input Exclusive-OR Gate (IEEE 1364 / IEEE 1800)**

Computes the bitwise exclusive-OR of all its inputs.
- **Output:** Terminal 0 (`out`)
- **Inputs:** Terminals 1..N (`in0`, `in1`, ...)"#;

const XNOR_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `xnor`
**N-Input Exclusive-NOR Gate (IEEE 1364 / IEEE 1800)**

Computes the inverted bitwise exclusive-OR of all its inputs.
- **Output:** Terminal 0 (`out`)
- **Inputs:** Terminals 1..N (`in0`, `in1`, ...)"#;

const BUF_GATE_DOC: &str = r#"### Built-in Verilog Primitive: `buf`
**Non-Inverting Buffer Gate (IEEE 1364 / IEEE 1800)**

Passes its input logic state directly to its output.
- **Output:** Terminal 0 (`out`)
- **Input:** Terminal 1 (`in`)"#;
