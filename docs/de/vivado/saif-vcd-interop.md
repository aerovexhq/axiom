# SAIF & VCD Interoperabilität

Um eine nahtlose Integration in bestehende industrielle Verifikationsumgebungen zu gewährleisten, erzeugt Axiom standardmäßige **IEEE 1364 Value Change Dump (.vcd)**- und **Synopsys SAIF 2.0 (.saif)**-Dateien.

---

## 1. IEEE 1364 Value Change Dump (VCD)

Der `VcdWriter` von Axiom formatiert alle Netzlisten-Zustandsübergänge mit standardmäßigen VCD-Definitionen:
- Kopfzeile: `$date`, `$version`, `$timescale 1 ps`.
- Hierarchie: Hierarchische `$scope module`- und `$upscope`-Blöcke.
- Variablen: Multi-Bit `$var wire [width] [symbol] [name]`-Deklarationen.
- Anfangswerte: `$dumpvars`-Zustands-Dump bei $t = 0$.
- Übergänge: Verschachtelte Zeitstempelmarkierungen (`#1000`) mit binären und hexadezimalen Busübergängen.

Von Axiom generierte VCD-Dateien können direkt geöffnet werden in:
- **GTKWave**
- **Surfer**
- **AMD Vivado Waveform Viewer**
- **Sigrok / PulseView**

---

## 2. Switching Activity Interchange Format (SAIF 2.0)

Eine genaue Leistungsschätzung in Vivados `report_power` erfordert hochzuverlässige Simulationsvektoren anstelle statischer vektorloser Schätzungen.

Axiom erzeugt gültige SAIF 2.0-Dateien mit Schaltwahrscheinlichkeiten:
```text
(SAIFILE
  (SAIFVERSION "2.0")
  (DIRECTION "backward")
  (DESIGN "counter")
  (DATE "Axiom HDL Engine")
  (VENDOR "Axiom")
  (PROGRAM_NAME "Axiom Simulator")
  (PROGRAM_VERSION "1.0.0")
  (DIVIDER /)
  (TIMESCALE 1 ps)
  (DURATION 50000)
  (INSTANCE counter
    (NET
      (clk (T0 25000) (T1 25000) (TX 0) (TZ 0) (TC 99))
      (rst_n (T0 1000) (T1 49000) (TX 0) (TZ 0) (TC 1))
      (count (T0 12000) (T1 38000) (TX 0) (TZ 0) (TC 48))
    )
  )
)
```

### In AMD Vivado laden
In Vivado Tcl:
```tcl
open_run impl_1
read_saif -strip_path /tb_top/u_dut -file power.saif
report_power -file post_sim_power.rpt
```
Vivado aktualisiert seine dynamischen Schaltaktivitätsmatrizen automatisch anhand der von Axiom gemessenen SAIF-Umschaltzählungen.
