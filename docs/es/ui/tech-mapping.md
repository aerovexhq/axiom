# Estudio de mapeo tecnológico a nivel de compuertas

El estudio de mapeo tecnológico de Axiom (`crates/ir/src/synth/`) conecta el RTL conductual con las arquitecturas físicas de FPGA. Descompone ecuaciones lógicas booleanas genéricas, multiplexores y operadores aritméticos en primitivas de silicio nativas de dispositivos AMD/Xilinx Serie 7 y UltraScale+.

---

## Reducción de primitivas específica por arquitectura

```
+-------------------------------------------------------------------------------+
| RTL Verilog Code:                       | Mapped Silicon Primitives:          |
|                                         |                                     |
| assign F = (cond) ? (a + b) : (c & d);  | - LUT6_2 (INIT = 64'hE2E2_0000_...) |
|                                         | - CARRY4 (Fast Arithmetic)          |
|                                         | - FDRE   (D Flip-Flop with Enable)  |
+-------------------------------------------------------------------------------+
```

### Destinos de silicio FPGA soportados
Los ingenieros pueden elegir entre arquitecturas de hardware preconfiguradas:
1. **AMD Artix-7 (XC7A35T / XC7A100T)**: LUTs de 6 entradas, aritmética CARRY4, slices DSP48E1 y memorias RAMB36E1.
2. **AMD Kintex-7 (XC7K325T)**: Arquitectura de Serie 7 de alta velocidad.
3. **AMD Zynq-7000 (XC7Z020)**: SoC ARM Cortex-A9 dual con matriz de lógica programable de Serie 7.
4. **AMD Kintex UltraScale+ (XCKU5P)**: Arquitectura FinFET moderna de 16nm con cadenas CARRY8, slices DSP48E2 y bloques UltraRAM.
5. **Axiom Virtual Silicon**: Arquitectura virtual genérica de alta capacidad optimizada para educación y prototipado rápido.

---

## Descomposición de redes booleanas y mapeo en K-LUT

### 1. Descomposición en $K$-LUT
Axiom descompone expresiones lógicas booleanas arbitrarias en tablas de búsqueda (LUT) con $K$ entradas (donde $K=6$ para las FPGA modernas de Xilinx):
- Las subfunciones con $\le 6$ entradas únicas se asignan directamente a una única `LUT6`.
- Funciones lógicas de salida dual que comparten hasta 5 entradas se asignan a primitivas `LUT6_2` de salida dual (`O5`, `O6`).
- Las funciones lógicas amplias ($N > 6$) se dividen mediante expansión de Shannon en redes de LUT en cascada.

### 2. Cálculo exacto del parámetro hexadecimal `INIT`
Cada LUT mapeada tiene su tabla de verdad serializada en un parámetro `INIT` hexadecimal de 64 bits:
$$\text{INIT}[i] = f(i_5, i_4, i_3, i_2, i_1, i_0)$$
Por ejemplo, una puerta AND de 2 entradas se asigna a `LUT6` con `INIT = 64'h0000_0000_0000_0008`.

---

## Inferencia de primitivas macro

El motor de síntesis identifica automáticamente patrones estructurales de alto nivel:
- **Inferencia de bloques DSP (`DSP48E1` / `DSP48E2`)**: Multiplicaciones multibit (`a * b`), operaciones de multiplicación-acumulación (`P = P + (A * B)`) y secuencias de pre-sumador se asignan directamente a bloques DSP dedicados en hardware en lugar de consumir cientos de LUTs de lógica.
- **Inferencia de Block RAM (`RAMB18E2` / `RAMB36E2`)**: Las matrices desempaquetadas con reloj síncrono (`reg [31:0] mem [0:1023]`) se reducen automáticamente a memorias Block RAM de hardware de doble puerto real o de puerto dual simple.

---

## Inspección de netlists mapeadas y exportación de Verilog estructural

El visor de mapeo tecnológico incluye:
- **Gráfico de barras de utilización de recursos**: Muestra recuentos y porcentajes de Slice LUTs, registros de Slice (FFs), cadenas CARRY, bloques DSP y memorias Block RAM.
- **Tabla inspectora de celdas**: Busque y filtre instancias de primitivas mapeadas.
- **HUD de tabla de verdad**: Inspeccione la tabla de verdad booleana exacta representada por cualquier LUT mapeada.
- **Exportación de Verilog estructural**: Generación en 1 clic de netlists de puertas puramente estructurales (`.v`) instanciadas con primitivas estándar de Xilinx.
