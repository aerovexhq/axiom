# Estudio de floorplanning de síntesis y distribución del troquel

Axiom EDA cuenta con un estudio interactivo de floorplanning de troqueles de silicio en 2D (`crates/ir/src/floorplan/`, `FloorplanStudioViewer.tsx`). Visualiza la ubicación física de celdas, cuadrículas de sitios de silicio, líneas de vuelo de interconexión y mapas de calor térmicos y de densidad en distribuciones reales de troqueles FPGA.

---

## Cuadrícula de arquitectura del troquel de silicio FPGA

El planificador de distribución (floorplanner) renderiza la disposición exacta de sitios de la arquitectura FPGA de destino:

```
+-------------------------------------------------------------------------------+
| Top I/O Bank (IOB)                                                            |
+---+-----------------------------------------------------------------------+---+
| L | CLB Slice Grid (SliceL / SliceM)   | DSP Column | BRAM Column         | R |
| e | [x][x][x][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | i |
| f | [x][x][ ][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | g |
| t |------------------------------------+------------+---------------------| h |
|   | Global Clock Center Spine (BUFG / Clock Center)                       | t |
| I |------------------------------------+------------+---------------------|   |
| O | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | I |
| B | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | O |
+---+-----------------------------------------------------------------------+---+
| Bottom I/O Bank (IOB)                                                         |
+-------------------------------------------------------------------------------+
```

### Tipos de sitios en el troquel
- **Slices CLB (SliceL y SliceM)**: Slices de lógica que contienen LUTs y biestables. Los sitios SliceM admiten además RAM distribuida y registros de desplazamiento (SRL).
- **Columnas DSP**: Columnas dedicadas de múltiples bloques que albergan bloques aritméticos `DSP48E2` de alta velocidad.
- **Columnas de Block RAM**: Columnas verticales reservadas para memorias embebidas `RAMB36E2` y `RAMB18E2`.
- **Bancos de E/S perimetrales**: Búferes de E/S (`IOB`) izquierdo, derecho, superior e inferior que conectan los pines del encapsulado con la lógica interna.
- **Espina de reloj**: Pista de distribución horizontal central que aloja `BUFG` y redes de enrutamiento de reloj.

---

## Ubicador analítico (HPWL) y agrupamiento de acarreos

El ubicador de síntesis calcula coordenadas $(x, y)$ óptimas para cada celda utilizando ubicación cuadrática analítica y minimización de longitud de interconexión de medio perímetro (HPWL):
$$\text{HPWL}(e) = \max_{v \in e}(x_v) - \min_{v \in e}(x_v) + \max_{v \in e}(y_v) - \min_{v \in e}(y_v)$$

### Agrupamiento de columnas verticales de cadenas de acarreo
Las macros aritméticas que requieren cadenas de acarreo rápido (`CARRY4` / `CARRY8`) no pueden dispersarse arbitrariamente en el troquel. El ubicador agrupa automáticamente elementos de acarreo dependientes en columnas verticales contiguas a lo largo de pistas de acarreo de silicio dedicadas de alta velocidad.

---

## Mapas de calor térmicos y de densidad de silicio

El área del troquel se divide en una matriz espacial de cuadrícula normalizada de $32 \times 32$:
- **Mapa de calor de utilización**: Las celdas se sombrean desde azul marino profundo (vacías / baja utilización) hasta ámbar brillante y rojo (alta congestión $>85\%$).
- **Mapa de calor térmico**: Combina la frecuencia de conmutación lógica ($\alpha$) con la densidad local para mostrar puntos calientes térmicos en el troquel de silicio.

---

## Líneas de vuelo Manhattan y superposición de rutas críticas

- **Líneas de vuelo punto a punto**: Al hacer clic en cualquier celda se iluminan los canales de enrutamiento ortogonal Manhattan que conectan todos los destinos de abanico de salida (fan-out) excitados.
- **Superposición neón de ruta crítica**: La ruta de temporización del peor caso identificada por el motor de análisis de temporización estática (STA) se representa como una traza naranja neón prominente desde el biestable de origen hasta el punto final de destino.
