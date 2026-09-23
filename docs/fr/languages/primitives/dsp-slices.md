# Slices de traitement arithmétique DSP48

Les FPGA Xilinx intègrent des tranches matérielles de traitement numérique du signal haute vitesse : `DSP48E1` (Série 7) et `DSP48E2` (UltraScale+).

---

## Architecture DSP48E2 (UltraScale+)

La tranche `DSP48E2` comprend :
- **Multiplieur en complément à deux $27 \times 18$ bits** : Prend en charge l'arithmétique à opérandes larges en un seul cycle d'horloge.
- **Accumulateur et ALU 48 bits** : Exécute additions, soustractions, opérations logiques et accumulations.
- **Pré-additionneur dédié** : Pré-additionneur 27 bits pour filtres à réponse impulsionnelle finie (FIR) symétriques.
- **Détecteur de motifs** : Détecte les comptages terminaux, les indicateurs de zéro et les conditions de dépassement de capacité positif ou négatif.

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

Dans Axiom EDA, les multiplications comportementales (`assign P = A * B;`) sont automatiquement inférées en tranches matérielles `DSP48E2` lors du mappage technologique.
