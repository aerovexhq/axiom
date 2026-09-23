# Mikroarchitektur- & Multi-Die-Betrachter

Axiom EDA bietet dedizierte Werkzeuge zur mikroarchitektonischen Inspektion (`crates/ir/src/microarch/`, `MicroarchViewer.tsx`, `MultiDieViewer.tsx`, `PpaParetoViewer.tsx`). Diese Tools erkennen automatisch Prozessordatenpfade, Rechenwerke (ALUs), Registerdateien und Zustandsautomaten sowie moderne 2.5D/3D-Multi-Die-Chiplet-Gehäuse.

---

## Automatische Datenpfad-Erkennung

Der RTL-Elaborator analysiert die Modulstruktur und inferiert standardmäßige mikroarchitektonische Blöcke:

```
+-------------------------------------------------------------------------------+
| Microarchitecture Datapath Detector:                                          |
| Detected: 1 ALU (32-Bit) | 1 RegFile (32x32) | 1 FSM Controller (5 States)     |
+-------------------------------------------------------------------------------+
| ALU Inspector Modal:                                                          |
| - Opcode: 4'b0010 (ADD) | Operand A: 0x0000_0020 | Operand B: 0x0000_0014     |
| - Result: 0x0000_0034   | Zero Flag: 0           | Overflow: 0                |
+-------------------------------------------------------------------------------+
| FSM Bubble Diagram: [IDLE] --start--> [READ] --ready--> [EXEC] --done--> [IDLE]
+-------------------------------------------------------------------------------+
```

### 1. ALU-Operations-Inspektor
Erkennt automatisch multiplexergesteuerte Arithmetikblöcke. Zeigt aktive Opcode-Auswahlen (ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT) und Live-Registeroperandenwerte an.

### 2. Registerdatei-Inspektor (RegFile)
Erkennt Multi-Port-Speicher-Arrays (`reg [31:0] registers [0:31]`). Bietet ein interaktives 32-Zeilen-Gitter, das die aktuellen Hexadezimalinhalte aller Architekturregister mit Echtzeit-Hervorhebung bei Schreibzugriffen anzeigt.

### 3. FSM-Zustandsblasen-Visualisierer (`FsmViewer.tsx`)
Extrahiert automatisch Zustandsvektoren und Übergangsmatrizen endlicher Zustandsautomaten:
- Rendert einen interaktiven gerichteten Graphen mit Zustandsblasen und Übergangspfeilen.
- Hebt die aktuell aktive Zustandsblase während der Live-Simulation hervor.
- Prüft die FSM-Struktur: erkennt unerreichbare Zustände, fatale Trap-Zustände und fehlende Default-Wiederherstellungszweige.

---

## 2.5D- & 3D-Multi-Die-Silizium-Gehäuse

Für moderne Chiplet- und Multi-Die-Architekturen (wie AMD UltraScale+ Stacked Silicon Interconnect):
- **Interposer-Die-Layout**: Visualisiert Silizium-Interposer, die mehrere aktive Logik-Dies (SLRs) verbinden.
- **Die-zu-Die-Verbindung (Super Long Lines - SLL)**: Analysiert Bandbreite, Ausbreitungslatenz und Skew über Mikro-Bumps hinweg, die physische Dies überbrücken.

---

## PPA-Pareto-Trade-off-Explorer

Der PPA-Viewer analysiert die Kompromisse des Designs über drei grundlegende technische Metriken hinweg:
- **Leistung (mW)**: Gesamter dynamischer und statischer Energieverbrauch (Leckleistung).
- **Leistung / Taktfrequenz (MHz)**: Maximal erreichbare Taktfrequenz aus der Statischen Timing-Analyse.
- **Fläche (LUTs / FFs)**: Gesamter Silizium-Ressourcen-Footprint.

Der Visualisierer stellt Pareto-optimale Konfigurationsfronten dar, sodass Entwickler die optimale Pipeline-Balance für Profile mit hohem Durchsatz oder geringem Stromverbrauch wählen können.
