# Asignaciones continuas y primitivas de compuertas

Las asignaciones continuas y las primitivas de compuertas estructurales representan hardware combinacional estático en Verilog. Se ejecutan de forma concurrente y continua: cada vez que cambia cualquier señal en el lado derecho, la red de salida se actualiza inmediatamente.

---

## Asignaciones continuas (`assign`)

Las asignaciones continuas excitan valores en redes `wire`:

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### Reglas de asignación
1. **Tipo de red de destino**: El lado izquierdo debe ser una red escalar o vectorial (`wire`). No puede ser una variable de registro (`reg`).
2. **Reevaluación dinámica**: Cada vez que `a` o `b` cambia, `sum` se actualiza dentro del paso de tiempo de simulación actual.
3. **Retardo cero implícito**: Los cambios se propagan a través de asignaciones continuas en tiempo cero de simulación, generando ciclos delta intermedios (ciclo δ) hasta que todas las redes alcanzan el estado estable.

---

## Primitivas de compuertas estructurales integradas

Verilog incluye primitivas de puertas integradas directamente reconocidas por el elaborador de Axiom y asignadas al visualizador DAG esquemático:

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

## Ejemplo de lógica combinacional: Sumador completo a nivel de compuertas

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

En Axiom Studio, abrir este diseño distribuye automáticamente las 5 compuertas con cableado ortogonal libre de colisiones, alineación de pines sin giros innecesarios y evaluaciones de redes en tiempo real en el visor esquemático.
