# Verilog-Tasks & Funktionen

Tasks und Funktionen kapseln wiederverwendbare algorithmische Anweisungen in Verilog. Sie verbessern die Modularität des Codes und reduzieren sich wiederholende prozedurale Logik in Designs und Testbenches.

---

## Funktionen (`function`)

Eine Funktion berechnet einen Rückgabewert aus einem oder mehreren Eingängen. Im synthetisierbaren Verilog modellieren Funktionen rein kombinatorische Logik:
- Wird in Null-Simulationszeit ausgeführt (darf keine `#`-Verzögerungen oder `@`-Ereignissteuerungen enthalten).
- Muss mindestens einen Eingang besitzen.
- Darf keine nicht-blockierenden Zuweisungen (`<=`) enthalten.
- Gibt einen einzelnen Skalar- oder Vektorwert zurück, der dem Funktionsnamen zugewiesen wird.

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

Ein Task ist allgemeiner als eine Funktion. Er kann Eingaben annehmen, mehrere Ausgaben über `output`-Argumente zurückgeben und temporale Verzögerungsanweisungen (`#`, `@`) enthalten:
- Wird prozedural innerhalb von `initial`- oder `always`-Blöcken ausgeführt.
- Kann die Simulationszeit steuern, was Tasks ideal für Testbench-Bus-Funktionsmodelle (BFMs) macht.

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

## Automatische (reentrante) Tasks & Funktionen

Standardmäßig sind Task-Variablen in IEEE 1364-1995 statisch. In IEEE 1364-2001 allokiert die Deklaration von `function automatic` oder `task automatic` lokale Variablen dynamisch auf einem Stack, was rekursive Algorithmen ermöglicht:

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
