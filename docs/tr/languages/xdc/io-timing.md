# Giriş ve Çıkış Gecikme Kısıtlamaları

Giriş ve çıkış gecikme kısıtlamaları, FPGA dışındaki kart düzeyindeki zamanlama bütçelerini tanımlayarak Axiom'un Statik Zamanlama Analizi (STA) motorunun arayüz zamanlama kapanışını doğrulamasını sağlar.

---

## Giriş Gecikmeleri (`set_input_delay`)

`set_input_delay`, harici bir çevre biriminin aktif bir saat kenarından sonra FPGA pininde veri sunması için geçen maksimum süreyi belirtir:

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## Çıkış Gecikmeleri (`set_output_delay`)

`set_output_delay`, veriler FPGA'dan çıktıktan sonra harici bir çevre birimi tarafından gereken kurma ve tutma süresini belirtir:

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
