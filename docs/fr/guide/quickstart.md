# Démarrage rapide (installation en 60s)

Démarrez avec **Axiom EDA** en moins de 60 secondes.

---

## 1. Installation en une seule ligne

Axiom fournit des binaires autonomes et légers (<50 Mo) sans aucune dépendance vers une chaîne d'outils externe.

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

L'installateur détecte automatiquement votre système d'exploitation et votre architecture (`x86_64` ou `aarch64` / Apple Silicon), installe le binaire `axiom` dans `~/.axiom/bin` (ou `%USERPROFILE%\.axiom\bin`) et configure votre `$PATH`.

---

## 2. Gestion des versions et drapeaux personnalisés

Vous pouvez spécifier une version personnalisée ou modifier le répertoire de destination.

### Cibler une version spécifique

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

### Répertoire d'installation personnalisé

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. Script dédié de compilation depuis les sources

Si vous préférez compiler depuis les sources ou modifier le moteur, Axiom inclut un script d'automatisation dans `scripts/` :

### Linux et macOS (`scripts/build_from_source.sh`)

Clonez le dépôt et exécutez le script automatisé :

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**Options du script de compilation :**

- `--cli-only` : Ignorer Node/UI et compiler uniquement la CLI Rust sans interface :
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>` : Installer dans un répertoire système ou utilisateur personnalisé :
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug` : Compilation de débogage rapide et non optimisée :
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

Dans PowerShell :
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. Compilation manuelle avec Cargo

Vous pouvez également invoquer directement Cargo :

```bash
cargo build --release --bin axiom
```

Le binaire résultant sera situé dans `target/release/axiom`.

Vérifiez votre installation :
```bash
axiom --version
```

Sortie :
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. Compilez votre première conception HDL

Axiom inclut des bancs de test matériels vérifiés dans `tests/fixtures/`. Compilez une ALU 32 bits directement en code machine natif en RAM :

```bash
axiom compile tests/fixtures/alu.v -t alu
```

Sortie :
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

## 6. Exécutez une simulation par lots avec export VCD et SAIF

Exécutez 100 cycles d'horloge en exportant les formes d'onde Logique à 4 états / Value Change Dump (VCD) IEEE 1364 standard et les fichiers d'activité de commutation Synopsys SAIF 2.0 :

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

Sortie :
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

## 7. Exécutez des bancs d'essai haute résolution

Testez les performances limites du noyau de simulation et mesurez le débit d'événements :

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

## 8. Lancez le Studio de bureau moderne et l'interface Web

### Application de bureau native autonome
Lancez la fenêtre de bureau native directement (propulsée par Tauri v2 sans hébergement de port réseau et avec compilation JIT en RAM avec Cranelift directe) :
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### Studio WebAssembly dans le navigateur
Ouvrez le studio sans installation déployé en direct sur **[https://axiom.aerovex.net/studio/](https://axiom.aerovex.net/studio/)**.

### Serveur de développement UI local
```bash
cd ui
npm install
npm run dev
```

Fonctionnalités clés :
- **Barre de recherche unifiée (`Ctrl+K`)** : Recherche floue instantanée parmi les signaux, la hiérarchie de netlist, les actions et la documentation.
- **Visualiseur de formes d'onde haute densité** : Décompacteur de bus multi-radix, double curseur ($\Delta t$) et tiroir d'aléas de cycle delta à temps nul (cycle δ).
- **Schéma DAG accéléré par GPU** : Moteur Canvas 2D à plus de 60 FPS avec découpeurs de cônes logiques critiques en 1 clic (`F` / `O`).
- **Rack d'instruments virtuels** : Banc d'interrupteurs DIP 8 bits, boutons poussoirs tactiles, sélecteur rotatif hexadécimal, afficheurs 7 segments et générateur de motifs de test.
- **Radar de temporisation et treemap d'énergie silicium** : Cascade de chemin critique d'analyse temporelle statique (STA) et décomposition de puissance dynamique ($P = \frac{1}{2} C V^2 f \alpha$).
- **Shell de script intégré** : REPL de simulation direct en RAM (`run`, `step delta`, `force`, `get`).
