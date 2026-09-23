# Zamanlama İstisnaları ve Asenkron Saat Grupları

Zamanlama istisnaları, Statik Zamanlama Analizi (STA) motoruna kritik olmayan yolları yok saymasını veya yavaş çok döngülü işlemler için döngü bütçelerini esnetmesini bildirir.

---

## Yanlış Yollar (`set_false_path`)

Yanlış yollar (false paths) zamanlama motoruna senkron çalışma sırasında iki nokta arasında asla veri transferi gerçekleşmeyeceğini bildirerek sahte zamanlama ihlallerini önler:

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## Asenkron Saat Grupları (`set_clock_groups`)

Birden çok bağımsız saat kaynağına sahip tasarımlarda (ör. 100 MHz sistem saati ve 33 MHz PCI saati), etki alanları arasında geçiş yapan yollar senkron olarak zamanlanamaz:

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
Axiom'un STA motoru, bu gruplar arasında geçiş yapan herhangi bir sinyalin yazmaçlı 2 aşamalı bir senkronizörden geçtiğini otomatik olarak doğrular.

---

## Çok Döngülü Yollar (`set_multicycle_path`)

Mimari olarak birden fazla saat döngüsünde tamamlanacak şekilde bütçelenmiş karmaşık aritmetik işlemler için:

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
