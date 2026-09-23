# Bloques procedimentales y planificación estratificada

Los bloques procedimentales (`always` e `initial`) contienen sentencias secuenciales que se ejecutan en respuesta a eventos o al inicio de la simulación. Modelan registros de estado secuenciales (biestables, latches), así como árboles de decisión combinacionales complejos.

---

## El planificador de eventos estratificado

Axiom ejecuta la simulación Verilog de acuerdo con la cola de eventos estratificada IEEE 1364:

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

## Asignaciones bloqueantes (`=`) frente a no bloqueantes (`<=`)

Comprender la distinción entre `=` y `<=` es crítico para el diseño digital libre de condiciones de carrera:

### 1. Asignación bloqueante (`=`)
Se ejecuta secuencialmente en el orden del programa. El simulador actualiza la variable del lado izquierdo inmediatamente y bloquea las sentencias posteriores hasta finalizar la asignación.
- **Regla**: Use asignaciones bloqueantes exclusivamente en procesos **combinacionales**.

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. Asignación no bloqueante (`<=`)
Evalúa la expresión del lado derecho durante la región activa, pero pospone la actualización del registro de destino hasta la región de asignaciones no bloqueantes (NBA).
- **Regla**: Use asignaciones no bloqueantes exclusivamente en procesos **secuenciales sincronizados por reloj**.

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

El linter en RAM de Axiom aplica activamente estas reglas:
- `AXIOM_W001`: Advierte si se usa `=` dentro de `always @(posedge clk)`.
- `AXIOM_W002`: Advierte si se usa `<=` dentro de `always @*`.

---

## Procesos disparados por flanco (registros y contadores)

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

## Inicialización de banco de pruebas de simulación (`initial`)

Los bloques `initial` se ejecutan una vez al inicio de la simulación ($t=0$):

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
