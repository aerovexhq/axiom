# Resumen de soporte de Verilog HDL (IEEE 1364)

Axiom EDA proporciona soporte integral y nativo de compilación y simulación para los estándares de lenguaje de descripción de hardware Verilog IEEE 1364-1995, IEEE 1364-2001 e IEEE 1364-2005.

En lugar de depender de transpilaciones heredadas de C++ en múltiples etapas o generación pesada de snapshots en disco, Axiom traduce Verilog directamente a una representación intermedia en RAM (BIR) que compila en código máquina nativo (x86_64, AArch64) mediante JIT Cranelift en menos de 3 milisegundos, o se ejecuta en el cliente en navegadores mediante WebAssembly.

---

## Pipeline de compilación y simulación de Verilog

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

### 1. Análisis léxico y sintáctico en RAM
El analizador léxico de alta velocidad y el analizador sintáctico descendente recursivo gestionan todas las convenciones léxicas de IEEE 1364, literales numéricos con tamaño, directivas de compilador (`\`include\`, `\`define\`, `\`ifdef\`) y expansiones de macros con tiempos de ejecución inferiores al milisegundo.

### 2. Elaboración de netlists
El elaborador despliega las jerarquías de módulos, resuelve sobreescrituras de parámetros (`#(.WIDTH(8))`), vincula asignaciones continuas, conecta primitivas de compuertas, extrae máquinas de estados finitos y construye un grafo de planificación de eventos estratificado.

### 3. Ejecución en doble entorno de ejecución
- **JIT nativo de escritorio**: Reduce directamente expresiones booleanas, multiplexores y operadores aritméticos a instrucciones de máquina nativas, logrando un rendimiento de simulación superior a 780,000 eventos/segundo.
- **Entorno aislado de WebAssembly**: Se ejecuta en un Web Worker en segundo plano aislado con telemetría en SharedArrayBuffer, ofreciendo simulación 100% en el cliente sin dependencias de servidor.

---

## Matriz de cumplimiento de estándares

| Estándar IEEE | Área de funcionalidad | Estado de soporte en Axiom |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | Primitivas de compuertas estructurales (`and`, `or`, `not`, `xor`, `buf`) | Totalmente soportado |
| **IEEE 1364-1995** | Cabeceras de puertos no ANSI (`module foo (a, b); input a;`) | Totalmente soportado |
| **IEEE 1364-2001** | Cabeceras de lista de puertos ANSI (`module foo (input wire a, output reg b);`) | Totalmente soportado |
| **IEEE 1364-2001** | Operadores de selección de parte indexada (`[base +: width]`, `[base -: width]`) | Totalmente soportado |
| **IEEE 1364-2001** | Matrices de memoria multidimensionales (`reg [31:0] mem [0:1023]`) | Totalmente soportado |
| **IEEE 1364-2001** | Declaración combinada y asignación continua (`wire [7:0] w = in;`) | Totalmente soportado |
| **IEEE 1364-2005** | Construcciones de bucle procedimentales (`for`, `while`, `repeat`, `forever`) | Totalmente soportado |
| **IEEE 1364-2005** | Tareas del sistema (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | Totalmente soportado |
| **IEEE 1364-2005** | Carga de archivos de memoria (`$readmemb`, `$readmemh`) | Totalmente soportado |
