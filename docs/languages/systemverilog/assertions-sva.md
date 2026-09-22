# SystemVerilog Assertions (SVA) & Formal Verification

SystemVerilog Assertions (SVA) specify expected behavior and temporal protocols mathematically. Axiom EDA integrates SVA with its in-engine Bounded Model Checker (`crates/sim/src/formal/`), allowing properties to be verified during transient simulation or proven formally for all time.

---

## Immediate vs. Concurrent Assertions

### 1. Immediate Assertions
Evaluated as procedural statements at a single simulation time step:

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. Concurrent Assertions
Sampled synchronously at clock edges over temporal sequences of cycles:

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## Temporal Sequences & Operators

| Operator | Syntax | Description |
| :--- | :--- | :--- |
| **Cycle Delay** | `##n` | Exactly $n$ clock cycles later |
| **Bounded Range** | `##[min:max]` | Between $min$ and $max$ clock cycles later |
| **Consecutive Rep** | `expr [*n]` | Expression holds true for $n$ consecutive cycles |
| **Overlapping Imp** | `ante \|-> cons` | If antecedent holds, consequent must hold in the **same** cycle |
| **Non-Overlapping Imp**| `ante \|=> cons` | If antecedent holds, consequent must hold in the **next** cycle |
| **System Function** | `$rose(signal)` | Evaluates true on a 0-to-1 rising edge transition |
| **System Function** | `$fell(signal)` | Evaluates true on a 1-to-0 falling edge transition |
| **System Function** | `$stable(signal)` | Evaluates true if signal value is unchanged since prior cycle |

---

## Verification Directives: `assert`, `assume`, `cover`

- **`assert property`**: Proves that design logic never violates the property. Violations generate counterexample traces in Axiom's Formal Studio.
- **`assume property`**: Restrains primary inputs to valid operating environments during formal bounded model checking.
- **`cover property`**: Proves that a target functional state is reachable, generating witness execution traces.
