# Simulationsbefehlsleiste & Vereinheitlichtes Dock

Das Axiom-Simulationssteuerungssystem kombiniert eine Hochgeschwindigkeits-Ausführungs-Engine mit einer intuitiven Befehlsleiste und einem vereinheitlichten unteren Dock (`BottomConsole.tsx`, `UnifiedBottomDock.tsx`). Es bietet unmittelbare Kontrolle über physische Simulationszeit und diskrete Delta-Zyklen.

---

## Simulationsbefehlsleiste in der Kopfzeile

Die obere Kopfzeile zeigt Simulations-Telemetrie und Bedienelemente an:

```
+-------------------------------------------------------------------------------+
| [ Run ] [ Pause ] | [ +1 ns ] [ +100 ps ] [ Step Delta ] | [ Reset (t=0) ]    |
| Time: 125,400 ps (125.4 ns) | Delta: 0 | Core: 0.988 V | Power: 34.2 mW       |
+-------------------------------------------------------------------------------+
```

### Steuerungsaktionen
- **Starten (`Leertaste` / `Strg + Enter`)**: Startet kontinuierliches autonomes Takten im Hintergrund-Web-Worker oder in der Cranelift-JIT-Engine mit hoher Frequenz.
- **Pause (`Leertaste`)**: Hält die Simulationsausführung sofort an und friert alle Signalverläufe und Registerzustände zur Inspektion ein.
- **+1 ns (`F10`)**: Schreitet in der physischen Simulationszeit um exakt 1.000 Pikosekunden voran.
- **+100 ps (`Umschalt + F10`)**: Schreitet in der physischen Simulationszeit um exakt 100 Pikosekunden für feine Timing-Analysen voran.
- **Delta-Schritt (`F11`)**: Führt einen einzelnen diskreten Null-Zeit-Delta-Zyklus (δ-Zyklus, $\delta \to \delta + 1$) aus, ohne die physische Simulationszeit zu erhöhen, und deckt kombinatorische Race Conditions und Zwischen-Gatterübergänge auf.
- **Zurücksetzen (`Strg + R`)**: Spult die Simulationszeit auf $t=0$ zurück, setzt Signalvektoren auf Ausgangszustände zurück und hält das Design kompiliert, sodass die Ausführung sofort ohne erneute Elaborierung fortgesetzt werden kann.

---

## Reiter des vereinheitlichten unteren Docks

Das einklappbare Dock organisiert wesentliche sekundäre Entwicklungswerkzeuge:

### 1. Konsole & REPL
- Zeigt Compiler-Durchläufe, AST-Elaborierungsmetriken und aktive Modulinstanzen an.
- Streamt Echtzeit-Ausgaben von `$display`, `$write` und `$monitor` aus der Verilog-Simulation.
- Bietet eine interaktive Befehlszeile, um Signalausdrücke auszuwerten oder Netzwerte abzufragen.

### 2. Probleme & Linter
- Listet aktive statische Analysewarnungen und Syntaxfehler auf.
- Zeigt Regel-ID (`AXIOM_W001`, etc.), Schweregrad-Badges und Quelldateinamen an.
- Durch Klicken auf eine Problemkarte navigiert der Monaco-Editor sofort zur exakten fehlerhaften Zeile.

### 3. Telemetrie-Radar
- Zeigt analoge Echtzeit-Messanzeigen für Kernspannung, induktiven Abfall, Versorgungsstrom und dynamische Verlustleistung an.

### 4. Signalverlaufs-Dock
- Rendert eine zusätzliche Signalverlaufsvorschau, während das primäre Visualisierungsfenster auf Schaltpläne, Virtuelles Labor oder Timing-Radar fokussiert ist.
