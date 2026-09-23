# DSP48 Arithmetik-Verarbeitungs-Slices

Xilinx-FPGAs enthalten integrierte Hochgeschwindigkeits-Hardware-Slices für die digitale Signalverarbeitung: `DSP48E1` (7-Series) und `DSP48E2` (UltraScale+).

---

## DSP48E2-Architektur (UltraScale+)

Das `DSP48E2`-Slice bietet:
- **$27 \times 18$-Bit-Zweierkomplement-Multiplizierer**: Unterstützt Arithmetik mit breiten Operanden in einem einzigen Taktzyklus.
- **48-Bit-Akkumulator & ALU**: Führt Addition, Subtraktion, Logikoperationen und Akkumulation durch.
- **Dedizierter Voraddierer**: 27-Bit-Voraddierer für symmetrische Finite-Impulse-Response-(FIR)-Filter.
- **Musterdetektor**: Erkennt Endzählerstände, Null-Flags sowie Überlauf-/Unterlaufbedingungen.

```verilog
DSP48E2 #(
    .USE_MULT("MULTIPLY")
) u_dsp (
    .P      (product_48bit),
    .A      ({3'b0, operand_a_27bit}),
    .B      (operand_b_18bit),
    .C      (48'h0),
    .CLK    (clk),
    .ALUMODE(4'b0000), // ADD
    .OPMODE (9'b000000101)
);
```

In Axiom EDA werden Verhaltensmultiplikationen (`assign P = A * B;`) während des Technologie-Mappings automatisch in `DSP48E2`-Hardware-Slices inferiert.
