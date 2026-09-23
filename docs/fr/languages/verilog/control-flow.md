# Instructions de contrôle de flux Verilog

Les instructions procédurales de contrôle de flux (`if-else`, `case` et boucles) permettent aux concepteurs d'exprimer des arbres de décision complexes, des encodeurs de priorité et la logique de transition d'états au sein des blocs procéduraux.

---

## Instructions conditionnelles (`if-else`)

L'instruction `if-else` évalue les conditions booléennes par ordre de priorité :

```verilog
always @(*) begin
    if (interrupt_high) begin
        active_irq = 2'b11;
    end else if (interrupt_med) begin
        active_irq = 2'b10;
    end else if (interrupt_low) begin
        active_irq = 2'b01;
    end else begin
        active_irq = 2'b00;
    end
end
```

### Le danger des verrous involontaires
Dans un processus combinatoire, si une variable est assignée dans une branche `if` mais omise de la branche `else`, le matériel doit conserver sa valeur précédente lorsque la condition est fausse. Cela contraint les outils de synthèse à inférer un **verrou transparent sensible au niveau**.
- Le linter d'Axiom émet l'avertissement `AXIOM_W006_TRANSPARENT_LATCH` dès qu'une branche incomplète est détectée dans les blocs combinatoires.

---

## Branchements à choix multiples (`case`, `casez`, `casex`)

### 1. `case` standard
Compare l'expression du sélecteur aux valeurs des éléments du case :

```verilog
reg [1:0] state;
reg [7:0] data_out;

always @(*) begin
    case (state)
        2'b00:   data_out = 8'h00;
        2'b01:   data_out = 8'hAA;
        2'b10:   data_out = 8'h55;
        2'b11:   data_out = 8'hFF;
        default: data_out = 8'h00; // Always include default!
    endcase
end
```
- Le linter d'Axiom signale `AXIOM_W007_MISSING_DEFAULT` si une instruction `case` omet la branche `default:`.

### 2. `casez` (Correspondance de bits indifférents)
Traite les bits `?` ou `z` des expressions de cas comme des valeurs indifférentes. Idéal pour les décodeurs d'adresses et les encodeurs de priorité :

```verilog
always @(*) begin
    casez (req_lines)
        4'b1???: grant = 4'b1000; // Bit 3 active, ignore lower bits
        4'b01??: grant = 4'b0100; // Bit 2 active
        4'b001?: grant = 4'b0010; // Bit 1 active
        4'b0001: grant = 4'b0001; // Bit 0 active
        default: grant = 4'b0000;
    endcase
end
```

---

## Boucles procédurales (`for`, `while`, `repeat`, `forever`)

Les boucles dans le matériel synthétisable sont déroulées en logique spatiale parallèle :

```verilog
// 8-bit Population Count (Bit Counter) unrolled in parallel
integer i;
reg [3:0] ones_count;

always @(*) begin
    ones_count = 0;
    for (i = 0; i < 8; i = i + 1) begin
        if (input_byte[i])
            ones_count = ones_count + 1;
    end
end
```

Dans le code de banc de test, les boucles `repeat` et `forever` modélisent des séquences d'horloge répétitives :
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
