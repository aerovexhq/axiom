# Axiom Studio Arbeitsbereichsübersicht

Axiom Studio ist eine plattformübergreifende Benutzeroberfläche für Electronic Design Automation (EDA) in Luft- und Raumfahrtqualität, nativ in Rust und React 19 entwickelt. Sie bietet einen einheitlichen, hochperformanten Arbeitsbereich, der einen responsiven Monaco-HDL-Code-Editor mit synchronisierten Gatterschaltplänen, digitalen Signalverläufen, taktilen Hardware-Breadboards, statischen Timing-Analysatoren und physischem Silizium-Floorplanning verbindet.

---

## Arbeitsbereich-Architektur

Axiom Studio verabschiedet sich von den trägen, fragmentierten Mehrfenster-Oberflächen herkömmlicher EDA-Tools zugunsten eines zusammenhängenden Dual-Pane-Arbeitsbereichs:

```
+-------------------------------------------------------------------------------+
| Header: Brand | File Sets | Simulation Ribbon (Run, Step, Reset) | PDN Gauges |
+---------------------------------------+---------------------------------------+
| Left Pane (Monaco HDL Editor)         | Right Pane (Dynamic Visualizers)      |
|                                       | - Schematic DAG Visualizer            |
| - Verilog / SystemVerilog / VHDL      | - Virtual Lab & Basys 3 FPGA Bay      |
| - In-RAM LSP Real-Time Linter         | - Waveforms & Logic Analyzer          |
| - Monarch Tokenizer & Autocomplete    | - Timing Radar & Static Timing        |
| - AST Hover Cards & Breadcrumbs       | - Technology Mapping Studio           |
|                                       | - Floorplanning & Silicon Die         |
|                                       | - Formal Verification (BMC)           |
|                                       | - Protocol Analyzer & Dissector       |
|                                       | - Microarchitecture & Multi-Die       |
+---------------------------------------+---------------------------------------+
| Unified Bottom Dock: Console & REPL | Problems & Linter | Telemetry Radar     |
+-------------------------------------------------------------------------------+
```

### 1. Kopfzeile & Simulationsbefehlsleiste
Die obere Navigationsleiste beherbergt Projektidentitäts-Tags, die Vivado-Dateisatzauswahl und die Simulationsausführungsleiste. Sie ermöglicht sofortiges Kompilieren, Ausführen, Anhalten, diskretes Delta-Zyklus-Stepping und das Zurückspulen der Simulationszeit. Echtzeit-Telemetrieanzeigen für das Stromversorgungsnetz (PDN) melden die dynamische Leistung in Milliwatt ($P$), den induktiven Spannungsabfall ($V_{\text{sag}}$) und den gesamten Versorgungsstrom ($I$).

### 2. Linker Bereich: Monaco HDL Code-Editor
Eine angepasste Instanz des Microsoft Monaco-Editors, konfiguriert mit Axioms Monarch Verilog/SystemVerilog-Tokenizer, dunklem Acryl-Design (`axiom-dark`), Echtzeit-AST-Hover-Tooltips und In-RAM-Language-Server-Protocol-(LSP)-Diagnosen.

### 3. Rechter Bereich: Visualisierungs-Bucht
Eine Arbeitsfläche über die volle Höhe und Breite für die visuellen Analysewerkzeuge von Axiom:
- **Schematischer DAG**: Echtzeit-Visualisierer für Netzlisten auf IEEE-Gatterebene mit kollisionsfreier orthogonaler Kanal-Leitungsführung.
- **Virtuelles Labor**: Taktiles Hardware-Breadboard mit Schaltern, LEDs und 7-Segment-Anzeigen des Digilent Basys 3 Artix-7-Boards.
- **Signalverläufe**: Digitaler Logikanalysator mit 60+ FPS, Drag-to-Measure-Messfenstern und Null-Zeit-Delta-Zyklus-Inspektion.
- **Timing-Radar**: Topologische statische Timing-Analyse zur Anzeige von Wasserfalldiagrammen kritischer Pfade und Setup-/Hold-Slack-Histogrammen.
- **Technologie-Mapping**: Technologie-Mapping auf Gatterebene, das RTL in Ziel-FPGA-Primitiven (LUTs, DSP48E2, RAMB36E2) absenkt.
- **Floorplanning**: 2D-Silizium-Die-Floorplanning-Studio zur Anzeige von CLB-Site-Platzierungen, thermischen Heatmaps und Routing-Luftlinien.
- **Formale Verifikation**: Bounded Model Checking (BMC) und $k$-Induktions-Verifikation für SystemVerilog-Assertionen.
- **Protokoll-Analysator**: Hardware-Seriell-Dissektoren für UART, SPI, I2C, CAN-Bus, USB und Ethernet.
- **Mikroarchitektur**: Automatische Datenpfad-Erkennung, ALU-Inspektoren, RegFile-Speicheransichten und FSM-Zustandsblasengraphen.

### 4. Zentraler verstellbarer Trennbalken
Ein responsiver Teiler, mit dem Ingenieure die Balance zwischen Editor und Visualisierer anpassen können. Axiom bietet dynamische Kamera-Mittelpunktverankerung: Das Ziehen des Teilers berechnet den Weltraum-Kameramittelpunkt der Arbeitsfläche kontinuierlich neu und verhindert so Verzerrungen oder Zoomverluste.

### 5. Vereinheitlichtes unteres Dock
Ein einklappbares Dock, das sekundäre Analysewerkzeuge in übersichtlichen Reitern organisiert:
- **Konsole & REPL**: Interaktive Verilog-Compiler-Ausgaben, Protokollierung von `$display`-Anweisungen und Simulationsstatus.
- **Probleme & Linter**: Aktive Diagnosekarten mit 1-Klick-Zeilennavigation zu Syntax- und Designregelwarnungen.
- **Telemetrie**: Analoge Silizium-Telemetrie-Messgeräte für Kern-Versorgungsspannung, induktiven Spannungsabfall und Schaltstrom.
- **Signalverlaufs-Vorschau**: Kompakte Signalverlaufsansicht beim Arbeiten in geteilten Schaltplanmodi.

---

## Globale Tastenkürzel

| Tastenkürzel | Aktion | Beschreibung |
| :--- | :--- | :--- |
| `Strg + S` / `Cmd + S` | **Projekt speichern** | Speichert alle Designdateien und Metadaten auf Festplatte oder IndexedDB |
| `Strg + Enter` / `Cmd + Enter` | **Kompilieren & Ausführen** | Kompiliert aktives Design via Cranelift-JIT im RAM und startet den Takt |
| `Leertaste` | **Starten / Anhalten** | Schaltet die Ausführung der Simulations-Engine um |
| `F10` | **Schritt +1 ns** | Schreitet in der physischen Simulationszeit um exakt 1.000 Pikosekunden voran |
| `Umschalt + F10` | **Schritt +100 ps** | Schreitet in der physischen Simulationszeit um exakt 100 Pikosekunden voran |
| `F11` | **Delta-Schritt (\(\delta\))** | Führt einen einzelnen diskreten Null-Zeit-Auswertungszyklus aus, ohne die physische Zeit voranzutreiben |
| `Strg + R` / `Cmd + R` | **Simulation zurücksetzen** | Spult den Simulations-Takt auf \(t=0\) zurück und stellt initiale Signalvektoren wieder her |
| `Strg + Alt + F` | **Floorplan-Studio** | Öffnet den visuellen Editor für das physische FPGA-Silizium-Floorplanning |
| `Strg + P` / `Cmd + P` | **Datei schnell öffnen** | Öffnet die Omnibar-Suchpalette, um durch Projektquellen zu springen |
| `Strg + \`` | **Unteres Dock ein-/ausklappen** | Klappt das vereinheitlichte untere Dock aus oder ein |
| `Strg + B` / `Cmd + B` | **Seitenleiste ein-/ausblenden** | Zeigt oder blendet die Vivado-Projektdateisatz-Seitenleiste ein |
| `Escape` | **Modal schließen / Abwählen** | Schließt aktive Dialoge, Inspektoren oder hebt die Netzauswahl auf |

---

## Mobiles Studio & Responsiver Drawer

Beim Betrieb auf Mobilgeräten oder in schmalen Browserfenstern (Breite \(\le 768\text{px}\)) passt sich Axiom Studio automatisch an:
- Mehrteilige anpassbare Trennbalken werden deaktiviert, um überfüllte Ansichten zu vermeiden.
- Ein seitlich ausfahrbares Drawer-Menü (`MobileDrawer.tsx`) bietet Zugriff auf Projektdateisätze, Simulationssteuerungen und Ansichtsauswahl.
- Die Benutzeroberfläche wird im Modus **1 Panel gleichzeitig** dargestellt, wobei 100% der Bildschirmbreite und -höhe der aktiven Ansicht zugewiesen werden.
- Eine daumenfreundliche mobile Bodenleiste (`MobileBottomBar.tsx`) bietet 5 zentrale Navigations-Reiter: **Code**, **Schaltplan**, **Labor**, **Signale** und **Konsole**, komplett mit Live-Problem-Badges.
