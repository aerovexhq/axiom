# Desktop- & Web-Architektur

Axiom bietet eine einheitliche Dual-Target-Architektur: eine schlanke native Desktop-Anwendung und ein installationsfreies, 100% im Browser ausführbares WebAssembly-Engineering-Dashboard.

---

## Dual-Target-Übersicht

```
                        Axiom Core Architecture
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        Native Desktop Target                WebAssembly Target
        - Tauri v2 (Rust IPC)               - wasm32-unknown-unknown
        - Linux, macOS, Windows             - 100% Client-Side In-Browser
        - Direct Cranelift JIT in RAM       - Portable Evaluator in WebWorker
        - Sub-50 MB Binary                  - Zero Backend Server Dependencies
```

---

## Modernes Obsidian Dark Theme UI

Das Frontend wurde mit **React 19**, **TypeScript 5.7**, **PostCSS** und **Vite 6** entwickelt und bietet einen von Obsidian/Linear inspirierten dunklen Arbeitsbereich:

1. **Simulationssteuerungs-Kopfzeile**:
   - Diskrete Stepping-Steuerelemente: `Run Free`, `Pause`, `+1 ns`, `+100 ps` und `Step δ` (Null-Zeit-Delta-Zyklus (δ-Zyklus)).
   - Live-Telemetrieanzeigen: Simulationszeitstempel ($ps / ns$), aktiver Delta-Zyklus ($\delta$), transienter Spitzenstrom ($mA$) und maximaler Spannungsabfall ($mV$).
2. **Explorer für elaborierte Netzlistenhierarchien**:
   - Rekursive Strukturansicht von elaborierten Bereichen, Modulinstanzen, Registern, Wires und prozeduralen Prozessen.
   - Integrierter Vorlagen-Umschalter (ALU, Zähler mit Glitches, hierarchischer Core).
3. **Hochperformanter Canvas-2D-Signalverlaufsbetrachter**:
   - Virtualisiertes Rendern digitaler Logik mit 60+ FPS.
   - Eindeutige 4-Zustands-Logikfarben: 0 (Schiefergrau), 1 (Smaragdgrün), X (Rosa), Z (Bernstein).
   - Rautenförmige Multi-Bit-Busübergangshüllkurven mit zentrierten Hexadezimalwerten.
   - **Delta-Glitch-Lupe**: Hebt transiente Null-Zeit-Hazards mit rosa Bug-Flags hervor.
4. **Physikalische Silizium-Telemetrie-Diagramme**:
   - Analoge transiente Stromkurve ($I(t)$) mit zyanfarbenem Farbverlauf.
   - Induktiver Spannungsabfall der Versorgungsschiene ($V_{sag} = IR + L \frac{di}{dt}$).
   - Dynamische Übersichtskarten: Durchschnittliche Leistung ($mW$), Spitzenstrom ($mA$), maximaler Abfall ($mV$) und gesamte dissipierte Energie ($nJ$).
5. **Simulationskern-Konsole & Exportierer**:
   - Echtzeit-Ereignisprotokoll-Stream.
   - 1-Klick-Downloads für IEEE 1364 `.vcd`- und Synopsys `.saif`-Dateien.
