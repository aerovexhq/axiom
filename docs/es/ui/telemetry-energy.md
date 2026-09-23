# Telemetría de silicio y radar de energía

Axiom EDA es pionero en telemetría de silicio basada en física (`crates/telemetry`). En lugar de tratar las compuertas digitales como abstracciones matemáticas, Axiom modela los parámetros físicos de semiconductores en conmutación CMOS: disipación de energía dinámica, carga capacitiva, corrientes de fuga y caída de tensión inductiva en PDN (IR + L di/dt).

---

## Formulación de potencia basada en física

Axiom calcula la disipación de energía a nivel de transición utilizando la física de primeros principios:

### 1. Potencia de conmutación dinámica
$$P_{\text{dynamic}} = \frac{1}{2} \cdot C_{\text{load}} \cdot V_{\text{dd}}^2 \cdot f \cdot \alpha$$ 
Donde:
- $C_{\text{load}}$: Capacitancia agrupada de la red, calculada a partir del fan-out y la longitud de pistas.
- $V_{\text{dd}}$: Tensión de alimentación nominal (1.0V por defecto para el núcleo de Artix-7/Kintex UltraScale+).
- $f$: Frecuencia de reloj.
- $\alpha$: Factor de actividad de conmutación (probabilidad de transición por ciclo de reloj).

### 2. Caída de tensión inductiva en PDN (IR + L di/dt)
Durante flancos de reloj de alta actividad cuando múltiples registros conmutan simultáneamente, el pico de consumo de corriente ($di/dt$) induce una caída de tensión inductiva en PDN (IR + L di/dt) a través de la inductancia del encapsulado:
$$V_{\text{sag}} = I \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$
Donde:
- $R_{\text{pdn}}$: Resistencia en serie efectiva del riel de alimentación.
- $L_{\text{pdn}}$: Inductancia parásita de los hilos de unión y bolas del encapsulado.
- $\frac{di}{dt}$: Tasa instantánea de incremento de corriente.

Si $V_{\text{sag}}$ cae por debajo de la tensión de umbral del transistor, el tiempo de preparación aumenta exponencialmente, induciendo fallos transitorios de temporización.

---

## HUD de telemetría de silicio e indicadores analógicos

El encabezado de navegación superior y el panel dedicado de telemetría muestran medidores analógicos sincronizados:

```
+-------------------------------------------------------------------------------+
| Silicon Telemetry Radar:                                                      |
| [ Power: 42.8 mW ]    [ Current: 42.8 mA ]   [ Voltage: 0.982 V (-18 mV Sag) ]|
+-------------------------------------------------------------------------------+
| Real-Time Power Strip-Chart (mW vs. Physical Time):                           |
| mW ^                                                                          |
| 60 |         /\                                                               |
| 40 |      /\/  \  /\                                                          |
| 20 |_____/      \/  \________________________________________________________ |
|  0 +-----+-----+-----+-----+-----+-----+-----+-----+-----+------------------> |
|    0 ns  10 ns 20 ns 30 ns 40 ns 50 ns 60 ns 70 ns 80 ns                     |
+-------------------------------------------------------------------------------+
```

### Parámetros de telemetría supervisados
- **Potencia dinámica (mW)**: Potencia de conmutación dinámica en tiempo real consumida por las celdas lógicas y los árboles de reloj.
- **Corriente de alimentación (mA)**: Corriente total del núcleo consumida a través del riel $V_{\text{dd}}$.
- **Tensión del riel del núcleo (V)**: Tensión nominal del riel (1.000V) menos la caída de tensión inductiva instantánea ($V_{\text{sag}}$).
- **Energía acumulada (pJ / nJ)**: Energía eléctrica total disipada desde el inicio de la simulación.

---

## Exportación de Synopsys SAIF 2.0

Axiom exporta de forma nativa archivos **Switching Activity Interchange Format (SAIF 2.0)**:
- Captura conteos de conmutación (`TC`), tiempo transcurrido en alto lógico (`T1`), bajo lógico (`T0`) y desconocido (`TX`) para cada red.
- Los archivos `.saif` exportados se pueden importar directamente en AMD Vivado Power Analyzer (`read_saif`) para informes oficiales de disipación térmica de FPGA.
