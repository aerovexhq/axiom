# Physische FPGA-Constraints & Pin-Platzierung

Physische Constraints binden logische Top-Level-RTL-Ports an physische Gehäuse-Pins und konfigurieren die elektrischen E/A-Puffereigenschaften des Ziel-FPGA-Siliziums.

---

## Gehäuse-Pin-Bindung (`PACKAGE_PIN`)

Der Befehl `set_property PACKAGE_PIN` weist einen RTL-Port einem physischen Ball oder Pin auf dem FPGA-Gehäuse zu:

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

## Elektrische E/A-Standards (`IOSTANDARD`)

Für jeden physischen Pin muss sein elektrischer Spannungsstandard definiert sein:

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

## Puffer-Flankensteilheit (Slew Rate) & Treiberstärke

Für Hochgeschwindigkeits- oder rauschsensible Signale konfigurieren Entwickler die Ausgangstreiberparameter:
- **`SLEW`**: Steuert die Flankensteilheit des Ausgangs (`FAST` für hohe Frequenzen, `SLOW` zur Reduzierung von Überschwingern und elektromagnetischen Interferenzen).
- **`DRIVE`**: Legt die Treiber-Ausgangsstromstärke in Milliampere fest (z. B. `4`, `8`, `12`, `16`).

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## Interne Pull-Up- & Pull-Down-Widerstände

Für Open-Drain- oder unbeschaltete Eingangsbusse (wie I2C oder Tastaturfelder):
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
