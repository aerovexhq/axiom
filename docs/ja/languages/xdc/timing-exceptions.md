# タイミング例外＆非同期クロックグループ

タイミング例外は、非クリティカルなパスを無視するか、低速なマルチサイクル動作のサイクルバジェットを緩和するよう静的タイミング解析 (STA) エンジンに指示します。

---

## フォールスパス (`set_false_path`)

フォールスパスは、同期動作中に2点間のデータ転送が決して発生しないことをタイミングエンジンに伝え、誤ったタイミング違反を防ぎます:

```tcl
# 1. Asynchronous Reset Button: reset release is synchronized internally
set_false_path -from [get_ports rst_btn]

# 2. Static Configuration Switches: values change slowly and are not synchronized to sys_clk
set_false_path -from [get_ports {sw[*]}]

# 3. Status Display LEDs: visual indicators do not require nanosecond timing closure
set_false_path -to [get_ports {led[*]}]
```

---

## 非同期クロックグループ (`set_clock_groups`)

複数の独立したクロックソース（例: 100MHzシステムクロックと33MHz PCIクロック）を持つ設計では、ドメイン間を横断するパスを同期してタイミング解析することはできません:

```tcl
# Isolate sys_clk and pci_clk domains asynchronously
set_clock_groups -asynchronous \
                 -group [get_clocks sys_clk_pin] \
                 -group [get_clocks pci_clk]
```
Axiomの静的タイミング解析 (STA) エンジンは、これらのグループ間を横断するすべての信号がレジスタ接続された2段シンクロナイザを通過することを自動的に検証します。

---

## マルチサイクルパス (`set_multicycle_path`)

複数クロックサイクルにわたって完了するようにアーキテクチャ上予算化された複雑な算術演算の場合:

```tcl
# Permit 2 full clock cycles for floating-point multiplier output to reach destination register
set_multicycle_path 2 -setup -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
set_multicycle_path 1 -hold  -from [get_pins u_fpu/mult_stage1_reg/C] -to [get_pins u_fpu/acc_reg/D]
```
