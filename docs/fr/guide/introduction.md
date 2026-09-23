# Introduction et manifeste

## La mission d'Axiom EDA

**Axiom** est une réécriture et une modernisation complète, haute performance et multiplateforme du moteur de traitement, de simulation et d'analyse de langages de description de matériel (HDL) d'AMD Vivado, nativement conçu en **Rust** par **Aerovex**.

Vivado est le standard incontesté de l'industrie pour le développement FPGA, mais souffre de décennies de lourdeur technique :
- Des **installations de plus de 100 Go** nécessitant des démons de licence complexes et une configuration interminable.
- Des **interfaces Java Swing lentes** qui consomment des gigaoctets de mémoire et se figent lors du rendu des formes d'onde.
- Des **pipelines de compilation sur fichiers en plusieurs étapes** (`xvlog` $\to$ base de données de bibliothèques $\to$ `xelab` $\to$ binaire instantané $\to$ `xsim`) qui prennent plusieurs minutes même pour de simples modifications HDL.
- Une **absence totale de support pour les plateformes modernes** telles que macOS (Apple Silicon M1/M2/M3/M4) ou les navigateurs web standards.
- Des **cycles delta à temps nul opaques** qui masquent les aléas de course combinatoires et les glitchs transitoires aux concepteurs numériques.

**Axiom abolit ces limitations.** Il fournit un moteur de simulation matérielle instantané, hautement introspectable et de moins de 50 Mo, associé à une application de bureau et web inspirée d'Obsidian.

---

## Piliers architecturaux fondamentaux

### 1. Compilation JIT en RAM avec Cranelift
Axiom élimine les vidages intermédiaires de fichiers C++, les appels externes à GCC/Clang et la sérialisation des instantanés. Les netlists matérielles élaborées et les processus procéduraux sont compilés directement en code machine natif en RAM à l'aide de **Cranelift** (x86_64, AArch64) en moins de 3 millisecondes.

### 2. API manuelle d'avancement temporel et file d'événements
Contrairement aux simulateurs traditionnels qui font avancer le temps à l'aveugle ou écrasent les cycles delta dans un horodatage unique, Axiom expose une API d'avancement contrôlée par l'appelant :
- `engine.tick(delta_time)` : Fait avancer le temps physique de quelques picosecondes ou nanosecondes.
- `engine.step_delta()` : Avance d'un cycle delta à temps nul (cycle δ) discret ($\delta \to \delta + 1$) sans incrémenter le temps physique, exposant les aléas transitoires avant la stabilisation des signaux.

### 3. Télémétrie de tension, d'énergie et de puissance physique
Axiom intègre les équations physiques fondamentales à chaque transition de signal :
- **Puissance dynamique** : $P_{\text{dynamic}} = \frac{1}{2} C_{\text{net}} V_{\text{dd}}^2 f \alpha$
- **Chute de tension inductive du PDN (IR + L di/dt)** : $V_{\text{sag}} = IR + L \frac{di}{dt}$
- Capture les micro-pics de courant lors des fronts d'horloge que les rapports d'estimation statique de Vivado ignorent.

### 4. Architecture bureau et web multiplateforme
Conçu avec **Tauri v2**, **React 19**, **TypeScript** et **Vite**, Axiom s'exécute nativement en tant qu'application de bureau sous Linux, macOS et Windows, tout en compilant parfaitement en **WebAssembly** (`wasm32-unknown-unknown`) pour une simulation 100% dans le navigateur.
