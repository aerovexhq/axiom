# Exceptions temporelles et groupes d'horloges asynchrones

Les exceptions temporelles ordonnent au moteur d'analyse temporelle statique (STA) d'ignorer les chemins non critiques ou d'assouplir les budgets de cycles pour les opérations lentes multi-cycles.

---

## Faux chemins (`set_false_path`)

Les faux chemins indiquent au moteur temporel que le transfert de données entre deux points n'aura jamais lieu en fonctionnement synchrone, évitant ainsi les fausses violations temporelles :

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## Groupes d'horloges asynchrones (`set_clock_groups`)

Dans les conceptions comportant plusieurs sources d'horloge indépendantes (ex. horloge système à 100 MHz et horloge PCI à 33 MHz), les chemins traversant les domaines ne peuvent être synchronisés temporellement :

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
Le moteur d'analyse temporelle statique (STA) d'Axiom vérifie automatiquement que tout signal traversant ces groupes transite par un synchroniseur à bascules à 2 étages.

---

## Chemins multi-cycles (`set_multicycle_path`)

Pour les opérations arithmétiques complexes dont le budget architectural prévoit l'achèvement sur plusieurs cycles d'horloge :

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
