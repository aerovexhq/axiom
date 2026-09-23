# Schnellstart & Installation

Starten Sie mit **Axiom EDA** in weniger als 60 Sekunden.

---

## 1. Einzeilige Installation

Axiom bietet schlanke, in sich geschlossene eigenständige Binärdateien (<50 MB) ohne externe Toolchain-Anforderungen.

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

Das Installationsprogramm erkennt automatisch Ihr Betriebssystem und Ihre Architektur (`x86_64` oder `aarch64` / Apple Silicon), installiert die `axiom`-Binärdatei in `~/.axiom/bin` (oder `%USERPROFILE%\.axiom\bin`) und konfiguriert Ihren `$PATH`.

---

## 2. Release-Versionierung & benutzerdefinierte Flags

Sie können eine benutzerdefinierte Release-Version angeben oder den Zielpfad überschreiben.

### Eine bestimmte Version ansteuern

::: code-group

```bash [Linux & macOS (Env Var)]
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```bash [Linux & macOS (Flag)]
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --version v1.0.0
```

```powershell [Windows (Env Var)]
$env:AXIOM_VERSION="v1.0.0"; irm https://axiom.aerovex.net/install.ps1 | iex
```

```powershell [Windows (Parameter)]
& ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v1.0.0
```

:::

### Benutzerdefiniertes Installationsverzeichnis

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. Dediziertes Skript für die Quellcode-Kompilierung

Wenn Sie es vorziehen, aus dem Quellcode zu kompilieren oder die Engine zu modifizieren, enthält Axiom einen automatisierten Build-Treiber in `scripts/`:

### Linux & macOS (`scripts/build_from_source.sh`)

Klonen Sie das Repository und führen Sie den automatisierten Treiber aus:

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**Optionen des Build-Skripts:**

- `--cli-only`: Überspringen Sie Node/UI und erstellen Sie nur das headless Rust-CLI:
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>`: In ein benutzerdefiniertes System- oder Benutzerverzeichnis installieren:
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug`: Schnelle, nicht optimierte Debug-Kompilierung:
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

In PowerShell:
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. Manuelle Cargo-Kompilierung

Sie können Cargo auch direkt aufrufen:

```bash
cargo build --release --bin axiom
```

Die ausgegebene Binärdatei befindet sich unter `target/release/axiom`.

Überprüfen Sie Ihre Installation:
```bash
axiom --version
```

Ausgabe:
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. Kompilieren Sie Ihr erstes HDL-Design

Axiom enthält standardmäßig verifizierte Hardware-Testvorlagen in `tests/fixtures/`. Kompilieren Sie eine 32-Bit-ALU direkt im RAM in nativen Maschinencode:

```bash
axiom compile tests/fixtures/alu.v -t alu
```

Ausgabe:
```text
============================================================
 Axiom HDL In-RAM Compiler: tests/fixtures/alu.v
 Top-Level Target: alu
============================================================
  [1/3] Lexing & Parsing in 172.70µs
  [2/3] Elaboration: 6 nets, 1 processes, 1 continuous assigns in 218.86µs
  [3/3] In-RAM Cranelift JIT Compilation in 2.41ms
------------------------------------------------------------
 Compilation successful! Total latency: 2.81ms
 In-RAM Arena Footprint: 6 64-bit words (48 bytes)
============================================================
```

---

## 6. Batch-Simulation mit Signalverlaufs- & SAIF-Export ausführen

Führen Sie 100 Taktschritte aus und exportieren Sie standardmäßige IEEE 1364 VCD-Signalverläufe sowie Synopsys SAIF 2.0-Schaltaktivitätsdateien:

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

Ausgabe:
```text
============================================================
 Axiom In-RAM Batch Simulator: tests/fixtures/counter.v
 Target: counter | Steps: 100 ticks
============================================================
 Simulation completed in 410.15µs
 Final SimTime: 50000 ps (50.000 ns) | Total Deltas: 0
 Glitches Detected: 0
 Exported IEEE 1364 VCD to: waveforms.vcd
 Exported SAIF 2.0 to: power.saif
============================================================
```

---

## 7. Hochauflösende Benchmarks ausführen

Unterziehen Sie den Simulationskern einem Stresstest und messen Sie den Ereignisdurchsatz:

```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 8. Modernes Desktop Studio & Web UI starten

### Eigenständige native Desktop-App
Starten Sie das native Desktop-Fenster direkt (unterstützt von Tauri v2 ohne Port-Hosting und mit direkter Cranelift-JIT im RAM):
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### In-Browser WebAssembly Studio
Öffnen Sie das live bereitgestellte installationsfreie Studio unter **[https://axiom.aerovex.net/studio/](https://axiom.aerovex.net/studio/)**.

### Lokaler UI-Entwicklungsserver
```bash
cd ui
npm install
npm run dev
```

Wichtigste Funktionen:
- **Vereinheitlichte Omnibar (`Strg+K`)**: Sofortige Fuzzy-Suche über Signale, Netzlistenhierarchie, Aktionen und Dokumentation.
- **Hochdichter Signalverlaufsbetrachter**: Multi-Radix-Bus-Exploder, Doppelcursor ($\Delta t$) und Null-Zeit-$\delta$-Zyklus-Hazard-Anzeige.
- **GPU-beschleunigter schematischer DAG**: 60+ FPS Canvas-2D-Engine mit 1-Klick-Slicern für kritische Logikkonen (`F` / `O`).
- **Virtuelles Instrumenten-Rack**: 8-Bit-DIP-Schalterbank, taktile Taster, Dreh-Hex-Schalter, 7-Segment-Anzeigen und Testmustergenerator.
- **Timing-Radar & Silizium-Energie-Treemap**: STA-Wasserfall für kritische Pfade und dynamische Leistungszerlegung ($P = \frac{1}{2} C V^2 f \alpha$).
- **Eingebettete Skript-Shell**: Direkte In-RAM-Simulations-REPL (`run`, `step delta`, `force`, `get`).
