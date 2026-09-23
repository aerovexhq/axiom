# Projekte- & Dateisatz-Lebenszyklus

Axiom EDA implementiert ein authentisches Projektmanagementsystem auf Vivado-Niveau, kombiniert mit leichtgewichtiger Web-Persistenz und nativer Dateisystemintegration auf dem Desktop. Projekte trennen strikt zwischen Design-RTL-Quellen, Simulations-Testbenches und physischen/zeitlichen Constraints.

---

## Das Willkommens-Launchpad

Wird Axiom ohne geöffnetes Projekt gestartet, zeigt es ein übersichtliches Willkommens-Launchpad in Luft- und Raumfahrtqualität:

```
+-------------------------------------------------------------------------------+
| Axiom EDA v1.0.0 — In-RAM Cranelift JIT & Silicon Telemetry Engine            |
+---------------------------------------+---------------------------------------+
| [ Create New Project ]                | [ Open Project from File ]            |
| Wizard with device selection          | Import serialized .json bundle        |
+---------------------------------------+---------------------------------------+
| Starter Engineering Blueprints (1-Click Launch):                              |
| 1. Logic Circuit (Gate-Level Booleans)| 5. SPI Master Controller              |
| 2. UART Transceiver (115200 Baud)     | 6. FSM Traffic Controller             |
| 3. Synchronous FIFO Buffer (32x8)     | 7. IUC Cerrahpasa Digital Logic Lab   |
| 4. 32-Bit Arithmetic Logic Unit (ALU) |                                       |
+-------------------------------------------------------------------------------+
| Recent Projects: [ Active Projects (3) ]  |  [ Trashed Projects (1) ]         |
+-------------------------------------------------------------------------------+
```

### Starter-Vorlagen
Axiom bietet 7 praxiserprobte Starter-Vorlagen:
1. **Kombinatorischer Logikschaltkreis**: Boolesches Logiksystem auf Gatterebene zur Berechnung von \(F = ((\neg A \land B) \land C) \lor \neg B\) mit 9 Gatterzellen (`inv1`, `inv2`, `and1`, `and2`, `or1`) und dedizierter taktiler Bucht im Virtuellen Labor.
2. **UART-Transceiver**: Vollständige Sender- und Empfänger-Pipeline mit 8 Datenbits, 1 Stoppbit, Überabtastungs-Taktgenerator und Statusregistern.
3. **Synchroner FIFO-Puffer**: 32x8 zirkulärer Ringspeicher mit Doppelzeigern und Status-Flags für voll, leer, fast-voll und fast-leer.
4. **32-Bit-ALU**: Arithmetisch-logische Einheit zur Implementierung von IEEE-vorzeichenbehafteten Additionen, Subtraktionen, Barrel-Shifts, Vergleichen und boolescher Logik mit Null-Flag- und Überlauferkennung.
5. **SPI-Master**: Für Motorsteuerungen geeignetes Serial Peripheral Interface, das die Modi 0, 1, 2 und 3 mit programmierbaren Taktteilern unterstützt.
6. **FSM-Verkehrssteuerung**: Endlicher Zustandsautomat für eine 4-Wege-Kreuzung mit Grün-, Gelb- und Rot-Phasen, Fußgängeranforderungs-Latches und Zeitzählern.
7. **IUC Cerrahpasa Digital-Logik-Labor**: Praktikumsprojekt der Universität Istanbul - Cerrahpasa mit `uygulama_0.v`, automatisierten Testbenches und Basys 3 Artix-7-Constraints.

---

## Vivado-Dateisatz-Struktur

Axiom organisiert Projektdateien in standardmäßige Vivado-Dateisatzkategorien:

```
project_root/
|-- sources_1/           # Design Sources
|   |-- logic_circuit.v  # Primary RTL implementation [TOP]
|   `-- uart_tx.v        # Submodules
|-- sim_1/               # Simulation Sources
|   `-- tb_circuit.v     # Testbench harness
`-- constrs_1/           # Physical & Timing Constraints
    `-- timing.xdc       # XDC pinouts and clock declarations
```

### 1. Design-Quellen (`sources_1`)
Enthält alle synthetisierbaren Hardware-Module, die in Verilog, SystemVerilog oder VHDL implementiert sind.
- **Top-Modul-Kennzeichnung (`[TOP]`)**: Das aktive Wurzelmodul für Synthese, Schaltplangenerierung und physisches Floorplanning. Sie können jedes Modul über das 3-Punkte-Menü auf der Dateikarte als Top-Modul festlegen.
- **Aktion Quelle hinzufügen (`+`)**: Durch Klicken auf die Schaltfläche `+` in der Kopfzeile der Design-Quellen wird `AddSourceModal` geöffnet, wobei die Kategorie `sources_1` vorausgewählt ist.

### 2. Simulations-Quellen (`sim_1`)
Enthält Testbench-Umgebungen (`tb_*.v`), Stimulus-Vektoren und Verifikationssequenzen. Testbench-Dateien sind von der physischen Synthese und dem Technologie-Mapping ausgeschlossen, um Fehlwarnungen über Mehrfachtreiber oder ungebundene Pins zu vermeiden.

### 3. Constraints (`constrs_1`)
Enthält Xilinx Design Constraints (`.xdc`)-Dateien zur Definition von FPGA-Gehäuse-Pinbelegungen (`PACKAGE_PIN`, `IOSTANDARD`) und Taktzielen für die Statische Timing-Analyse (`create_clock`).

---

## Projekt-Kopfzeilenmenü (`ProjectDropdown`)

Das Projekt-Dropdown-Badge oben links bietet direkten Zugriff auf die wichtigsten Lebenszyklus-Operationen:
- **Projekt speichern (`Strg + S`)**: Schreibt alle Editor-Puffer auf die Festplatte (Desktop) oder in IndexedDB (Web) mit sofortiger visueller Bestätigung.
- **Projekt-Bundle exportieren (`.json`)**: Erzeugt eine in sich geschlossene, portable JSON-Datei, die alle Dateisätze, FPGA-Zielbausteinnummern, das aktive Top-Modul und Sicherheits-Flags bündelt.
- **Quelle hinzufügen...**: Startet den Assistenten zur Erstellung von Quelldateien verschiedener Formate.
- **Projekteinstellungen & Sicherheit...**: Konfiguriert den Projekt-Vertrauensmodus, Speicherkontingente, Datenisolation und Simulations-Sicherheitsgrenzen.
- **Assistent für neue Projekte**: Startet den Projekterstellungs-Assistenten.
- **Projekt schließen**: Speichert den aktiven Zustand sicher und kehrt zum Willkommens-Launchpad zurück, ohne ungespeicherte Änderungen zu verlieren.

---

## Projekt-Papierkorb- & Wiederherstellungs-Lebenszyklus

Um versehentlichen Datenverlust zu verhindern, implementiert Axiom einen zweistufigen Löschlebenszyklus:
1. **In den Papierkorb verschieben**: Zugänglich über die 3 vertikalen Punkte auf jeder Projektkarte im Launchpad. In den Papierkorb verschobene Projekte setzen sofort `isTrashed: true`, verschwinden aus dem Reiter Aktiv und erhöhen den Zähler des Papierkorbs.
2. **Zugriff auf gelöschte Projekte**: Durch Klicken auf den Reiter **Papierkorb** im Launchpad werden alle gelöschten Designs mit Löschdatum angezeigt.
3. **Projekt wiederherstellen**: Stellt das Projekt mit allen Dateien und Konfigurationen im Reiter Aktiv wieder her.
4. **Dauerhafte Löschung**: Öffnet ein Bestätigungs-Modal (`ConfirmModal.tsx`). Nach der Bestätigung werden die Projektdatensätze dauerhaft gelöscht und zugehörige Speicherverzeichnisse vom Dateisystem entfernt.
