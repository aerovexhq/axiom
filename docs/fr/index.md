---
layout: home
hero:
  name: Axiom EDA
  text: Moteur HDL haute performance et télémétrie sur silicium
  tagline: Compilation JIT en RAM avec Cranelift ultra-rapide, cycle delta à temps
    nul (cycle δ) pas à pas et télémétrie sur silicium physique. Conçu en Rust sous
    Aerovex.
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
  - theme: brand
    text: Lancer Web Studio
    link: /studio/
    target: _blank
  - theme: alt
    text: Télécharger l'application de bureau
    link: '#download-desktop-studio-msi-deb-dmg'
  - theme: alt
    text: Démarrage rapide et installation
    link: /fr/guide/quickstart
  - theme: alt
    text: Voir sur GitHub
    link: https://github.com/aerovexsim/axiom
features:
- title: Compilation JIT en RAM avec Cranelift
  details: Compile les conceptions Verilog et SystemVerilog directement en code machine
    natif (x86_64, AArch64) en RAM en quelques millisecondes, éliminant les temps
    de compilation C++ et les écritures disque de snapshots.
- title: Avancement granulaire par cycle delta
  details: API de pas d'horloge manuelle contrôlée par l'appelant exposant des cycles
    delta à temps nul (cycle δ) discrets (step_delta), révélant les aléas de commutation
    et les glitchs dissimulés par les simulateurs hérités.
- title: Télémétrie sur silicium physique
  details: Modélisation de la puissance dynamique fondée sur les principes premiers
    (0.5 * C * V^2 * f * α) associée à la chute de tension inductive du PDN (IR +
    L di/dt), diffusant une télémétrie analogique synchronisée en direct aux côtés
    des traces numériques.
- title: Bureau et Web multiplateforme
  details: Application de bureau légère (<50 Mo) conçue avec Tauri v2, React 19 et
    Vite, compilant nativement vers WebAssembly pour une simulation 100% côté client
    dans le navigateur.
- title: Formes d'onde Canvas haute densité
  details: Visualiseur de formes d'onde numériques virtualisé à plus de 60 FPS prenant
    en charge les enveloppes de transition de bus multibits, l'inspection par curseur
    temporel et les loupes de glitchs delta.
- title: Interopérabilité 100% Vivado
  details: Exporte des formes d'onde Logique à 4 états / Value Change Dump (VCD) IEEE
    1364 et des fichiers d'activité de commutation Synopsys SAIF 2.0 directement exploitables
    par Vivado read_saif.
---


## Télécharger Desktop Studio (.msi, .deb, .dmg)

Téléchargez des paquets de bureau natifs haute performance avec compilation JIT en RAM avec Cranelift directe et sans restriction de bac à sable de navigateur. Les versions sont automatiquement récupérées depuis GitHub :

<ReleaseDownloader />

::: tip Versions GitHub et vérification SHA256
Tous les artefacts de version, les sommes de contrôle SHA256 et les notes de version sont disponibles sur la [page des versions GitHub d'Axiom](https://github.com/aerovexsim/axiom/releases).
:::

## Installation en une seule ligne

Installez le binaire autonome Axiom EDA en quelques secondes sans l'encombrement d'un installateur de plus de 100 Go :

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip Sélection de version et compilation depuis les sources
Pour installer une version spécifique :
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

Ou compilez directement depuis les sources avec cargo :
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## Points saillants des bancs d'essai : Axiom vs AMD Vivado

| Métrique | Axiom EDA (Aerovex) | AMD Vivado Design Suite | Avantage |
| :--- | :--- | :--- | :--- |
| **Délai de compilation de bout en bout** | **2,81 ms** (JIT en RAM) | 30,0 – 60,0 s (instantané `xelab`) | **>10 000× plus rapide** |
| **Débit d'événements de simulation** | **780 840 événements/s** | ~100 000 – 250 000 événements/s | **3 à 7× plus rapide** |
| **Introspection des cycles delta à temps nul** | Exécution pas à pas explicite en cycle $\delta$ et indicateurs de glitchs | Écrasement en boîte noire du temps nul | **Visibilité totale des aléas de course** |
| **Télémétrie d'énergie dynamique** | $P = \frac{1}{2} C V^2 f \alpha$ en temps réel | Rapport statique post-simulation | **Formes d'onde synchronisées en direct** |
| **Empreinte d'installation** | Binaire autonome **<50 Mo** | Installation monolithique de **plus de 100 Go** | **>2 000× plus léger** |
| **Compatibilité de plateforme** | Linux, macOS (Apple Silicon), Windows, Web | Linux et Windows uniquement | **Portabilité universelle** |
