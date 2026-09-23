# Physikalische Silizium-Telemetrie & PDN-Modellierung

Im Gegensatz zu herkömmlichen Simulatoren, die sich ausschließlich auf statische Tabellenkalkulationen nach der Simulation stützen, integriert Axiom physikalische Echtzeit-Leistungsgleichungen direkt in die Simulationsschleife.

---

## Dynamische Verlustleistung

Die dynamische Verlustleistung wird durch das Auf- und Entladen physikalischer kapazitiver Lasten während Signalübergängen bestimmt:

$$P_{\text{dynamic}} = \frac{1}{2} C_{\text{lumped}} V_{\text{rail}}^2 f \alpha$$

Wobei:
- $C_{\text{lumped}}$: Gesamte physikalische Kapazität des Netzes (Treiber-Pin + Leitungsführung + Fanout-Empfänger-Pins).
- $V_{\text{rail}}$: Versorgungsspannungsschiene der Leistungsdomäne des Treibers (z. B. 1,20V Core).
- $f$: Taktfrequenz.
- $\alpha$: Schaltaktivitätsfaktor (Hamming-Distanz-Umschaltrate).

---

## Energieakkumulation pro Ereignis

Bei jedem Zustandsübergang von Netz $i$:
$$\Delta E_i = \frac{1}{2} C_i V_{\text{rail}}^2 \times \text{bit\_flips}$$

Der `TelemetryCollector` von Axiom akkumuliert die dissipierte Energie pro hierarchischer Modulinstanz in Echtzeit und erfasst die momentane Verlustleistung in Milliwatt ($mW$) sowie die kumulierte Energie in Mikrojoule ($\mu J$).

---

## Induktiver PDN-Spannungsabfall (IR + L di/dt)

Simultanes Schaltrauschen (SSN) tritt auf, wenn mehrere Register oder Busleitungen an derselben Taktflanke umschalten und hohe transiente Ströme aus der On-Chip-Stromschiene ziehen.

Axiom modelliert die Impedanz des Stromversorgungsnetzes (PDN, $R + L \frac{di}{dt}$):

$$V_{\text{sag}}(t) = I(t) \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$

$$V_{\text{effective}}(t) = V_{\text{nominal}} - V_{\text{sag}}(t)$$

Wenn Bussignale gleichzeitig umschalten, erfasst Axiom:
- Momentane transiente Stromspitzen ($mA$).
- Versorgungsspannungsabfall ($mV$) unter die Nennwerte.
- Direkte Korrelation zwischen Taktflanken und Spannungseinbrüchen der Stromversorgung.
