# Ruban de commande de simulation et dock unifié

Le système de contrôle de simulation d'Axiom combine un moteur d'exécution haute vitesse avec un ruban de commande intuitif et un dock inférieur unifié (`BottomConsole.tsx`, `UnifiedBottomDock.tsx`). Il offre un contrôle immédiat sur le temps physique de simulation et les cycles delta discrets.

---

## Ruban de commande de simulation de l'en-tête

La barre d'en-tête supérieure affiche la télémétrie de simulation et les commandes :

```
+-------------------------------------------------------------------------------+
| [ Run ] [ Pause ] | [ +1 ns ] [ +100 ps ] [ Step Delta ] | [ Reset (t=0) ]    |
| Time: 125,400 ps (125.4 ns) | Delta: 0 | Core: 0.988 V | Power: 34.2 mW       |
+-------------------------------------------------------------------------------+
```

### Actions de contrôle
- **Exécuter (`Espace` / `Ctrl + Entrée`)** : Démarre le cadencement autonome continu de l'horloge en arrière-plan dans le Web Worker ou le moteur Cranelift JIT à haute fréquence.
- **Pause (`Espace`)** : Suspend instantanément l'exécution de la simulation, figeant toutes les traces de signaux et les états des registres pour inspection.
- **+1 ns (`F10`)** : Fait avancer le temps physique de simulation d'exactement 1 000 picosecondes.
- **+100 ps (`Maj + F10`)** : Fait avancer le temps physique de simulation d'exactement 100 picosecondes pour une analyse temporelle fine.
- **Pas Delta (`F11`)** : Avance d'un cycle delta à temps nul (cycle δ) discret ($\delta \to \delta + 1$) sans incrémenter le temps physique, exposant les conditions de course combinatoires et les transitions de portes intermédiaires.
- **Réinitialiser (`Ctrl + R`)** : Rembobine le temps de simulation à $t=0$, réinitialise les vecteurs de signaux aux états initiaux et maintient la conception compilée afin que l'exécution puisse reprendre immédiatement sans réélaboration.

---

## Onglets du dock inférieur unifié

Le dock repliable organise les outils d'ingénierie secondaires essentiels :

### 1. Console et REPL
- Affiche les passes du compilateur, les métriques d'élaboration de l'AST et les instances de modules actives.
- Diffuse en temps réel les sorties `$display`, `$write` et `$monitor` de la simulation Verilog.
- Fournit une invite de commande interactive pour évaluer les expressions de signaux ou interroger les valeurs d'équipotentielles.

### 2. Problèmes et linter
- Liste les avertissements d'analyse statique et les erreurs de syntaxe actifs.
- Affiche l'identifiant de règle (`AXIOM_W001`, etc.), les badges de gravité et les noms des fichiers sources.
- Cliquer sur une carte de problème oriente instantanément l'éditeur Monaco vers la ligne en cause.

### 3. Radar de télémétrie
- Affiche des indicateurs analogiques en temps réel pour la tension du cœur, la chute de tension inductive du PDN (IR + L di/dt), le courant d'alimentation et la dissipation de puissance dynamique.

### 4. Dock de formes d'onde
- Génère un aperçu auxiliaire des formes d'onde lorsque le volet visualiseur principal est focalisé sur les schémas, le laboratoire virtuel ou le radar de temporisation.
