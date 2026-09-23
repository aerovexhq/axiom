# Contraintes physiques FPGA et placement des broches

Les contraintes physiques lient les ports RTL logiques de niveau supérieur aux broches physiques du boîtier et configurent les propriétés électriques des tampons d'E/S du silicium FPGA cible.

---

## Liaison de broche de boîtier (`PACKAGE_PIN`)

La commande `set_property PACKAGE_PIN` assigne un port RTL à une bille ou broche physique du boîtier FPGA :

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

## Standards électriques d'E/S (`IOSTANDARD`)

Chaque broche physique doit avoir son standard de tension électrique défini :

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

## Vitesse de balayage du tampon et force de commande

Pour les signaux à haute vitesse ou sensibles au bruit, les concepteurs configurent les paramètres des pilotes de sortie :
- **`SLEW`** : Contrôle la vitesse des fronts de transition de sortie (`FAST` pour les hautes fréquences, `SLOW` pour réduire le dépassement et les interférences électromagnétiques).
- **`DRIVE`** : Définit la capacité de courant de sortie du pilote en milliampères (ex. `4`, `8`, `12`, `16`).

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## Résistances de tirage vers le haut et vers le bas internes

Pour les bus d'entrée à drain ouvert ou flottants (tels que l'I2C ou les claviers) :
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
