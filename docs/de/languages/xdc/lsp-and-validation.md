# Monaco XDC Sprachserver & Validierung

Axiom EDA verfügt über ein dediziertes Language Server Protocol (LSP) und Syntax-Highlighting für Xilinx Design Constraints (`crates/lsp/src/xdc.rs`).

---

## Echtzeit-XDC-Syntaxüberprüfung

Der Monaco XDC-Sprachdienst arbeitet direkt in `.xdc`-Dateien im Editor:
- **Tcl-Befehlsvalidierung**: Erkennt `set_property`, `create_clock`, `create_generated_clock`, `set_input_delay`, `set_output_delay`, `set_false_path`, `set_clock_groups`, `set_multicycle_path`.
- **Kommentar-Verarbeitung**: Parst Zeilenkommentare, die mit `#` beginnen, präzise und verhindert falsche Syntaxwarnungen bei auskommentierten Pin-Konfigurationen.
- **Port-Abfrage-Validierung**: Überprüft, ob in `[get_ports <name>]` referenzierte Ports im aktiven Design-Top-Modul existieren.

---

## Intelligente Autovervollständigungen

Die Eingabe in eine `.xdc`-Datei löst kontextbezogene Autovervollständigungs-Snippets aus:
- **Gehäuse-Pin-Bindung**: `set_property PACKAGE_PIN <PIN> [get_ports <PORT>]`
- **E/A-Standard-Zuweisung**: `set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **Primärtakt**: `create_clock -period 10.000 -name <NAME> [get_ports <PORT>]`
- **Falscher Pfad**: `set_false_path -from [get_ports <PORT>]`
