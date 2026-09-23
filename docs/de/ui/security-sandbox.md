# Projekt-Vertrauen & Arbeitsbereich-Sandbox-Isolation

Axiom EDA wurde für sicheres digitales Hardware-Design entwickelt. Da Hardware-Beschreibungsdateien und Simulationsmodelle komplexe prozedurale Schleifen ausführen oder externe Speicherinhalte importieren können, implementiert Axiom ein **Projekt-Vertrauensberechtigungssystem**, einen **nativen Host-Dateisystem-Sandbox-Schutz** und **konfigurierbare Speicherkontingente** in Luft- und Raumfahrtqualität.

---

## Projekt-Vertrauensberechtigungssystem

Beim Öffnen oder Importieren eines externen Projektpakets (`.json`) aus einer nicht vertrauenswürdigen Quelle oder von Kollegen schützt Axiom den Host-Rechner, indem das Projekt standardmäßig im **eingeschränkten Modus** geöffnet wird.

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### Matrix: Eingeschränkter vs. Vertrauenswürdiger Modus

| Funktion | Eingeschränkter Modus | Vertrauenswürdiger Modus |
| :--- | :--- | :--- |
| **Simulationsausführung** | Erlaubt (strikte Schleifenbegrenzung) | Erlaubt (volle Leistung) |
| **Max. Delta-Zyklen (\(\delta\))** | 50.000 Zyklen / Schritt | 100.000 Zyklen / Schritt (konfigurierbar) |
| **Speicherzuweisungslimit** | 64 KWords (256 KB) | 16 MWords (64 MB) |
| **Host-Dateisystem-Export** | Blockiert | Erlaubt |
| **Datenverzeichnis-Isolation** | Strikt erzwungen (`.axiom/data/`) | Standardmäßig erzwungen |
| **Kopfzeilen-Indikator** | `[ Eingeschränkter Modus ]` Schild-Warnung | Dezentes Projekt-Badge |

Entwickler können den Vertrauensstatus jederzeit durch Klicken auf das Badge `[ Eingeschränkter Modus ]` in der Kopfzeile oder über **Projekteinstellungen & Sicherheit...** im Projektmenü ändern.

---

## Nativer Host-Dateisystem-Sandbox-Schutz

Bei nativen Desktop-Installationen (Tauri v2) erzwingt Axiom eine Pfadeingrenzung im Rust-Backend (`crates/desktop/src/lib.rs`) über `validate_sandboxed_path`:

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### Sandbox-Schutzmechanismen
1. **Plattformübergreifende Pfadnormalisierung**: Konvertiert Windows-Backslashes (`\`) und Unix-Slashes (`/`) automatisch und entfernt wörtliche Präfixe (`\\?\`).
2. **Pfadüberquerungs-Blockierung**: Verbietet `..`-Elternverzeichnis-Sequenzen sowohl in der rohen Eingabezeichenkette als auch im aufgelösten kanonischen Pfad strikt.
3. **Blacklist für sensible Systemverzeichnisse**: Verbietet das Lesen oder Schreiben in betriebssystemkritischen Verzeichnissen:
   - Linux/macOS: `/etc`, `/proc`, `/sys`, `/boot`, `/root`, `/bin`, `/sbin`, `/usr`
   - Windows: `C:\Windows`, `C:\System32`, `C:\Program Files`
4. **Quarantäne für Anmeldeinformationsspeicher**: Blockiert alle Operationen, die auf private Schlüssel, Anmeldeinformationen und Authentifizierungsspeicher zugreifen:
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Tauri-IPC-Befehlsabdeckung**: Jeder Dateisystem-IPC-Aufruf (`fs_read_file`, `fs_write_file`, `fs_remove_file`, `fs_list_dir`, `fs_create_dir`, `fs_exists`) wird durch `validate_sandboxed_path` geschützt. Nicht autorisierte Pfadanfragen geben sofort einen `[SandboxViolation]`-Fehler zurück.

---

## Konfigurierbare Speicherkontingente

Um zu verhindern, dass ausufernde Simulations-Trace-Dateien (`.vcd`, `.saif`) oder Endlosschleifen den Festplattenspeicher des Hosts erschöpfen, erzwingt Axiom Speicherkontingente auf Byte-Ebene:

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### Optionen für Speicherkontingente
- **10 MB**: Minimaler Speicherbedarf für leichtgewichtige Praktika auf Gatterebene.
- **25 MB**: Geeignet für Standard-FSMs und kleine Prozessordesigns.
- **50 MB (Standard)**: Standard-Entwicklungskontingent für Tausende von Simulationszyklen und Signalverlaufsaufzeichnungen.
- **100 MB / 250 MB / 500 MB**: Erweiterte Grenzwerte für tiefe Verifikationsläufe, Multi-Megabyte-VCD-Signalverläufe und Post-Synthese-Netzlisten.
- **Unbegrenzt**: Unbeschränkte Zuweisung für umfangreiche Enterprise-Projekte.

Die Kontingenterzwingung ist sowohl in der Browser-IndexedDB (`BrowserIndexedDbFileSystem`) als auch im nativen Desktop-Speicher (`TauriIpcFileSystem`) aktiv. Versuche, über das Kontingent hinaus zu schreiben, lösen eine saubere `[StorageQuota]`-Ausnahme aus, ohne die Laufzeitumgebung zu destabilisieren.

---

## Dediziertes Verzeichnis für generierte Daten (`.axiom/data/`)

Axiom isoliert alle generierten Ausgaben in einem dedizierten Unterordner des Arbeitsbereichs:
- Value Change Dumps (`.vcd`)
- Dateien im Switching Activity Interchange Format (`.saif`)
- Statische Timing-Berichte (`timing_report.txt`)
- Zugeordnete strukturelle Verilog-Netzlisten (`synth_netlist.v`)
- Protokoll-Paketerfassungen (`.pcap`)

### 1-Klick-Datenbereinigungs-Subsystem
Das **Projekt-Sicherheits-Modal** bietet eine 1-Klick-Schaltfläche **Generierte Daten bereinigen**. Dieser Vorgang löscht den gesamten Inhalt von `.axiom/data/` und setzt die Speichernutzung sofort auf die reinen Quelldateien zurück, ohne Verilog-, SystemVerilog-, VHDL- oder XDC-Dateien zu modifizieren oder zu löschen.
