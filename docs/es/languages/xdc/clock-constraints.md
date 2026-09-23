# Restricciones de reloj y especificaciones de temporización

Los relojes establecen la base temporal del hardware digital síncrono. Sin restricciones explícitas de reloj, el análisis de temporización estática (STA) no puede calcular el margen (slack) de setup o hold.

---

## Definición del reloj principal (`create_clock`)

La restricción `create_clock` especifica una fuente de reloj externa que ingresa a la FPGA:

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## Relojes generados (`create_generated_clock`)

Cuando un reloj se deriva internamente de un oscilador mediante un divisor de frecuencia, PLL o búfer de reloj, use `create_generated_clock`:

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## Modelado de incertidumbre y jitter de reloj

Los relojes del mundo real sufren de jitter de fase del oscilador y ruido de la fuente de alimentación. El motor STA de Axiom incorpora la incertidumbre en los cálculos de margen (slack):

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{Data Required Time} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$ 
