# In-RAM Cranelift-JIT-Kompilierung

Herkömmliche Hardware-Simulatoren (wie Verilator, Synopsys VCS und Vivado xsim) stützen sich stark auf eine mehrstufige Dateigenerierung:
1. Lexikalische Analyse und Parsen von HDL-Quelldateien in Zwischen-ASTs.
2. Ausgabe riesiger C++- oder C-Quelldateien (oft mehrere Gigabyte groß).
3. Aufruf externer Host-Compiler (GCC / Clang) zum Kompilieren und Binden von Shared-Object-Dateien.
4. Zurückladen von Shared Libraries in den Speicher zum Starten der Simulation.

Dieser Ansatz führt bei jeder Design-Iteration zu **zig Sekunden bis Minuten unproduktiver Kompilierungszeit**.

---

## Die Festplatten-freie Axiom-JIT-Pipeline

Axiom umgeht Zwischenspeicherungen auf der Festplatte und externe Toolchains vollständig:

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

1. **Direkte Cranelift-Funktionsgenerierung**:
   - Kontinuierliche Zuweisungen (z. B. `assign c = a + b`) und kombinatorische Blöcke werden direkt in die Cranelift Intermediate Representation (CLIF) abgesenkt.
   - Arithmetische, bitweise, Verschiebungs- und Reduktionsoperatoren werden in vektorisierte Host-Maschinenbefehle kompiliert.
2. **Ausführung über native Speicherzeiger**:
   - Die kompilierte Funktion akzeptiert direkte Zeiger auf den `SimStateArena`-Speicherpuffer (`values: *mut u64, masks: *mut u64`).
   - Operationen auf Bitebene werden mit Einzelzyklus-CPU-Befehlen (`and`, `or`, `xor`, `add`, `sub`) ausgeführt.
3. **Änderungserkennungs-Flags**:
   - Kompilierte Funktionen geben einen einzelnen booleschen Integer zurück, der anzeigt, ob das Zielnetz einen Zustandsübergang durchlaufen hat, was ein optimales nachgelagertes Sensitivitäts-Scheduling ermöglicht.
