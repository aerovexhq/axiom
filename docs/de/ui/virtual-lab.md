# Virtuelles Labor-Rack & Board-Emulation

Das Virtual Lab Rack von Axiom schlägt die Brücke zwischen HDL-Simulation und physischen Hardwaretests. Es bietet eine authentische digitale Breadboard-Emulation, mit der Studenten und FPGA-Ingenieure in Echtzeit über taktile Schalter, Taster, LEDs und 7-Segment-Anzeigen mit ihren Designs interagieren können.

---

## Digilent Basys 3 FPGA-Board-Bucht

Die Basys 3 FPGA-Bucht bietet einen präzisen digitalen Zwilling des beliebten Artix-7-Entwicklungsboards von Digilent:

```
+-------------------------------------------------------------------------------+
| Axiom Basys 3 Artix-7 Hardware Emulation Bay                                  |
+-------------------------------------------------------------------------------+
| [SSEG Display:  1 0 4 2 ]       [BTNU]                 [LD15 .. LD0]          |
| Anode: AN3..AN0 Active        [BTNL] [BTNC] [BTNR]     * * * * * * * *        |
| Segments: CA..CG, DP            [BTND]                 O O O O O O O O        |
|                                                                               |
| Tactile Slide Switches:                                                       |
| [SW15] [SW14] [SW13] [SW12] [SW11] [SW10] [SW9] [SW8] ... [SW1] [SW0]         |
|  [ON]   [OFF]  [OFF]  [ON]   [ON]   [OFF]  [OFF] [ON]       [OFF] [ON]        |
+-------------------------------------------------------------------------------+
```

### 1. 16 taktile Schiebeschalter (`SW0`..`SW15`)
- Direkt über physische XDC-Constraints (`PACKAGE_PIN V17`, etc.) auf Eingangsports abgebildet.
- Interaktives Klicken schaltet die Schalterposition mit authentischen Soundeffekten und Zustandspersistenz um.
- Kontrastreiche visuelle Schalthebel mit grünen Anzeige-Punkten.

### 2. 16 SMD-LEDs (`LD0`..`LD15`)
- Über XDC-Constraints (`PACKAGE_PIN U16`, etc.) auf Ausgangsports abgebildet.
- Realistisches smaragdgrünes Leuchten zur Anzeige aktiver Logisch-Hoch-Zustände (`1`).

### 3. 5 Taster (`BTNC`, `BTNU`, `BTNL`, `BTNR`, `BTND`)
- Steuerkreuz-Konfiguration für die Tasten Mitte, Oben, Links, Rechts und Unten.
- Drücken hält Logisch-Hoch (`1`); Loslassen kehrt zu Logisch-Tief (`0`) zurück. Perfekt für manuelle Reset-Impulse oder Einzelschritt-Taktung.

### 4. 4-stellige gemultiplexte 7-Segment-Anzeige (`SSEG`)
- Implementiert authentische dynamische Kathoden-Anoden-Abtastung.
- Rendert Segmente (`CA` bis `CG`) und den Dezimalpunkt (`DP`) präzise, gesteuert durch aktiv-niedrige Anodenauswahlleitungen (`AN0` bis `AN3`).

---

## Bucht für kombinatorische Logik

Die Bucht für kombinatorische Logik wurde für einführende Digitallogik und Wahrheitstabellen-Verifikation entwickelt und bietet eine dedizierte taktile Schnittstelle:
- **Interaktive Eingänge**: Drei markante Kippschalter (`A`, `B`, `C`).
- **Gatter-Messspitzen**: Echtzeit-Signalbewertungs-Pins für Zwischennetze (`w1`, `w2`, `w3`, `w4`).
- **Ausgangs-LED**: Prominente Anzeige-Diode, die den Schaltungsausgang `F` darstellt.
- **Synchronisiertes 8-Zeilen-Wahrheitstabellen-HUD**: Zeigt alle $2^3 = 8$ Eingangskombinationen ($000$ bis $111$) an. Die aktive Zeile leuchtet dynamisch basierend auf den aktuellen Schalterzuständen auf und liefert eine sofortige visuelle Bestätigung der booleschen Korrektheit.

---

## Automatischer Labor-Bewerter (`LabGraderModal`)

Entwickelt in Partnerschaft mit universitären Digitaldesign-Kursen (einschließlich Universität Istanbul - Cerrahpasa):
- **Automatisierte Verifikation**: Führt die Testbench-Matrix automatisch gegen studentische RTL-Implementierungen (`uygulama_0.v`) aus.
- **Zusammenfassende Bewertungskarten**: Berechnet prozentuale Punktzahlen, Timing-Genauigkeit und funktionale Abdeckung.
- **Testvektor-Matrix**: Führt Soll- und Ist-Signalwerte über jeden Simulationsschritt detailliert auf.
- **Markdown-Bewertungskarten-Export**: 1-Klick-Generierung formatierter Labor-Einreichungsberichte für Dozenten.
