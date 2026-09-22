# Monaco XDC Language Server & Validation

Axiom EDA features a dedicated Language Server Protocol (LSP) and syntax highlighter for Xilinx Design Constraints (`crates/lsp/src/xdc.rs`).

---

## Real-Time XDC Syntax Verification

The Monaco XDC language service operates directly inside `.xdc` files in the editor:
- **Tcl Command Validation**: Recognizes `set_property`, `create_clock`, `create_generated_clock`, `set_input_delay`, `set_output_delay`, `set_false_path`, `set_clock_groups`, `set_multicycle_path`.
- **Comment Handling**: Accurately parses line comments starting with `#`, preventing false syntax warnings on commented pin configurations.
- **Port Query Validation**: Verifies that ports referenced inside `[get_ports <name>]` exist in the active design top module.

---

## Intelligent Autocompletions

Typing inside an `.xdc` file triggers contextual autocompletion snippets:
- **Package Pin Binding**: `set_property PACKAGE_PIN <PIN> [get_ports <PORT>]`
- **I/O Standard Assignment**: `set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **Primary Clock**: `create_clock -period 10.000 -name <NAME> [get_ports <PORT>]`
- **False Path**: `set_false_path -from [get_ports <PORT>]`
