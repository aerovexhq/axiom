# SAIF & VCD Birlikte Çalışabilirlik

Mevcut endüstriyel doğrulama ortamlarıyla sorunsuz entegrasyon sağlamak için Axiom, standart **IEEE 1364 Değer Değişim Dökümü (.vcd)** ve **Synopsys SAIF 2.0 (.saif)** dosyaları üretir.

---

## 1. IEEE 1364 Değer Değişim Dökümü (VCD)

Axiom'un `VcdWriter` bileşeni, tüm netlist durum geçişlerini standart VCD tanımlarıyla biçimlendirir:
- Başlık: `$date`, `$version`, `$timescale 1 ps`.
- Hiyerarşi: Hiyerarşik `$scope module` ve `$upscope` blokları.
- Değişkenler: Çok bitli `$var wire [genişlik] [sembol] [ad]` bildirimleri.
- Başlangıç Değerleri: $t = 0$ anında `$dumpvars` durum dökümü.
- Geçişler: İkili ve onaltılık veri yolu geçişleriyle serpiştirilmiş zaman damgası işaretçileri (`#1000`).

Axiom tarafından üretilen VCD dosyaları doğrudan şuralarda açılabilir:
- **GTKWave**
- **Surfer**
- **AMD Vivado Dalga Biçimi Görüntüleyici**
- **Sigrok / PulseView**

---

## 2. Anahtarlama Etkinliği Değişim Formatı (SAIF 2.0)

Vivado'nun `report_power` komutunda doğru güç tahmini, statik vektörsüz tahminler yerine yüksek güvenilirlikli simülasyon vektörleri gerektirir.

Axiom, anahtarlama olasılıklarını içeren geçerli SAIF 2.0 dosyaları üretir:
```text
(SAIFILE
  (SAIFVERSION "2.0")
  (DIRECTION "backward")
  (DESIGN "counter")
  (DATE "Axiom HDL Engine")
  (VENDOR "Axiom")
  (PROGRAM_NAME "Axiom Simulator")
  (PROGRAM_VERSION "1.0.0")
  (DIVIDER /)
  (TIMESCALE 1 ps)
  (DURATION 50000)
  (INSTANCE counter
    (NET
      (clk (T0 25000) (T1 25000) (TX 0) (TZ 0) (TC 99))
      (rst_n (T0 1000) (T1 49000) (TX 0) (TZ 0) (TC 1))
      (count (T0 12000) (T1 38000) (TX 0) (TZ 0) (TC 48))
    )
  )
)
```

### AMD Vivado İçine Yükleme
Vivado Tcl içinde:
```tcl
open_run impl_1
read_saif -strip_path /tb_top/u_dut -file power.saif
report_power -file post_sim_power.rpt
```
Vivado, dinamik anahtarlama etkinliği matrislerini Axiom'un ölçülen SAIF geçiş sayımlarından otomatik olarak günceller.
