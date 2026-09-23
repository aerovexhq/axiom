# Takt-Constraints & Timing-Spezifikationen

Takte bilden das zeitliche Fundament synchroner digitaler Hardware. Ohne explizite Takt-Constraints kann die Statische Timing-Analyse keinen Setup- oder Hold-Slack berechnen.

---

## Primäre Taktdefinition (`create_clock`)

Das `create_clock`-Constraint gibt eine externe Taktquelle an, die in das FPGA eintritt:

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## Generierte Takte (`create_generated_clock`)

Wenn ein Takt intern von einem Oszillator über einen Frequenzteiler, eine PLL oder einen Taktpuffer abgeleitet wird, verwenden Sie `create_generated_clock`:

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## Taktunsicherheit & Jitter-Modellierung

Reale Takte leiden unter Oszillator-Phasenjitter und Rauschen der Stromversorgung. Die STA-Engine von Axiom bezieht Unsicherheiten in die Slack-Berechnungen ein:

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{Erforderliche Datenzeit} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$
