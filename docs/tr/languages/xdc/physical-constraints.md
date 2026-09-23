# Fiziksel FPGA Kısıtlamaları ve Pin Yerleşimi

Fiziksel kısıtlamalar, mantıksal üst düzey RTL portlarını fiziksel kılıf pinlerine bağlar ve hedef FPGA silikonunun elektriksel G/Ç tampon özelliklerini yapılandırır.

---

## Kılıf Pini Bağlama (`PACKAGE_PIN`)

`set_property PACKAGE_PIN` komutu bir RTL portunu FPGA kılıfı üzerindeki fiziksel bir lehim topuna veya pine atar:

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

## G/Ç Elektriksel Standartları (`IOSTANDARD`)

Her fiziksel pinin elektriksel voltaj standardı tanımlanmalıdır:

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

## Tampon Dönüş Hızı (Slew Rate) ve Sürüş Gücü

Yüksek hızlı veya gürültüye duyarlı sinyaller için tasarımcılar çıkış sürücüsü parametrelerini yapılandırır:
- **`SLEW`**: Çıkış geçiş kenar hızını denetler (yüksek frekanslar için `FAST`, çınlamayı ve elektromanyetik paraziti azaltmak için `SLOW`).
- **`DRIVE`**: Sürücü çıkış akımı yeteneğini miliamper cinsinden ayarlar (ör. `4`, `8`, `12`, `16`).

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## Dahili Yukarı Çekme (Pull-Up) ve Aşağı Çekme (Pull-Down) Dirençleri

Açık savaklı (open-drain) veya yüzen giriş veri yolları için (I2C veya tuş takımları gibi):
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
