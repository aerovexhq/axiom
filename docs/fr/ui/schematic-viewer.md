# Visualiseur de schéma DAG interactif de portes IEEE

Le visualiseur de schémas d'Axiom EDA traduit les netlists Verilog analysées en un graphe orienté acyclique (DAG) interactif et haute performance rendu sur un canevas HTML5 accéléré. Il offre une visibilité précise au cycle et au niveau des portes sur les cônes logiques combinatoires, les bascules, les macros arithmétiques et le routage des bus.

---

## Routage de fils sans collision de niveau Vivado

Les visualiseurs EDA traditionnels produisent souvent un câblage en spaghetti entremêlé et difficile à suivre. Axiom intègre un algorithme avancé de routage par canaux orthogonaux :

```
+-------+                                     +-------+
| In A  |--------[ Straight Track ]---------> | In 0  |
+-------+                                     | AND1  |
                                       +----> | In 1  |
+-------+       +--------+             |      +---+---+
| In B  |------>|  INV1  |-------------+          |
+-------+       +--------+                        V
                                              [ Out F ]
```

### 1. Alignement des rangées de chemin de données sur la grille
Les ports d'entrée, les portes logiques et les broches de sortie sont partitionnés en couches logiques de chemin de données ($L_0, L_1, \dots, L_n$). Les broches connectées sont mathématiquement alignées le long de rangées verticales identiques ($Y_{\text{out}} = Y_{\text{in}}$), permettant aux connexions majeures de s'afficher sous forme de lignes horizontales droites avec **zéro mouvement de virage**.

### 2. Décalage multi-couche vers les destinations
Lorsqu'un fil s'étend sur plusieurs couches ($dx \ge 150\text{px}$), la connexion conserve sa piste horizontale source et exécute son décrochement vertical dans le canal ouvert dédié situé immédiatement avant la broche de destination ($dstX - 28$).

### 3. Plaques d'obturation de protection du texte
Chaque étiquette d'instance de porte (`inv1`, `and1`, `or1`) et identifiant de broche est rendu sur une plaque de masquage de fond opaque protectrice (`#0c1017`). Cela empêche totalement les fils de chevaucher ou de traverser les annotations textuelles.

### 4. Détours de canaux conscients des obstacles
Le moteur de routage (`routeOrthogonalEdge`) maintient dynamiquement des boîtes d'exclusion de dégagement (`KeepOutBox`) autour des portes intermédiaires, déroutant proprement les fils à travers des canaux verticaux ouverts.

---

## Navigation sur le canvas et centrage dynamique

- **Panoramique infini** : Cliquez et faites glisser sur toute zone vide du canevas pour naviguer sur de grandes netlists.
- **Zoom fluide à la molette** : Faites défiler le pavé tactile ou la molette de la souris pour zoomer de manière continue entre 10 % et 500 %.
- **Ancrage dynamique du point médian de la caméra** : Lors du déplacement du séparateur central redimensionnable, le `ResizeObserver` d'Axiom verrouille mathématiquement le point médian de la caméra dans l'espace universel sur le centre du volet du visualiseur :
  $$\Delta \text{offsetX} = \frac{\Delta W}{2}, \quad \Delta \text{offsetY} = \frac{\Delta H}{2}$$
  Cela maintient le schéma parfaitement centré et stable sans écrasement horizontal ni sauts de zoom.

---

## Sondage de signaux en direct et HUD

Le survol ou le clic sur un fil ou une porte fournit une introspection matérielle instantanée :
- **Sondage de fil** : Affiche le nom de l'équipotentielle, la largeur de bits et la valeur logique en temps réel (`0`, `1`, `X`, `Z`).
- **Carte flottante suivant le curseur** : Suit le pointeur avec verrouillage aux bordures pour maintenir les détails dans la fenêtre d'affichage.
- **HUD de table de vérité de porte** : Cliquer sur une porte combinatoire (AND, OR, XOR, INV, MUX) affiche une table de vérité flottante mettant en évidence le vecteur d'entrée actif et l'état de sortie résultant.
- **Mise en évidence du cône logique** : Sélectionner une équipotentielle illumine l'ensemble de son cône de sortance amont et ses destinations aval en cyan néon.
