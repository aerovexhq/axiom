# Aperçu de l'espace de travail Axiom Studio

Axiom Studio est une interface d'automatisation de conception électronique (EDA) multiplateforme de qualité aérospatiale, développée nativement en Rust et React 19. Elle offre un espace de travail unifié et haute performance associant un éditeur de code Monaco HDL réactif à des schémas synchronisés au niveau des portes, des formes d'onde numériques, des bancs d'essai matériels tactiles, des analyseurs temporels statiques et le floorplanning physique du silicium.

---

## Architecture de l'espace de travail

Axiom Studio abandonne les interfaces multifenêtres lentes et fragmentées des outils EDA hérités au profit d'un espace de travail cohérent à deux volets :

```
+-------------------------------------------------------------------------------+
| Header: Brand | File Sets | Simulation Ribbon (Run, Step, Reset) | PDN Gauges |
+---------------------------------------+---------------------------------------+
| Left Pane (Monaco HDL Editor)         | Right Pane (Dynamic Visualizers)      |
|                                       | - Schematic DAG Visualizer            |
| - Verilog / SystemVerilog / VHDL      | - Virtual Lab & Basys 3 FPGA Bay      |
| - In-RAM LSP Real-Time Linter         | - Waveforms & Logic Analyzer          |
| - Monarch Tokenizer & Autocomplete    | - Timing Radar & Static Timing        |
| - AST Hover Cards & Breadcrumbs       | - Technology Mapping Studio           |
|                                       | - Floorplanning & Silicon Die         |
|                                       | - Formal Verification (BMC)           |
|                                       | - Protocol Analyzer & Dissector       |
|                                       | - Microarchitecture & Multi-Die       |
+---------------------------------------+---------------------------------------+
| Unified Bottom Dock: Console & REPL | Problems & Linter | Telemetry Radar     |
+-------------------------------------------------------------------------------+
```

### 1. En-tête et ruban de commande de simulation
L'en-tête de navigation supérieur héberge les étiquettes d'identité de projet, le sélecteur d'ensemble de fichiers Vivado et le ruban d'exécution de la simulation. Il permet la compilation instantanée, l'exécution, la pause, l'avancement discret par cycle delta et le rembobinage du temps de simulation. Des jauges de télémétrie du réseau de distribution d'alimentation (PDN) en temps réel rapportent la puissance dynamique en milliwatts ($P$), la chute de tension inductive ($V_{\text{sag}}$) et le courant d'alimentation total ($I$).

### 2. Volet gauche : Éditeur de code Monaco HDL
Une instance personnalisée de l'éditeur Microsoft Monaco configurée avec le tokeniseur Monarch Verilog/SystemVerilog d'Axiom, le thème acrylique sombre (`axiom-dark`), les info-bulles AST au survol en temps réel et les diagnostics de protocole de serveur de langage (LSP) en RAM.

### 3. Volet droit : Baie de visualisation
Un canvas pleine hauteur et pleine largeur accueillant les outils d'analyse visuelle d'Axiom :
- **Schéma DAG** : Visualiseur de netlist au niveau des portes IEEE en temps réel avec routage orthogonal des canaux sans collision.
- **Laboratoire virtuel** : Platine matérielle tactile avec interrupteurs, LED et afficheurs 7 segments de la carte Digilent Basys 3 Artix-7.
- **Formes d'onde** : Analyseur logique numérique à plus de 60 FPS avec fenêtres de mesure par glisser-déposer et inspection des cycle delta à temps nul (cycle δ).
- **Radar de temporisation** : Analyse temporelle statique (STA) topologique affichant les cascades de chemins critiques et les histogrammes de marges d'établissement/maintien.
- **Mappage technologique** : Mappage technologique au niveau des portes convertissant le RTL en primitives FPGA cibles (LUTs, DSP48E2, RAMB36E2).
- **Floorplanning** : Studio de floorplanning de puce silicium 2D affichant le placement des sites CLB, les cartes thermiques et les lignes de vol de routage.
- **Vérification formelle** : Vérification de modèles bornés (BMC) et vérification par $k$-induction pour les assertions SystemVerilog.
- **Analyseur de protocoles** : Disséqueurs matériels série pour UART, SPI, I2C, Bus CAN, USB et Ethernet.
- **Microarchitecture** : Détection automatisée du chemin de données, inspecteurs d'ALU, vues mémoire de RegFile et graphes de bulles d'états FSM.

### 4. Séparateur central redimensionnable
Un séparateur réactif permettant aux ingénieurs d'ajuster l'équilibre entre éditeur et visualiseur. Axiom propose un ancrage dynamique du point médian de la caméra : déplacer le séparateur recalcule en continu le point médian de la caméra dans l'espace universel du canvas, évitant tout écrasement du schéma ou perte de zoom.

### 5. Dock inférieur unifié
Un dock escamotable organisant les outils d'analyse secondaires en onglets clairs :
- **Console et REPL** : Sorties interactives du compilateur Verilog, journalisation des instructions `$display` et état de la simulation.
- **Problèmes et linter** : Cartes de diagnostic actives avec navigation vers la ligne en 1 clic pour les avertissements de syntaxe et de règles de conception.
- **Télémétrie** : Indicateurs analogiques de télémétrie sur silicium pour la tension d'alimentation du cœur, la chute inductive et le courant de commutation.
- **Aperçu des formes d'onde** : Vue compacte des formes d'onde lors du travail en mode schéma scindé.

---

## Raccourcis clavier globaux

| Raccourci | Action | Description |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | **Enregistrer le projet** | Conserve tous les fichiers de conception et métadonnées sur disque ou IndexedDB |
| `Ctrl + Entrée` / `Cmd + Entrée` | **Compiler et exécuter** | Compile la conception active en RAM via le JIT Cranelift et démarre l'horloge |
| `Espace` | **Exécuter / Pause** | Bascule l'exécution du moteur de simulation |
| `F10` | **Pas +1 ns** | Fait avancer le temps physique de simulation d'exactement 1 000 picosecondes |
| `Maj + F10` | **Pas +100 ps** | Fait avancer le temps physique de simulation d'exactement 100 picosecondes |
| `F11` | **Pas Delta (\(\delta\))** | Exécute un cycle delta à temps nul (cycle δ) discret d'évaluation sans faire avancer le temps physique |
| `Ctrl + R` / `Cmd + R` | **Réinitialiser la simulation** | Rembobine l'horloge de simulation à \(t=0\) et restaure les vecteurs de signaux initiaux |
| `Ctrl + Alt + F` | **Studio de Floorplanning** | Ouvre le visualiseur de floorplanning physique sur silicium FPGA |
| `Ctrl + P` / `Cmd + P` | **Ouverture rapide de fichier** | Ouvre la palette de recherche Omnibar pour naviguer dans les sources du projet |
| `Ctrl + \`` | **Afficher/masquer le dock inférieur** | Développe ou réduit le dock inférieur unifié |
| `Ctrl + B` / `Cmd + B` | **Afficher/masquer la barre latérale** | Affiche ou masque la barre latérale des ensembles de fichiers du projet Vivado |
| `Échap` | **Fermer la boîte de dialogue / Désélectionner** | Ferme les boîtes de dialogue actives, les inspecteurs ou efface la sélection d'équipotentielles |

---

## Studio mobile et tiroir réactif

Lors d'une utilisation sur appareils mobiles ou dans des fenêtres de navigateur étroites (largeur \(\le 768\text{px}\)), Axiom Studio s'adapte automatiquement :
- Les séparateurs redimensionnables multivolets sont désactivés pour éliminer les zones d'affichage trop exiguës.
- Un tiroir coulissant hors écran (`MobileDrawer.tsx`) donne accès aux ensembles de fichiers de projet, aux commandes de simulation et à la sélection des vues.
- L'interface bascule en mode **1 panneau à la fois**, allouant 100% de la largeur et de la hauteur de l'écran à la vue active.
- Une barre inférieure mobile ergonomique pour le pouce (`MobileBottomBar.tsx`) fournit 5 onglets de navigation principaux : **Code**, **Schéma**, **Labo**, **Signaux** et **Console**, avec badges de problèmes en direct.
