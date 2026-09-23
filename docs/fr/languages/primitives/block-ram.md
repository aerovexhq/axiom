# Mémoires intégrées RAM bloc (RAMB18 / RAMB36)

Les FPGA Xilinx intègrent des blocs de RAM statique synchrone double port dédiés : `RAMB18E2` (18 kilobits) et `RAMB36E2` (36 kilobits).

---

## Fonctionnalités clés de RAMB

- **Fonctionnement en véritable double port** : Ports de lecture et d'écriture indépendants (`Port A` et `Port B`) avec horloges séparées.
- **Largeurs de données configurables** :
  - `RAMB36E2` : $32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$ ou $512 \times 72$.
  - `RAMB18E2` : $16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$ ou $512 \times 36$.
- **Validation d'écriture par octet** : Signaux d'écriture individuels par octet 8 bits (`WEA[3:0]`).
- **Contrôleur FIFO intégré** : Pointeurs matériels dédiés et drapeaux d'état (`FULL`, `EMPTY`) sans consommer de logique CLB externe.

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
