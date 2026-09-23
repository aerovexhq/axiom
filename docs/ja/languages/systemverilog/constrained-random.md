# 制約付きランダム検証

Axiom EDAは制約付きランダムテスト生成（`crates/syntax/src/stimulus.rs`）をサポートしており、検証エンジニアが正当な入力パラメータ空間、値の分布、制約を定義して潜在的なコーナーケースのバグを洗い出すことを可能にします。

---

## ランダム変数 (`rand`, `randc`)

- `rand`: 一様分布の疑似乱数整数を生成します。
- `randc`: 循環ランダム生成（反復前に範囲内の全順列がサンプリングされることを保証します）。

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

## 制約ブロック＆ソルビング

Axiomの内蔵制約ソルバーは、線形算術不等式と集合所属を評価します:
- **集合所属 (`inside`)**: 値を特定の範囲に制限します（`val inside {[10:50], [100:200]};`）。
- **含意制約 (`->`)**: 条件付き制約を定義します（`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`）。
- **先行解決 (`solve a before b`)**: 結合確率分布におけるサンプリング優先順序を制御します。

---

## テストベンチの自動生成

Axiom Studioでは、エンジニアは**ビジュアル刺激エディタ**（`StimulusGeneratorModal.tsx`）を使用して、シード値により再現可能な制約付きランダムテストベンチ（`tb_<top>.v`）を生成し、ワンクリックでHDLエクスポートできます。
