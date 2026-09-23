# Hochdichte Signalverläufe & Logikanalysator

Axiom EDA bietet einen hochdichten digitalen Signalverlaufsbetrachter und Logikanalysator mit 60+ FPS, der auf einem beschleunigten HTML5-Canvas gerendert wird. Er ermöglicht Ingenieuren die Untersuchung von Multi-Signal-Timing-Beziehungen, das Erweitern von Bus-Radices, das Messen von Intervallen und das Erkennen von Null-Zeit-Delta-Zyklus-Glitches.

---

## Geschichtete digitale Zeitleiste

Der Signalverlaufsbetrachter rendert digitale Spuren mit virtualisiertem vertikalem Scrolling und bewältigt Hunderte von Signalen ohne jegliche Verzögerung:

```
Signal Name   Radix   | 0 ns      5 ns      10 ns     15 ns     20 ns     25 ns
----------------------+--------------------------------------------------------
clk           1-bit   | _/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_
rst_n         1-bit   | _____/=================================================
data_in[7:0]  Hex     | = 00 =X= 41 =X= 42 =X= 43 =X= 44 =X= 45 =X= 46 ======
valid_in      1-bit   | ______/===========\___________/=======================
busy_out      1-bit   | ____________/===========\___________/=================
----------------------+--------------------------------------------------------
                      |       |<---- Delta-T: 10.0 ns (100.0 MHz) ---->|
```

### Signalanzeigefunktionen
- **Radix-Umschaltung**: Klicken Sie mit der rechten Maustaste oder auf das Radix-Pill-Element eines Signals, um zwischen **Hexadezimal**, **Binär**, **Vorzeichenlosem Dezimal**, **Vorzeichenbehaftetem Dezimal** und **ASCII** umzuschalten.
- **Bus-Erweiterung**: Klicken Sie auf das Chevron-Symbol (`>`) neben einem Multi-Bit-Vektor (`data[7:0]`), um einzelne Bitzeilen aufzuklappen.
- **Farbliche Hervorhebung**: Signalspuren werden in kontrastreichem Zyan für Logikpegel, Bernstein für Busse und Rot für unbekannte/Kollisions-Zustände (`X`, `Z`) gerendert.

---

## Modernes Drag-to-Measure-Messfenster

Axiom ersetzt veraltete Mess-Workflows mit zwei Cursor-Linien durch ein intuitives Drag-to-Measure-Messfenster:

1. **Klicken und Ziehen**: Ziehen Sie über einen beliebigen Bereich der Signalverlaufszeitleiste, um ein Messfenster hervorzuheben.
2. **Grenz-Ziehgriffe ($[A, B]$)**: Ziehen Sie die linken oder rechten Grenzgriffe, um die Messendpunkte mit Pikosekunden-Präzision anzupassen.
3. **Gleitendes Fenster**: Ziehen Sie die Mitte des Messfensters, um das gesamte Zeitintervall entlang der Zeitleiste zu verschieben.
4. **Live-Mess-HUD**: Das HUD zeigt Folgendes an:
   - **Zeit A ($T_A$)**: Startzeitstempel mit kompakten technischen Einheiten (ps, ns, us, ms).
   - **Zeit B ($T_B$)**: Endzeitstempel.
   - **Delta-Zeit ($\Delta t$)**: Exakte Zeitdauer ($\Delta t = |T_B - T_A|$).
   - **Frequenz ($f$)**: Äquivalente Taktfrequenz ($f = 1 / \Delta t$).
5. **In Fenster zoomen**: Klicken Sie auf **Zoom into Window**, um das ausgewählte Intervall auf 100% der Arbeitsflächenbreite zu vergrößern.

---

## Delta-Zyklus (\(\delta\)) & Glitch-Erkennung

Herkömmliche Simulatoren fassen Null-Zeit-Ereignisse in einem einzigen Zeitstempel zusammen und verbergen kombinatorische Race Conditions. Axiom bietet eine explizite Delta-Inspektion:
- **Delta-Schritt (`F11`)**: Führt einen einzelnen diskreten Null-Zeit-Auswertungszyklus aus ($\delta 	o \delta + 1$).
- **Glitch-Hazard-Markierungen**: Wenn ein Signal innerhalb desselben physischen Zeitstempels ($t_0$) mehrfach umschaltet, markiert der Signalverlaufs-Canvas das Netz mit einer bernsteinfarbenen Warnflagge.
- **Delta-Erweiterungsansicht**: Dehnt Null-Zeit-Intervalle horizontal aus und zeigt die interne Kaskade von Zwischen-Gatterübergängen, bevor der Schaltkreis den stabilen Zustand erreicht.

---

## IEEE 1364 VCD Export & Import-Vergleich (Diffing)

- **VCD exportieren**: Exportieren Sie den aktuellen Simulationsverlauf als IEEE 1364 Value Change Dump (`.vcd`), der direkt mit GTKWave, ModelSim oder Vivado kompatibel ist.
- **VCD importieren (`ImportVcdModal`)**: Laden Sie externe VCD-Dateien in Axiom.
- **Signalverlaufs-Vergleich (Diffing)**: Vergleicht Simulationsaufzeichnungen automatisch mit Golden-Reference-VCD-Dateien und hebt Signalabweichungen mit zyklusgenauen Fehler-Flags hervor.
