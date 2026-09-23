# Floorplanning de synthèse et studio de disposition de puce

Axiom EDA intègre un studio interactif de floorplanning de puce silicium 2D (`crates/ir/src/floorplan/`, `FloorplanStudioViewer.tsx`). Il visualise le placement physique des cellules, les grilles de sites en silicium, les lignes de vol d'interconnexion et les cartes thermiques/de densité sur les dispositions réelles de puces FPGA.

---

## Grille d'architecture de puce silicium FPGA

Le floorplanner effectue le rendu de la disposition exacte des sites de l'architecture FPGA cible :

```
+-------------------------------------------------------------------------------+
| Top I/O Bank (IOB)                                                            |
+---+-----------------------------------------------------------------------+---+
| L | CLB Slice Grid (SliceL / SliceM)   | DSP Column | BRAM Column         | R |
| e | [x][x][x][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | i |
| f | [x][x][ ][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | g |
| t |------------------------------------+------------+---------------------| h |
|   | Global Clock Center Spine (BUFG / Clock Center)                       | t |
| I |------------------------------------+------------+---------------------|   |
| O | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | I |
| B | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | O |
+---+-----------------------------------------------------------------------+---+
| Bottom I/O Bank (IOB)                                                         |
+-------------------------------------------------------------------------------+
```

### Types d'emplacements sur la puce
- **Tranches CLB (SliceL & SliceM)** : Tranches logiques contenant des LUTs et des bascules. Les sites SliceM prennent également en charge la RAM distribuée et les registres à décalage (SRL).
- **Colonnes DSP** : Colonnes dédiées multi-tuiles abritant des blocs arithmétiques haute vitesse `DSP48E2`.
- **Colonnes de RAM bloc** : Colonnes verticales réservées aux mémoires intégrées `RAMB36E2` et `RAMB18E2`.
- **Bancs d'E/S périphériques** : Tampons d'E/S gauche, droite, haut et bas (`IOB`) connectant les broches du boîtier à la logique interne.
- **Épine dorsale d'horloge** : Piste de distribution horizontale centrale accueillant les `BUFG` et les réseaux de routage d'horloge.

---

## Placeur analytique (HPWL) et regroupement de retenue

Le placeur de synthèse calcule les coordonnées $(x, y)$ optimales pour chaque cellule au moyen d'un placement quadratique analytique et de la minimisation de la demi-longueur de fil de périmètre (HPWL) :
$$\text{HPWL}(e) = \max_{v \in e}(x_v) - \min_{v \in e}(x_v) + \max_{v \in e}(y_v) - \min_{v \in e}(y_v)$$

### Regroupement en colonnes verticales de chaînes de retenue
Les macros arithmétiques nécessitant des chaînes de retenue rapide (`CARRY4` / `CARRY8`) ne peuvent pas être dispersées arbitrairement sur la puce. Le placeur regroupe automatiquement les éléments de retenue dépendants en colonnes verticales contiguës le long de pistes silicium dédiées haute vitesse.

---

## Densité de silicium et cartes thermiques

La surface de la puce est partitionnée en une matrice spatiale de tuiles normalisée $32 \times 32$ :
- **Carte de chaleur d'utilisation** : Les cellules sont nuancées du bleu marine profond (vide / faible utilisation) à l'ambre vif et au rouge (forte congestion $>85\%$).
- **Carte thermique** : Combine la fréquence de commutation logique ($\alpha$) avec la densité locale pour afficher les points chauds thermiques sur la puce de silicium.

---

## Lignes de vol de Manhattan et superposition du chemin critique

- **Lignes de vol point à point** : Cliquer sur une cellule illumine les canaux de routage orthogonal de Manhattan reliant toutes les destinations pilotées.
- **Superposition néon du chemin critique** : Le pire chemin temporel identifié par le moteur d'analyse temporelle statique (STA) est représenté par une trace orange néon reliant la bascule source au point terminal de destination.
