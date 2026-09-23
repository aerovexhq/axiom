# VHDL (IEEE 1076) Unterstützungsübersicht

Axiom EDA umfasst natives Parsen, Elaborieren und Language Server Protocol-Diagnosen für den **IEEE 1076 VHDL**-Standard (`crates/lsp/src/vhdl.rs`). VHDL (VHSIC Hardware Description Language) legt Wert auf strenge Typisierung, strikte strukturelle Trennung und deterministische Hardware-Modellierung.

---

## Die VHDL-Architektur in Axiom

```
+-------------------------------------------------------------------------------+
| Axiom Multi-Language HDL Processing Core                                      |
+---------------------------------------+---------------------------------------+
| Verilog / SystemVerilog Frontend      | VHDL Frontend (IEEE 1076-1993/2008)   |
| (IEEE 1364 / IEEE 1800)               | (Entity, Architecture, Port Maps)     |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|             +-------------------------------------------+                     |
|             | Unified Bound Intermediate Representation  |                    |
|             | (BIR Netlist & Technology Mapping Engine) |                     |
|             +-------------------------------------------+                     |
|                                   |                                           |
|                                   v                                           |
|       Cranelift JIT Compiler & WebAssembly Simulation Backends                |
+-------------------------------------------------------------------------------+
```

### Unterstützte VHDL-Standards
- **IEEE 1076-1993**: Vollständige Unterstützung für Entitäten, Architekturen, Komponentendeklarationen, Prozesse und Standardpakete.
- **IEEE 1076-2008**: Unbegrenzte Arrays in Portlisten, vereinfachte Sensitivitätslisten (`process(all)`) und Standardoperatoren.
- **Zweisprachiges Co-Design**: Der Elaborator von Axiom ermöglicht die Instanziierung von Verilog- und VHDL-Modulen innerhalb derselben Designhierarchie.
