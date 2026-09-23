# Timing-Ausnahmen & Asynchrone Taktgruppen

Timing-Ausnahmen weisen die Statische Timing-Analyse-Engine an, unkritische Pfade zu ignorieren oder Zyklusbudgets für langsame Mehrzyklusoperationen zu lockern.

---

## Falsche Pfade (`set_false_path`)

Falsche Pfade (False Paths) teilen der Timing-Engine mit, dass eine Datenübertragung zwischen zwei Punkten während des synchronen Betriebs niemals stattfindet, was falsche Timing-Verletzungen verhindert:

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## Asynchrone Taktgruppen (`set_clock_groups`)

In Designs mit mehreren unabhängigen Taktquellen (z. B. 100-MHz-Systemtakt und 33-MHz-PCI-Takt) können domänenübergreifende Pfade nicht synchron getimt werden:

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
Die STA-Engine von Axiom überprüft automatisch, ob jedes Signal, das diese Gruppen kreuzt, einen zweistufigen Registersynchronisierer durchläuft.

---

## Mehrzykluspfade (`set_multicycle_path`)

Für komplexe arithmetische Operationen, die architektonisch so ausgelegt sind, dass sie über mehrere Taktzyklen hinweg abgeschlossen werden:

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
