# Migration depuis AMD Vivado vers Axiom

Axiom a été conçu dès ses fondements pour constituer un remplacement direct des flux de simulation et de vérification d'AMD Vivado Design Suite.

---

## Correspondance des commandes

| Tâche | Commande AMD Vivado | Équivalent CLI Axiom |
| :--- | :--- | :--- |
| **Analyser Verilog** | `xvlog design.v` | Intégré dans `axiom compile` |
| **Élaborer la conception** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **Lancer la simulation** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **Exporter la forme d'onde VCD** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **Exporter l'activité SAIF** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **Mesurer la latence** | Chronomètre manuel / journaux de profilage | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## Zéro surcoût d'instantané sur disque

Dans Vivado, l'élaboration produit un répertoire d'instantanés sur disque :
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

Dans Axiom, la compilation et la simulation s'exécutent à 100% en RAM :
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
Aucun répertoire de cache `xsim.dir`, aucun fichier d'instantané de plusieurs gigaoctets et aucun artefact binaire obsolète.
