# Compilación JIT en RAM con Cranelift

Los simuladores de hardware tradicionales (como Verilator, Synopsys VCS y Vivado xsim) dependen en gran medida de la generación de archivos en múltiples etapas:
1. Análisis léxico y sintáctico de archivos fuente HDL a AST intermedios.
2. Emisión de archivos fuente masivos en C++ o C (a menudo de gigabytes de tamaño).
3. Invocación de compiladores del host externos (GCC / Clang) para compilar y enlazar archivos de objetos compartidos.
4. Carga de bibliotecas compartidas nuevamente en memoria para iniciar la simulación.

Este enfoque introduce **de decenas de segundos a minutos de tiempo muerto de compilación** en cada iteración del diseño.

---

## El pipeline JIT sin disco de Axiom

Axiom evita completamente los volcados intermedios a disco y las cadenas de herramientas externas:

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

1. **Generación directa de funciones con Cranelift**:
   - Las asignaciones continuas (ej. `assign c = a + b`) y los bloques combinacionales se reducen directamente a la representación intermedia de Cranelift (CLIF).
   - Los operadores aritméticos, bit a bit, de desplazamiento y de reducción se compilan a instrucciones vectorizadas de la máquina host.
2. **Ejecución nativa mediante punteros de memoria**:
   - La función compilada acepta punteros directos al búfer de memoria de `SimStateArena` (`values: *mut u64, masks: *mut u64`).
   - Las operaciones a nivel de bit se ejecutan con instrucciones de CPU de ciclo único (`and`, `or`, `xor`, `add`, `sub`).
3. **Indicadores de detección de cambios**:
   - Las funciones compiladas devuelven un único entero booleano que indica si la red de destino experimentó una transición de estado, permitiendo una planificación óptima de sensibilidad posterior.
