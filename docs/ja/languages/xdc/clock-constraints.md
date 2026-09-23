# クロック制約＆タイミング仕様

クロックは同期デジタルハードウェアの時間的基盤を確立します。明示的なクロック制約がなければ、静的タイミング解析 (STA) はセットアップやホールドのスラックを計算できません。

---

## プライマリクロック定義 (`create_clock`)

`create_clock` 制約は、FPGAに入力される外部クロックソースを指定します:

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## 生成クロック (`create_generated_clock`)

クロックが周波数分周器、PLL、またはクロックバッファを介して発振器から内部生成される場合は、`create_generated_clock` を使用します:

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## クロック不確かさ＆ジッターモデリング

現実世界のクロックには発振器の位相ジッターや電源ノイズが存在します。AxiomのSTAエンジンはスラック計算に不確かさを組み込んでいます:

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{要求データ時間} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$
