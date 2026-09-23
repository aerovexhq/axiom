# Formes d'onde haute densité et analyseur logique

Axiom EDA intègre un visualiseur de formes d'onde numériques et un analyseur logique haute densité à plus de 60 FPS, rendu sur un canevas HTML5 accéléré. Il permet aux ingénieurs d'inspecter les relations temporelles multi-signaux, d'étendre les bases des bus, de mesurer les intervalles et de détecter les aléas de cycle delta à temps nul (cycle δ).

---

## Chronologie numérique stratifiée

Le visualiseur de formes d'onde rend les traces numériques avec un défilement vertical virtualisé, accueillant des centaines de signaux sans aucun ralentissement de l'interface utilisateur :

```
Signal Name   Radix   | 0 ns      5 ns      10 ns     15 ns     20 ns     25 ns
----------------------+--------------------------------------------------------
clk           1-bit   | _/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_
rst_n         1-bit   | _____/=================================================
data_in[7:0]  Hex     | = 00 =X= 41 =X= 42 =X= 43 =X= 44 =X= 45 =X= 46 ======
valid_in      1-bit   | ______/===========\___________/=======================
busy_out      1-bit   | ____________/===========\___________/=================
----------------------+--------------------------------------------------------
                      |       |<---- Delta-T: 10.0 ns (100.0 MHz) ---->|
```

### Capacités d'affichage des signaux
- **Changement de base (Radix)** : Faites un clic droit ou cliquez sur la pastille de base de tout signal pour basculer entre **Hexadécimal**, **Binaire**, **Décimal non signé**, **Décimal signé** et **ASCII**.
- **Expansion de bus** : Cliquez sur le chevron (`>`) à côté de tout vecteur multi-bits (`data[7:0]`) pour dérouler les lignes de bits individuelles.
- **Coloration contrastée** : Les traces s'affichent en cyan à fort contraste pour les niveaux logiques, en ambre pour les bus et en rouge pour les états inconnus ou de conflit (`X`, `Z`).

---

## Fenêtre moderne de mesure par glisser-déposer

Axiom remplace les flux de travail désuets à deux curseurs par une fenêtre intuitive de mesure par glisser-déposer :

1. **Cliquer et glisser** : Faites glisser sur n'importe quelle région de la chronologie des formes d'onde pour mettre en surbrillance une fenêtre de mesure.
2. **Poignées de délimitation ($[A, B]$)** : Faites glisser les poignées gauche ou droite pour ajuster les bornes de mesure avec une précision à la picoseconde.
3. **Fenêtre coulissante** : Faites glisser le centre de la fenêtre de mesure pour faire glisser l'intervalle de temps complet le long de la chronologie.
4. **HUD de mesure en direct** : Le HUD affiche :
   - **Temps A ($T_A$)** : Horodatage de début avec unités d'ingénierie compactes (ps, ns, µs, ms).
   - **Temps B ($T_B$)** : Horodatage de fin.
   - **Temps Delta ($\Delta t$)** : Durée exacte ($\Delta t = |T_B - T_A|$).
   - **Fréquence ($f$)** : Fréquence d'horloge équivalente ($f = 1 / \Delta t$).
5. **Zoomer sur la fenêtre** : Cliquez sur **Zoomer sur la fenêtre** pour agrandir l'intervalle sélectionné à 100 % de la largeur du canevas.

---

## Détection des cycles delta (\(\delta\)) et des aléas (glitchs)

Les simulateurs traditionnels regroupent les événements à temps nul en un seul horodatage, masquant les situations de compétition combinatoire. Axiom propose une inspection explicite des deltas :
- **Pas delta (`F11`)** : Avance d'un cycle delta à temps nul (cycle δ) d'évaluation discret ($\delta \to \delta + 1$).
- **Marqueurs d'aléa de glitch** : Lorsqu'un signal effectue plusieurs transitions au cours du même horodatage physique ($t_0$), le canevas des formes d'onde met l'équipotentielle en surbrillance avec un drapeau d'avertissement ambre.
- **Vue étendue des deltas** : Déploie horizontalement les intervalles à temps nul, révélant la cascade interne des transitions de portes intermédiaires avant que le circuit n'atteigne l'état stationnaire.

---

## Export IEEE 1364 VCD et comparaison différentielle

- **Exporter VCD** : Exporte l'historique de simulation actuel sous forme de Logique à 4 états / Value Change Dump (VCD) IEEE 1364 directement compatible avec GTKWave, ModelSim ou Vivado.
- **Importer VCD (`ImportVcdModal`)** : Charge des fichiers VCD externes dans Axiom.
- **Différentiel de formes d'onde** : Compare automatiquement les traces de simulation aux fichiers VCD de référence (golden), mettant en évidence les discordances de signaux avec des indicateurs d'erreur cycle par cycle.
