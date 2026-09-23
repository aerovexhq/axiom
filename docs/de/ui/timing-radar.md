# Statische Timing-Analyse (STA) & Timing-Radar

Axiom EDA enthält eine voll ausgestattete Statische Timing-Analyse-(STA)-Engine und einen interaktiven Timing-Radar-Visualisierer (`crates/sta`). Sie führt topologische Pfadausbreitung über synthetisierbare Netzlisten durch, berechnet Setup- und Hold-Slack anhand von Ziel-Takt-Constraints und identifiziert Engpässe auf kritischen Pfaden vor der physischen Implementierung.

---

## Architektur der statischen Timing-Engine

Die STA-Engine zerlegt die Netzliste in einen gerichteten azyklischen Graphen (DAG) aus Timing-Knoten und -Kanten:
- **Timing-Knoten**: Gatter-Pins, Flipflop-Eingänge (`D`, `CE`, `R`), Flipflop-Ausgänge (`Q`) und primäre E/A-Ports.
- **Timing-Kanten**: Zellen-Ausbreitungsverzögerungen ($t_{\text{logic}}$) und Netz-Routing-Verzögerungen ($t_{\text{route}}$).

### Timing-Slack-Formulierung
Für jeden Pfad, der von einem Quell-Flipflop ($FF_1$) ausgeht und an einem Ziel-Flipflop ($FF_2$) endet:
$$\text{Daten-Ankunftszeit} = T_{\text{clk1}} + t_{\text{cq}} + t_{\text{logic}} + t_{\text{route}}$$
$$\text{Erforderliche Datenzeit} = T_{\text{period}} + T_{\text{clk2}} - t_{\text{setup}} - t_{\text{skew}} - t_{\text{jitter}}$$
$$\text{Setup-Slack} = \text{Erforderliche Datenzeit} - \text{Daten-Ankunftszeit}$$

Ein Pfad erfüllt das Timing, wenn $\text{Slack} \ge 0$ ist. Ein negativer Slack ($\text{Slack} < 0$) weist auf eine Timing-Verletzung hin, die eine Logikreduzierung oder das Einfügen von Pipeline-Stufen erfordert.

---

## Das Timing-Radar-Dashboard

Die Timing-Radar-Ansicht bietet eine Gesamtübersicht über die Performance des Designs:

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

### 1. Timing-Kennzahlen (KPIs)
- **Worst Negative Slack (WNS)**: Der ungünstigste Slack über alle Timing-Endpunkte hinweg. Wenn WNS negativ ist, kann das Design nicht mit der Ziel-Taktfrequenz betrieben werden.
- **Total Negative Slack (TNS)**: Summe aller negativen Slacks über alle verletzenden Endpunkte hinweg, die den Schweregrad des designweiten Timing-Drucks anzeigt.
- **Fehlerhafte Endpunkte**: Anzahl der Register oder Primärausgänge, die Setup- oder Hold-Anforderungen verletzen.

### 2. Wasserfalltabelle der kritischen Pfade
Zeigt die exakte physische Sequenz von Zellenlogikübergängen und Routing-Hops an, die zur längsten Ausbreitungsverzögerung beitragen. Jede Zeile führt Elementname, inkrementelle Verzögerung, kumulative Ankunftszeit und verbleibendes Slack-Budget auf.

### 3. Slack-Verteilungs-Histogramm
Visualisiert die statistische Streuung der Endpunkt-Slacks im Design. Balken links von der 0-ns-Linie markieren verletzende Pfade, die optimiert werden müssen.

---

## Taktdomänenübergangs-Synchronisierer (CDC)

Die STA-Engine analysiert Designs mit mehreren asynchronen Taktdomänen automatisch:
- Erkennt unregistrierte Signalübergänge zwischen nicht synchronisierten Takten.
- Identifiziert und verifiziert 2-stufige und 3-stufige Flipflop-Synchronisierer (`cdc_sync`).
- Markiert nicht mit Constraints versehene CDC-Pfade als hochriskante Metastabilitäts-Hazards.
