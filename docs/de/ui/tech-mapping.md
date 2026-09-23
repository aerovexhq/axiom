# Gatterebenen-Technologie-Mapping-Studio

Axioms Technologie-Mapping-Studio (`crates/ir/src/synth/`) schlägt die Brücke zwischen Verhaltens-RTL und physischen FPGA-Architekturen. Es zerlegt generische boolesche Logikgleichungen, Multiplexer und arithmetische Operatoren in Siliziumprimitiven, die nativ für AMD/Xilinx 7-Series- und UltraScale+-Bausteine sind.

---

## Architekturspezifische Primitiven-Absenkung

```
+-------------------------------------------------------------------------------+
| RTL Verilog Code:                       | Mapped Silicon Primitives:          |
|                                         |                                     |
| assign F = (cond) ? (a + b) : (c & d);  | - LUT6_2 (INIT = 64'hE2E2_0000_...) |
|                                         | - CARRY4 (Fast Arithmetic)          |
|                                         | - FDRE   (D Flip-Flop with Enable)  |
+-------------------------------------------------------------------------------+
```

### Unterstützte FPGA-Silizium-Zielbausteine
Entwickler können aus vorkonfigurierten Hardware-Architekturen wählen:
1. **AMD Artix-7 (XC7A35T / XC7A100T)**: 6-Input-LUTs, CARRY4-Arithmetik, DSP48E1-Slices, RAMB36E1-Speicher.
2. **AMD Kintex-7 (XC7K325T)**: Hochgeschwindigkeits-Architektur der 7er-Serie.
3. **AMD Zynq-7000 (XC7Z020)**: Dual-ARM-Cortex-A9-SoC mit programmierbarer Logikstruktur der 7er-Serie.
4. **AMD Kintex UltraScale+ (XCKU5P)**: Moderne 16-nm-FinFET-Architektur mit CARRY8-Ketten, DSP48E2-Slices und UltraRAM-Blöcken.
5. **Axiom Virtual Silicon**: Generische, hochkapazitive virtuelle Architektur, optimiert für Lehre und schnelles Prototyping.

---

## Boolesche Netzwerkzerlegung & K-LUT-Mapping

### 1. $K$-LUT-Zerlegung
Axiom zerlegt beliebige boolesche Logikausdrücke in Look-Up-Tabellen mit $K$ Eingängen (wobei $K=6$ für moderne Xilinx-FPGAs ist):
- Unterfunktionen mit $\le 6$ eindeutigen Eingängen werden direkt auf eine einzelne `LUT6` abgebildet.
- Dual-Ausgangs-Logikfunktionen, die sich bis zu 5 Eingänge teilen, werden auf Dual-Ausgangs-`LUT6_2`-Primitiven (`O5`, `O6`) abgebildet.
- Breite Logikfunktionen ($N > 6$) werden mittels Shannon-Zerlegung in kaskadierende LUT-Netzwerke aufgeteilt.

### 2. Exakte `INIT`-Hexadezimalparameter-Berechnung
Jede zugeordnete LUT hat ihre Wahrheitstabelle in einen 64-Bit-Hexadezimalparameter `INIT` serialisiert:
$$\text{INIT}[i] = f(i_5, i_4, i_3, i_2, i_1, i_0)$$
Beispielsweise wird ein AND-Gatter mit 2 Eingängen auf eine `LUT6` mit `INIT = 64'h0000_0000_0000_0008` abgebildet.

---

## Makro-Primitiven-Inferenz

Die Synthese-Engine identifiziert automatisch übergeordnete strukturelle Muster:
- **DSP-Slice-Inferenz (`DSP48E1` / `DSP48E2`)**: Multi-Bit-Multiplikationen (`a * b`), Multiply-Accumulate-Operationen (`P = P + (A * B)`) und Voraddierer-Sequenzen werden direkt auf dedizierte Hardware-DSP-Blöcke abgebildet, anstatt Hunderte von Logik-LUTs zu verbrauchen.
- **Block-RAM-Inferenz (`RAMB18E2` / `RAMB36E2`)**: Entpackte Arrays mit synchroner Taktung (`reg [31:0] mem [0:1023]`) werden automatisch in echte Dual-Port- oder einfache Dual-Port-Hardware-Block-RAMs abgesenkt.

---

## Inspektion der zugeordneten Netzliste & Struktureller Verilog-Export

Der Technologie-Mapping-Betrachter bietet:
- **Ressourcenauslastungs-Balkendiagramm**: Zeigt Anzahlen und Prozentsätze für Slice-LUTs, Slice-Register (FFs), CARRY-Ketten, DSP-Slices und Block-RAMs an.
- **Zellen-Inspektor-Tabelle**: Suchen und filtern Sie zugeordnete Primitiveninstanzen.
- **Wahrheitstabellen-HUD**: Untersuchen Sie die exakte boolesche Wahrheitstabelle jeder zugeordneten LUT.
- **Struktureller Verilog-Export**: 1-Klick-Generierung reiner struktureller Gatter-Netzlisten (`.v`), instanziiert mit standardmäßigen Xilinx-Primitiven.
