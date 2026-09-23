# Aperçu des contraintes de conception Xilinx (XDC / SDC)

Axiom EDA offre une prise en charge native pour l'analyse, la validation et l'exécution des fichiers **Xilinx Design Constraints (XDC)** (`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`). XDC est basé sur la syntaxe standard de l'industrie Synopsys Design Constraints (SDC), étendue avec des propriétés basées sur Tcl pour la configuration physique des composants FPGA.

---

## Le double rôle de XDC dans Axiom

```
+-------------------------------------------------------------------------------+
| XDC Constraints File (constrs_1/timing.xdc)                                   |
+---------------------------------------+---------------------------------------+
| Physical Constraints                  | Static Timing Constraints             |
|---------------------------------------+---------------------------------------|
| - Package pin allocation (PACKAGE_PIN)| - Clock definitions (create_clock)    |
| - I/O electrical standard (IOSTANDARD)| - I/O setup/hold delays               |
| - Drive strength & slew rate          | - False paths & multicycle exceptions |
| - Pull-up & pull-down resistors       | - Asynchronous clock domain isolation |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|       [Floorplanning & Virtual Lab]       [Static Timing Analysis Engine]     |
|       - Physical die placement            - Critical path waterfall           |
|       - Basys 3 board mapping             - Setup & hold slack calculation    |
+-------------------------------------------------------------------------------+
```

### Capacités clés dans Axiom
1. **LSP sans faux positifs** : Le serveur de langage XDC en RAM d'Axiom analyse les commentaires `#`, valide les mots-clés de commande et fournit l'autocomplétion des ports sans signaler les contraintes valides comme erreurs de syntaxe.
2. **Liaison directe au Virtual Lab** : Les mappages physiques de broches (`PACKAGE_PIN V17`, `PACKAGE_PIN U16`) sont dynamiquement liés au rack de laboratoire virtuel d'Axiom, connectant le RTL simulé directement aux interrupteurs à glissière et LED de la Basys 3.
3. **Intégration au moteur STA** : Les définitions d'horloge (`create_clock -period 10.0`) établissent la fréquence de référence temporelle pour le moteur d'analyse temporelle statique (STA) et le radar de temporisation.
