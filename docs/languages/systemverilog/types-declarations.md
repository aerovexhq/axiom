# SystemVerilog Data Types & Declarations

SystemVerilog modernizes hardware modeling by eliminating the confusing dichotomy between `wire` and `reg` in classic Verilog, while introducing user-defined types, structures, and enumerations.

---

## The Universal `logic` Type

In classic Verilog, designers constantly had to choose between `wire` (for continuous assignments) and `reg` (for procedural blocks). SystemVerilog resolves this with the 4-state `logic` type:

```verilog
// 1-bit logic signal driven by continuous assignment
logic valid;
assign valid = ready & req;

// Multi-bit logic bus driven procedurally
logic [31:0] data_reg;
always_ff @(posedge clk) begin
    data_reg <= next_data;
end
```
*Note: A `logic` net can have at most one continuous driver. If multi-driver wired-OR or wired-AND buses are required, standard `wire` is used.*

---

## Two-State Data Types

For high-performance simulation and testbench modeling where high-impedance (`Z`) and unknown (`X`) states are not needed, SystemVerilog introduces 2-state types:

| Type | Bit Width | Signedness | Values |
| :--- | :--- | :--- | :--- |
| `bit` | 1-bit | Unsigned | `0`, `1` |
| `byte` | 8-bit | Signed | `-128` to `127` |
| `shortint` | 16-bit | Signed | `-32,768` to `32,767` |
| `int` | 32-bit | Signed | Standard 32-bit integer |
| `longint` | 64-bit | Signed | Standard 64-bit integer |

Axiom compiles 2-state variables directly to native CPU machine registers, achieving peak execution speeds.

---

## User-Defined Types (`typedef`)

Designers can create readable, reusable type aliases:

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## Enumerated Types (`enum`)

Enumerations assign symbolic names to hardware states, dramatically improving Finite State Machine readability:

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
Axiom's Microarchitecture Inspector automatically detects `enum` state variables and renders labeled state bubbles in the FSM visualizer.

---

## Structures (`struct`)

Structures bundle related signals into a single named data structure:

```verilog
// Packed structure: contiguous bit-vector representation in hardware
typedef struct packed {
    logic [7:0]  opcode;
    logic [3:0]  reg_dest;
    logic [3:0]  reg_src1;
    logic [3:0]  reg_src2;
    logic [11:0] immediate;
} instruction_t; // Total 32 bits

instruction_t current_instr;
assign current_instr.opcode = 8'h01;
```
