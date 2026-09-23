# Compilation JIT en RAM avec Cranelift

Les simulateurs matériels traditionnels (tels que Verilator, Synopsys VCS et Vivado xsim) reposent lourdement sur une génération de fichiers en plusieurs étapes :
1. Analyse lexicale et syntaxique des fichiers sources HDL en AST intermédiaires.
2. Émission de fichiers sources C++ ou C massifs (souvent de plusieurs gigaoctets).
3. Appel de compilateurs hôtes externes (GCC / Clang) pour compiler et lier les fichiers d'objets partagés.
4. Chargement des bibliothèques partagées en mémoire pour commencer la simulation.

Cette approche introduit **des dizaines de secondes à plusieurs minutes de temps de compilation mort** à chaque itération de conception.

---

## Le pipeline JIT sans disque d'Axiom

Axiom contourne complètement les vidages intermédiaires sur disque et les chaînes d'outils externes :

```
Verilog / SystemVerilog Source
              |
              v
     Streaming Lexer & Pratt Parser
              | (In-Memory AST)
              v
     Hierarchical Elaborator (BIR)
              | (Dataflow Netlist Graph)
              v
  Cranelift JIT Code Generator
              | (Machine Instructions)
              v
Native Machine Code in RAM (x86_64 / AArch64)
              |
              +--> Directly mutates SimStateArena in O(1)
```

1. **Génération directe de fonctions Cranelift** :
   - Les assignations continues (ex. `assign c = a + b`) et les blocs combinatoires sont directement convertis dans la représentation intermédiaire de Cranelift (CLIF).
   - Les opérateurs arithmétiques, bit à bit, de décalage et de réduction sont compilés en instructions vectorisées de la machine hôte.
2. **Exécution native par pointeurs mémoire** :
   - La fonction compilée accepte des pointeurs directs vers le tampon mémoire de `SimStateArena` (`values: *mut u64, masks: *mut u64`).
   - Les opérations au niveau du bit s'exécutent avec des instructions processeur en un seul cycle (`and`, `or`, `xor`, `add`, `sub`).
3. **Indicateurs de détection de changement** :
   - Les fonctions compilées renvoient un entier booléen unique indiquant si l'équipotentielle de destination a subi une transition d'état, permettant une planification optimale de la sensibilité en aval.
