# Verilog Data Types, Nets & Variables

In Verilog HDL, physical hardware connections and storage elements are categorized into two fundamental groups: **Nets** (representing physical electrical wires) and **Variables** (representing behavioral procedural storage).

---

## Net Data Types

Nets represent physical connections between hardware elements. They do not store logic values; their value is determined continuously by their drivers.

### 1. `wire` and `tri`
The primary net type representing physical copper traces. `wire` and `tri` are functionally identical in synthesis, representing standard interconnect lines.

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. Net Strengths and Multi-Driver Contention
If multiple active continuous assignments drive a standard `wire` simultaneously with conflicting values (`1` and `0`), Axiom evaluates the conflict as unknown (`X`) and triggers linter error `AXIOM_E002_MULTI_DRIVER_NET`.

---

## Variable Data Types

Variables retain their value from one procedural assignment to the next.

### 1. `reg`
The standard procedural variable. Despite its name, a `reg` does not always synthesize to a physical flip-flop register; if assigned inside a purely combinational block (`always @*`), it synthesizes into combinational logic.

```verilog
// 1-bit register variable
reg state;

// 32-bit register vector
reg [31:0] accumulator;

// Sequential clocked assignment
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        accumulator <= 32'd0;
    else
        accumulator <= accumulator + 32'd1;
end
```

### 2. `integer` and `time`
- `integer`: Signed 32-bit variable commonly used in `for` loops and testbench iteration.
- `time`: 64-bit unsigned variable used to record simulation timestamps via `$time`.

---

## Vectors & Indexed Part-Selects

Vectors represent multi-bit buses declared with `[MSB:LSB]` ranges:

```verilog
wire [15:0] packet;

// Static slice part-select
wire [7:0] lower_byte = packet[7:0];
wire [7:0] upper_byte = packet[15:8];

// IEEE 1364-2001 Variable Indexed Part-Select (+: and -:)
// Syntax: [base_expr +: width]  (starts at base, selects width bits upward)
// Syntax: [base_expr -: width]  (starts at base, selects width bits downward)
wire [7:0] byte_0 = packet[0 +: 8];   // Selects packet[7:0]
wire [7:0] byte_1 = packet[8 +: 8];   // Selects packet[15:8]
wire [3:0] nibble = packet[7 -: 4];   // Selects packet[7:4]
```

---

## Unpacked Memory Arrays

Axiom supports multi-dimensional unpacked arrays for modeling Register Files, Look-Up Tables, and SRAM memory blocks:

```verilog
// Array of 1024 registers, each 32 bits wide (4 KB RAM block)
reg [31:0] memory_array [0:1023];

// Synchronous memory write
always @(posedge clk) begin
    if (write_enable)
        memory_array[addr] <= write_data;
end

// Continuous read
assign read_data = memory_array[addr];
```

Axiom's synthesis engine automatically detects unpacked synchronous memories and infers them into Xilinx `RAMB18E2` or `RAMB36E2` hardware Block RAMs.

---

## Sized Number Literals

Verilog numbers can be specified as unsized decimals or sized constants with explicit base prefixes:

$$\text{Format: } <\text{size}>'<\text{base}><\text{value}>$$

| Literal | Bit Width | Base | Value |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | Binary | `0xAC` |
| `8'hFF` | 8 | Hexadecimal | `255` |
| `16'd1024` | 16 | Decimal | `1024` |
| `4'o17` | 4 | Octal | `15` |
| `'d50` | Unsized (32) | Decimal | `50` |
| `1'b1` | 1 | Binary | Logic-high |
