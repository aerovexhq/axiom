# Resumen de restricciones de diseño Xilinx (XDC / SDC)

Axiom EDA proporciona soporte nativo de análisis sintáctico, validación y ejecución para archivos de **restricciones de diseño Xilinx (XDC)** (`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`). XDC se basa en la sintaxis estándar de la industria Synopsys Design Constraints (SDC), extendida con propiedades basadas en Tcl para la configuración física de dispositivos FPGA.

---

## El doble papel de XDC en Axiom

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

### Capacidades clave en Axiom
1. **LSP con cero falsos positivos**: El servidor de lenguaje XDC en RAM de Axiom analiza comentarios `#`, valida palabras clave de comandos y proporciona autocompletado para puertos sin marcar restricciones válidas como errores de sintaxis.
2. **Vinculación directa con el laboratorio virtual**: Las asignaciones de pines físicos (`PACKAGE_PIN V17`, `PACKAGE_PIN U16`) se vinculan dinámicamente al rack del laboratorio virtual de Axiom, conectando el RTL simulado directamente a los interruptores y LED de la placa Basys 3.
3. **Integración con el motor STA**: Las definiciones de reloj (`create_clock -period 10.0`) establecen la frecuencia de referencia para el motor de análisis de temporización estática (STA) y el radar de temporización.
