# SAIF 功耗与 VCD 波形互操作性

为确保与现有工业界验证环境无缝集成，Axiom 生成标准的 **IEEE 1364 Value Change Dump (VCD)** 与 **Synopsys SAIF 2.0 (.saif)** 文件。

---

## 1. IEEE 1364 Value Change Dump (VCD) 波形

Axiom 的 `VcdWriter` 采用标准 VCD 规范格式化所有网表状态跳变：
- 文件头：`$date`、`$version`、`$timescale 1 ps`。
- 层次结构：层次化的 `$scope module` 与 `$upscope` 作用域块。
- 变量定义：多位宽 `$var wire [width] [symbol] [name]` 变量声明。
- 初始状态：$t = 0$ 时的 `$dumpvars` 状态全量导出。
- 跳变时序：带有二进制和十六进制总线跳变交织的时间戳标记（`#1000`）。

Axiom 生成的 Value Change Dump (VCD) 文件可直接在以下工具中打开：
- **GTKWave**
- **Surfer**
- **AMD Vivado 波形查看器**
- **Sigrok / PulseView**

---

## 2. 翻转活动交换格式 (SAIF 2.0)

Vivado 中的 `report_power` 进行精确功耗评估需要高置信度的动态仿真向量，而非粗糙的无向量静态估算。

Axiom 生成包含精确翻转概率的合规 SAIF 2.0 文件：
```text
(SAIFILE
  (SAIFVERSION "2.0")
  (DIRECTION "backward")
  (DESIGN "counter")
  (DATE "Axiom HDL Engine")
  (VENDOR "Axiom")
  (PROGRAM_NAME "Axiom Simulator")
  (PROGRAM_VERSION "1.0.0")
  (DIVIDER /)
  (TIMESCALE 1 ps)
  (DURATION 50000)
  (INSTANCE counter
    (NET
      (clk (T0 25000) (T1 25000) (TX 0) (TZ 0) (TC 99))
      (rst_n (T0 1000) (T1 49000) (TX 0) (TZ 0) (TC 1))
      (count (T0 12000) (T1 38000) (TX 0) (TZ 0) (TC 48))
    )
  )
)
```

### 加载进 AMD Vivado
在 Vivado Tcl 终端中运行：
```tcl
open_run impl_1
read_saif -strip_path /tb_top/u_dut -file power.saif
report_power -file post_sim_power.rpt
```
Vivado 会自动根据 Axiom 实测的 SAIF 翻转计数更新其内部动态开关活动率矩阵。
