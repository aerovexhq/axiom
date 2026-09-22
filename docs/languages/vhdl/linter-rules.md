# VHDL Language Server & Linter Rules

Axiom EDA incorporates a dedicated VHDL language server (`crates/lsp/src/vhdl.rs`) providing syntax verification, type consistency auditing, and design rule checking directly in Monaco editor.

---

## Diagnostic Rules for VHDL

| Rule ID | Severity | Description | Fix |
| :--- | :--- | :--- | :--- |
| `VHDL_W001` | Warning | **Incomplete Sensitivity List**: A signal read inside a combinational process is missing from the sensitivity list. | Add the missing signal to `process(...)` or use `process(all)` (VHDL-2008). |
| `VHDL_W002` | Warning | **Inferred Latch**: Incomplete `if-then-else` or `case-when` branches in a combinational process infer an unwanted transparent latch. | Cover all branches or assign a default value prior to conditional checks. |
| `VHDL_E001` | Error | **Type Mismatch**: Attempting to assign `std_logic_vector` directly to `unsigned` or `integer` without conversion. | Use explicit `to_integer()`, `unsigned()`, or `std_logic_vector()`. |
| `VHDL_W003` | Warning | **Unused Signal**: A declared architecture signal is never assigned or read. | Remove dead signal declaration. |
| `VHDL_E002` | Error | **Multi-Driver Contention**: Multiple concurrent assignments drive the same resolved signal. | Use a single multiplexed assignment. |
