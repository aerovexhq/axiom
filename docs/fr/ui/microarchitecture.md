# Visualiseurs de microarchitecture et multi-puces

Axiom EDA fournit des outils d'inspection microarchitecturale dédiés (`crates/ir/src/microarch/`, `MicroarchViewer.tsx`, `MultiDieViewer.tsx`, `PpaParetoViewer.tsx`). Ces outils détectent automatiquement les chemins de données des processeurs, les unités arithmétiques et logiques, les bancs de registres et les machines à états, ainsi que les boîtiers chiplets multi-die 2.5D/3D modernes.

---

## Détection automatisée du chemin de données

L'élaborateur RTL inspecte la structure des modules et infère les blocs microarchitecturaux standards :

```
+-------------------------------------------------------------------------------+
| Microarchitecture Datapath Detector:                                          |
| Detected: 1 ALU (32-Bit) | 1 RegFile (32x32) | 1 FSM Controller (5 States)     |
+-------------------------------------------------------------------------------+
| ALU Inspector Modal:                                                          |
| - Opcode: 4'b0010 (ADD) | Operand A: 0x0000_0020 | Operand B: 0x0000_0014     |
| - Result: 0x0000_0034   | Zero Flag: 0           | Overflow: 0                |
+-------------------------------------------------------------------------------+
| FSM Bubble Diagram: [IDLE] --start--> [READ] --ready--> [EXEC] --done--> [IDLE]
+-------------------------------------------------------------------------------+
```

### 1. Inspecteur d'opérations d'ALU
Détecte automatiquement les blocs arithmétiques pilotés par multiplexeur. Affiche les sélections d'opcode actives (ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT) et l'évaluation des opérandes de registres en direct.

### 2. Inspecteur de banc de registres (RegFile)
Détecte les tableaux de mémoire multi-ports (`reg [31:0] registers [0:31]`). Fournit une grille interactive de 32 lignes affichant le contenu hexadécimal en direct de tous les registres architecturaux avec surbrillance en temps réel des écritures.

### 3. Visualiseur de bulles d'états FSM (`FsmViewer.tsx`)
Extrait automatiquement les vecteurs d'état et matrices de transition des machines à états finis (FSM) :
- Affiche un graphe orienté interactif avec des bulles d'états et des flèches de transition.
- Illumine la bulle de l'état actuellement actif pendant la simulation en direct.
- Audite la structure de la FSM : détecte les états inatteignables, les états pièges terminaux et l'absence de branches de récupération par défaut.

---

## Boîtier silicium multi-puces 2.5D et 3D

Pour les architectures chiplets et multi-die modernes (telles qu'AMD UltraScale+ Stacked Silicon Interconnect) :
- **Disposition sur interposeur de puce** : Visualise les interposeurs de silicium connectant plusieurs puces logiques actives (SLR).
- **Interconnexion puce à puce (Super Long Lines - SLL)** : Analyse la bande passante, la latence de propagation et la gigue à travers les micro-bosses reliant les puces physiques.

---

## Explorateur de compromis de Pareto PPA

Le visualiseur PPA analyse les compromis de la conception selon trois métriques d'ingénierie fondamentales :
- **Puissance (mW)** : Consommation totale d'énergie dynamique et de fuite.
- **Performance (MHz)** : Fréquence d'horloge maximale atteignable calculée par l'analyse temporelle statique (STA).
- **Surface (LUTs / FFs)** : Empreinte totale en ressources de silicium.

Le visualiseur trace les frontières de configuration Pareto-optimales, permettant aux concepteurs de choisir l'équilibre de pipeline idéal pour des profils de haut débit ou de basse consommation.
