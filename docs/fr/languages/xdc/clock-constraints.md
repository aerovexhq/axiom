# Contraintes d'horloge et spécifications temporelles

Les horloges établissent le fondement temporel du matériel numérique synchrone. Sans contraintes d'horloge explicites, l'analyse temporelle statique (STA) ne peut calculer les marges d'établissement ou de maintien.

---

## Définition de l'horloge primaire (`create_clock`)

La contrainte `create_clock` spécifie une source d'horloge externe entrant dans le FPGA :

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## Horloges générées (`create_generated_clock`)

Lorsqu'une horloge est dérivée en interne d'un oscillateur via un diviseur de fréquence, une PLL ou un tampon d'horloge, utilisez `create_generated_clock` :

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## Modélisation de l'incertitude et de la gigue d'horloge

Les horloges réelles souffrent de la gigue de phase d'oscillateur et du bruit d'alimentation. Le moteur d'analyse temporelle statique (STA) d'Axiom intègre l'incertitude dans les calculs de marge :

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{Data Required Time} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$
