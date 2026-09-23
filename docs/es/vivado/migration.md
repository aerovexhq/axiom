# Migración desde AMD Vivado a Axiom

Axiom fue desarrollado desde los primeros principios para proporcionar un reemplazo directo para los flujos de trabajo de simulación y verificación en AMD Vivado Design Suite.

---

## Resumen de correspondencia de comandos

| Tarea | Comando de AMD Vivado | Equivalente en la CLI de Axiom |
| :--- | :--- | :--- |
| **Analizar Verilog** | `xvlog design.v` | Integrado en `axiom compile` |
| **Elaborar diseño** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **Ejecutar simulación** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **Volcar forma de onda VCD** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **Exportar actividad SAIF** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **Medir latencia de benchmark** | Cronómetro manual / registros de perfilado | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## Cero sobrecarga de snapshots en disco

En Vivado, la elaboración produce un directorio de snapshot en disco:
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

En Axiom, la compilación y la simulación se ejecutan 100% en RAM:
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
Sin directorios de caché `xsim.dir`, sin archivos de snapshot de varios gigabytes y sin artefactos binarios obsoletos.
