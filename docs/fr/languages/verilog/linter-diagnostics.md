# Règles du linter statique et diagnostics d'Axiom

Axiom EDA intègre un linter d'analyse statique en temps réel en RAM (`crates/lsp/src/linter.rs`). Le linter analyse les arbres de syntaxe abstraite et la connectivité des netlists pour détecter les aléas de synthèse, les conditions de course en simulation et les erreurs électriques pendant l'écriture du code.

---

## Catalogue des règles de diagnostic

```
+-------------------------------------------------------------------------------+
| Axiom Static Linter Dashboard (Problems Dock)                                 |
| 0 Errors | 2 Warnings | 1 Informational | Real-Time Latency: 1.8 ms           |
+-------------------------------------------------------------------------------+
| [AXIOM_W001] Line 42: Blocking assignment (=) inside clocked sequential block |
| [AXIOM_W007] Line 88: Case statement missing default branch                   |
+-------------------------------------------------------------------------------+
```

### 1. `AXIOM_W001` : Assignation bloquante dans un processus séquentiel
- **Gravité** : Avertissement
- **Violation** : Utilisation de `=` au lieu de `<=` dans un processus déclenché sur front (`always @(posedge clk)`).
- **Aléa** : Introduit des conditions de course dépendantes du simulateur où les valeurs des registres peuvent être lues avant ou après mise à jour selon l'ordre d'exécution des threads.
- **Correction** : Remplacer `=` par `<=`.

### 2. `AXIOM_W002` : Assignation non bloquante dans un processus combinatoire
- **Gravité** : Avertissement
- **Violation** : Utilisation de `<=` dans un processus sensible au niveau (`always @*` ou `always @(a or b)`).
- **Aléa** : Provoque une surcharge inutile de cycles delta de simulation et de potentielles disparités de synthèse.
- **Correction** : Remplacer `<=` par `=`.

### 3. `AXIOM_W003` : Équipotentielle non pilotée
- **Gravité** : Avertissement
- **Violation** : Un fil `wire` ou une équipotentielle déclarée n'a aucun pilote continu (`assign`), sortie de porte ou connexion de port de sous-module.
- **Aléa** : L'équipotentielle reste flottante en permanence à haute impédance (`Z`) ou inconnue (`X`).
- **Correction** : Ajouter un pilote ou supprimer la déclaration d'équipotentielle inutilisée.

### 4. `AXIOM_W004` : Signal inutilisé
- **Gravité** : Avertissement
- **Violation** : Un registre ou une équipotentielle déclarée est écrit ou défini mais jamais lu dans aucun cône logique aval.
- **Aléa** : Surface de silicium morte et inférence inutile de portes.
- **Correction** : Supprimer le signal inutilisé ou le connecter au consommateur cible.

### 5. `AXIOM_E002` : Conflit d'équipotentielle multi-pilotes
- **Gravité** : Erreur
- **Violation** : Plusieurs assignations continues ou pilotes simultanés pilotent le même fil `wire`.
- **Aléa** : Court-circuit électrique sur le silicium physique ; évalué comme conflit inconnu (`X`) en simulation.
- **Correction** : Insérer un multiplexeur ou s'assurer qu'un seul pilote contrôle l'équipotentielle.

### 6. `AXIOM_W006` : Verrou transparent inféré
- **Gravité** : Avertissement
- **Violation** : Un processus combinatoire laisse une variable cible non assignée le long d'un ou plusieurs chemins d'exécution conditionnels.
- **Aléa** : Les outils de synthèse infèrent un verrou asynchrone sensible au niveau, introduisant de graves problèmes de fermeture temporelle et une sensibilité aux glitchs d'horloge.
- **Correction** : S'assurer que toutes les variables sont assignées dans chaque branche `if-else`, ou assigner une valeur par défaut en tête de bloc `always @*`.

### 7. `AXIOM_W007` : Absence de default dans le case
- **Gravité** : Avertissement
- **Violation** : Une instruction `case` omet la branche `default:`.
- **Aléa** : Les combinaisons d'entrée non couvertes provoquent l'inférence de verrous ou bloquent les machines à états.
- **Correction** : Ajouter `default: <état_sûr>;`.

### 8. `AXIOM_W008` : Discordance de largeur de bits
- **Gravité** : Avertissement
- **Violation** : La largeur de bits de l'équipotentielle de gauche n'est pas égale à la largeur de bits de l'expression de droite.
- **Aléa** : Troncature silencieuse des bits de poids fort (MSB) ou extension involontaire de zéros ou de signe.
- **Correction** : Aligner explicitement les largeurs de bits ou utiliser le découpage en sous-parties.
