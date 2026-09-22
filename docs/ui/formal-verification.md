# Formal Property Verification (FPV) Studio

Axiom EDA features an in-engine Bounded Model Checker (BMC) and $k$-induction formal verification suite (`crates/sim/src/formal/`, `FormalVerificationViewer.tsx`). Rather than relying exclusively on pseudo-random test vectors that may miss obscure corner cases, formal verification mathematically proves or falsifies SystemVerilog Assertions (SVA) across all possible input scenarios.

---

## Bounded Model Checking & k-Induction

```
+-------------------------------------------------------------------------------+
| Formal Verification Studio: Bound Depth K = 20 | Mode: k-Induction           |
| Proven: 8 | Falsified: 1 (Counterexample) | Witnessed: 4 | Inconclusive: 0    |
+-------------------------------------------------------------------------------+
| Verification Goals:                                                           |
| Status    | Goal Name           | Type   | Bound | Time (ms) | Trace          |
|-----------+---------------------+--------+-------+-----------+----------------|
| [PROVEN]  | p_fifo_no_overflow  | assert | K=20  | 14.2 ms   | -              |
| [PROVEN]  | p_fsm_legal_state   | assert | K=20  |  8.1 ms   | -              |
| [FALSIFY] | p_ack_within_4_cyc  | assert | K=12  | 24.8 ms   | [View Trace]   |
| [WITNESS] | c_fifo_full_reached | cover  | K=8   |  5.3 ms   | [View Trace]   |
+-------------------------------------------------------------------------------+
```

### 1. Bounded Model Checking (BMC)
BMC unrolls the hardware state transition relation over $k$ discrete clock cycles ($s_0 \to s_1 \to \dots \to s_k$). The engine evaluates whether any reachable state violates an assertion. If an invalid state is encountered at step $j \le k$, the engine extracts an exact **counterexample trace**.

### 2. $k$-Induction (Complete Proofs)
$k$-Induction proves that if a property holds for the first $k$ base steps, and assuming it holds for any arbitrary sequence of $k$ steps implies it holds for step $k+1$, then the property is **unconditionally proven** for all infinite time ($t \to \infty$).

---

## Automated Structural Verification Goals

When opening a design in the Formal Studio, Axiom automatically synthesizes baseline structural safety properties without requiring manual SVA authoring:
- **`p_no_unknown_out`**: Proves that primary outputs never transition to high-impedance (`Z`) or unknown (`X`) states after reset deassertion.
- **`p_fsm_state_valid`**: Proves that one-hot and binary state registers never enter undocumented or illegal state vectors.
- **`p_reset_stability`**: Proves that internal registers maintain safe reset states while the reset line is asserted.
- **`c_fsm_active`**: Automatically generates cover properties proving that every declared FSM state is reachable.

---

## Counterexample Scrubber & Waveform Trace Injection

When an assertion fails, Axiom generates a minimal counterexample trace:
- **Cycle-by-Cycle Scrubber**: Step through each cycle leading to the assertion violation with a signal diff table showing which nets triggered the failure.
- **1-Click Waveform Injection**: Clicking **Inject Trace to Waveform** loads the counterexample trace directly into the Waveform Viewer, placing the time marker exactly at the violation cycle.

---

## SVA Property Assistant Modal

The Formal Studio includes an interactive SVA Property Assistant (`SvaAssistantModal`):
- **Immediate Assertions**: Simple invariant assertions (`assert (ready == 1);`).
- **Request-Grant Handshake**: `req |-> ##[1:4] gnt` ensuring response arrives within bounded cycles.
- **FIFO Ordering**: Verifies that written data appears at the output in exact first-in, first-out order without corruption.
- **Stability Under Stall**: Ensures data bus remains constant while `stall` is asserted (`stall |-> $stable(data)`).
