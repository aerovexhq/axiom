# Synthese-Floorplanning & Die-Layout-Studio

Axiom EDA verfügt über ein interaktives 2D-Silizium-Die-Floorplanning-Studio (`crates/ir/src/floorplan/`, `FloorplanStudioViewer.tsx`). Es visualisiert physische Zellplatzierungen, Silizium-Site-Gitter, Verbindungs-Luftlinien und thermische/Dichte-Heatmaps auf tatsächlichen FPGA-Die-Layouts.

---

## FPGA-Silizium-Die-Architekturgitter

Der Floorplanner stellt das exakte Site-Layout der Ziel-FPGA-Architektur dar:

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

### Die-Site-Typen
- **CLB-Slices (SliceL & SliceM)**: Logik-Slices mit LUTs und Flipflops. SliceM-Sites unterstützen zusätzlich verteiltes RAM und Schieberegister (SRL).
- **DSP-Spalten**: Dedizierte Spalten für Hochgeschwindigkeits-`DSP48E2`-Arithmetikblöcke.
- **Block-RAM-Spalten**: Vertikale Spalten, die für eingebettete `RAMB36E2`- und `RAMB18E2`-Speicher reserviert sind.
- **Perimeter-E/A-Bänke**: Linke, rechte, obere und untere E/A-Puffer (`IOB`), die Gehäuse-Pins mit der internen Logik verbinden.
- **Takt-Rückgrat (Clock Spine)**: Zentraler horizontaler Verteilungskanal für `BUFG` und Takt-Routing-Netzwerke.

---

## Analytischer Placer (HPWL) & Carry-Clustering

Der Synthese-Placer berechnet optimale $(x, y)$-Koordinaten für jede Zelle mithilfe analytischer quadratischer Platzierung und Minimierung der Half-Perimeter Wire Length (HPWL):
$$\text{HPWL}(e) = \max_{v \in e}(x_v) - \min_{v \in e}(x_v) + \max_{v \in e}(y_v) - \min_{v \in e}(y_v)$$

### Vertikales Übertragsketten-Spalten-Clustering
Arithmetik-Makros, die schnelle Übertragsketten (`CARRY4` / `CARRY8`) erfordern, können nicht willkürlich über den Die verteilt werden. Der Placer fasst abhängige Übertragselemente automatisch in zusammenhängenden vertikalen Spalten entlang dedizierter Hochgeschwindigkeits-Übertragskanäle zusammen.

---

## Silizium-Dichte & Thermische Heatmaps

Die Die-Fläche ist in eine normalisierte $32 \times 32$ räumliche Kachelmatrix unterteilt:
- **Auslastungs-Heatmap**: Zellen werden von tiefem Marineblau (leer / geringe Auslastung) bis zu lebhaftem Bernstein und Rot (hohe Überlastung $>85\%$) schattiert.
- **Thermische Heatmap**: Kombiniert Logikschaltfrequenz ($\alpha$) mit lokaler Dichte, um thermische Hotspots über den Silizium-Die hinweg anzuzeigen.

---

## Manhattan-Luftlinien & Kritischer-Pfad-Überlagerung

- **Punkt-zu-Punkt-Luftlinien**: Das Anklicken einer Zelle hebt orthogonale Manhattan-Routing-Kanäle hervor, die alle angesteuerten Fan-Out-Ziele verbinden.
- **Neon-Überlagerung des kritischen Pfads**: Der von der Statischen Timing-Analyse-Engine ermittelte Worst-Case-Timing-Pfad wird als markante neonorangefarbene Linie gerendert, die vom Quell-Flipflop zum Zielendpunkt verläuft.
