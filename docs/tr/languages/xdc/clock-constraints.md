# Saat Kısıtlamaları ve Zamanlama Belirtimleri

Saatler, senkron dijital donanımın zamansal temelini oluşturur. Açık saat kısıtlamaları olmadan, Statik Zamanlama Analizi (STA) kurma (setup) veya tutma (hold) payını hesaplayamaz.

---

## Birincil Saat Tanımı (`create_clock`)

`create_clock` kısıtlaması FPGA'ya giren harici bir saat kaynağını belirtir:

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## Üretilen Saatler (`create_generated_clock`)

Bir saat dahili olarak bir osilatörden frekans bölücü, PLL veya saat tamponu aracılığıyla türetildiğinde `create_generated_clock` kullanın:

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## Saat Belirsizliği ve Seğirme (Jitter) Modellemesi

Gerçek dünyadaki saatler, osilatör faz seğirmesinden ve güç kaynağı gürültüsünden etkilenir. Axiom'un STA motoru, pay hesaplamalarına belirsizliği dahil eder:

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{Veri Gerekli Zamanı} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$
