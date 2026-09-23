# AMD Vivado'dan Axiom'a Geçiş

Axiom, AMD Vivado Tasarım Paketindeki simülasyon ve doğrulama iş akışları için doğrudan bir ikame sağlamak üzere ilk ilkelerden inşa edilmiştir.

---

## Komut Eşleme Genel Bakışı

| Görev | AMD Vivado Komutu | Axiom CLI Karşılığı |
| :--- | :--- | :--- |
| **Verilog Ayrıştırma** | `xvlog design.v` | `axiom compile` içine gömülü |
| **Tasarımı Açımlama** | `xelab -top my_top work.my_top` | `axiom compile design.v -t my_top` |
| **Simülasyonu Çalıştır** | `xsim snapshot -tclbatch run.tcl` | `axiom run design.v -t my_top --ticks 100` |
| **VCD Dalga Biçimi Dökümü** | `open_vcd`, `log_vcd`, `close_vcd` | `axiom run design.v -t my_top --vcd out.vcd` |
| **SAIF Etkinliği Dışa Aktarımı** | `open_saif`, `log_saif`, `close_saif` | `axiom run design.v -t my_top --saif out.saif` |
| **Gecikme Kıyaslaması** | Manuel kronometre / profil günlükleri | `axiom benchmark design.v -t my_top --cycles 5000` |

---

## Sıfır Disk Anlık Görüntüsü Yükü

Vivado'da açımlama disk üzerinde bir anlık görüntü dizini üretir:
```bash
# Vivado: Multi-stage, multi-minute file writes
xvlog alu.v
xelab -top alu work.alu -s alu_snapshot
xsim alu_snapshot -R
```

Axiom'da derleme ve simülasyon %100 RAM içinde yürütülür:
```bash
# Axiom: In-RAM, sub-3 millisecond turnaround
axiom run alu.v -t alu --ticks 100
```
`xsim.dir` önbellek dizinleri yok, çok gigabaytlık anlık görüntü dosyaları yok ve bayat ikili yapıtlar yok.
