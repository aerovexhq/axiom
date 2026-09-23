# Aperçu du support VHDL (IEEE 1076)

Axiom EDA intègre l'analyse syntaxique native, l'élaboration et les diagnostics de protocole de serveur de langage (LSP) pour le standard **IEEE 1076 VHDL** (`crates/lsp/src/vhdl.rs`). Le VHDL met l'accent sur le typage fort, la stricte séparation structurelle et la modélisation matérielle déterministe.

---

## L'architecture VHDL dans Axiom

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

### Standards VHDL pris en charge
- **IEEE 1076-1993** : Prise en charge complète des entités, architectures, déclarations de composants, processus et paquets standards.
- **IEEE 1076-2008** : Tableaux non contraints dans les listes de ports, listes de sensibilité simplifiées (`process(all)`) et opérateurs standards.
- **Co-conception bilingue** : L'élaborateur d'Axiom permet d'instancier des modules Verilog et VHDL au sein de la même hiérarchie de conception.
