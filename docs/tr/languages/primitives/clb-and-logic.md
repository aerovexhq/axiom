# Yapılandırılabilir Mantık Bloğu (CLB) & Mantık Primitifleri

Yapılandırılabilir Mantık Blokları (CLB), Xilinx FPGA'larının temel Doğruluk Tablolarını (LUT), elde mantığını ve ardışıl depolama elemanlarını içerir.

---

## Doğruluk Tabloları (`LUT1` - `LUT6`, `LUT6_2`)

### 1. `LUT6_2` (Çift Çıkışlı 6 Girişli LUT)
Modern Xilinx CLB'lerinin temeli. Herhangi bir tekli 6 girişli Boole fonksiyonunu (`O6`) veya `I0` ile `I4` arasındaki girişleri paylaşan iki farklı 5 girişli Boole fonksiyonunu (`O5` ve `O6`) gerçekleştirebilir:

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

## Hızlı Elde Mantığı (`CARRY4`, `CARRY8`)

Özel hızlı elde zincirleri, elde sinyallerini daha yavaş genel arabağlantı üzerinden yönlendirmeden yüksek hızlı toplayıcılar ve akümülatörler uygular:
- **`CARRY4` (7-Serisi)**: Yayma (`S[3:0]`), üretme (`DI[3:0]`), giriş eldesi (`CI`) ve çıkış eldeleri (`CO[3:0]`, `O[3:0]`) içeren 4-bit önceden belirlemeli elde makrosu.
- **`CARRY8` (UltraScale+)**: CLB dilimi başına iki kat elde yoğunluğu sağlayan 8-bitlik önceden belirlemeli elde makrosu.

---

## Flip-Floplar & Mandal Devreleri (`FDRE`, `FDSE`, `FDCE`, `FDPE`)

Xilinx dilim yazmaçları, özel saat etkinleştirmelerini ve öncelikli kurma/sıfırlamaları destekler:

| Primitif | Tetikleyici | Sıfırlama Türü | Öncelik | Açıklama |
| :--- | :--- | :--- | :--- | :--- |
| `FDRE` | `posedge C` | Senkron Sıfırlama (`R`) | Sıfırlama önceliği | Saat Etkinleştirmeli (`CE`) ve Senkron Sıfırlamalı D Flip-Flop |
| `FDSE` | `posedge C` | Senkron Kurma (`S`) | Kurma önceliği | Saat Etkinleştirmeli (`CE`) ve Senkron Kurmalı D Flip-Flop |
| `FDCE` | `posedge C` | Asenkron Temizleme (`CLR`) | Temizleme önceliği | Saat Etkinleştirmeli (`CE`) ve Asenkron Temizlemeli D Flip-Flop |
| `FDPE` | `posedge C` | Asenkron Ön Kurma (`PRE`) | Ön kurma önceliği | Saat Etkinleştirmeli (`CE`) ve Asenkron Ön Kurmalı D Flip-Flop |

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
