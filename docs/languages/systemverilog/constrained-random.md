# Constrained Random Verification

Axiom EDA supports constrained random test generation (`crates/syntax/src/stimulus.rs`), allowing verification engineers to define legal input parameter spaces, value distributions, and constraints to uncover obscure corner-case bugs.

---

## Random Variables (`rand`, `randc`)

- `rand`: Generates uniformly distributed pseudo-random integers.
- `randc`: Cyclic random generation (guarantees every permutation in the range is sampled before repeating).

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

## Constraint Blocks & Solving

Axiom's in-engine constraint solver evaluates linear arithmetic inequalities and set membership:
- **Set Membership (`inside`)**: Restricts values to ranges (`val inside {[10:50], [100:200]};`).
- **Implication Constraints (`->`)**: Conditional constraints (`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`).
- **Solve Before (`solve a before b`)**: Controls sampling priority order in joint probability distributions.

---

## Automated Testbench Generation

In Axiom Studio, engineers can use the **Visual Stimulus Editor** (`StimulusGeneratorModal.tsx`) to generate seed-repeatable constrained random testbenches (`tb_<top>.v`) with 1-click HDL export.
