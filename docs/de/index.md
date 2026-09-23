---
layout: home
hero:
  name: Axiom EDA
  text: Hochleistungs-HDL-Engine & Silizium-Telemetrie
  tagline: Ultraschnelle In-RAM Cranelift-JIT-Kompilierung, manuelles Delta-Zyklus-Stepping
    und physikbasierte Silizium-Telemetrie. Entwickelt in Rust unter Aerovex.
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
  - theme: brand
    text: Web Studio starten
    link: /studio/
    target: _blank
  - theme: alt
    text: Desktop-App herunterladen
    link: '#download-desktop-studio-msi-deb-dmg'
  - theme: alt
    text: Schnellstart & Installation
    link: /de/guide/quickstart
  - theme: alt
    text: Auf GitHub ansehen
    link: https://github.com/aerovexsim/axiom
features:
- title: In-RAM Cranelift-JIT
  details: Kompiliert Verilog- & SystemVerilog-Designs direkt im RAM in Millisekunden
    in nativen Maschinencode (x86_64, AArch64) und umgeht mehrminütigen C++- und Snapshot-Festplatten-Overhead.
- title: Granulares Delta-Zyklus-Stepping
  details: Aufrufergesteuerte manuelle Tick-API, die diskrete Null-Zeit-Delta-Zyklen
    (δ-Zyklen) offenlegt (step_delta) und kombinatorische Race Conditions sowie Glitches
    aufdeckt, die von herkömmlichen Simulatoren verborgen werden.
- title: Physikalische Silizium-Telemetrie
  details: Grundlagenbasierte dynamische Leistungsmodellierung (0,5 * C * V^2 * f
    * α) gekoppelt mit induktivem PDN-Spannungsabfall (IR + L di/dt), die live synchronisierte
    analoge Telemetrie parallel zu digitalen Signalverläufen streamt.
- title: Plattformübergreifend für Desktop & Web
  details: Leichtgewichtige (<50 MB) Desktop-Anwendung, entwickelt mit Tauri v2, React
    19 und Vite, die nativ nach WebAssembly für 100% clientseitige Simulation im Browser
    kompiliert.
- title: Hochdichte Canvas-Signalverläufe
  details: Virtualisierter digitaler Signalverlaufsbetrachter mit 60+ FPS, der Multi-Bit-Busübergangshüllkurven,
    Zeitcursor-Inspektion und Delta-Glitch-Lupen unterstützt.
- title: 100% Vivado-Interoperabilität
  details: Exportiert IEEE 1364 Value Change Dump (.vcd)-Signalverläufe und Synopsys
    SAIF 2.0-Schaltaktivitätsdateien, die direkt von Vivado read_saif eingelesen werden
    können.
---


## Desktop Studio herunterladen (.msi, .deb, .dmg)

Laden Sie native, hochperformante Desktop-Pakete mit direkter Cranelift-JIT im RAM und ohne Browser-Sandbox-Einschränkungen herunter. Releases werden automatisch von GitHub abgerufen:

<ReleaseDownloader />

::: tip GitHub-Releases & SHA256-Verifikation
Alle Release-Assets, SHA256-Prüfsummen und Versionshinweise sind auf der [Axiom GitHub-Releases-Seite](https://github.com/aerovexsim/axiom/releases) verfügbar.
:::

## Einzeilige Installation

Installieren Sie die eigenständige Axiom EDA-Binärdatei in Sekundenschnelle ohne über 100 GB Installationsballast:

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip Versionsauswahl & Quellcode-Kompilierung
So installieren Sie eine bestimmte Release-Version:
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

Oder kompilieren Sie direkt aus dem Quellcode mit Cargo:
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## Benchmark-Highlights: Axiom vs. AMD Vivado

| Metrik | Axiom EDA (Aerovex) | AMD Vivado Design Suite | Vorteil |
| :--- | :--- | :--- | :--- |
| **End-to-End-Kompilierungszeit** | **2.81 ms** (In-RAM JIT) | 30,0 – 60,0 s (`xelab`-Snapshot) | **>10.000× schneller** |
| **Simulations-Ereignisdurchsatz** | **780.840 Ereignisse/s** | ~100.000 – 250.000 Ereignisse/s | **3–7× schneller** |
| **Null-Zeit-Delta-Introspektion** | Explizites $\delta$-Stepping & Glitch-Flags | Black-Box-Nullzeit-Kollaps | **Vollständige Sichtbarkeit von Race Conditions** |
| **Dynamische Energietelemetrie** | Echtzeit $P = \frac{1}{2} C V^2 f \alpha$ | Statischer Bericht nach der Simulation | **Live synchronisierte Signalverläufe** |
| **Installationsgröße** | **<50 MB** eigenständige Binärdatei | **100+ GB** monolithische Installation | **>2.000× schlanker** |
| **Plattformkompatibilität** | Linux, macOS (Apple Silicon), Windows, Web | Nur Linux & Windows | **Universelle Portabilität** |
