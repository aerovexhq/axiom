# Baie de laboratoire virtuel et émulation de cartes

La baie de laboratoire virtuel d'Axiom fait le pont entre la simulation HDL et les tests sur matériel physique. Elle offre une émulation authentique de plaque d'essais numérique, permettant aux étudiants et aux ingénieurs FPGA d'interagir avec leurs conceptions à l'aide d'interrupteurs tactiles, de boutons-poussoirs, de voyants LED et d'afficheurs 7 segments en temps réel.

---

## Baie de carte FPGA Digilent Basys 3

La baie FPGA Basys 3 offre un jumeau numérique précis de la célèbre carte de développement Artix-7 de Digilent :

```
+-------------------------------------------------------------------------------+
| Axiom Basys 3 Artix-7 Hardware Emulation Bay                                  |
+-------------------------------------------------------------------------------+
| [SSEG Display:  1 0 4 2 ]       [BTNU]                 [LD15 .. LD0]          |
| Anode: AN3..AN0 Active        [BTNL] [BTNC] [BTNR]     * * * * * * * *        |
| Segments: CA..CG, DP            [BTND]                 O O O O O O O O        |
|                                                                               |
| Tactile Slide Switches:                                                       |
| [SW15] [SW14] [SW13] [SW12] [SW11] [SW10] [SW9] [SW8] ... [SW1] [SW0]         |
|  [ON]   [OFF]  [OFF]  [ON]   [ON]   [OFF]  [OFF] [ON]       [OFF] [ON]        |
+-------------------------------------------------------------------------------+
```

### 1. 16 interrupteurs à glissière tactiles (`SW0`..`SW15`)
- Mappés directement sur les ports d'entrée via des contraintes physiques XDC (`PACKAGE_PIN V17`, etc.).
- Le clic interactif bascule la position de l'interrupteur avec des effets sonores authentiques et une persistance d'état.
- Leviers de bascule visuels à fort contraste avec repères lumineux verts.

### 2. 16 LED montées en surface (`LD0`..`LD15`)
- Mappées sur les ports de sortie via des contraintes XDC (`PACKAGE_PIN U16`, etc.).
- Rendu de lueur émeraude réaliste indiquant les états actifs de niveau logique haut (`1`).

### 3. 5 boutons-poussoirs momentanés (`BTNC`, `BTNU`, `BTNL`, `BTNR`, `BTND`)
- Configuration en croix directionnelle pour les boutons Centre, Haut, Gauche, Droite et Bas.
- L'appui maintient l'état logique haut (`1`) ; le relâchement revient à l'état logique bas (`0`). Parfait pour les impulsions manuelles de réinitialisation ou le pas à pas d'horloge.

### 4. Afficheur 7 segments multiplexé à 4 chiffres (`SSEG`)
- Implémente un balayage dynamique authentique cathode-anode.
- Rend avec précision les segments (`CA` à `CG`) et le point décimal (`DP`) contrôlés par des lignes de sélection d'anode actives à l'état bas (`AN0` à `AN3`).

---

## Baie de logique combinatoire

Conçue pour l'initiation à la logique numérique et la vérification des tables de vérité, la baie de logique combinatoire fournit une interface tactile dédiée :
- **Entrées interactives** : Trois interrupteurs à bascule principaux (`A`, `B`, `C`).
- **Sondes de portes** : Broches d'évaluation de signaux en temps réel pour les équipotentielles intermédiaires (`w1`, `w2`, `w3`, `w4`).
- **LED de sortie** : Diode indicatrice principale affichant la sortie du circuit `F`.
- **HUD de table de vérité synchronisée à 8 lignes** : Affiche les $2^3 = 8$ combinaisons d'entrées ($000$ à $111$). La ligne active s'illumine dynamiquement selon l'état actuel des interrupteurs, apportant une confirmation visuelle immédiate de l'exactitude booléenne.

---

## Évaluateur de laboratoire automatisé (`LabGraderModal`)

Conçu en partenariat avec les cours universitaires de conception numérique (notamment l'Université d'Istanbul - Cerrahpasa) :
- **Vérification automatisée** : Exécute automatiquement la matrice de banc d'essai sur les implémentations RTL des étudiants (`uygulama_0.v`).
- **Cartes de notation synthétiques** : Calcule les scores en pourcentage, la précision temporelle et la couverture fonctionnelle.
- **Matrice de vecteurs de test** : Détaille les sorties de signaux attendues par rapport aux sorties réelles à chaque étape de simulation.
- **Export de fiche de score en Markdown** : Génération en un clic de rapports de soumission de laboratoire formatés pour les enseignants.
