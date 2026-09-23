# Eingangs- & Ausgangs-Verzögerungs-Constraints

Eingangs- und Ausgangsverzögerungs-Constraints beschreiben Timing-Budgets auf Platinenebene außerhalb des FPGAs, wodurch die Statische Timing-Analyse-Engine von Axiom den Schnittstellen-Timing-Abschluss verifizieren kann.

---

## Eingangsverzögerungen (`set_input_delay`)

`set_input_delay` gibt die maximale Zeit an, die ein externes Peripheriegerät benötigt, um nach einer aktiven Taktflanke Daten am FPGA-Pin bereitzustellen:

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## Ausgangsverzögerungen (`set_output_delay`)

`set_output_delay` gibt die Setup- und Hold-Zeit an, die von einem externen Peripheriegerät benötigt wird, nachdem Daten das FPGA verlassen:

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
