# Silizium-Telemetrie & Energie-Radar

Axiom EDA leistet Pionierarbeit bei der physikbasierten Silizium-Telemetrie (`crates/telemetry`). Anstatt digitale Gatter als mathematische Abstraktionen zu behandeln, modelliert Axiom die physikalischen Halbleiterparameter des CMOS-Schaltens: dynamische Verlustleistung, kapazitive Lastaufladung, Leckströme und den induktiven Spannungsabfall des Stromversorgungsnetzes (PDN).

---

## Physikbasierte Leistungsberechnung

Axiom berechnet die Verlustleistung auf Übergangsebene unter Verwendung physikalischer Grundprinzipien:

### 1. Dynamische Schaltleistung
$$P_{\text{dynamic}} = \frac{1}{2} \cdot C_{\text{load}} \cdot V_{\text{dd}}^2 \cdot f \cdot \alpha$$
Wobei:
- $C_{\text{load}}$: Gesamte Netzkapazität, berechnet aus Fan-Out und Leitungslänge.
- $V_{\text{dd}}$: Nennversorgungsspannung (Standard: 1,0V für Artix-7/Kintex UltraScale+ Core).
- $f$: Taktfrequenz.
- $\alpha$: Schaltaktivitätsfaktor (Übergangswahrscheinlichkeit pro Taktzyklus).

### 2. Induktiver PDN-Spannungsabfall (IR + L di/dt)
Während Taktflanken mit hoher Aktivität, an denen mehrere Register gleichzeitig umschalten, induziert der Spitzenstrombedarf ($di/dt$) einen Spannungsabfall über die Gehäuseinduktivität:
$$V_{\text{sag}} = I \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$
Wobei:
- $R_{\text{pdn}}$: Effektiver Serienwiderstand der Stromversorgungsschiene.
- $L_{\text{pdn}}$: Parasitäre Induktivität von Bonddrähten und Gehäuse-Bällen.
- $\frac{di}{dt}$: Momentane Stromanstiegsrate.

Fällt $V_{\text{sag}}$ unter die Schwellenspannung der Transistoren, steigt die Setup-Zeit exponentiell an, was zu transienten Timing-Glitches führt.

---

## Silizium-Telemetrie-HUD & Analoge Messanzeigen

Die obere Navigationsleiste und das dedizierte Telemetrie-Dock zeigen synchronisierte analoge Messanzeigen an:

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

### Überwachte Telemetrieparameter
- **Dynamische Leistung (mW)**: Dynamische Echtzeit-Schaltleistung, die von Logikzellen und Taktbäumen verbraucht wird.
- **Versorgungsstrom (mA)**: Gesamter über die $V_{\text{dd}}$-Schiene aufgenommene Kernstrom.
- **Kernschienenspannung (V)**: Nennschienenspannung (1,000V) abzüglich des momentanen induktiven Abfalls ($V_{\text{sag}}$).
- **Kumulierte Energie (pJ / nJ)**: Gesamte seit Simulationsbeginn dissipierte elektrische Energie.

---

## Synopsys SAIF 2.0 Export

Axiom exportiert nativ Dateien im **Switching Activity Interchange Format (SAIF 2.0)**:
- Erfasst Umschaltzählungen (`TC`), Verweildauer in Logisch-Hoch (`T1`), Logisch-Tief (`T0`) und Unbekannt (`TX`) für jedes Netz.
- Exportierte `.saif`-Dateien können direkt in den AMD Vivado Power Analyzer (`read_saif`) importiert werden, um offizielle FPGA-Thermoberechnungen zu erhalten.
