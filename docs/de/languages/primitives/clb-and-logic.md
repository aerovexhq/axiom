# Konfigurierbarer Logikblock (CLB) & Logik-Primitiven

Konfigurierbare Logikblöcke (CLBs) enthalten die zentralen Look-Up-Tabellen, die Übertragslogik und die sequenziellen Speicherelemente von Xilinx-FPGAs.

---

## Look-Up-Tabellen (`LUT1` bis `LUT6`, `LUT6_2`)

### 1. `LUT6_2` (6-Input-LUT mit Dual-Ausgang)
Das Fundament moderner Xilinx-CLBs. Es kann jede einzelne boolesche Funktion mit 6 Eingängen (`O6`) oder zwei verschiedene boolesche Funktionen mit 5 Eingängen implementieren, die sich die Eingänge `I0` bis `I4` teilen (`O5` und `O6`):

```verilog
LUT6_2 #(
    .INIT(64'h8000_0000_0000_0000) // 6-input AND gate
) u_lut (
    .O6 (and_out),
    .O5 (), // Unused in single-output mode
    .I0 (in0), .I1 (in1), .I2 (in2),
    .I3 (in3), .I4 (in4), .I5 (in5)
);
```

---

## Schnelle Übertragslogik (`CARRY4`, `CARRY8`)

Dedizierte schnelle Übertragsketten implementieren Hochgeschwindigkeits-Addierer und -Akkumulatoren, ohne Übertragssignale über langsamere allgemeine Verbindungen zu leiten:
- **`CARRY4` (7-Series)**: 4-Bit-Lookahead-Übertragsmakro mit Propagate (`S[3:0]`), Generate (`DI[3:0]`), Übertragseingang (`CI`) und Übertragsausgängen (`CO[3:0]`, `O[3:0]`).
- **`CARRY8` (UltraScale+)**: 8-Bit-Lookahead-Übertragsmakro mit doppelter Übertragsdichte pro CLB-Slice.

---

## Flipflops & Latches (`FDRE`, `FDSE`, `FDCE`, `FDPE`)

Xilinx-Slice-Register unterstützen dedizierte Taktaktivierungen und priorisierte Sets/Resets:

| Primitiv | Auslöser | Reset-Typ | Priorität | Beschreibung |
| :--- | :--- | :--- | :--- | :--- |
| `FDRE` | `posedge C` | Synchroner Reset (`R`) | Reset-Priorität | D-Flipflop mit Taktaktivierung (`CE`) und synchronem Reset |
| `FDSE` | `posedge C` | Synchroner Set (`S`) | Set-Priorität | D-Flipflop mit Taktaktivierung (`CE`) und synchronem Set |
| `FDCE` | `posedge C` | Asynchroner Clear (`CLR`) | Clear-Priorität | D-Flipflop mit Taktaktivierung (`CE`) und asynchronem Clear |
| `FDPE` | `posedge C` | Asynchroner Preset (`PRE`) | Preset-Priorität | D-Flipflop mit Taktaktivierung (`CE`) und asynchronem Preset |

```verilog
FDRE #(
    .INIT(1'b0) // Power-on initial value
) u_ff (
    .Q  (q_out),
    .C  (clk),
    .CE (clk_en),
    .R  (sync_rst),
    .D  (d_in)
);
```
