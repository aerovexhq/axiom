# Verilog HDL (IEEE 1364) Unterstützungsübersicht

Axiom EDA bietet umfassende, native Kompilierungs- und Simulationsunterstützung für die Standards IEEE 1364-1995, IEEE 1364-2001 und IEEE 1364-2005 der Verilog Hardware Description Language.

Anstatt sich auf veraltete mehrstufige C++-Transpilierungen oder festplattenintensive Snapshot-Generierung zu verlassen, übersetzt Axiom Verilog direkt in eine In-RAM-Zwischendarstellung (BIR), die über Cranelift-JIT in unter 3 Millisekunden in nativen Maschinencode (x86_64, AArch64) kompiliert oder clientseitig in Browsern über WebAssembly ausgeführt wird.

---

## Verilog-Kompilierungs- & Simulations-Pipeline

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

### 1. Lexing & Parsing im RAM
Der Hochgeschwindigkeits-Lexer und der rekursive Abstiegs-Parser verarbeiten alle lexikalischen Konventionen von IEEE 1364, Zahlenliterale mit Größenangabe, Compiler-Direktiven (`\`include\`, `\`define\`, `\`ifdef\`) und Makro-Erweiterungen mit Ausführungszeiten im Submillisekundenbereich.

### 2. Netzlisten-Elaborierung
Der Elaborator entrollt Modulhierarchien, löst Parameterüberschreibungen (`#(.WIDTH(8))`) auf, bindet kontinuierliche Zuweisungen, verdrahtet Gatterprimitiven, extrahiert Zustandsautomaten und konstruiert einen geschichteten Ereignis-Scheduling-Graphen.

### 3. Dual-Laufzeit-Ausführung
- **Nativer Desktop-JIT**: Senkt boolesche Ausdrücke, Multiplexer und arithmetische Operatoren direkt in native Maschinenbefehle ab und erzielt einen Simulationsdurchsatz von über 780.000 Ereignissen/Sekunde.
- **WebAssembly-Sandbox**: Läuft in einem isolierten Hintergrund-Web-Worker mit SharedArrayBuffer-Telemetrie und liefert eine 100%ige clientseitige Simulation ohne Serverabhängigkeiten.

---

## Standard-Konformitätsmatrix

| IEEE-Standard | Funktionsbereich | Axiom Unterstützungsstatus |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | Strukturelle Gatter-Primitiven (`and`, `or`, `not`, `xor`, `buf`) | Vollständig unterstützt |
| **IEEE 1364-1995** | Nicht-ANSI-Port-Header (`module foo (a, b); input a;`) | Vollständig unterstützt |
| **IEEE 1364-2001** | ANSI-Portlisten-Header (`module foo (input wire a, output reg b);`) | Vollständig unterstützt |
| **IEEE 1364-2001** | Indexierte Teilbereichs-Auswahloperatoren (`[base +: width]`, `[base -: width]`) | Vollständig unterstützt |
| **IEEE 1364-2001** | Mehrdimensionale Speicher-Arrays (`reg [31:0] mem [0:1023]`) | Vollständig unterstützt |
| **IEEE 1364-2001** | Kombinierte Deklaration und kontinuierliche Zuweisung (`wire [7:0] w = in;`) | Vollständig unterstützt |
| **IEEE 1364-2005** | Prozedurale Schleifenkonstrukte (`for`, `while`, `repeat`, `forever`) | Vollständig unterstützt |
| **IEEE 1364-2005** | System-Tasks (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | Vollständig unterstützt |
| **IEEE 1364-2005** | Laden von Speicherdateien (`$readmemb`, `$readmemh`) | Vollständig unterstützt |
