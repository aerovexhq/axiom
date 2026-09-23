# Monaco HDL Code-Editor & Sprachserver

Der Axiom HDL Code-Editor integriert den Monaco-Editor von Microsoft mit einem In-RAM-Language-Server-Protocol-(LSP)-Daemon für Verilog, SystemVerilog und VHDL (`crates/lsp`). Er vereint Syntax-Highlighting, statische Echtzeit-Designregelprüfung, AST-Hover-Tooltips und Autovervollständigungs-Snippets in einer IDE von Luft- und Raumfahrtqualität.

---

## Der Monarch HDL-Tokenizer

Axiom verfügt über einen maßgeschneiderten Monarch-Tokenizer, der speziell für IEEE 1364 Verilog, IEEE 1800 SystemVerilog und IEEE 1076 VHDL entwickelt wurde.

### Visuelles Styling (`axiom-dark`)
Der Editor ist im dunklen Farbschema von Axiom gestaltet:
- **Schlüsselwörter** (`module`, `always_ff`, `assign`, `wire`, `reg`): Kontrastreiches Zyan (`#00f0ff`)
- **System-Tasks & -Funktionen** (`$display`, `$finish`, `$time`, `$clog2`): Violett (`#a855f7`)
- **Zeichenketten (Strings)**: Bernstein (`#fbbf24`)
- **Zahlen & Literale mit Größenangabe** (`8'hFF`, `1'b0`, `32'd100`): Smaragdgrün (`#34d399`)
- **Kommentare** (`//`, `/* ... */`): Gedämpftes Schiefergrau (`#64748b`)
- **Bezeichner & Signalnamen**: Sanftes Weiß (`#f1f5f9`)

---

## Echtzeit-Statischer Linter im RAM

Im Gegensatz zu veralteten Werkzeugen, die mehrminütige Kompilierungs-Pipelines benötigen, um Syntaxfehler oder Design-Hazards zu melden, arbeitet der Linter von Axiom kontinuierlich im RAM mit einem Debounce-Fenster von 250 ms.

### Integrierte statische Designregeln

| Regel-ID | Schweregrad | Name | Beschreibung & Verhinderter Hazard |
| :--- | :--- | :--- | :--- |
| `AXIOM_W001` | Warnung | **Blockierende Zuweisung in sequenziellem Block** | Die Verwendung blockierender Zuweisungen (`=`) in getakteten Blöcken (`always @(posedge clk)`) führt zu Race Conditions zwischen Simulation und Synthese. |
| `AXIOM_W002` | Warnung | **Nicht-blockierende Zuweisung in kombinatorischem Block** | Die Verwendung nicht-blockierender Zuweisungen (`<=`) in kombinatorischen Blöcken (`always @*`) erzeugt Multi-Delta-Race-Hazards und Synthese-Diskrepanzen. |
| `AXIOM_W003` | Warnung | **Nicht angesteuertes Netz** | Ein deklariertes Wire oder Netz hat keinen kontinuierlichen Treiber (`assign`), Primitiven-Ausgang oder Submodul-Treiber. |
| `AXIOM_W004` | Warnung | **Ungenutztes Signal** | Ein deklariertes Register oder Netz wird geschrieben, aber in keinem nachfolgenden Logikkonus gelesen. |
| `AXIOM_E002` | Fehler | **Mehrfachtreiber-Kollision** | Mehrere kontinuierliche Zuweisungen oder simultane Treiber treiben dasselbe Netz und verursachen elektrische Kurzschlüsse und `X`-Konflikte. |
| `AXIOM_W006` | Warnung | **Transparenter Latch inferiert** | Unvollständige bedingte Zweige (`if` ohne `else`, oder `case` ohne alle Zweige) inferieren unbeabsichtigte transparente Latches. |
| `AXIOM_W007` | Warnung | **Fehlender case-Default** | Eine `case`-Anweisung enthält keinen `default:`-Zweig, was das Hängenbleiben in nicht abgedeckten Vektoren riskiert. |
| `AXIOM_W008` | Warnung | **Bitbreiten-Fehlanpassung** | Netz- oder Port-Zuweisungsbreite weicht zwischen linken und rechten Ausdrücken ab, was zu stiller Bit-Abschneidung führt. |

Wellenlinien heben fehlerhafte Token direkt im Editor hervor. Ein Klick auf eine Fehlerkarte im Dock **Probleme & Linter** springt mit dem Cursor sofort zur exakten Zeile und Spalte.

---

## AST-Hover-Karten

Das Bewegen des Mauszeigers über einen beliebigen Bezeichner im Editor öffnet einen interaktiven AST-Metadaten-Tooltip:
- **Signal-Deklaration**: Zeigt Netztyp (`wire`, `reg`, `logic`), Bitbereich (`[31:0]`) und Vorzeichen an.
- **Treiber-Position**: Zeigt die genaue Zeilennummer an, in der das Signal zugewiesen oder angesteuert wird.
- **Xilinx-Primitiven-Dokumentation**: Das Bewegen des Mauszeigers über Hardwareprimitiven (`LUT6_2`, `DSP48E2`, `RAMB36E2`, `BUFG`, `CARRY8`) blendet vollständige Pinbelegungsdokumentationen, Wahrheitstabellenparameter und Verhaltensbeschreibungen ein.

---

## Intelligente Autovervollständigung

Der Language Server von Axiom liefert sofortige Autovervollständigungen:
- **IEEE 1364/1800-Schlüsselwörter**: Automatische Grundgerüst-Generierung für `module`, `always_ff`, `always_comb`, `case` und `generate`.
- **System-Tasks**: Formatierte Argumentvorlagen für `$display`, `$monitor`, `$finish` und `$dumpvars`.
- **Gültige Signale im Gültigkeitsbereich**: Schlägt Netze, Register und Parameter vor, die innerhalb der aktiven Modulhierarchie deklariert sind.
- **Xilinx 7-Series / UltraScale+ Primitiven**: Vollständige Port-Mapping-Instanziierungsvorlagen für Hardwarezellen.

---

## Editor-Ergonomie & Persistenz

- **Multi-Tab-Dateiverwaltung**: Öffnen Sie mehrere Designquellen gleichzeitig. Aktive Datei-Reiter bleiben über Browser-Neuladevorgänge hinweg erhalten.
- **Breadcrumb-Navigation**: Die Pfadleiste über dem Editor zeigt das aktuelle Projekt, den Dateisatz, die aktive Datei und das übergeordnete Modul an.
- **Persistenz der Ansichtsposition**: Die Scroll-Position im Monaco-Editor (vertikale Zeile und horizontaler Offset) wird pro Datei in `localStorage` zwischengespeichert, sodass die Rückkehr zu einer Datei die exakte Ansicht wiederherstellt.
