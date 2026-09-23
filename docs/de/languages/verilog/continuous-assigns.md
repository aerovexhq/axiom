# Kontinuierliche Zuweisungen & Gatter-Primitiven

Kontinuierliche Zuweisungen und strukturelle Gatterprimitiven repräsentieren statische kombinatorische Hardware in Verilog. Sie werden nebenläufig und kontinuierlich ausgeführt: Sobald sich ein Signal auf der rechten Seite ändert, wird das Ausgangsnetz sofort aktualisiert.

---

## Kontinuierliche Zuweisungen (`assign`)

Kontinuierliche Zuweisungen treiben Werte auf `wire`-Netze:

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### Zuweisungsregeln
1. **Ziel-Netztyp**: Die linke Seite muss ein Skalar- oder Vektor-Netz (`wire`) sein. Sie darf keine Registervariable (`reg`) sein.
2. **Dynamische Neuberechnung**: Sobald sich `a` oder `b` ändert, wird `sum` innerhalb des aktuellen Simulationszeitschritts aktualisiert.
3. **Implizite Null-Verzögerung**: Änderungen pflanzen sich durch kontinuierliche Zuweisungen in Null-Simulationszeit fort und erzeugen Zwischen-Delta-Zyklen ($\delta$-Zyklen), bis alle Netze den stabilen Zustand erreichen.

---

## Eingebaute strukturelle Gatter-Primitiven

Verilog enthält integrierte Gatterprimitiven, die vom Elaborator von Axiom direkt erkannt und in den schematischen DAG-Visualisierer abgebildet werden:

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

## Beispiel kombinatorischer Logik: Volladdierer auf Gatterebene

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

In Axiom Studio ordnet das Öffnen dieses Designs automatisch alle 5 Gatter mit kollisionsfreier orthogonaler Leitungsführung, kurvenfreier Pin-Ausrichtung und Echtzeit-Netzbewertungen im Schaltplan-Betrachter an.
