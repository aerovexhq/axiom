# Xilinx Design Constraints (XDC / SDC) Overview

Axiom EDA provides native parsing, validation, and execution support for **Xilinx Design Constraints (XDC)** files (`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`). XDC is based on the industry-standard Synopsys Design Constraints (SDC) syntax, extended with Tcl-based properties for physical FPGA device configuration.

---

## The Dual Role of XDC in Axiom

```
+-------------------------------------------------------------------------------+
| XDC Constraints File (constrs_1/timing.xdc)                                   |
+---------------------------------------+---------------------------------------+
| Physical Constraints                  | Static Timing Constraints             |
|---------------------------------------+---------------------------------------|
| - Package pin allocation (PACKAGE_PIN)| - Clock definitions (create_clock)    |
| - I/O electrical standard (IOSTANDARD)| - I/O setup/hold delays               |
| - Drive strength & slew rate          | - False paths & multicycle exceptions |
| - Pull-up & pull-down resistors       | - Asynchronous clock domain isolation |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|       [Floorplanning & Virtual Lab]       [Static Timing Analysis Engine]     |
|       - Physical die placement            - Critical path waterfall           |
|       - Basys 3 board mapping             - Setup & hold slack calculation    |
+-------------------------------------------------------------------------------+
```

### Key Capabilities in Axiom
1. **Zero False-Positive LSP**: Axiom's in-RAM XDC Language Server parses `#` comments, validates command keywords, and provides autocompletion for ports without flagging valid constraints as syntax errors.
2. **Virtual Lab Direct Binding**: Physical pin mappings (`PACKAGE_PIN V17`, `PACKAGE_PIN U16`) are dynamically bound to Axiom's tactile Virtual Lab Rack, connecting simulated RTL directly to the Basys 3 slide switches and LEDs.
3. **STA Engine Integration**: Clock definitions (`create_clock -period 10.0`) establish the timing reference frequency for the Static Timing Analysis engine and Timing Radar.
