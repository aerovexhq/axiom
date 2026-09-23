# Migration von AMD Vivado zu Axiom

Axiom wurde von Grund auf als direkter Ersatz für die Simulations- und Verifikations-Workflows in der AMD Vivado Design Suite entwickelt.

---

## Befehlszuordnungs-Übersicht

| Aufgabe | AMD Vivado-Befehl | Axiom CLI-Äquivalent |
| :--- | :--- | :--- |
| **Verilog parsen** | `xvlog design.v` | Integriert in `axiom compile` |
| **Design elaborieren** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **Simulation ausführen** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **VCD-Signalverlauf ausgeben** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **SAIF-Aktivität exportieren** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **Benchmark-Latenz** | Manuelle Stoppuhr / Profiling-Logs | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## Null Festplatten-Snapshot-Overhead

In Vivado erzeugt die Elaborierung ein Snapshot-Verzeichnis auf der Festplatte:
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

In Axiom werden Kompilierung und Simulation zu 100% im RAM ausgeführt:
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
Keine `xsim.dir`-Cache-Verzeichnisse, keine Multi-Gigabyte-Snapshot-Dateien und keine veralteten Binär-Artefakte.
