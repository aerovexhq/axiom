# Project Trust & Workspace Sandbox Isolation

Axiom EDA is engineered for safe digital hardware design. Because hardware description files and simulation models can execute complex procedural loops or import external memory contents, Axiom implements an aerospace-grade **Project Trust Permission System**, **Native Host FileSystem Sandbox Guard**, and **Configurable Storage Quotas**.

---

## Project Trust Permission System

When opening or importing an external project bundle (`.json`) from an untrusted source or colleague, Axiom protects the host machine by opening the project in **Restricted Mode** by default.

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### Restricted vs. Trusted Mode Matrix

| Feature | Restricted Mode | Trusted Mode |
| :--- | :--- | :--- |
| **Simulation Execution** | Allowed (strict loop bounds) | Allowed (full performance) |
| **Max Delta Cycles (\(\delta\))** | 50,000 cycles / step | 100,000 cycles / step (configurable) |
| **Memory Allocation Limit** | 64 KWords (256 KB) | 16 MWords (64 MB) |
| **Host Filesystem Export** | Blocked | Permitted |
| **Data Directory Isolation** | Strictly enforced (`.axiom/data/`) | Enforced by default |
| **Header Indicator** | `[ Restricted Mode ]` Shield Alert | Subtle project badge |

Engineers can modify trust status at any time by clicking the `[ Restricted Mode ]` badge in the header or via **Project Settings & Security...** in the project menu.

---

## Native Host FileSystem Sandbox Guard

For native desktop installations (Tauri v2), Axiom enforces kernel-grade path containment in the Rust backend (`crates/desktop/src/lib.rs`) via `validate_sandboxed_path`:

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### Sandboxing Protections
1. **Cross-Platform Path Normalization**: Automatically converts Windows backslashes (`\`) and Unix forward slashes (`/`), stripping verbatim prefixes (`\\?\`).
2. **Path Traversal Blocking**: Strictly forbids `..` parent directory traversal sequences both in the raw input string and in the resolved canonical path.
3. **Sensitive System Directory Blacklist**: Prohibits reading or writing to operating system critical directories:
   - Linux/macOS: `/etc`, `/proc`, `/sys`, `/boot`, `/root`, `/bin`, `/sbin`, `/usr`
   - Windows: `C:\Windows`, `C:\System32`, `C:\Program Files`
4. **Credential Store Quarantine**: Blocks all operations accessing private keys, credentials, and authentication stores:
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Tauri IPC Command Coverage**: Every filesystem IPC invocation (`fs_read_file`, `fs_write_file`, `fs_remove_file`, `fs_list_dir`, `fs_create_dir`, `fs_exists`) is guarded by `validate_sandboxed_path`. Unauthorized path requests return an immediate `[SandboxViolation]` error.

---

## Configurable Storage Quotas

To prevent runaway simulation trace files (`.vcd`, `.saif`) or synthetic loops from exhausting host disk space, Axiom enforces byte-level storage quotas:

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### Storage Quota Options
- **10 MB**: Minimal footprint for lightweight gate-level coursework.
- **25 MB**: Suitable for standard FSM and small processor designs.
- **50 MB (Default)**: Standard engineering quota accommodating thousands of simulation cycles and waveform traces.
- **100 MB / 250 MB / 500 MB**: Extended limits for deep verification runs, multi-megabyte VCD waveforms, and post-synthesis netlists.
- **Unlimited**: Uncapped allocation for massive enterprise projects.

Quota enforcement is active across both Browser IndexedDB (`BrowserIndexedDbFileSystem`) and native desktop storage (`TauriIpcFileSystem`). Attempting to write past the quota triggers a clean `[StorageQuota]` exception without crashing the runtime.

---

## Dedicated Generated Data Directory (`.axiom/data/`)

Axiom isolates all generated outputs into a dedicated workspace sub-folder:
- Value Change Dumps (`.vcd`)
- Switching Activity Interchange Format files (`.saif`)
- Static Timing Reports (`timing_report.txt`)
- Mapped structural Verilog netlists (`synth_netlist.v`)
- Protocol packet captures (`.pcap`)

### 1-Click Data Purge Subsystem
The **Project Security Modal** provides a 1-click **Purge Generated Data** button. This operation wipes the entire contents of `.axiom/data/`, instantly resetting storage usage down to the raw source files without modifying or deleting any Verilog, SystemVerilog, VHDL, or XDC files.
