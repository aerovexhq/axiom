# Assignations continues et primitives logiques

Les assignations continues et les primitives de portes structurelles représentent le matériel combinatoire statique en Verilog. Elles s'exécutent de manière concurrente et continue : dès qu'un signal du membre de droite change, l'équipotentielle de sortie est mise à jour immédiatement.

---

## Assignations continues (`assign`)

Les assignations continues pilotent des valeurs sur des équipotentielles `wire` :

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### Règles d'assignation
1. **Type d'équipotentielle cible** : Le membre de gauche doit être une équipotentielle scalaire ou vectorielle (`wire`). Il ne peut pas s'agir d'une variable de registre (`reg`).
2. **Réévaluation dynamique** : Dès que `a` ou `b` change, `sum` est mis à jour au cours du pas de temps de simulation actuel.
3. **Délai nul implicite** : Les changements se propagent à travers les assignations continues dans un cycle delta à temps nul (cycle δ), générant des cycles delta intermédiaires ($\delta$) jusqu'à ce que toutes les équipotentielles atteignent l'état stable.

---

## Primitives logiques structurelles intégrées

Verilog inclut des primitives logiques intégrées directement reconnues par l'élaborateur d'Axiom et mappées dans le visualiseur de schéma DAG :

```verilog
// Basic Boolean Gates
// Syntax: gate_type [instance_name] (output, input1, input2, ...);
and  and1 (out_and, in_a, in_b);
or   or1  (out_or,  in_a, in_b);
xor  xor1 (out_xor, in_a, in_b);
nand nand1(out_nand, in_a, in_b);
nor  nor1 (out_nor, in_a, in_b);
xnor xnor1(out_xnor, in_a, in_b);

// Inverters and Buffers
// Syntax: not/buf [instance_name] (output, input);
not  inv1 (out_not, in_a);
buf  buf1 (out_buf, in_a);

// Tristate Buffers
// Syntax: bufif0/bufif1 [instance_name] (output, input, control);
bufif1 tri_buf (bus_line, tx_data, enable); // Enabled when enable == 1
bufif0 tri_inv (bus_line, tx_data, n_en);   // Enabled when n_en == 0
```

---

## Exemple de logique combinatoire : Additionneur complet au niveau des portes

```verilog
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire s1, c1, c2;

    // First half adder stage
    xor xor1 (s1, a, b);
    and and1 (c1, a, b);

    // Second half adder stage
    xor xor2 (sum, s1, cin);
    and and2 (c2, s1, cin);

    // Carry out calculation
    or  or1  (cout, c1, c2);

endmodule
```

Dans Axiom Studio, l'ouverture de cette conception dispose automatiquement les 5 portes avec un routage orthogonal sans collision, un alignement direct des broches et l'affichage des valeurs d'équipotentielles en temps réel dans le visualiseur de schéma.
