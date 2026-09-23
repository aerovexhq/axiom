# Sentencias de control de flujo en Verilog

Las sentencias de control de flujo procedimental (`if-else`, `case` y bucles) permiten a los diseñadores expresar árboles de decisión complejos, codificadores de prioridad condicional y lógica de transición de estados dentro de bloques procedimentales.

---

## Sentencias condicionales (`if-else`)

La sentencia `if-else` evalúa condiciones booleanas en orden de prioridad:

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

### El riesgo de latch no intencionado
En un proceso combinacional, si se asigna una variable en una rama `if` pero se omite en la rama `else`, el hardware debe retener su valor anterior cuando la condición sea falsa. Esto obliga a las herramientas de síntesis a inferir un **latch transparente sensible al nivel**.
- El linter de Axiom emite la advertencia `AXIOM_W006_TRANSPARENT_LATCH` cada vez que se detecta una rama incompleta en bloques combinacionales.

---

## Ramificación múltiple (`case`, `casez`, `casex`)

### 1. `case` estándar
Compara la expresión selectora con los valores de elementos del case:

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
- El linter de Axiom emite `AXIOM_W007_MISSING_DEFAULT` si una sentencia `case` omite la rama `default:`.

### 2. `casez` (Coincidencia con bits indiferentes)
Trata los bits `?` o `z` en expresiones de caso como valores indiferentes (don't care). Ideal para decodificadores de direcciones y codificadores de prioridad:

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

## Bucles procedimentales (`for`, `while`, `repeat`, `forever`)

Los bucles dentro del hardware sintetizable se despliegan en lógica espacial paralela:

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

En el código de banco de pruebas, los bucles `repeat` y `forever` modelan secuencias repetitivas de reloj:
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
