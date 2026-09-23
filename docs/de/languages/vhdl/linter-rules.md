# VHDL-Sprachserver & Linter-Regeln

Axiom EDA enthält einen dedizierten VHDL-Sprachserver (`crates/lsp/src/vhdl.rs`), der Syntaxüberprüfung, Typkonsistenzprüfungen und Designregelprüfungen direkt im Monaco-Editor bereitstellt.

---

## Diagnoseregeln für VHDL

| Regel-ID | Schweregrad | Beschreibung | Behebung |
| :--- | :--- | :--- | :--- |
| `VHDL_W001` | Warnung | **Unvollständige Sensitivitätsliste**: Ein in einem kombinatorischen Prozess gelesenes Signal fehlt in der Sensitivitätsliste. | Fügen Sie das fehlende Signal zu `process(...)` hinzu oder verwenden Sie `process(all)` (VHDL-2008). |
| `VHDL_W002` | Warnung | **Inferierter Latch**: Unvollständige `if-then-else`- oder `case-when`-Zweige in einem kombinatorischen Prozess inferieren einen unerwünschten transparenten Latch. | Decken Sie alle Zweige ab oder weisen Sie vor bedingten Prüfungen einen Standardwert zu. |
| `VHDL_E001` | Fehler | **Typ-Fehlanpassung**: Versuch, `std_logic_vector` ohne Konvertierung direkt an `unsigned` oder `integer` zuzuweisen. | Verwenden Sie explizites `to_integer()`, `unsigned()` oder `std_logic_vector()`. |
| `VHDL_W003` | Warnung | **Ungenutztes Signal**: Ein deklariertes Architektursignal wird weder zugewiesen noch gelesen. | Tote Signaldeklaration entfernen. |
| `VHDL_E002` | Fehler | **Mehrfachtreiber-Kollision**: Mehrere nebenläufige Zuweisungen treiben dasselbe aufgelöste Signal. | Verwenden Sie eine einzelne gemultiplexte Zuweisung. |
