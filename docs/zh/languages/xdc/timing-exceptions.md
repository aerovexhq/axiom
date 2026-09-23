# 时序异常 (False/Multicycle Path) 与异步时钟组

时序异常指示静态时序分析 (STA) 引擎忽略非关键异步路径，或为慢速多周期运算放宽建立时间周期预算。

---

## 伪路径异常约束 (`set_false_path`)

伪路径约束告知时序引擎两点之间的数据传输在同步操作期间绝不会在单周期内采样，从而避免产生虚假的时序违例告警：

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## 异步时钟组约束 (`set_clock_groups`)

在包含多个独立时钟源的硬件设计中（例如 100 MHz 系统时钟与 33 MHz PCI 时钟），跨时钟域路径无法以单一时钟周期进行同步时序分析：

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
Axiom 的静态时序分析 (STA) 引擎会自动验证跨越这些时钟组的任何信号是否均通过了合规的双级寄存器同步器。

---

## 多周期路径约束 (`set_multicycle_path`)

对于在微架构设计上允许耗费多个时钟周期完成计算的复杂算术运算逻辑：

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
