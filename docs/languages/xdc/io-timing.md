# Input & Output Delay Constraints

Input and output delay constraints describe board-level timing budgets outside the FPGA, enabling Axiom's Static Timing Analysis engine to verify interface timing closure.

---

## Input Delays (`set_input_delay`)

`set_input_delay` specifies the maximum time an external peripheral device takes to present data at the FPGA pin after an active clock edge:

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## Output Delays (`set_output_delay`)

`set_output_delay` specifies the setup and hold time required by an external peripheral device after data exits the FPGA:

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
