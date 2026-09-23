# 端口输入输出延迟约束

输入与输出延迟约束描述了 FPGA 芯片外部板级的时序预算，使 Axiom 静态时序分析 (STA) 引擎能够全面验证板卡级外设通信接口的时序收敛。

---

## 输入端口延迟 (`set_input_delay`)

`set_input_delay` 指定外部前级设备在有效时钟沿之后，将数据驱动并稳定呈现在 FPGA 引脚上所需的最长时间：

```tcl
# Syntax: set_input_delay -clock <clock_name> -max <delay_ns> [get_ports <port>]
#         set_input_delay -clock <clock_name> -min <delay_ns> [get_ports <port>]

# External ADC presents data between 2.0 ns (min) and 4.5 ns (max) after sys_clk edge
set_input_delay -clock sys_clk_pin -max 4.500 [get_ports adc_data_in]
set_input_delay -clock sys_clk_pin -min 2.000 [get_ports adc_data_in]
```

---

## 输出端口延迟 (`set_output_delay`)

`set_output_delay` 指定当数据从 FPGA 引脚输出后，外部后级芯片所必需的建立时间与保持时间时序预算：

```tcl
# External DAC requires data to arrive at least 3.0 ns before the next sys_clk edge
set_output_delay -clock sys_clk_pin -max 3.000 [get_ports dac_data_out]

# External DAC hold requirement of 0.5 ns
set_output_delay -clock sys_clk_pin -min -0.500 [get_ports dac_data_out]
```
