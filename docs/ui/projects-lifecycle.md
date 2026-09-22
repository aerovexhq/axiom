# Projects & File Sets Lifecycle

Axiom EDA implements an authentic Vivado-grade project management system combined with lightweight web persistence and desktop filesystem integration. Projects maintain strict separation between design RTL sources, simulation testbenches, and physical/timing constraints.

---

## The Welcome Launchpad

When launched without an open project, Axiom presents a clean, aerospace-grade Welcome Launchpad:

```
+-------------------------------------------------------------------------------+
| Axiom EDA v1.0.0 — In-RAM Cranelift JIT & Silicon Telemetry Engine            |
+---------------------------------------+---------------------------------------+
| [ Create New Project ]                | [ Open Project from File ]            |
| Wizard with device selection          | Import serialized .json bundle        |
+---------------------------------------+---------------------------------------+
| Starter Engineering Blueprints (1-Click Launch):                              |
| 1. Logic Circuit (Gate-Level Booleans)| 5. SPI Master Controller              |
| 2. UART Transceiver (115200 Baud)     | 6. FSM Traffic Controller             |
| 3. Synchronous FIFO Buffer (32x8)     | 7. IUC Cerrahpasa Digital Logic Lab   |
| 4. 32-Bit Arithmetic Logic Unit (ALU) |                                       |
+-------------------------------------------------------------------------------+
| Recent Projects: [ Active Projects (3) ]  |  [ Trashed Projects (1) ]         |
+-------------------------------------------------------------------------------+
```

### Starter Templates
Axiom provides 7 industry-tested starter blueprints:
1. **Combinational Logic Circuit**: Gate-level boolean logic system computing \(F = ((\neg A \land B) \land C) \lor \neg B\) with 9 gate cells (`inv1`, `inv2`, `and1`, `and2`, `or1`) and dedicated Virtual Lab tactile bay.
2. **UART Transceiver**: Complete transmitter and receiver pipeline with 8-data bits, 1 stop bit, oversampling clock generator, and status registers.
3. **Synchronous FIFO Buffer**: Dual-pointer 32x8 circular memory buffer with full, empty, almost-full, and almost-empty watermark flags.
4. **32-Bit ALU**: Arithmetic Logic Unit implementing IEEE signed additions, subtractions, barrel shifts, comparisons, and boolean logic with zero-flag and overflow detection.
5. **SPI Master**: Motor-control grade Serial Peripheral Interface supporting Modes 0, 1, 2, and 3 with programmable clock dividers.
6. **FSM Traffic Controller**: 4-way intersection finite state machine featuring green, yellow, red sequences, pedestrian request latches, and timer counters.
7. **IUC Cerrahpasa Digital Logic Lab**: Istanbul University - Cerrahpasa coursework project featuring `uygulama_0.v`, automated testbenches, and Basys 3 Artix-7 constraints.

---

## Vivado File Sets Structure

Axiom organizes project files into standard Vivado file set categories:

```
project_root/
|-- sources_1/           # Design Sources
|   |-- logic_circuit.v  # Primary RTL implementation [TOP]
|   `-- uart_tx.v        # Submodules
|-- sim_1/               # Simulation Sources
|   `-- tb_circuit.v     # Testbench harness
`-- constrs_1/           # Physical & Timing Constraints
    `-- timing.xdc       # XDC pinouts and clock declarations
```

### 1. Design Sources (`sources_1`)
Contains all synthesizable hardware modules implemented in Verilog, SystemVerilog, or VHDL.
- **Top Module Designation (`[TOP]`)**: The active root module for synthesis, schematic generation, and physical floorplanning. You can designate any module as top via the 3-vertical-dot kebab dropdown on the file card.
- **Add Source (`+`) Action**: Clicking the `+` button on the Design Sources header opens `AddSourceModal` with the `sources_1` category preselected.

### 2. Simulation Sources (`sim_1`)
Contains testbench harnesses (`tb_*.v`), stimulus vectors, and verification sequences. Testbench files are excluded from physical synthesis and technology mapping to prevent false multi-driver or unconstrained pin warnings.

### 3. Constraints (`constrs_1`)
Contains Xilinx Design Constraints (`.xdc`) files defining FPGA package pin bindings (`PACKAGE_PIN`, `IOSTANDARD`) and Static Timing Analysis clock targets (`create_clock`).

---

## Project Header Menu (`ProjectDropdown`)

The top-left project dropdown badge provides direct access to core lifecycle operations:
- **Save Project (`Ctrl + S`)**: Flushes all editor buffers to disk (Desktop) or IndexedDB (Web) with instant visual confirmation.
- **Export Project Bundle (`.json`)**: Generates a self-contained, portable JSON file packaging all file sets, target FPGA part numbers, active top module, and security flags.
- **Add Source...**: Launches the multi-format source creation wizard.
- **Project Settings & Security...**: Configures project trust mode, storage quotas, data isolation, and simulation safety bounds.
- **New Project Wizard**: Launches the project creation wizard.
- **Close Project**: Safely saves active state and returns to the Welcome Launchpad without losing uncommitted edits.

---

## Project Trashing & Recovery Lifecycle

To prevent accidental data loss, Axiom implements a two-stage deletion lifecycle:
1. **Move to Trash**: Accessible via the 3-vertical-dot kebab button on any project card on the Launchpad. Trashed projects immediately persist `isTrashed: true`, disappear from the Active tab, and increment the Trash badge count.
2. **Accessing Trashed Projects**: Clicking the **Trash** tab on the Launchpad reveals all trashed designs with deletion dates.
3. **Restore Project**: Restores the project back to the Active tab with all files and configurations intact.
4. **Permanent Deletion**: Prompts an acrylic confirmation modal (`ConfirmModal.tsx`). Once confirmed, permanently wipes project records and removes associated storage directories from the filesystem.
