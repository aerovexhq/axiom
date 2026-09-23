# Yordamsal Bloklar ve Katmanlı Zamanlama

Yordamsal bloklar (`always` ve `initial`), olaylara veya simülasyon başlangıcına yanıt olarak yürütülen sıralı ifadeler içerir. Sıralı durum yazmaçlarını (flip-floplar, mandallar) ve karmaşık kombinasyonel karar ağaçlarını modeller.

---

## Katmanlı Olay Zamanlayıcı

Axiom, Verilog simülasyonunu IEEE 1364 Katmanlı Olay Kuyruğuna göre yürütür:

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

## Engelleyici (`=`) ve Engelleyici Olmayan (`<=`) Atamalar

`=` ve `<=` arasındaki ayrımı anlamak, yarış durumu içermeyen sayısal tasarım için kritik öneme sahiptir:

### 1. Engelleyici Atama (`=`)
Program sırasında sıralı olarak yürütülür. Benzetici sol taraftaki değişkeni hemen günceller ve atama bitene kadar sonraki ifadeleri engeller.
- **Kural**: Engelleyici atamaları yalnızca **kombinasyonel** süreçlerde kullanın.

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. Engelleyici Olmayan Atama (`<=`)
Sağ taraftaki ifadeyi Active bölgesinde değerlendirir, ancak hedef yazmacı güncellemeyi Engelleyici Olmayan Atama (NBA) bölgesine kadar erteler.
- **Kural**: Engelleyici olmayan atamaları yalnızca **saatli ardışıl** süreçlerde kullanın.

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

Axiom'un bellek içi linteri bu kuralları etkin bir şekilde zorunlu kılar:
- `AXIOM_W001`: `always @(posedge clk)` içinde `=` kullanıldığında uyarır.
- `AXIOM_W002`: `always @*` içinde `<=` kullanıldığında uyarır.

---

## Kenar Tetiklemeli Süreçler (Yazmaçlar ve Sayaçlar)

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

## Simülasyon Test Ortamı Başlatması (`initial`)

`initial` blokları benzetim başlangıcında ($t=0$) bir kez yürütülür:

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
