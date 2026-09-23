# Excepciones de temporización y grupos de reloj asíncronos

Las excepciones de temporización instruyen al motor de análisis de temporización estática (STA) que ignore rutas no críticas o relaje los márgenes de ciclos para operaciones lentas de múltiples ciclos.

---

## Rutas falsas (`set_false_path`)

Las rutas falsas indican al motor de temporización que la transferencia de datos entre dos puntos nunca ocurrirá durante la operación síncrona, evitando violaciones de temporización falsas:

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## Grupos de reloj asíncronos (`set_clock_groups`)

En diseños con múltiples fuentes de reloj independientes (ej. reloj de sistema de 100 MHz y reloj PCI de 33 MHz), las rutas que cruzan entre dominios no pueden temporizarse de forma síncrona:

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
El motor STA de Axiom verifica automáticamente que cualquier señal que cruce entre estos grupos pase a través de un sincronizador de 2 etapas registrado.

---

## Rutas multietapa (`set_multicycle_path`)

Para operaciones aritméticas complejas presupuestadas arquitectónicamente para completarse a lo largo de múltiples ciclos de reloj:

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
