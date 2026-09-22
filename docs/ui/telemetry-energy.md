# Silicon Telemetry & Energy Radar

Axiom EDA pioneers physics-informed silicon telemetry (`crates/telemetry`). Instead of treating digital gates as mathematical abstractions, Axiom models the physical semiconductor parameters of CMOS switching: dynamic energy dissipation, capacitive load charging, leakage currents, and Power Distribution Network (PDN) inductive voltage droop.

---

## Physics-Informed Power Formulation

Axiom calculates energy dissipation at the transition level using first-principles physics:

### 1. Dynamic Switching Power
$$P_{\text{dynamic}} = \frac{1}{2} \cdot C_{\text{load}} \cdot V_{\text{dd}}^2 \cdot f \cdot \alpha$$
Where:
- $C_{\text{load}}$: Lumped net capacitance, computed from fan-out and wirelength.
- $V_{\text{dd}}$: Nominal supply voltage (1.0V default for Artix-7/Kintex UltraScale+ core).
- $f$: Clock frequency.
- $\alpha$: Switching activity factor (transition probability per clock cycle).

### 2. PDN Inductive Voltage Sag & Droop
During high-activity clock edges when multiple registers toggle simultaneously, peak current draw ($di/dt$) induces voltage droop across the package inductance:
$$V_{\text{sag}} = I \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$
Where:
- $R_{\text{pdn}}$: Effective series resistance of the power rail.
- $L_{\text{pdn}}$: Parasitic inductance of bond wires and package balls.
- $\frac{di}{dt}$: Instantaneous current ramp rate.

If $V_{\text{sag}}$ drops below the transistor threshold voltage, setup time increases exponentially, inducing transient timing glitches.

---

## Silicon Telemetry HUD & Analog Gauges

The top navigation header and dedicated Telemetry dock display synchronized analog gauges:

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

### Monitored Telemetry Parameters
- **Dynamic Power (mW)**: Real-time dynamic switching power consumed by logic cells and clock trees.
- **Supply Current (mA)**: Total core current drawn across the $V_{\text{dd}}$ rail.
- **Core Rail Voltage (V)**: Nominal rail voltage (1.000V) minus instantaneous inductive sag ($V_{\text{sag}}$).
- **Cumulative Energy (pJ / nJ)**: Total electrical energy dissipated since simulation start.

---

## Synopsys SAIF 2.0 Export

Axiom natively exports **Switching Activity Interchange Format (SAIF 2.0)** files:
- Captures toggle counts (`TC`), time spent in logic-high (`T1`), logic-low (`T0`), and unknown (`TX`) for every net.
- Exported `.saif` files can be directly imported into AMD Vivado Power Analyzer (`read_saif`) for official FPGA thermal dissipation reports.
