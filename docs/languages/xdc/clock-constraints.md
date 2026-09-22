# Clock Constraints & Timing Specifications

Clocks establish the temporal foundation of synchronous digital hardware. Without explicit clock constraints, Static Timing Analysis cannot calculate setup or hold slack.

---

## Primary Clock Definition (`create_clock`)

The `create_clock` constraint specifies an external clock source entering the FPGA:

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## Generated Clocks (`create_generated_clock`)

When a clock is derived internally from an oscillator via a frequency divider, PLL, or clock buffer, use `create_generated_clock`:

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## Clock Uncertainty & Jitter Modeling

Real-world clocks suffer from oscillator phase jitter and power supply noise. Axiom's STA engine incorporates uncertainty into slack calculations:

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{Data Required Time} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$
