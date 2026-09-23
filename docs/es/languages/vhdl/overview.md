# Resumen de soporte de VHDL (IEEE 1076)

Axiom EDA incorpora análisis sintáctico nativo, elaboración y diagnósticos de Language Server Protocol para el estándar **IEEE 1076 VHDL** (`crates/lsp/src/vhdl.rs`). VHDL (VHSIC Hardware Description Language) enfatiza el tipado fuerte, la estricta separación estructural y el modelado de hardware determinista.

---

## La arquitectura VHDL en Axiom

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

### Estándares VHDL soportados
- **IEEE 1076-1993**: Soporte completo para entidades, arquitecturas, declaraciones de componentes, procesos y paquetes estándar.
- **IEEE 1076-2008**: Matrices no restringidas en listas de puertos, listas de sensibilidad simplificadas (`process(all)`) y operadores estándar.
- **Co-diseño en doble lenguaje**: El elaborador de Axiom permite instanciar módulos Verilog y VHDL dentro de la misma jerarquía de diseño.
