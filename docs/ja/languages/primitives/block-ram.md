# ブロックRAM内蔵メモリ (RAMB18 / RAMB36)

Xilinx FPGAには、専用のデュアルポート同期スタティックRAMブロックが搭載されています: `RAMB18E2`（18キロビット）および `RAMB36E2`（36キロビット）。

---

## RAMBの主要機能

- **真のデュアルポート動作**: 個別のクロックを持つ独立した読み取りおよび書き込みポート（`Port A` および `Port B`）。
- **構成可能なデータ幅**:
  - `RAMB36E2`: $32\text{K} \times 1$, $16\text{K} \times 2$, $8\text{K} \times 4$, $4\text{K} \times 9$, $2\text{K} \times 18$, $1\text{K} \times 36$, または $512 \times 72$。
  - `RAMB18E2`: $16\text{K} \times 1$, $8\text{K} \times 2$, $4\text{K} \times 4$, $2\text{K} \times 9$, $1\text{K} \times 18$, または $512 \times 36$。
- **バイト単位の書き込みイネーブル**: 個別の8ビットバイト書き込みストローブ（`WEA[3:0]`）。
- **内蔵FIFOコントローラ**: 外部CLBロジックを消費しない専用のハードウェアポインタおよびステータスフラグ（`FULL`, `EMPTY`）。

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
