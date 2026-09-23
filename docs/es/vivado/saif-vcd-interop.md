# Interoperabilidad SAIF y VCD

Para garantizar una integración fluida con los entornos de verificación industrial existentes, Axiom genera archivos estándar **Value Change Dump (VCD) IEEE 1364 (.vcd)** y **Synopsys SAIF 2.0 (.saif)**.

---

## 1. Value Change Dump (VCD) IEEE 1364

El `VcdWriter` de Axiom formatea todas las transiciones de estado de la netlist con definiciones estándar de VCD:
- Cabecera: `$date`, `$version`, `$timescale 1 ps`.
- Jerarquía: Bloques jerárquicos `$scope module` y `$upscope`.
- Variables: Declaraciones multibit `$var wire [width] [symbol] [name]`.
- Valores iniciales: Volcado de estado `$dumpvars` en $t = 0$.
- Transiciones: Marcas de tiempo intercaladas (`#1000`) con transiciones de bus en binario y hexadecimal.

Los archivos VCD generados por Axiom se pueden abrir directamente en:
- **GTKWave**
- **Surfer**
- **Visor de formas de onda de AMD Vivado**
- **Sigrok / PulseView**

---

## 2. Formato de intercambio de actividad de conmutación (SAIF 2.0)

La estimación precisa de potencia en `report_power` de Vivado requiere vectores de simulación de alta confianza en lugar de estimaciones estáticas sin vectores.

Axiom genera archivos SAIF 2.0 válidos que contienen probabilidades de conmutación:
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

### Carga en AMD Vivado
En Vivado Tcl:
```tcl
open_run impl_1
read_saif -strip_path /tb_top/u_dut -file power.saif
report_power -file post_sim_power.rpt
```
Vivado actualiza automáticamente sus matrices dinámicas de actividad de conmutación a partir de los conteos de conmutación SAIF medidos por Axiom.
