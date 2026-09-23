# Vivado vs. Axiom Feature-Matrix

Ein detaillierter Vergleich zwischen der herkömmlichen AMD Vivado-Simulationsumgebung und der Axiom EDA-Engine der nächsten Generation.

---

## Vergleich der technischen Leistungsmerkmale

| Leistungsmerkmal | AMD Vivado Design Suite | Axiom EDA (Aerovex) |
| :--- | :--- | :--- |
| **Primäre Ausführungs-Engine** | Auf Festplatte kompilierter `xsimk`-Snapshot | In-RAM Cranelift-JIT-Maschinencode |
| **Typische Kompilierungslatenz** | 30 – 120 Sekunden | **1 – 3 Millisekunden** |
| **Simulationsdurchsatz** | 100k – 250k Ereignisse/s | **780k+ Ereignisse/s** |
| **Delta-Zyklus-Steuerung** | Undurchsichtig (kollabiert Delta-Schritte) | **Aufrufergesteuertes `step_delta`** |
| **Glitch- / Hazard-Verfolgung** | Verborgen | **Statische & dynamische Hazard-Erkennung** |
| **Silizium-Leistungsmodellierung** | Statische Schätzung nach der Simulation | **Echtzeit-Dynamik $P = \frac{1}{2} C V^2 f \alpha$** |
| **PDN-Spannungsabfall** | Erfordert externe SPICE-Modellierung | **Integrierte Modellierung des induktiven $IR + L \frac{di}{dt}$-Spannungsabfalls** |
| **Speicherzustands-Arena** | Fragmentierte C++-Strukturen | **Zusammenhängende 64-Bit-Doppelvektoren** |
| **Signalverlaufs-Exportierer** | Proprietäres `.wdb` + `.vcd` | **Standard IEEE 1364 `.vcd`** |
| **Leistungsexportierer** | SAIF-Generierung | **Standard SAIF 2.0-Interoperabilität** |
| **GUI-Framework** | Java Swing (schwerfällig, speicherhungrig) | **Tauri v2 + React 19 (Dunkles Obsidian)** |
| **Web-Browser-Ausführung** | Nicht möglich | **100% Client-seitiges WebAssembly** |
| **Installationsgröße** | 60 – 110 GB | **< 50 MB** |
| **Nativer macOS-Support** | Nein (erfordert Linux-VM) | **Natives Apple Silicon (AArch64)** |
| **Lizenzkosten** | Monolithische Arbeitsplatzlizenzen ($$$) | **Open-Source-Kern (MIT-Lizenz)** |
