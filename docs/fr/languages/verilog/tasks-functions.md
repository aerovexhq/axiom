# Tâches et fonctions Verilog

Les tâches et fonctions encapsulent des instructions algorithmiques réutilisables en Verilog. Elles améliorent la modularité du code et réduisent la logique procédurale répétitive à travers les conceptions et bancs de test.

---

## Fonctions (`function`)

Une fonction calcule une valeur de retour à partir d'une ou plusieurs entrées. En Verilog synthétisable, les fonctions modélisent une logique purement combinatoire :
- S'exécute dans un cycle delta à temps nul (ne peut pas contenir de délais `#` ni de contrôles d'événements `@`).
- Doit avoir au moins une entrée.
- Ne peut pas contenir d'assignations non bloquantes (`<=`).
- Renvoie une valeur scalaire ou vectorielle unique assignée au nom de la fonction.

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

## Tâches (`task`)

Une tâche est plus générale qu'une fonction. Elle peut accepter des entrées, renvoyer plusieurs sorties via des arguments `output` et contenir des instructions de délai temporel (`#`, `@`) :
- Fonctionne de manière procédurale dans des blocs `initial` ou `always`.
- Peut contrôler le temps de simulation, ce qui rend les tâches idéales pour les modèles fonctionnels de bus (BFM) de bancs de test.

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

## Tâches et fonctions automatiques (réentrantes)

Par défaut en IEEE 1364-1995, les variables de tâche sont statiques. En IEEE 1364-2001, déclarer `function automatic` ou `task automatic` alloue dynamiquement les variables locales sur une pile, permettant les algorithmes récursifs :

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
