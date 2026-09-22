# IEEE 1364 System Tasks & Functions

Verilog provides standard built-in system tasks and functions prefixed with the dollar sign (`$`). Axiom EDA natively intercepts and executes these routines in RAM without requiring external C/C++ PLI or VPI libraries.

---

## Display & String Formatting Tasks

### 1. `$display` and `$write`
Prints formatted text directly to Axiom's interactive **Console & REPL** dock. `$display` appends an automatic newline character, while `$write` does not.

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### Supported Format Specifiers
- `%d` / `%0d`: Decimal integer (unpadded)
- `%h` / `%0h`: Hexadecimal value
- `%b`: Binary vector
- `%o`: Octal value
- `%c`: ASCII character
- `%s`: String
- `%t`: Formatted simulation time

### 2. `$monitor` and `$strobe`
- `$monitor`: Monitors signal arguments and automatically prints a message whenever any monitored signal changes value.
- `$strobe`: Defers message output to the Monitor region at the very end of the current time step, ensuring all NBA assignments have settled.

---

## Simulation Control Tasks

### 1. `$finish`
Terminates the simulation run, suspends autonomous clock ticking, and displays final execution metrics in the Console.
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop`
Pauses the simulation, transitions the simulation ribbon to the **Paused** state, and retains all signal traces and register states for inspection.

### 3. `$time` and `$realtime`
- `$time`: Returns the current simulation time as a 64-bit integer based on the active `` `timescale `` directive.
- `$realtime`: Returns the current simulation time as a real floating-point number.

---

## Mathematical & Utility Functions

### 1. `$clog2` (Ceiling Logarithm Base-2)
Computes $\lceil \log_2(N) \rceil$. Indispensable for computing address bus widths from memory depths:
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random`
Generates a signed 32-bit pseudo-random integer. Often masked to generate randomized test vectors:
```verilog
test_byte = $random % 256;
```

---

## Waveform Dumping Tasks

Axiom natively intercepts VCD system calls:
- `$dumpfile("waveform.vcd");`: Specifies the output waveform filename.
- `$dumpvars(0, top_tb);`: Dumps all signal value changes across the design hierarchy into Axiom's in-memory trace buffer and downloads as an IEEE 1364 VCD file.

---

## Memory File Initialization (`$readmemb`, `$readmemh`)

Loads memory array contents directly from text files:
- `$readmemb("rom.bin", memory_array);`: Loads binary data (`10101100`).
- `$readmemh("rom.hex", memory_array);`: Loads hexadecimal data (`AF 04 C2`).

In Axiom Studio, memory initialization files are read securely within project file sets without violating host filesystem sandbox boundaries.
