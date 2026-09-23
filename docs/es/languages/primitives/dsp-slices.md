# Slices de procesamiento aritmético DSP48

Las FPGA de Xilinx integran slices de hardware de procesamiento de señales digitales de alta velocidad: `DSP48E1` (Serie 7) y `DSP48E2` (UltraScale+).

---

## Arquitectura DSP48E2 (UltraScale+)

El slice `DSP48E2` cuenta con:
- **Multiplicador en complemento a dos de $27 \times 18$ bits**: Admite aritmética de operandos anchos en un solo ciclo de reloj.
- **Acumulador y ALU de 48 bits**: Realiza suma, resta, operaciones lógicas y acumulación.
- **Pre-sumador dedicado**: Pre-sumador de 27 bits para filtros de respuesta al impulso finita (FIR) simétricos.
- **Detector de patrones**: Detecta conteos terminales, indicadores de cero y condiciones de desbordamiento por exceso o por defecto.

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

En Axiom EDA, las multiplicaciones de comportamiento (`assign P = A * B;`) se infieren automáticamente en slices de hardware `DSP48E2` durante el mapeo tecnológico.
