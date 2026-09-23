# Bloques procedimentales especializados (`always_comb`, `always_ff`, `always_latch`)

En Verilog clásico, la palabra clave genérica `always` se utilizaba para lógica combinacional, registros sincronizados y latches, provocando errores sutiles de diseño cuando las listas de sensibilidad estaban incompletas o se omitían ramas. SystemVerilog introduce bloques procedimentales explícitos que imponen la intención del diseño.

---

## `always_comb` (Lógica combinacional)

`always_comb` declara explícitamente un proceso combinacional:
- **Sensibilidad automática**: Los diseñadores ya no escriben `@*` ni enumeran las entradas. El simulador infiere automáticamente la lista de sensibilidad completa de todas las variables leídas.
- **Evaluación inmediata al inicio**: Se ejecuta automáticamente en el tiempo de simulación $t=0$ para garantizar que las salidas sean válidas antes del primer flanco de reloj.
- **Prevención estricta de latches**: El linter de Axiom emite un error si un bloque `always_comb` infiere un latch transparente debido a ramas incompletas.

```verilog
always_comb begin
    case (alu_op)
        4'b0000: alu_result = operand_a + operand_b;
        4'b0001: alu_result = operand_a - operand_b;
        4'b0010: alu_result = operand_a & operand_b;
        4'b0011: alu_result = operand_a | operand_b;
        default: alu_result = 32'd0;
    endcase
end
```

---

## `always_ff` (Lógica secuencial sincronizada)

`always_ff` modela registros y biestables disparados por flanco:
- Debe tener una lista de sensibilidad disparada por flanco (`@(posedge clk)` o `@(posedge clk or negedge rst_n)`).
- No puede contener asignaciones bloqueantes (`=`) para registros de estado secuenciales.
- Prohíbe múltiples relojes o bucles de retardo cero.

```verilog
always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        q_reg <= 16'h0000;
    end else if (enable) begin
        q_reg <= d_in;
    end
end
```

---

## `always_latch` (Latches sensibles por nivel)

Cuando realmente se pretende implementar un latch asíncrono sensible al nivel (ej. en celdas de compuerta de reloj de bajo consumo):

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
Al aislar los latches en bloques explícitos `always_latch`, los diseñadores eliminan la inferencia involuntaria de latches en sus módulos RTL principales.
