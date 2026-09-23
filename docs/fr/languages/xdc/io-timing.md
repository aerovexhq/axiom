# Contraintes de délai d'entrée et de sortie

Les contraintes de délai d'entrée et de sortie décrivent les budgets temporels au niveau de la carte hors du FPGA, permettant au moteur d'analyse temporelle statique (STA) d'Axiom de vérifier la fermeture temporelle des interfaces.

---

## Délais d'entrée (`set_input_delay`)

`set_input_delay` spécifie le temps maximal pris par un périphérique externe pour présenter les données sur la broche FPGA après un front actif d'horloge :

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## Délais de sortie (`set_output_delay`)

`set_output_delay` spécifie le temps d'établissement et de maintien requis par un périphérique externe après que les données ont quitté le FPGA :

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
