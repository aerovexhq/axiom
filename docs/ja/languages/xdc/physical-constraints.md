# FPGA物理的制約＆ピン配置

物理的制約は、論理的な最上位RTLポートを物理パッケージピンにバインドし、ターゲットFPGAシリコンの電気的入出力バッファ特性を設定します。

---

## パッケージピンバインド (`PACKAGE_PIN`)

`set_property PACKAGE_PIN` コマンドは、RTLポートをFPGAパッケージ上の物理ボールまたはピンに割り当てます:

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

## 入出力電気標準規格 (`IOSTANDARD`)

すべての物理ピンには、電気電圧標準が定義されている必要があります:

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

## バッファスルーレート＆駆動強度

高速信号やノイズに敏感な信号の場合、設計者は出力ドライバパラメータを設定します:
- **`SLEW`**: 出力遷移エッジ速度を制御します（高周波用の `FAST`、リンギングや電磁妨害を低減する `SLOW`）。
- **`DRIVE`**: ドライバ出力電流容量をミリアンペア単位で設定します（例: `4`, `8`, `12`, `16`）。

```tcl
set_property SLEW FAST [get_ports spi_sclk]
set_property DRIVE 8   [get_ports spi_sclk]
```

---

## 内部プルアップ＆プルダウン抵抗

オープンドレインまたはフローティング入力バス（I2Cやキーパッドなど）の場合:
```tcl
set_property PULLUP TRUE   [get_ports i2c_sda]
set_property PULLDOWN TRUE [get_ports {ext_gpio[*]}]
```
