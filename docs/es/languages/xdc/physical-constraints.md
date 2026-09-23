# Restricciones físicas de FPGA y ubicación de pines

Las restricciones físicas vinculan los puertos lógicos RTL de nivel superior con los pines físicos del encapsulado y configuran las propiedades de los búferes de E/S eléctricos del silicio FPGA de destino.

---

## Vinculación de pines de encapsulado (`PACKAGE_PIN`)

El comando `set_property PACKAGE_PIN` asigna un puerto RTL a una bola o pin físico en el encapsulado de la FPGA:

```tcl
# Assign top-level clock port 'sys_clk' to 100 MHz oscillator pin W5
set_property PACKAGE_PIN W5 [get_ports sys_clk]

# Assign reset button to Center Pushbutton pin U18
set_property PACKAGE_PIN U18 [get_ports rst_btn]

# Assign multi-bit bus to contiguous slide switches (SW0 to SW3)
set_property PACKAGE_PIN V17 [get_ports {sw[0]}]
set_property PACKAGE_PIN V16 [get_ports {sw[1]}]
set_property PACKAGE_PIN W16 [get_ports {sw[2]}]
set_property PACKAGE_PIN W17 [get_ports {sw[3]}]

# Assign LED outputs (LD0 to LD3)
set_property PACKAGE_PIN U16 [get_ports {led[0]}]
set_property PACKAGE_PIN E19 [get_ports {led[1]}]
set_property PACKAGE_PIN U19 [get_ports {led[2]}]
set_property PACKAGE_PIN V19 [get_ports {led[3]}]
```

---

## Estándares eléctricos de E/S (`IOSTANDARD`)

Cada pin físico debe tener definido su estándar de tensión eléctrica:

```tcl
# 3.3V Low-Voltage CMOS (Standard on Basys 3 / Nexys boards)
set_property IOSTANDARD LVCMOS33 [get_ports sys_clk]
set_property IOSTANDARD LVCMOS33 [get_ports {sw[*]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[*]}]

# 1.8V Low-Voltage CMOS
set_property IOSTANDARD LVCMOS18 [get_ports vaux_p]

# Differential SSTL (Stub Series Terminated Logic) for DDR memory
set_property IOSTANDARD DIFF_SSTL15 [get_ports ddr_clk_p]
```

---

## Velocidad de transición del búfer y fuerza de excitación

Para señales de alta velocidad o sensibles al ruido, los diseñadores configuran los parámetros del controlador de salida:
- **`SLEW`**: Controla la velocidad del flanco de transición de salida (`FAST` para altas frecuencias, `SLOW` para reducir el sobreimpulso y la interferencia electromagnética).
- **`DRIVE`**: Establece la capacidad de corriente de salida del controlador en miliamperios (ej., `4`, `8`, `12`, `16`).

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## Resistencias internas de Pull-Up y Pull-Down

Para buses de entrada de drenador abierto o flotantes (como I2C o teclados):
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
