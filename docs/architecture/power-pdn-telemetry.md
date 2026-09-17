# Physics Silicon Telemetry & PDN Modeling

Unlike traditional simulators that rely exclusively on static, post-simulation spreadsheet calculations, Axiom integrates real-time physical power equations directly into the simulation loop.

---

## Dynamic Power Dissipation

Dynamic power dissipation is governed by charging and discharging physical capacitive loads during signal transitions:

$$P_{\text{dynamic}} = \frac{1}{2} C_{\text{lumped}} V_{\text{rail}}^2 f \alpha$$

Where:
- $C_{\text{lumped}}$: Total physical capacitance of the net (driver pin + wire routing + fanout sink pins).
- $V_{\text{rail}}$: Supply voltage rail of the driver's power domain (e.g. 1.20V Core).
- $f$: Clock frequency.
- $\alpha$: Switching activity factor (Hamming distance toggle rate).

---

## Energy Accumulation per Event

On every state transition of net $i$:
$$\Delta E_i = \frac{1}{2} C_i V_{\text{rail}}^2 \times \text{bit\_flips}$$

Axiom's `TelemetryCollector` accumulates dissipated energy per hierarchical module instance in real time, tracking instantaneous power dissipation in milliwatts ($mW$) and cumulative energy in microjoules ($\mu J$).

---

## Power Distribution Network (PDN) Voltage Droop

Simultaneous switching noise (SSN) occurs when multiple registers or bus lines toggle on the same clock edge, pulling high transient currents from the on-chip power rail.

Axiom models the impedance of the Power Distribution Network ($R + L \frac{di}{dt}$):

$$V_{\text{sag}}(t) = I(t) \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$

$$V_{\text{effective}}(t) = V_{\text{nominal}} - V_{\text{sag}}(t)$$

When bus signals toggle simultaneously, Axiom captures:
- Instantaneous transient current spikes ($mA$).
- Supply rail voltage droop ($mV$) below nominal levels.
- Direct correlation between clock edges and power supply bounce.
