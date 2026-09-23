# Blok RAM Gömülü Bellekleri (RAMB18 / RAMB36)

Xilinx FPGA'ları özel çift portlu senkron Statik RAM blokları içerir: `RAMB18E2` (18 Kilobit) ve `RAMB36E2` (36 Kilobit).

---

## Temel RAMB Özellikleri

- **Gerçek Çift Port İşlemi**: Ayrı saatlere sahip bağımsız okuma ve yazma portları (`Port A` ve `Port B`).
- **Yapılandırılabilir Veri Genişlikleri**:
  - `RAMB36E2`: $32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$ veya $512 \times 72$.
  - `RAMB18E2`: $16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$ veya $512 \times 36$.
- **Bayt Genişliğinde Yazma Etkinleştirmeleri**: Bağımsız 8-bitlik bayt yazma darbeleri (`WEA[3:0]`).
- **Dahili FIFO Denetleyicisi**: Harici CLB mantığı tüketmeden özel donanım işaretçileri ve durum bayrakları (`FULL`, `EMPTY`).

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
