# VHDL (IEEE 1076) Desteğine Genel Bakış

Axiom EDA, **IEEE 1076 VHDL** standardı (`crates/lsp/src/vhdl.rs`) için yerel ayrıştırma, açımlama ve Dil Sunucusu Protokolü (LSP) tanılamaları içerir. VHDL (VHSIC Donanım Tanımlama Dili), güçlü tiplemeyi, katı yapısal ayrımı ve deterministik donanım modellemesini vurgular.

---

## Axiom'da VHDL Mimarisi

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

### Desteklenen VHDL Standartları
- **IEEE 1076-1993**: Varlıklar, mimariler, bileşen bildirimleri, süreçler ve standart paketler için tam destek.
- **IEEE 1076-2008**: Port listelerinde kısıtlanmamış diziler, basitleştirilmiş duyarlılık listeleri (`process(all)`) ve standart işleçler.
- **Çift Dilli Ortak Tasarım**: Axiom'un açımlayıcısı, Verilog ve VHDL modüllerinin aynı tasarım hiyerarşisi içinde örneklendirilmesine olanak tanır.
