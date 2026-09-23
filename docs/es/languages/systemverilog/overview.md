# Resumen de soporte de SystemVerilog (IEEE 1800)

Axiom EDA proporciona soporte nativo de síntesis, simulación y verificación formal para el estándar de lenguaje **IEEE 1800 SystemVerilog**. SystemVerilog extiende Verilog clásico con construcciones modernas de diseño de hardware (`logic`, `always_ff`, `always_comb`, `interface`, `package`) y capacidades de verificación, incluidas aserciones de SystemVerilog (SVA) y estímulos aleatorios restringidos.

---

## El paradigma de SystemVerilog en Axiom

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

### Ventajas arquitectónicas clave en Axiom
1. **Elaboración con cero sobrecarga**: Elabora interfaces, modports y paquetes de SystemVerilog directamente en netlists planas BIR sin crear archivos envolventes intermedios.
2. **Verificación explícita de intención**: Aplica reglas de síntesis estrictas en bloques `always_comb` y `always_ff`, detectando la inferencia de latches y riesgos de carreras en tiempo de análisis sintáctico.
3. **Motor de propiedades formales**: Compila de forma nativa propiedades temporales SVA directamente en relaciones de transición de estados booleanas verificadas por el comprobador de modelos acotados (BMC) integrado de Axiom.
