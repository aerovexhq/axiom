# Analyse temporelle statique (STA) et radar de temporisation

Axiom EDA intègre un moteur d'analyse temporelle statique (STA) complet et un visualiseur interactif de radar de temporisation (`crates/sta`). Il effectue la propagation topologique de chemins sur les netlists synthétisables, calcule les marges (slack) d'établissement et de maintien par rapport aux contraintes d'horloge cibles, et identifie les goulets d'étranglement du chemin critique avant l'implémentation physique.

---

## Architecture du moteur de synchronisation statique

Le moteur STA décompose la netlist en un graphe orienté acyclique (DAG) de nœuds et d'arêtes de synchronisation :
- **Nœuds temporels** : Broches de portes, entrées de bascules (`D`, `CE`, `R`), sorties de bascules (`Q`) et ports d'E/S primaires.
- **Arêtes temporelles** : Délais de propagation des cellules ($t_{\text{logic}}$) et délais de routage des équipotentielles ($t_{\text{route}}$).

### Formulation de la marge temporelle (Slack)
Pour chaque chemin partant d'une bascule source ($FF_1$) et aboutissant à une bascule de destination ($FF_2$) :
$$\text{Heure d'arrivée des données} = T_{\text{clk1}} + t_{\text{cq}} + t_{\text{logic}} + t_{\text{route}}$$
$$\text{Heure requise des données} = T_{\text{period}} + T_{\text{clk2}} - t_{\text{setup}} - t_{\text{skew}} - t_{\text{jitter}}$$
$$\text{Setup Slack} = \text{Heure requise des données} - \text{Heure d'arrivée des données}$$

Un chemin respecte le timing lorsque $\text{Slack} \ge 0$. Une marge négative ($\text{Slack} < 0$) indique une violation temporelle nécessitant une réduction logique ou l'insertion d'étages de pipeline.

---

## Le tableau de bord du radar de temporisation

La vue du radar de temporisation présente une vue d'ensemble des performances de conception :

```
+-------------------------------------------------------------------------------+
| Timing Radar: Target Clock = 100.0 MHz (Period: 10.0 ns)                      |
| Worst Negative Slack (WNS): +1.42 ns (MET) | Total Negative Slack (TNS): 0.00 |
+-------------------------------------------------------------------------------+
| Critical Path Timing Waterfall:                                               |
| Hop | Element                 | Delay (ps) | Incr (ps) | Total Arrival (ns)   |
|-----+-------------------------+------------+-----------+----------------------|
| 1   | reg_a_reg[3]/C -> Q     | 240 ps     | +240 ps   | 0.240 ns             |
| 2   | net_wire_1 (route)      | 350 ps     | +350 ps   | 0.590 ns             |
| 3   | alu_inst/lut_add_3/I0->O| 480 ps     | +480 ps   | 1.070 ns             |
| 4   | net_sum_3 (route)       | 520 ps     | +520 ps   | 1.590 ns             |
| 5   | reg_result_reg[3]/D     | setup check|           | Required: 8.580 ns   |
+-------------------------------------------------------------------------------+
| Slack Distribution Histogram: [ -2ns | -1ns | 0ns | +1ns | +2ns | +3ns ]      |
+-------------------------------------------------------------------------------+
```

### 1. Indicateurs clés de performance temporelle (KPIs)
- **Pire marge négative (WNS)** : La pire marge sur tous les points d'extrémité temporels. Si le WNS est négatif, le circuit ne peut pas fonctionner à la fréquence d'horloge cible.
- **Marge négative totale (TNS)** : Somme de toutes les marges négatives sur tous les points d'extrémité en violation, indiquant la sévérité de la contrainte temporelle à l'échelle du circuit.
- **Points d'extrémité en échec** : Nombre de registres ou de sorties primaires échouant aux exigences d'établissement ou de maintien.

### 2. Tableau en cascade du chemin critique
Affiche la séquence physique exacte des transitions logiques de cellules et des sauts de routage d'interconnexion contribuant au délai de propagation le plus long. Chaque ligne indique le nom de l'élément, le délai incrémentiel, l'heure d'arrivée cumulée et le budget de marge restant.

### 3. Histogramme de distribution des marges
Visualise la dispersion statistique des marges de points d'extrémité dans la conception. Les classes situées à gauche de la ligne 0 ns mettent en évidence les chemins en violation nécessitant une optimisation.

---

## Synchroniseurs de traversée de domaines d'horloge (CDC)

Le moteur STA analyse automatiquement les conceptions comportant plusieurs domaines d'horloge asynchrones :
- Détecte les traversées de signaux non enregistrés entre horloges sans relation de phase.
- Identifie et vérifie les synchroniseurs à bascules à 2 et 3 étages (`cdc_sync`).
- Signale les chemins CDC non contraints comme des aléas de métastabilité à haut risque.
