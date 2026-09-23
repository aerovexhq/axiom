# 约束随机测试平台验证

Axiom EDA 支持约束随机测试平台生成（`crates/syntax/src/stimulus.rs`），允许验证工程师定义合法输入参数空间、取值概率分布与边界约束，从而挖掘深层次的边界极端 Bug。

---

## 随机变量 (`rand`, `randc`)

- `rand`：生成均匀分布的伪随机整数。
- `randc`：周期性随机循环生成（确保在重复之前遍历采样取值范围内的每一种排列）。

```verilog
class ethernet_packet;
    rand  bit [15:0] length;
    rand  bit [7:0]  payload[];
    randc bit [3:0]  priority_id;

    // Constraint block defining legal packet size
    constraint c_length {
        length inside {[64:1518]}; // Standard Ethernet frame size
    }

    // Weighted distribution constraint
    constraint c_priority {
        priority_id dist {
            0       := 50,  // 50% probability for background priority
            [1:3]   := 30,  // 30% divided across normal priority
            [4:7]   := 20   // 20% for high priority
        };
    }
endclass
```

---

## 约束块与求解机制

Axiom 内置约束求解器高效求解线性算术不等式与集合成员关系：
- **集合成员 (`inside`)**：将取值限制在指定范围或离散集合内（`val inside {[10:50], [100:200]};`）。
- **条件蕴涵约束 (`->`)**：前项触发条件约束（`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`）。
- **求解次序 (`solve a before b`)**：控制联合概率分布中的随机变量采样计算优先级。

---

## 自动化测试平台生成

在 Axiom Studio 中，工程师可以使用**可视化测试激励编辑器**（`StimulusGeneratorModal.tsx`）生成种子可重现的约束随机测试平台（`tb_<top>.v`），支持一键导出 HDL 代码。
