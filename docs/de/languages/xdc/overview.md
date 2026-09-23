# Xilinx Design Constraints (XDC / SDC) Übersicht

Axiom EDA bietet native Unterstützung für das Parsen, Validieren und Ausführen von **Xilinx Design Constraints (XDC)**-Dateien (`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`). XDC basiert auf der Syntax der Synopsys Design Constraints (SDC), erweitert um Tcl-basierte Eigenschaften für die physische FPGA-Konfiguration.

---

## Die Doppelrolle von XDC in Axiom

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

### Wichtige Funktionen in Axiom
1. **LSP ohne Fehlalarme**: Der In-RAM-XDC-Sprachserver von Axiom parst `#`-Kommentare, validiert Befehlsschlüsselwörter und bietet Port-Autovervollständigung, ohne gültige Constraints fälschlich als Syntaxfehler zu melden.
2. **Direkte Anbindung an das Virtuelle Labor**: Physische Pin-Mappings (`PACKAGE_PIN V17`, `PACKAGE_PIN U16`) werden dynamisch an das taktile Virtual Lab Rack von Axiom gebunden und verbinden simuliertes RTL direkt mit den Basys 3-Schiebeschaltern und -LEDs.
3. **STA-Engine-Integration**: Taktdefinitionen (`create_clock -period 10.0`) legen die Timing-Referenzfrequenz für die Statische Timing-Analyse-Engine und das Timing-Radar fest.
