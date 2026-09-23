# Serveur de langage Monaco XDC et validation

Axiom EDA propose un serveur de langage (LSP) dédié et un surligneur de syntaxe pour les contraintes de conception Xilinx (`crates/lsp/src/xdc.rs`).

---

## Vérification syntaxique XDC en temps réel

Le service de langage Monaco XDC fonctionne directement dans les fichiers `.xdc` au sein de l'éditeur :
- **Validation des commandes Tcl** : Reconnaît `set_property`, `create_clock`, `create_generated_clock`, `set_input_delay`, `set_output_delay`, `set_false_path`, `set_clock_groups`, `set_multicycle_path`.
- **Gestion des commentaires** : Analyse avec précision les commentaires commençant par `#`, évitant les faux avertissements de syntaxe sur les configurations de broches commentées.
- **Validation des requêtes de ports** : Vérifie que les ports référencés dans `[get_ports <nom>]` existent dans le module racine de la conception active.

---

## Autocomplétion intelligente

La saisie dans un fichier `.xdc` déclenche des extraits d'autocomplétion contextuelle :
- **Liaison de broche de boîtier** : `set_property PACKAGE_PIN <BROCHE> [get_ports <PORT>]`
- **Assignation de standard d'E/S** : `set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **Horloge primaire** : `create_clock -period 10.000 -name <NOM> [get_ports <PORT>]`
- **Faux chemin** : `set_false_path -from [get_ports <PORT>]`
