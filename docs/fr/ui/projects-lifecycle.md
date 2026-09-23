# Cycle de vie des projets et ensembles de fichiers

Axiom EDA implémente un système de gestion de projet authentique de niveau Vivado combiné avec une persistance web légère et une intégration au système de fichiers de bureau. Les projets maintiennent une séparation stricte entre les sources RTL de conception, les bancs de test de simulation et les contraintes physiques/temporelles.

---

## La rampe de lancement d'accueil

Lorsqu'il est lancé sans projet ouvert, Axiom présente une rampe de lancement d'accueil soignée de qualité aérospatiale :

```
+-------------------------------------------------------------------------------+
| Axiom EDA v1.0.0 — In-RAM Cranelift JIT & Silicon Telemetry Engine            |
+---------------------------------------+---------------------------------------+
| [ Create New Project ]                | [ Open Project from File ]            |
| Wizard with device selection          | Import serialized .json bundle        |
+---------------------------------------+---------------------------------------+
| Starter Engineering Blueprints (1-Click Launch):                              |
| 1. Logic Circuit (Gate-Level Booleans)| 5. SPI Master Controller              |
| 2. UART Transceiver (115200 Baud)     | 6. FSM Traffic Controller             |
| 3. Synchronous FIFO Buffer (32x8)     | 7. IUC Cerrahpasa Digital Logic Lab   |
| 4. 32-Bit Arithmetic Logic Unit (ALU) |                                       |
+-------------------------------------------------------------------------------+
| Recent Projects: [ Active Projects (3) ]  |  [ Trashed Projects (1) ]         |
+-------------------------------------------------------------------------------+
```

### Modèles de démarrage
Axiom fournit 7 modèles de démarrage testés en industrie :
1. **Circuit logique combinatoire** : Système logique booléen au niveau des portes calculant \(F = ((\neg A \land B) \land C) \lor \neg B\) avec 9 cellules de portes (`inv1`, `inv2`, `and1`, `and2`, `or1`) et une baie tactile dédiée dans le laboratoire virtuel.
2. **Émetteur-récepteur UART** : Pipeline complet d'émetteur et de récepteur avec 8 bits de données, 1 bit d'arrêt, générateur d'horloge de suréchantillonnage et registres d'état.
3. **Tampon FIFO synchrone** : Tampon mémoire circulaire 32x8 à double pointeur avec drapeaux de niveau plein, vide, presque plein et presque vide.
4. **ALU 32 bits** : Unité arithmétique et logique implémentant les additions signées IEEE, les soustractions, les décalages barrel, les comparaisons et la logique booléenne avec détection de drapeau zéro et de débordement.
5. **Maître SPI** : Interface périphérique série de qualité commande moteur prenant en charge les modes 0, 1, 2 et 3 avec diviseurs d'horloge programmables.
6. **Contrôleur de feux FSM** : Machine à états finis pour intersection à 4 voies comprenant des séquences vert, jaune, rouge, des verrous de demande piéton et des compteurs de temporisation.
7. **Laboratoire de logique numérique IUC Cerrahpasa** : Projet de cours de l'Université d'Istanbul - Cerrahpasa comprenant `uygulama_0.v`, bancs de test automatisés et contraintes Basys 3 Artix-7.

---

## Structure des ensembles de fichiers Vivado

Axiom organise les fichiers de projet dans les catégories standard d'ensembles de fichiers Vivado :

```
project_root/
|-- sources_1/           # Design Sources
|   |-- logic_circuit.v  # Primary RTL implementation [TOP]
|   `-- uart_tx.v        # Submodules
|-- sim_1/               # Simulation Sources
|   `-- tb_circuit.v     # Testbench harness
`-- constrs_1/           # Physical & Timing Constraints
    `-- timing.xdc       # XDC pinouts and clock declarations
```

### 1. Sources de conception (`sources_1`)
Contient tous les modules matériels synthétisables implémentés en Verilog, SystemVerilog ou VHDL.
- **Désignation du module racine (`[TOP]`)** : Le module racine actif pour la synthèse, la génération de schémas et le placement physique. Vous pouvez désigner tout module comme racine via le menu déroulant à 3 points verticaux sur la carte de fichier.
- **Action Ajouter une source (`+`)** : Cliquer sur le bouton `+` dans l'en-tête Sources de conception ouvre `AddSourceModal` avec la catégorie `sources_1` présélectionnée.

### 2. Sources de simulation (`sim_1`)
Contient les bancs de test (`tb_*.v`), les vecteurs de stimulus et les séquences de vérification. Les fichiers de banc de test sont exclus de la synthèse physique et du mappage technologique pour éviter les faux avertissements de pilotes multiples ou de broches non contraintes.

### 3. Contraintes (`constrs_1`)
Contient les fichiers Xilinx Design Constraints (`.xdc`) définissant les liaisons de broches de boîtier FPGA (`PACKAGE_PIN`, `IOSTANDARD`) et les cibles d'horloge de l'analyse temporelle statique (`create_clock`).

---

## Menu d'en-tête de projet (`ProjectDropdown`)

Le badge déroulant de projet en haut à gauche offre un accès direct aux opérations fondamentales du cycle de vie :
- **Enregistrer le projet (`Ctrl + S`)** : Vide tous les tampons d'édition sur le disque (Desktop) ou IndexedDB (Web) avec une confirmation visuelle instantanée.
- **Exporter le bundle de projet (`.json`)** : Génère un fichier JSON portable et autonome regroupant tous les ensembles de fichiers, les références FPGA cibles, le module racine actif et les drapeaux de sécurité.
- **Ajouter une source...** : Lance l'assistant de création de sources multi-formats.
- **Paramètres du projet et sécurité...** : Configure le mode de confiance du projet, les quotas de stockage, l'isolation des données et les limites de sécurité de la simulation.
- **Assistant Nouveau projet** : Lance l'assistant de création de projet.
- **Fermer le projet** : Enregistre l'état actif en toute sécurité et retourne à la rampe de lancement d'accueil sans perdre les modifications non validées.

---

## Cycle de vie de mise à la corbeille et de récupération de projet

Pour éviter toute perte accidentelle de données, Axiom implémente un cycle de vie de suppression en deux étapes :
1. **Déplacer vers la corbeille** : Accessible via le bouton à 3 points verticaux sur toute carte de projet sur la rampe de lancement. Les projets mis à la corbeille enregistrent immédiatement `isTrashed: true`, disparaissent de l'onglet Actif et incrémentent le compteur du badge Corbeille.
2. **Accéder aux projets de la corbeille** : Cliquer sur l'onglet **Corbeille** sur la rampe de lancement révèle toutes les conceptions mises à la corbeille avec leurs dates de suppression.
3. **Restaurer le projet** : Restaure le projet dans l'onglet Actif avec tous les fichiers et configurations intacts.
4. **Suppression définitive** : Affiche une boîte de dialogue de confirmation acrylique (`ConfirmModal.tsx`). Une fois confirmée, efface définitivement les enregistrements du projet et supprime les répertoires de stockage associés du système de fichiers.
