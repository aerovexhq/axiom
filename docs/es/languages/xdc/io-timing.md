# Restricciones de retardo de entrada y salida

Las restricciones de retardo de entrada y salida describen los presupuestos de temporización a nivel de placa fuera de la FPGA, lo que permite al motor de análisis de temporización estática (STA) de Axiom verificar el cierre de temporización de la interfaz.

---

## Retardos de entrada (`set_input_delay`)

`set_input_delay` especifica el tiempo máximo que tarda un dispositivo periférico externo en presentar datos en el pin de la FPGA tras un flanco de reloj activo:

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## Retardos de salida (`set_output_delay`)

`set_output_delay` especifica el tiempo de setup y hold requerido por un dispositivo periférico externo tras la salida de datos de la FPGA:

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
