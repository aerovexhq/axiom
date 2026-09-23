# 入出力遅延制約

入力および出力遅延制約は、FPGA外部の基板レベルのタイミングバジェットを記述し、Axiomの静的タイミング解析 (STA) エンジンがインターフェースのタイミング収束を検証できるようにします。

---

## 入力遅延 (`set_input_delay`)

`set_input_delay` は、アクティブクロックエッジ後に外部周辺デバイスがFPGAピンにデータを提示するまでの最大時間を指定します:

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## 出力遅延 (`set_output_delay`)

`set_output_delay` は、データがFPGAから出力された後に外部周辺デバイスが必要とするセットアップ時間およびホールド時間を指定します:

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
