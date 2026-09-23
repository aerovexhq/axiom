# 时钟定义与时序约束规范

时钟构成了同步数字硬件的时间基准。若缺乏显式时钟约束，静态时序分析 (STA) 将无法准确计算建立时间 (Setup Slack) 或保持时间 (Hold Slack) 裕量。

---

## 主时钟定义 (`create_clock`)

`create_clock` 约束用于指定进入 FPGA 芯片的外部输入参考时钟源：

```tcl
# Syntax: create_clock -period <period_ns> -name <clock_name> [get_ports <port_name>]

# 100 MHz oscillator entering pin W5 (10.0 ns period, 50% duty cycle default)
create_clock -period 10.000 -name sys_clk_pin [get_ports sys_clk]

# 50 MHz external clock with custom duty cycle (60% high: 0 to 12 ns high, 12 to 20 ns low)
create_clock -period 20.000 -waveform {0.000 12.000} -name eth_rx_clk [get_ports rx_clk]
```

---

## 派生时钟定义 (`create_generated_clock`)

当某个时钟是由主振荡时钟经分频器、PLL 或门控时钟缓冲器在内部派生而来时，使用 `create_generated_clock` 进行约束：

```tcl
# Divided clock: 25 MHz pixel clock derived from 100 MHz sys_clk by divide-by-4 flip-flop
create_generated_clock -name pixel_clk \
                       -source [get_ports sys_clk] \
                       -divide_by 4 \
                       [get_pins clk_divider_reg/Q]
```

---

## 时钟不确定度与抖动建模

实际物理时钟必然存在晶振相位抖动与电源波动噪声。Axiom 的静态时序分析 (STA) 引擎将不确定度精确纳入时序裕量计算方程：

```tcl
# Add 200 ps setup uncertainty (pessimism) to sys_clk
set_clock_uncertainty -setup 0.200 [get_clocks sys_clk_pin]

# Add 100 ps hold uncertainty
set_clock_uncertainty -hold 0.100 [get_clocks sys_clk_pin]
```
$$\text{Data Required Time} = T_{\text{period}} - t_{\text{setup}} - t_{\text{uncertainty}}$$
