# Verilog Tasks & Functions

Tasks and functions encapsulate reusable algorithmic statements in Verilog. They improve code modularity and reduce repetitive procedural logic across designs and testbenches.

---

## Functions (`function`)

A function computes a return value from one or more inputs. In synthesizable Verilog, functions model purely combinational logic:
- Executes in zero simulation time (cannot contain `#` delays or `@` event controls).
- Must have at least one input.
- Cannot contain non-blocking assignments (`<=`).
- Returns a single scalar or vector value assigned to the function name.

```verilog
module parity_checker (
    input  wire [7:0] data_byte,
    output wire       parity_bit
);
    // User-defined function calculating odd parity
    function calc_parity;
        input [7:0] val;
        integer i;
        begin
            calc_parity = 1'b0;
            for (i = 0; i < 8; i = i + 1) begin
                calc_parity = calc_parity ^ val[i];
            end
        end
    endfunction

    // Continuous assignment calling function
    assign parity_bit = calc_parity(data_byte);

endmodule
```

---

## Tasks (`task`)

A task is more general than a function. It can accept inputs, return multiple outputs via `output` arguments, and contain temporal delay statements (`#`, `@`):
- Operates procedurally inside `initial` or `always` blocks.
- Can control simulation time, making tasks ideal for testbench bus functional models (BFMs).

```verilog
module tb_memory;
    reg clk;
    reg we;
    reg [7:0] addr;
    reg [15:0] wdata;
    wire [15:0] rdata;

    // Bus Functional Task modeling an SRAM write bus cycle
    task sram_write;
        input [7:0]  target_addr;
        input [15:0] write_val;
        begin
            @(posedge clk);
            addr  <= target_addr;
            wdata <= write_val;
            we    <= 1'b1;
            @(posedge clk);
            we    <= 1'b0;
        end
    endtask

    initial begin
        clk = 0;
        we  = 0;
        #20;
        // Invoke task with arguments
        sram_write(8'h04, 16'hDEAD);
        sram_write(8'h08, 16'hBEEF);
        #50 $finish;
    end

    always #5 clk = ~clk;
endmodule
```

---

## Automatic (Re-entrant) Tasks & Functions

By default in IEEE 1364-1995, task variables are static. In IEEE 1364-2001, declaring `function automatic` or `task automatic` allocates local variables dynamically on a stack, enabling recursive algorithms:

```verilog
function automatic [31:0] factorial;
    input [31:0] n;
    begin
        if (n <= 1)
            factorial = 1;
        else
            factorial = n * factorial(n - 1);
    end
endfunction
```
