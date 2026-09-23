# 管脚与电气物理约束

物理约束将顶层 RTL 逻辑端口绑定到芯片物理封装管脚，并精细配置目标 FPGA 芯片的 I/O 电气缓冲器属性。

---

## 封装物理引脚绑定 (`PACKAGE_PIN`)

`set_property PACKAGE_PIN` 命令将逻辑端口指派给 FPGA 封装芯片上的特定物理焊球或管脚：

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

## I/O 电气电压标准 (`IOSTANDARD`)

每个已使用的物理引脚都必须显式定义其电气电平标准：

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

## 缓冲器压摆率与驱动强度

对于高速信号或对噪声敏感的关键网络，设计者可以精细配置输出驱动器物理参数：
- **`SLEW`**：控制输出信号沿跳变压摆率（高频选择 `FAST`；选择 `SLOW` 可有效抑制信号振铃与电磁干扰 EMI）。
- **`DRIVE`**：设置输出驱动电流能力，单位为毫安（例如 `4`、`8`、`12`、`16` mA）。

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## 内部弱上拉与弱下拉电阻

针对开漏输出总线或可能悬空的输入信号线（如 I2C 总线或矩阵键盘）：
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
