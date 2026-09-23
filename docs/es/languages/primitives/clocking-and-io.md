# Búferes de reloj y primitivas de E/S

Las primitivas de reloj y E/S controlan las redes de distribución de reloj global y la interfaz eléctrica externa de pines.

---

## Búferes de reloj global (`BUFG`, `BUFGCE`)

Los búferes de reloj global excitan espinas de distribución de reloj dedicadas de alto fanout y bajo sesgo que abarcan todo el troquel de la FPGA:

### 1. `BUFG`
Búfer de reloj global simple que conecta un pin de oscilador o salida de PLL a la red de reloj global:
```verilog
BUFG u_bufg (
    .O (sys_clk_global),
    .I (sys_clk_pin)
);
```

### 2. `BUFGCE` (Búfer con habilitación de reloj)
Búfer de reloj con compuerta libre de fallos (glitches). Desactivar `CE` bloquea la salida de reloj en bajo sin generar pulsos espurios riesgosos:
```verilog
BUFGCE u_bufgce (
    .O  (gated_clk),
    .I  (sys_clk),
    .CE (clock_enable)
);
```

---

## Búferes de entrada y salida (`IBUF`, `OBUF`)

Los búferes de entrada y salida conectan la lógica interna con los pines físicos del encapsulado:
- **`IBUF`**: Búfer de entrada asimétrico estándar (`.O(internal_wire), .I(external_pin)`).
- **`OBUF`**: Búfer de salida asimétrico estándar (`.O(external_pin), .I(internal_wire)`).
- **`OBUFT`**: Búfer de salida tri-estado con habilitación activa en bajo (`.T`).
