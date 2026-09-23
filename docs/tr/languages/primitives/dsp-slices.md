# DSP48 Aritmetik İşleme Dilimleri

Xilinx FPGA'ları yüksek hızlı donanımsal dijital sinyal işleme dilimleri barındırır: `DSP48E1` (7-Serisi) ve `DSP48E2` (UltraScale+).

---

## DSP48E2 Mimarisi (UltraScale+)

`DSP48E2` dilimi aşağıdaki özelliklere sahiptir:
- **$27 \times 18$-bit İkiye Tümleyen Çarpıcı**: Tek bir saat döngüsünde geniş işlenenli aritmetiği destekler.
- **48-bit Akümülatör ve ALU**: Toplama, çıkarma, mantık işlemleri ve akümülasyon gerçekleştirir.
- **Özel Ön Toplayıcı**: Simetrik sonlu dürtü yanıtı (FIR) filtreleri için 27-bitlik ön toplayıcı.
- **Desen Algılayıcı**: Terminal sayımlarını, sıfır bayraklarını ve taşma/yetersizlik durumlarını algılar.

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

Axiom EDA'da davranışsal çarpımlar (`assign P = A * B;`), teknoloji eşleme sırasında otomatik olarak `DSP48E2` donanım dilimlerine çıkarılır.
