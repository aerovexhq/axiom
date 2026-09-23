# Análisis de temporización estática (STA) y radar de temporización

Axiom EDA incorpora un motor de análisis de temporización estática (STA) con todas las funciones y un visualizador interactivo de radar de temporización (`crates/sta`). Realiza propagación topológica de rutas a través de netlists sintetizables, calcula el margen (slack) de setup y hold frente a las restricciones de reloj de destino e identifica cuellos de botella en rutas críticas antes de la implementación física.

---

## Arquitectura del motor de análisis de temporización estática (STA)

El motor de análisis de temporización estática (STA) descompone la netlist en un grafo acíclico dirigido (DAG) de nodos y aristas de temporización:
- **Nodos de temporización**: Pines de compuertas, entradas de biestables (`D`, `CE`, `R`), salidas de biestables (`Q`) y puertos de E/S principales.
- **Aristas de temporización**: Retardos de propagación de celdas ($t_{\text{logic}}$) y retardos de enrutamiento de redes ($t_{\text{route}}$).

### Formulación del margen de temporización (Slack)
Para cada ruta que se origina en un flip-flop de origen ($FF_1$) y termina en un flip-flop de destino ($FF_2$):
$$\text{Data Arrival Time} = T_{\text{clk1}} + t_{\text{cq}} + t_{\text{logic}} + t_{\text{route}}$$ 
$$\text{Data Required Time} = T_{\text{period}} + T_{\text{clk2}} - t_{\text{setup}} - t_{\text{skew}} - t_{\text{jitter}}$$ 
$$\text{Setup Slack} = \text{Data Required Time} - \text{Data Arrival Time}$$ 

Una ruta cumple con la temporización cuando $\text{Slack} \ge 0$. Un margen negativo ($\text{Slack} < 0$) indica una violación de temporización que requiere reducción de lógica o inserción de segmentación (pipeline).

---

## El panel del radar de temporización

La vista del radar de temporización presenta una descripción ejecutiva del rendimiento del diseño:

```
+-------------------------------------------------------------------------------+
| Timing Radar: Target Clock = 100.0 MHz (Period: 10.0 ns)                      |
| Worst Negative Slack (WNS): +1.42 ns (MET) | Total Negative Slack (TNS): 0.00 |
+-------------------------------------------------------------------------------+
| Critical Path Timing Waterfall:                                               |
| Hop | Element                 | Delay (ps) | Incr (ps) | Total Arrival (ns)   |
|-----+-------------------------+------------+-----------+----------------------|
| 1   | reg_a_reg[3]/C -> Q     | 240 ps     | +240 ps   | 0.240 ns             |
| 2   | net_wire_1 (route)      | 350 ps     | +350 ps   | 0.590 ns             |
| 3   | alu_inst/lut_add_3/I0->O| 480 ps     | +480 ps   | 1.070 ns             |
| 4   | net_sum_3 (route)       | 520 ps     | +520 ps   | 1.590 ns             |
| 5   | reg_result_reg[3]/D     | setup check|           | Required: 8.580 ns   |
+-------------------------------------------------------------------------------+
| Slack Distribution Histogram: [ -2ns | -1ns | 0ns | +1ns | +2ns | +3ns ]      |
+-------------------------------------------------------------------------------+
```

### 1. KPI de temporización
- **Peor margen negativo (Worst Negative Slack - WNS)**: El peor margen entre todos los puntos finales de temporización. Si WNS es negativo, el diseño no puede operar a la frecuencia de reloj objetivo.
- **Margen negativo total (Total Negative Slack - TNS)**: Suma de todos los márgenes negativos en todos los puntos finales que infringen la temporización, lo que indica la gravedad de la presión de temporización en todo el diseño.
- **Puntos finales con fallos**: Número de registros o salidas principales que no cumplen con los requisitos de setup o hold.

### 2. Tabla en cascada de rutas críticas
Muestra la secuencia física exacta de transiciones lógicas de celdas y saltos de enrutamiento de interconexión que contribuyen al retardo de propagación más largo. Cada fila detalla el nombre del elemento, el retardo incremental, el tiempo de llegada acumulado y el presupuesto de margen restante.

### 3. Histograma de distribución de margen (slack)
Visualiza la dispersión estadística de los márgenes de los puntos finales en todo el diseño. Las barras a la izquierda de la línea de 0 ns resaltan las rutas que violan los tiempos y requieren optimización.

---

## Sincronizadores de cruce de dominios de reloj (CDC)

El motor de análisis de temporización estática (STA) analiza automáticamente diseños con múltiples dominios de reloj asíncronos:
- Detecta cruces de señales no registradas entre relojes no relacionados.
- Identifica y verifica sincronizadores de biestables de 2 y 3 etapas (`cdc_sync`).
- Señala las rutas CDC sin restricciones como riesgos de metaestabilidad de alto riesgo.
