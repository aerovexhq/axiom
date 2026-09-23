# Prozedurale Blöcke & Schichten-Scheduling

Prozedurale Blöcke (`always` und `initial`) enthalten sequenzielle Anweisungen, die als Reaktion auf Ereignisse oder beim Simulationsstart ausgeführt werden. Sie modellieren sequenzielle Zustandsregister (Flipflops, Latches) sowie komplexe kombinatorische Entscheidungsbäume.

---

## Der Schichten-Ereignis-Scheduler

Axiom führt Verilog-Simulationen gemäß der IEEE 1364 Schichten-Ereignis-Warteschlange aus:

```
+-------------------------------------------------------------------------------+
| Axiom Stratified Simulation Event Cycle (Time Step T)                         |
+-------------------------------------------------------------------------------+
| 1. Active Region                                                              |
|    - Evaluate continuous assignments (assign)                                 |
|    - Evaluate procedural blocking assignments (=)                             |
|    - Evaluate RHS of non-blocking assignments (<=)                            |
|    - Execute $display and system tasks                                        |
|   |                                                                           |
|   v                                                                           |
| 2. Inactive Region                                                            |
|    - Process explicit #0 delay procedural statements                          |
|   |                                                                           |
|   v                                                                           |
| 3. Non-Blocking Assignment (NBA) Region                                       |
|    - Update LHS of all non-blocking assignments (<=)                          |
|    - May trigger new Active events -> Advance Delta Cycle (delta -> delta + 1)|
|   |                                                                           |
|   v                                                                           |
| 4. Monitor & Post-Update Region                                               |
|    - Execute $monitor and $strobe tasks                                       |
|    - Sample waveform trace history                                            |
|   |                                                                           |
|   v                                                                           |
| 5. Future Time Region                                                         |
|    - Advance physical simulation time: t -> t + dt                            |
+-------------------------------------------------------------------------------+
```

---

## Blockierende (`=`) vs. Nicht-blockierende (`<=`) Zuweisungen

Das Verständnis des Unterschieds zwischen `=` und `<=` ist entscheidend für ein Race-Condition-freies digitales Design:

### 1. Blockierende Zuweisung (`=`)
Wird sequenziell in Programmreihenfolge ausgeführt. Der Simulator aktualisiert die linksseitige Variable sofort und blockiert nachfolgende Anweisungen, bis die Zuweisung abgeschlossen ist.
- **Regel**: Verwenden Sie blockierende Zuweisungen ausschließlich in **kombinatorischen** Prozessen.

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. Nicht-blockierende Zuweisung (`<=`)
Wertet den rechtsseitigen Ausdruck während der Active-Region aus, verzögert jedoch die Aktualisierung des Zielregisters bis zur Non-Blocking Assignment (NBA)-Region.
- **Regel**: Verwenden Sie nicht-blockierende Zuweisungen ausschließlich in **getakteten sequenziellen** Prozessen.

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

Der In-RAM-Linter von Axiom setzt diese Regeln aktiv durch:
- `AXIOM_W001`: Warnt, wenn `=` innerhalb von `always @(posedge clk)` verwendet wird.
- `AXIOM_W002`: Warnt, wenn `<=` innerhalb von `always @*` verwendet wird.

---

## Flankengesteuerte Prozesse (Register & Zähler)

```verilog
module counter_8bit (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       enable,
    output reg  [7:0] count
);
    // Asynchronous active-low reset, positive-edge clock
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 8'd0;
        end else if (enable) begin
            count <= count + 8'd1;
        end
    end
endmodule
```

---

## Testbench-Initialisierung für die Simulation (`initial`)

`initial`-Blöcke werden einmalig beim Simulationsstart ($t=0$) ausgeführt:

```verilog
initial begin
    // Initialize signals
    clk = 0;
    rst_n = 0;
    data_in = 8'h00;

    // Release reset after 20 nanoseconds
    #20 rst_n = 1;

    // Apply test vector after 10 nanoseconds
    #10 data_in = 8'hA5;

    // Finish simulation at t = 100 ns
    #70 $finish;
end

// Clock generator: 100 MHz (10 ns period)
always #5 clk = ~clk;
```
