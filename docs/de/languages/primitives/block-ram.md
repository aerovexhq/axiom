# Eingebettete Block-RAM-Speicher (RAMB18 / RAMB36)

Xilinx-FPGAs enthalten dedizierte synchrone Dual-Port-Static-RAM-Blöcke: `RAMB18E2` (18 Kilobit) und `RAMB36E2` (36 Kilobit).

---

## Wichtige RAMB-Funktionen

- **Echter Dual-Port-Betrieb**: Unabhängige Lese- und Schreibports (`Port A` und `Port B`) mit getrennten Takten.
- **Konfigurierbare Datenbreiten**:
  - `RAMB36E2`: $32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$ oder $512 \times 72$.
  - `RAMB18E2`: $16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$ oder $512 \times 36$.
- **Bytebreite Schreibaktivierungen**: Individuelle 8-Bit-Byte-Schreib-Strobes (`WEA[3:0]`).
- **Integrierter FIFO-Controller**: Dedizierte Hardware-Zeiger und Status-Flags (`FULL`, `EMPTY`) ohne Verbrauch externer CLB-Logik.

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
