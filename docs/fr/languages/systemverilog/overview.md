# Aperçu du support SystemVerilog (IEEE 1800)

Axiom EDA fournit une prise en charge native de la synthèse, de la simulation et de la vérification formelle pour la norme **IEEE 1800 SystemVerilog**. SystemVerilog étend le Verilog classique avec des constructions modernes (`logic`, `always_ff`, `always_comb`, `interface`, `package`) et des capacités de vérification avancées, y compris les assertions SVA et les stimuli aléatoires sous contraintes.

---

## Le paradigme SystemVerilog dans Axiom

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

### Avantages architecturaux clés dans Axiom
1. **Élaboration sans surcoût** : Élabore les interfaces, modports et paquets SystemVerilog directement en netlists BIR plates sans créer de fichiers d'emballage intermédiaires.
2. **Vérification explicite de l'intention** : Impose des règles strictes de synthèse sur les blocs `always_comb` et `always_ff`, détectant l'inférence de verrous et les aléas de course dès l'analyse syntaxique.
3. **Moteur de propriétés formelles** : Compile nativement les propriétés temporelles SVA directement en relations de transition d'état booléennes vérifiées par le vérificateur de modèles bornés (BMC) intégré d'Axiom.
