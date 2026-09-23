# Bloque de lógica configurable (CLB) y primitivas lógicas

Los bloques de lógica configurable contienen las tablas de búsqueda (LUT), lógica de acarreo y elementos de almacenamiento secuencial fundamentales de las FPGA de Xilinx.

---

## Tablas de búsqueda (`LUT1` a `LUT6`, `LUT6_2`)

### 1. `LUT6_2` (LUT de 6 entradas y doble salida)
La base de los CLB modernos de Xilinx. Puede implementar cualquier función booleana única de 6 entradas (`O6`), o dos funciones booleanas distintas de 5 entradas que comparten las entradas `I0` a `I4` (`O5` y `O6`):

```verilog
LUT6_2 #(
    .INIT(64'h8000_0000_0000_0000) // 6-input AND gate
) u_lut (
    .O6 (and_out),
    .O5 (), // Unused in single-output mode
    .I0 (in0), .I1 (in1), .I2 (in2),
    .I3 (in3), .I4 (in4), .I5 (in5)
);
```

---

## Lógica de acarreo rápido (`CARRY4`, `CARRY8`)

Las cadenas dedicadas de acarreo rápido implementan sumadores y acumuladores de alta velocidad sin enrutar señales de acarreo por la interconexión general más lenta:
- **`CARRY4` (Serie 7)**: Macro de acarreo anticipado de 4 bits con propagación (`S[3:0]`), generación (`DI[3:0]`), acarreo de entrada (`CI`) y acarreos de salida (`CO[3:0]`, `O[3:0]`).
- **`CARRY8` (UltraScale+)**: Macro de acarreo anticipado de 8 bits que proporciona el doble de densidad de acarreo por slice CLB.

---

## Biestables y latches (`FDRE`, `FDSE`, `FDCE`, `FDPE`)

Los registros de slice de Xilinx admiten habilitaciones de reloj dedicadas y activaciones/reinicios priorizados:

| Primitiva | Disparador | Tipo de reinicio | Prioridad | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `FDRE` | `posedge C` | Reinicio síncrono (`R`) | Prioridad de reinicio | Flip-Flop D con habilitación de reloj (`CE`) y reinicio síncrono |
| `FDSE` | `posedge C` | Activación síncrona (`S`) | Prioridad de activación (Set) | Flip-Flop D con habilitación de reloj (`CE`) y establecimiento síncrono |
| `FDCE` | `posedge C` | Borrado asíncrono (`CLR`) | Prioridad de borrado | Flip-Flop D con habilitación de reloj (`CE`) y borrado asíncrono |
| `FDPE` | `posedge C` | Preajuste asíncrono (`PRE`) | Prioridad de preajuste | Flip-Flop D con habilitación de reloj (`CE`) y preajuste asíncrono |

```verilog
FDRE #(
    .INIT(1'b0) // Power-on initial value
) u_ff (
    .Q  (q_out),
    .C  (clk),
    .CE (clk_en),
    .R  (sync_rst),
    .D  (d_in)
);
```
