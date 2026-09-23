# Saat Tamponları & G/Ç Primitifleri

Saatleme ve G/Ç primitifleri, genel saat dağıtım ağlarını ve harici elektriksel pin arayüzlerini kontrol eder.

---

## Genel Saat Tamponları (`BUFG`, `BUFGCE`)

Genel saat tamponları, tüm FPGA yongasını kapsayan özel yüksek çıkış yüklü, düşük kaymalı saat dağıtım omurgalarını sürer:

### 1. `BUFG`
Bir osilatör pinini veya PLL çıkışını genel saat ağına bağlayan basit genel saat tamponu:
```verilog
BUFG u_bufg (
    .O (sys_clk_global),
    .I (sys_clk_pin)
);
```

### 2. `BUFGCE` (Saat Etkinleştirme Tamponu)
Aksaklıksız geçitli saat tamponu. `CE` sinyalinin pasif yapılması, zararlı güdük darbeler üretmeden saat çıkışını lojik sıfıra çeker:
```verilog
BUFGCE u_bufgce (
    .O  (gated_clk),
    .I  (sys_clk),
    .CE (clock_enable)
);
```

---

## Giriş & Çıkış Tamponları (`IBUF`, `OBUF`)

Giriş ve çıkış tamponları, dahili mantığı fiziksel kılıf pinlerine bağlar:
- **`IBUF`**: Standart tek uçlu giriş tamponu (`.O(internal_wire), .I(external_pin)`).
- **`OBUF`**: Standart tek uçlu çıkış tamponu (`.O(external_pin), .I(internal_wire)`).
- **`OBUFT`**: Aktif-düşük etkinleştirmeli (`.T`) üç durumlu çıkış tamponu.
