# Clock Buffers & I/O Primitives

Clocking and I/O primitives control global clock distribution networks and external electrical pin interfacing.

---

## Global Clock Buffers (`BUFG`, `BUFGCE`)

Global clock buffers drive dedicated high-fanout, low-skew clock distribution spines spanning the entire FPGA die:

### 1. `BUFG`
Simple global clock buffer connecting an oscillator pin or PLL output to the global clock network:
```verilog
BUFG u_bufg (
    .O (sys_clk_global),
    .I (sys_clk_pin)
);
```

### 2. `BUFGCE` (Clock Enable Buffer)
Glitch-free gated clock buffer. Deasserting `CE` gates the clock output low without generating hazardous runt pulses:
```verilog
BUFGCE u_bufgce (
    .O  (gated_clk),
    .I  (sys_clk),
    .CE (clock_enable)
);
```

---

## Input & Output Buffers (`IBUF`, `OBUF`)

Input and output buffers interface internal logic to physical package pins:
- **`IBUF`**: Standard single-ended input buffer (`.O(internal_wire), .I(external_pin)`).
- **`OBUF`**: Standard single-ended output buffer (`.O(external_pin), .I(internal_wire)`).
- **`OBUFT`**: Tristate output buffer with active-low enable (`.T`).
