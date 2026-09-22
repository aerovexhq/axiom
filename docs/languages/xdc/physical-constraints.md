# Physical FPGA Constraints & Pin Placement

Physical constraints bind logical top-level RTL ports to physical package pins and configure the electrical I/O buffer properties of the target FPGA silicon.

---

## Package Pin Binding (`PACKAGE_PIN`)

The `set_property PACKAGE_PIN` command assigns an RTL port to a physical ball or pin on the FPGA package:

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

## I/O Electrical Standards (`IOSTANDARD`)

Every physical pin must have its electrical voltage standard defined:

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

## Buffer Slew Rate & Drive Strength

For high-speed or noise-sensitive signals, designers configure output driver parameters:
- **`SLEW`**: Controls output transition edge speed (`FAST` for high frequencies, `SLOW` to reduce ringing and electromagnetic interference).
- **`DRIVE`**: Sets driver output current capability in milliamps (e.g., `4`, `8`, `12`, `16`).

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## Internal Pull-Up & Pull-Down Resistors

For open-drain or floating input buses (such as I2C or keypads):
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
