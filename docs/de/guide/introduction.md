# Einführung & Projekt-Manifest

## Die Mission von Axiom EDA

**Axiom** ist eine von Grund auf neu entwickelte, hochperformante, plattformübergreifende Neugestaltung und Modernisierung der Hardware-Beschreibungssprachen-(HDL)-Verarbeitungs-, Simulations- und Analyse-Engine von AMD Vivado, nativ in **Rust** von **Aerovex** entwickelt.

Vivado ist der unangefochtene Industriestandard für die FPGA-Entwicklung, leidet jedoch unter jahrzehntelangem technischem Ballast:
- **100+ GB Installationen**, die komplexe Lizenz-Daemons und langwierige Setups erfordern.
- **Schwerfällige Java Swing-Oberflächen**, die Gigabytes an Speicher verbrauchen und beim Rendern von Signalverläufen einfrieren.
- **Mehrstufige dateibasierte Kompilierungs-Pipelines** (`xvlog` $\to$ Bibliotheksdatenbank $\to$ `xelab` $\to$ Snapshot-Binärdatei $\to$ `xsim`), die selbst für triviale HDL-Änderungen Minuten benötigen.
- **Vollständiges Fehlen von Unterstützung für moderne Plattformen** wie macOS (Apple Silicon M1/M2/M3/M4) oder Standard-Webbrowser.
- **Undurchsichtige Null-Zeit-Delta-Zyklen**, die transiente kombinatorische Race Conditions und Glitches vor Digitalentwicklern verbergen.

**Axiom beseitigt diese Einschränkungen.** Es liefert eine unter 50 MB große, verzögerungsfreie und tief introspektive Hardware-Simulations-Engine, gepaart mit einer von Obsidian inspirierten Desktop- und Web-Anwendung.

---

## Architektonische Kernsäulen

### 1. In-RAM Cranelift-JIT-Kompilierung
Axiom eliminiert C++-Zwischendateien, externe GCC/Clang-Aufrufe und Snapshot-Serialisierung. Elaborierte Hardware-Netzlisten und prozedurale Prozesse werden mit **Cranelift** (x86_64, AArch64) in unter 3 Millisekunden direkt im RAM in nativen Maschinencode kompiliert.

### 2. Manuelle Delta-Zeit-Tick & Ereignis-Warteschlangen-API
Im Gegensatz zu herkömmlichen Simulatoren, die die Simulationszeit blind vorantreiben oder Delta-Zyklen in einen einzigen Zeitstempel kollabieren, bietet Axiom eine einbettbare, aufrufergesteuerte Stepping-API:
- `engine.tick(delta_time)`: Physische Zeit um Pikosekunden oder Nanosekunden vorantreiben.
- `engine.step_delta()`: Einen einzelnen diskreten Delta-Zyklus ($\delta \to \delta + 1$) innerhalb der Null-Simulationszeit ausführen, um transiente Hazards aufzudecken, bevor sich Signale einschwingen.

### 3. Physikbasierte Spannungs-, Energie- & Leistungstelemetrie
Axiom bettet physikalische Grundlagengleichungen in jeden Signalübergang ein:
- **Dynamische Leistung**: $P_{\text{dynamic}} = \frac{1}{2} C_{\text{net}} V_{\text{dd}}^2 f \alpha$
- **Induktiver PDN-Spannungsabfall**: $V_{\text{sag}} = IR + L \frac{di}{dt}$
- Erfasst Mikrostromspitzen während Taktflanken, die in den statischen Schätzberichten von Vivado übersehen werden.

### 4. Plattformübergreifende Desktop- & Web-Architektur
Entwickelt mit **Tauri v2**, **React 19**, **TypeScript** und **Vite**, läuft Axiom nativ als Desktop-Anwendung unter Linux, macOS und Windows und kompiliert nahtlos nach **WebAssembly** (`wasm32-unknown-unknown`) für eine 100%ige Simulation im Browser.
