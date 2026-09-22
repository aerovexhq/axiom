# Timing Exceptions & Asynchronous Clock Groups

Timing exceptions instruct the Static Timing Analysis engine to ignore non-critical paths or relax cycle budgets for slow multi-cycle operations.

---

## False Paths (`set_false_path`)

False paths tell the timing engine that data transfer between two points will never occur during synchronous operation, preventing false timing violations:

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## Asynchronous Clock Groups (`set_clock_groups`)

In designs with multiple independent clock sources (e.g., 100 MHz system clock and 33 MHz PCI clock), paths crossing between domains cannot be timed synchronously:

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
Axiom's STA engine automatically verifies that any signal crossing between these groups passes through a registered 2-stage synchronizer.

---

## Multicycle Paths (`set_multicycle_path`)

For complex arithmetic operations that are architecturally budgeted to complete over multiple clock cycles:

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
