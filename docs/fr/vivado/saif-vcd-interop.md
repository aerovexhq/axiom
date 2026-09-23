# Interopérabilité SAIF et VCD

Pour garantir une intégration transparente avec les environnements industriels de vérification existants, Axiom génère des fichiers standard **Logique à 4 états / Value Change Dump (VCD) IEEE 1364 (.vcd)** et **Synopsys SAIF 2.0 (.saif)**.

---

## 1. Value Change Dump (VCD) IEEE 1364

Le `VcdWriter` d'Axiom formate toutes les transitions d'état de netlist selon les définitions VCD standards :
- En-tête : `$date`, `$version`, `$timescale 1 ps`.
- Hiérarchie : Blocs hiérarchiques `$scope module` et `$upscope`.
- Variables : Déclarations multibits `$var wire [width] [symbol] [name]`.
- Valeurs initiales : Vidage d'état `$dumpvars` à $t = 0$.
- Transitions : Marqueurs d'horodatage entrelacés (`#1000`) avec transitions de bus binaires et hexadécimales.

Les fichiers VCD générés par Axiom peuvent être ouverts directement dans :
- **GTKWave**
- **Surfer**
- **Visualiseur de formes d'onde AMD Vivado**
- **Sigrok / PulseView**

---

## 2. Switching Activity Interchange Format (SAIF 2.0)

Une estimation précise de la puissance dans le `report_power` de Vivado nécessite des vecteurs de simulation de haute confiance plutôt que des estimations statiques sans vecteurs.

Axiom génère des fichiers SAIF 2.0 valides contenant les probabilités de commutation :
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

### Chargement dans AMD Vivado
En Tcl Vivado :
```tcl
open_run impl_1
read_saif -strip_path /tb_top/u_dut -file power.saif
report_power -file post_sim_power.rpt
```
Vivado met à jour automatiquement ses matrices d'activité dynamique de commutation à partir des taux de basculement SAIF mesurés par Axiom.
