# Serveur de langage VHDL et règles de linter

Axiom EDA intègre un serveur de langage VHDL dédié (`crates/lsp/src/vhdl.rs`) fournissant la vérification syntaxique, l'audit de cohérence des types et la vérification des règles de conception directement dans l'éditeur Monaco.

---

## Règles de diagnostic pour VHDL

| Identifiant de règle | Gravité | Description | Correction |
| :--- | :--- | :--- | :--- |
| `VHDL_W001` | Avertissement | **Liste de sensibilité incomplète** : Un signal lu à l'intérieur d'un processus combinatoire est absent de la liste de sensibilité. | Ajoutez le signal manquant à `process(...)` ou utilisez `process(all)` (VHDL-2008). |
| `VHDL_W002` | Avertissement | **Verrou inféré** : Des branches `if-then-else` ou `case-when` incomplètes dans un processus combinatoire infèrent un verrou transparent indésirable. | Couvrez toutes les branches ou assignez une valeur par défaut avant les vérifications conditionnelles. |
| `VHDL_E001` | Erreur | **Incompatibilité de type** : Tentative d'assigner directement `std_logic_vector` à `unsigned` ou `integer` sans conversion. | Utilisez explicitement `to_integer()`, `unsigned()` ou `std_logic_vector()`. |
| `VHDL_W003` | Avertissement | **Signal inutilisé** : Un signal d'architecture déclaré n'est jamais assigné ni lu. | Supprimez la déclaration du signal mort. |
| `VHDL_E002` | Erreur | **Conflit multi-pilotes** : Plusieurs assignations concurrentes pilotent le même signal résolu. | Utilisez une assignation multiplexée unique. |
