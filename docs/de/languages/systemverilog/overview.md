# SystemVerilog (IEEE 1800) Unterstützungsübersicht

Axiom EDA bietet native Synthese-, Simulations- und formale Verifikationsunterstützung für den Sprachstandard **IEEE 1800 SystemVerilog**. SystemVerilog erweitert klassisches Verilog um moderne Hardware-Designkonstrukte (`logic`, `always_ff`, `always_comb`, `interface`, `package`) und Verifikationsfunktionen, einschließlich SystemVerilog-Assertionen (SVA) und eingeschränkter Zufallsstimuli.

---

## Das SystemVerilog-Paradigma in Axiom

```
+-------------------------------------------------------------------------------+
| SystemVerilog Design & Verification Unified Engine                            |
+---------------------------------------+---------------------------------------+
| Hardware Design Enhancements          | Verification & Formal Proofs          |
|---------------------------------------+---------------------------------------|
| - Universal 'logic' data type         | - Immediate & Concurrent Assertions   |
| - Strict 'always_comb' / 'always_ff'  | - Temporal Sequences (##n, |->, |=>)   |
| - Typedefs, Structs & Enums           | - In-Engine Bounded Model Checker     |
| - Interfaces & Modports               | - Constrained Random Stimulus (rand)  |
| - Parameterized Packages              | - Automated Testbench Generators      |
+---------------------------------------+---------------------------------------+
| Unified Cranelift JIT & WebAssembly In-RAM Simulation Kernel                  |
+-------------------------------------------------------------------------------+
```

### Wichtige Architekturvorteile in Axiom
1. **Zero-Overhead-Elaborierung**: Elaboriert SystemVerilog-Schnittstellen, Modports und Pakete direkt in flache BIR-Netzlisten ohne Zwischen-Wrapper-Dateien.
2. **Explizite Absichtsverifikation**: Erzwingt strikte Syntheseregeln für `always_comb`- und `always_ff`-Blöcke und erkennt Latch-Inferenzen und Race-Hazards bereits beim Parsen.
3. **Engine für formale Eigenschaften**: Kompiliert temporale SVA-Eigenschaften direkt in boolesche Zustandsübergangsrelationen, die vom integrierten Bounded Model Checker von Axiom verifiziert werden.
