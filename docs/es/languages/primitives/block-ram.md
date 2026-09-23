# Memorias embebidas Block RAM (RAMB18 / RAMB36)

Las FPGA de Xilinx contienen bloques dedicados de RAM estática síncrona de doble puerto: `RAMB18E2` (18 Kilobits) y `RAMB36E2` (36 Kilobits).

---

## Características clave de RAMB

- **Operación de doble puerto real**: Puertos independientes de lectura y escritura (`Puerto A` y `Puerto B`) con relojes separados.
- **Anchos de datos configurables**:
  - `RAMB36E2`: $32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$ o $512 \times 72$.
  - `RAMB18E2`: $16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$ o $512 \times 36$.
- **Habilitaciones de escritura por byte**: Señales de escritura individuales de 8 bits por byte (`WEA[3:0]`).
- **Controlador FIFO integrado**: Punteros de hardware dedicados e indicadores de estado (`FULL`, `EMPTY`) sin consumir lógica CLB externa.

```verilog
RAMB36E2 #(
    .READ_WIDTH_A(36),
    .WRITE_WIDTH_A(36),
    .READ_WIDTH_B(36),
    .WRITE_WIDTH_B(36)
) u_bram (
    // Port A
    .CLKARDCLK (clk),
    .ADDRARDADDR({addr_a, 5'b0}),
    .DINADIN   (data_in_a),
    .DOUTADOUT (data_out_a),
    .WEA       (write_en_a),
    // Port B
    .CLKBWRCLK (clk),
    .ADDRBWRADDR({addr_b, 5'b0}),
    .DINBDIN   (data_in_b),
    .DOUTBDOUT (data_out_b),
    .WEBWE     (write_en_b)
);
```
