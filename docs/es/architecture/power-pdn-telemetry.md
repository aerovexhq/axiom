# Telemetría de silicio basada en física y modelado de PDN

A diferencia de los simuladores tradicionales que dependen exclusivamente de cálculos estáticos en hojas de cálculo tras la simulación, Axiom integra ecuaciones físicas de potencia en tiempo real directamente en el bucle de simulación.

---

## Disipación de potencia dinámica

La disipación de potencia dinámica está gobernada por la carga y descarga de cargas capacitivas físicas durante las transiciones de señal:

$$P_{\text{dynamic}} = \frac{1}{2} C_{\text{lumped}} V_{\text{rail}}^2 f \alpha$$

Donde:
- $C_{\text{lumped}}$: Capacitancia física total de la red (pin del controlador + enrutamiento de pistas + pines de carga del fanout).
- $V_{\text{rail}}$: Riel de tensión de alimentación del dominio de potencia del controlador (ej. 1.20V Core).
- $f$: Frecuencia de reloj.
- $\alpha$: Factor de actividad de conmutación (tasa de conmutación por distancia de Hamming).

---

## Acumulación de energía por evento

En cada transición de estado de la red $i$:
$$\Delta E_i = \frac{1}{2} C_i V_{\text{rail}}^2 \times \text{bit\_flips}$$

El `TelemetryCollector` de Axiom acumula la energía disipada por instancia de módulo jerárquico en tiempo real, registrando la disipación de potencia instantánea en milivatios ($mW$) y la energía acumulada en microjulios ($\mu J$).

---

## Caída de tensión inductiva en PDN (IR + L di/dt)

El ruido de conmutación simultánea (SSN) ocurre cuando múltiples registros o líneas de bus conmutan en el mismo flanco de reloj, extrayendo corrientes transitorias elevadas del riel de alimentación integrado en el chip.

Axiom modela la impedancia de la red de distribución de energía (caída de tensión inductiva en PDN (IR + L di/dt)):

$$V_{\text{sag}}(t) = I(t) \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$

$$V_{\text{effective}}(t) = V_{\text{nominal}} - V_{\text{sag}}(t)$$ 

Cuando las señales de bus conmutan simultáneamente, Axiom captura:
- Picos instantáneos de corriente transitoria ($mA$).
- Caída de tensión en el riel de alimentación ($mV$) por debajo de los niveles nominales.
- Correlación directa entre flancos de reloj y rebote de la fuente de alimentación.
