# Axiom Statischer Linter & Diagnoseregeln

Axiom EDA enthält einen statischen Echtzeit-Analyse-Linter im RAM (`crates/lsp/src/linter.rs`). Der Linter analysiert abstrakte Syntaxbäume und die Netzlisten-Konnektivität, um Synthese-Hazards, Simulations-Race-Conditions und elektrische Fehler bereits während der Codeeingabe zu erkennen.

---

## Katalog der Diagnoseregeln

```
+-------------------------------------------------------------------------------+
| Axiom Static Linter Dashboard (Problems Dock)                                 |
| 0 Errors | 2 Warnings | 1 Informational | Real-Time Latency: 1.8 ms           |
+-------------------------------------------------------------------------------+
| [AXIOM_W001] Line 42: Blocking assignment (=) inside clocked sequential block |
| [AXIOM_W007] Line 88: Case statement missing default branch                   |
+-------------------------------------------------------------------------------+
```

### 1. `AXIOM_W001`: Blockierende Zuweisung im sequenziellen Prozess
- **Schweregrad**: Warnung
- **Verletzung**: Verwendung von `=` anstelle von `<=` innerhalb eines flankengesteuerten Prozesses (`always @(posedge clk)`).
- **Hazard**: Führt zu simulatorabhängigen Race Conditions, bei denen Registerwerte je nach Thread-Ausführungsreihenfolge vor oder nach der Aktualisierung gelesen werden.
- **Behebung**: Ersetzen Sie `=` durch `<=`. 

### 2. `AXIOM_W002`: Nicht-blockierende Zuweisung im kombinatorischen Prozess
- **Schweregrad**: Warnung
- **Verletzung**: Verwendung von `<=` innerhalb eines pegelgesteuerten Prozesses (`always @*` oder `always @(a or b)`).
- **Hazard**: Verursacht unnötigen Simulations-Delta-Zyklus-Overhead und potenzielle Diskrepanzen zur Synthese.
- **Behebung**: Ersetzen Sie `<=` durch `=`.

### 3. `AXIOM_W003`: Nicht angesteuertes Netz
- **Schweregrad**: Warnung
- **Verletzung**: Ein deklariertes `wire` oder Netz besitzt keinen kontinuierlichen Treiber (`assign`), Gatterausgang oder Submodul-Portanschluss.
- **Hazard**: Das Netz bleibt permanent hochohmig (`Z`) oder unbekannt (`X`) unbeschaltet.
- **Behebung**: Fügen Sie einen Treiber hinzu oder entfernen Sie die ungenutzte Netzdeklaration.

### 4. `AXIOM_W004`: Ungenutztes Signal
- **Schweregrad**: Warnung
- **Verletzung**: Ein deklariertes Register oder Netz wird geschrieben oder definiert, aber in keinem nachgelagerten Logikkonus gelesen.
- **Hazard**: Unnötige Siliziumfläche und überflüssige Gatterinferenz.
- **Behebung**: Entfernen Sie das ungenutzte Signal oder verbinden Sie es mit dem Zielverbraucher.

### 5. `AXIOM_E002`: Mehrfachtreiber-Kollision
- **Schweregrad**: Fehler
- **Verletzung**: Mehrere kontinuierliche Zuweisungen oder gleichzeitige Treiber treiben dasselbe `wire` an.
- **Hazard**: Elektrischer Kurzschluss auf dem physischen Silizium; wird in der Simulation als Kollisions-Unbekannt (`X`) ausgewertet.
- **Behebung**: Fügen Sie einen Multiplexer ein oder stellen Sie sicher, dass nur ein einzelner Treiber das Netz ansteuert.

### 6. `AXIOM_W006`: Transparenter Latch inferiert
- **Schweregrad**: Warnung
- **Verletzung**: Ein kombinatorischer Prozess lässt eine Zielvariable entlang eines oder mehrerer bedingter Ausführungspfade unzugewiesen.
- **Hazard**: Synthese-Tools inferieren einen asynchronen, pegelgesteuerten Latch, was zu gravierenden Timing-Closure-Problemen und Takt-Glitch-Empfindlichkeit führt.
- **Behebung**: Stellen Sie sicher, dass alle Variablen in jedem `if-else`-Zweig zugewiesen werden, oder weisen Sie zu Beginn des `always @*`-Blocks einen Standardwert zu.

### 7. `AXIOM_W007`: Fehlender case-Default-Zweig
- **Schweregrad**: Warnung
- **Verletzung**: Eine `case`-Anweisung lässt den `default:`-Zweig aus.
- **Hazard**: Nicht abgedeckte Eingangskombinationen führen zu Latch-Inferenzen oder blockieren Zustandsautomaten.
- **Behebung**: Fügen Sie `default: <safe_state>;` hinzu.

### 8. `AXIOM_W008`: Bitbreiten-Fehlanpassung
- **Schweregrad**: Warnung
- **Verletzung**: Die Bitbreite des linksseitigen Netzes stimmt nicht mit der Bitbreite des rechtsseitigen Ausdrucks überein.
- **Hazard**: Stummes Abschneiden des höchstwertigen Bits (MSB) oder unbeabsichtigte Null-/Vorzeichenerweiterung.
- **Behebung**: Passen Sie Bitbreiten explizit an oder verwenden Sie Teilbereichs-Slicing.
