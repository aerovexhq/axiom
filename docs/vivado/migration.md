# Migrating from AMD Vivado to Axiom

Axiom was built from first principles to provide a drop-in replacement for the simulation and verification workflows in AMD Vivado Design Suite.

---

## Command Mapping Overview

| Task | AMD Vivado Command | Axiom CLI Equivalent |
| :--- | :--- | :--- |
| **Parse Verilog** | `xvlog design.v` | Embedded in `axiom compile` |
| **Elaborate Design** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **Run Simulation** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **Dump VCD Waveform** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **Export SAIF Activity** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **Benchmark Latency** | Manual stopwatch / profile logs | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## Zero Disk Snapshot Overhead

In Vivado, elaboration produces an on-disk snapshot directory:
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

In Axiom, compilation and simulation execute 100% in RAM:
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
No `xsim.dir` cache directories, no multi-gigabyte snapshot files, and no stale binary artifacts.
