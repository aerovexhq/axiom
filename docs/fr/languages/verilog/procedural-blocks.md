# Blocs procéduraux et ordonnancement stratifié

Les blocs procéduraux (`always` et `initial`) contiennent des instructions séquentielles qui s'exécutent en réponse à des événements ou au démarrage de la simulation. Ils modélisent les registres d'état séquentiels (bascules, verrous) ainsi que les arbres de décision combinatoires complexes.

---

## Le planificateur d'événements stratifié

Axiom exécute la simulation Verilog conformément à la file d'événements stratifiée IEEE 1364 :

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

## Assignations bloquantes (`=`) vs non bloquantes (`<=`)

Comprendre la distinction entre `=` et `<=` est crucial pour une conception numérique sans aléa de course :

### 1. Assignation bloquante (`=`)
S'exécute séquentiellement dans l'ordre du programme. Le simulateur met à jour la variable de gauche immédiatement et bloque les instructions suivantes jusqu'à ce que l'assignation soit terminée.
- **Règle** : Utilisez exclusivement les assignations bloquantes dans les processus **combinatoires**.

```verilog
// Combinational block using blocking assignments
always @(*) begin
    temp   = in_a & in_b; // Evaluated and updated immediately
    result = temp | in_c; // Uses updated value of temp
end
```

### 2. Assignation non bloquante (`<=`)
Évalue l'expression de droite pendant la région Active, mais diffère la mise à jour du registre cible jusqu'à la région NBA (Non-Blocking Assignment).
- **Règle** : Utilisez exclusivement les assignations non bloquantes dans les processus **séquentiels cadencés**.

```verilog
// Synchronous pipeline register using non-blocking assignments
always @(posedge clk) begin
    stage1 <= data_in;  // Evaluates data_in, updates at NBA
    stage2 <= stage1;   // Uses previous cycle's stage1, NOT newly assigned data_in!
end
```

Le linter en RAM d'Axiom applique activement ces règles :
- `AXIOM_W001` : Avertit si `=` est utilisé dans `always @(posedge clk)`.
- `AXIOM_W002` : Avertit si `<=` est utilisé dans `always @*`.

---

## Processus déclenchés sur front (registres et compteurs)

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

## Initialisation du banc de test de simulation (`initial`)

Les blocs `initial` s'exécutent une seule fois au démarrage de la simulation ($t=0$) :

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
