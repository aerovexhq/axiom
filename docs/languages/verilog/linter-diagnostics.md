# Axiom Static Linter & Diagnostic Rules

Axiom EDA incorporates a real-time, in-RAM static analysis linter (`crates/lsp/src/linter.rs`). The linter analyzes abstract syntax trees and netlist connectivity to detect synthesis hazards, simulation race conditions, and electrical errors while code is being written.

---

## Diagnostic Rules Catalog

```
+-------------------------------------------------------------------------------+
| Axiom Static Linter Dashboard (Problems Dock)                                 |
| 0 Errors | 2 Warnings | 1 Informational | Real-Time Latency: 1.8 ms           |
+-------------------------------------------------------------------------------+
| [AXIOM_W001] Line 42: Blocking assignment (=) inside clocked sequential block |
| [AXIOM_W007] Line 88: Case statement missing default branch                   |
+-------------------------------------------------------------------------------+
```

### 1. `AXIOM_W001`: Blocking Assignment in Sequential Process
- **Severity**: Warning
- **Violation**: Using `=` instead of `<=` inside an edge-triggered process (`always @(posedge clk)`).
- **Hazard**: Introduces simulator-dependent race conditions where register values may be read before or after updating depending on thread execution order.
- **Fix**: Replace `=` with `<="`.

### 2. `AXIOM_W002`: Non-Blocking Assignment in Combinational Process
- **Severity**: Warning
- **Violation**: Using `<=` inside a level-sensitive process (`always @*` or `always @(a or b)`).
- **Hazard**: Causes unnecessary simulation delta cycle overhead and potential synthesis mismatches.
- **Fix**: Replace `<=` with `=`.

### 3. `AXIOM_W003`: Undriven Net
- **Severity**: Warning
- **Violation**: A declared `wire` or net has no continuous driver (`assign`), gate output, or submodule port connection.
- **Hazard**: The net remains permanently floating at high-impedance (`Z`) or unknown (`X`).
- **Fix**: Add a driver or remove the unused net declaration.

### 4. `AXIOM_W004`: Unused Signal
- **Severity**: Warning
- **Violation**: A declared register or net is written or defined but never read in any downstream logic cone.
- **Hazard**: Dead silicon area and unnecessary gate inference.
- **Fix**: Remove the unused signal or wire it to the target consumer.

### 5. `AXIOM_E002`: Multi-Driver Net Contention
- **Severity**: Error
- **Violation**: Multiple continuous assignments or simultaneous drivers drive the same `wire`.
- **Hazard**: Electrical short circuit on physical silicon; evaluated as contention unknown (`X`) in simulation.
- **Fix**: Insert a multiplexer or ensure only a single driver controls the net.

### 6. `AXIOM_W006`: Transparent Latch Inferred
- **Severity**: Warning
- **Violation**: A combinational process leaves a target variable unassigned along one or more conditional execution paths.
- **Hazard**: Synthesis tools infer an asynchronous level-sensitive latch, introducing severe timing closure problems and clock glitch sensitivity.
- **Fix**: Ensure all variables are assigned in every `if-else` branch, or assign a default value at the top of the `always @*` block.

### 7. `AXIOM_W007`: Missing Case Default
- **Severity**: Warning
- **Violation**: A `case` statement omits the `default:` branch.
- **Hazard**: Non-covered input combinations cause latch inference or freeze state machines.
- **Fix**: Add `default: <safe_state>;`.

### 8. `AXIOM_W008`: Bit-Width Mismatch
- **Severity**: Warning
- **Violation**: The bit width of the left-hand net does not equal the bit width of the right-hand expression.
- **Hazard**: Silent MSB truncation or unintended zero/sign extension.
- **Fix**: Align bit widths explicitly or use part-select slicing.
