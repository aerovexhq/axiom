# Aperçu du support Verilog HDL (IEEE 1364)

Axiom EDA offre une prise en charge complète et native de la compilation et de la simulation pour les normes de langage de description de matériel Verilog IEEE 1364-1995, IEEE 1364-2001 et IEEE 1364-2005.

Plutôt que de s'appuyer sur des transpilations C++ héritées en plusieurs étapes ou sur la génération d'instantanés lourds sur disque, Axiom traduit directement le Verilog en une représentation intermédiaire en RAM (BIR) compilée en code machine natif (x86_64, AArch64) via la compilation JIT en RAM avec Cranelift en moins de 3 millisecondes, ou exécutée côté client dans les navigateurs via WebAssembly.

---

## Pipeline de compilation et de simulation Verilog

```
+-------------------------------------------------------------------------------+
| Axiom In-RAM HDL Processing Pipeline                                          |
+-------------------------------------------------------------------------------+
| Source Code (.v)                                                              |
|   |                                                                           |
|   v [Lexer & Tokenizer] (crates/syntax/src/lexer.rs)                          |
| IEEE 1364 Token Stream (Keywords, Identifiers, Sized Numbers, Directives)     |
|   |                                                                           |
|   v [Recursive Descent Parser] (crates/syntax/src/parser.rs)                  |
| Abstract Syntax Tree (AST) (Modules, Ports, Declarations, Processes, Assigns) |
|   |                                                                           |
|   v [Hardware Elaborator] (crates/ir/src/elaborator.rs)                       |
| Bound Intermediate Representation (BIR Netlist, Stratified Event Graph)       |
|   |                                                                           |
|   +---------------------------------------+-----------------------------------+
|   | (Desktop Native)                      | (In-Browser WebAssembly)          |
|   v                                       v                                   |
| [Cranelift JIT Backend]                   | [WASM Execution Engine]           |
| Machine Code in RAM (x86_64 / AArch64)    | Web Worker Sandbox (32-bit WASM)  |
|   |                                       |                                   |
|   +-------------------+-------------------+                                   |
|                       v                                                       |
|       [Stratified Event Scheduler] (crates/sim/src/engine.rs)                 |
|       Active -> Inactive -> NBA -> Monitor -> Future Events                   |
+-------------------------------------------------------------------------------+
```

### 1. Analyse lexicale et syntaxique en RAM
L'analyseur lexical et syntaxique haute vitesse gère toutes les conventions lexicales IEEE 1364, les littéraux numériques dimensionnés, les directives de compilation (`\`include\`, `\`define\`, `\`ifdef\`) et l'expansion de macros avec des temps d'exécution inférieurs à la milliseconde.

### 2. Élaboration de la netlist
L'élaborateur déploie les hiérarchies de modules, résout les surcharges de paramètres (`#(.WIDTH(8))`), lie les assignations continues, câble les primitives de portes, extrait les machines à états finis et construit un graphe de planification d'événements stratifié.

### 3. Exécution sur double environnement
- **JIT natif de bureau** : Convertit directement les expressions booléennes, multiplexeurs et opérateurs arithmétiques en instructions machine natives, atteignant un débit de simulation supérieur à 780 000 événements/seconde.
- **Bac à sable WebAssembly** : S'exécute dans un Web Worker d'arrière-plan isolé avec télémétrie par SharedArrayBuffer, assurant une simulation 100% côté client sans dépendance de serveur.

---

## Matrice de conformité aux standards

| Standard IEEE | Domaine de fonctionnalité | Statut de support Axiom |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | Primitives de portes structurelles (`and`, `or`, `not`, `xor`, `buf`) | Entièrement pris en charge |
| **IEEE 1364-1995** | En-têtes de ports non-ANSI (`module foo (a, b); input a;`) | Entièrement pris en charge |
| **IEEE 1364-2001** | En-têtes de liste de ports ANSI (`module foo (input wire a, output reg b);`) | Entièrement pris en charge |
| **IEEE 1364-2001** | Opérateurs de sélection de partie indexée (`[base +: width]`, `[base -: width]`) | Entièrement pris en charge |
| **IEEE 1364-2001** | Tableaux de mémoire multidimensionnels (`reg [31:0] mem [0:1023]`) | Entièrement pris en charge |
| **IEEE 1364-2001** | Déclaration et assignation continue combinées (`wire [7:0] w = in;`) | Entièrement pris en charge |
| **IEEE 1364-2005** | Constructions de boucles procédurales (`for`, `while`, `repeat`, `forever`) | Entièrement pris en charge |
| **IEEE 1364-2005** | Tâches système (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | Entièrement pris en charge |
| **IEEE 1364-2005** | Chargement de fichiers mémoire (`$readmemb`, `$readmemh`) | Entièrement pris en charge |
