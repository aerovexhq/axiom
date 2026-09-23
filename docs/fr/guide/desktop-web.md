# Architecture bureau et web

Axiom propose une architecture unifiée à double cible : une application de bureau native légère et un tableau de bord d'ingénierie WebAssembly sans installation 100% dans le navigateur.

---

## Aperçu de la double cible

```
                        Axiom Core Architecture
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        Native Desktop Target                WebAssembly Target
        - Tauri v2 (Rust IPC)               - wasm32-unknown-unknown
        - Linux, macOS, Windows             - 100% Client-Side In-Browser
        - Direct Cranelift JIT in RAM       - Portable Evaluator in WebWorker
        - Sub-50 MB Binary                  - Zero Backend Server Dependencies
```

---

## Interface moderne au thème sombre Obsidian

Le frontend d'ingénierie est construit à l'aide de **React 19**, **TypeScript 5.7**, **PostCSS** et **Vite 6**, offrant un espace de travail sombre inspiré d'Obsidian et Linear :

1. **En-tête de contrôle de simulation** :
   - Commandes d'avancement discret : `Run Free`, `Pause`, `+1 ns`, `+100 ps` et `Step δ` (cycle delta à temps nul (cycle δ)).
   - Indicateurs de télémétrie en direct : Horodatage de simulation ($ps / ns$), Cycle delta actif ($\delta$), Courant transitoire de crête ($mA$) et Chute de tension maximale ($mV$).
2. **Explorateur hiérarchique de netlist élaborée** :
   - Vue arborescente récursive des portées élaborées, des instances de modules, des registres, des fils et des processus procéduraux.
   - Sélecteur de bancs d'essai intégré (ALU, Compteur avec glitchs, Cœur hiérarchique).
3. **Visualiseur de formes d'onde Canvas 2D haute performance** :
   - Rendu logique numérique virtualisé à plus de 60 FPS.
   - Couleurs distinctes de logique à 4 états : 0 (ardoise), 1 (émeraude), X (rose), Z (ambre).
   - Enveloppes de transition en losange pour bus multibits avec valeurs hexadécimales centrées.
   - **Loupe de glitchs delta** : Met en évidence les aléas transitoires à temps nul avec des drapeaux d'avertissement roses.
4. **Graphiques de télémétrie silicium physique** :
   - Courbe de courant transitoire analogique ($I(t)$) avec dégradé cyan.
   - Chute de tension inductive du rail d'alimentation ($V_{sag} = IR + L \frac{di}{dt}$).
   - Cartes de synthèse dynamique : Puissance moyenne ($mW$), Courant de crête ($mA$), Chute maximale ($mV$) et Énergie totale dissipée ($nJ$).
5. **Console du noyau de simulation et exportateurs** :
   - Flux de journalisation des événements en temps réel.
   - Téléchargements en un clic des fichiers IEEE 1364 `.vcd` et Synopsys `.saif`.
