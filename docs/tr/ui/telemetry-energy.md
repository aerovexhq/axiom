# Silikon Telemetrisi ve Enerji Radarı

Axiom EDA, fizik tabanlı silikon telemetrisine öncülük eder (`crates/telemetry`). Axiom, dijital kapıları matematiksel soyutlamalar olarak ele almak yerine CMOS anahtarlamasının fiziksel yarı iletken parametrelerini modeller: dinamik enerji tüketimi, kapasitif yük şarjı, sızıntı akımları ve Güç Dağıtım Ağı (PDN) endüktif gerilim düşümü.

---

## Fizik Tabanlı Güç Formülasyonu

Axiom, ilk ilkelerden fiziği kullanarak geçiş düzeyinde enerji harcamasını hesaplar:

### 1. Dinamik Anahtarlama Gücü
$$P_{\text{dynamic}} = \frac{1}{2} \cdot C_{\text{load}} \cdot V_{\text{dd}}^2 \cdot f \cdot \alpha$$
Burada:
- $C_{\text{load}}$: Çıkış yükü (fan-out) ve kablo uzunluğundan hesaplanan toplam hat kapasitansı.
- $V_{\text{dd}}$: Nominal besleme voltajı (Artix-7/Kintex UltraScale+ çekirdeği için varsayılan 1.0V).
- $f$: Saat frekansı.
- $\alpha$: Anahtarlama etkinlik faktörü (saat döngüsü başına geçiş olasılığı).

### 2. PDN Endüktif Gerilim Düşümü ve Çökmesi
Birden çok yazmacın aynı anda değiştiği yüksek etkinlikli saat kenarlarında, tepe akım çekimi ($di/dt$) kılıf endüktansı üzerinde gerilim düşümüne neden olur:
$$V_{\text{sag}} = I \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$
Burada:
- $R_{\text{pdn}}$: Güç hattının etkin seri direnci.
- $L_{\text{pdn}}$: Bağlantı kablolarının ve kılıf lehim toplarının parazitik endüktansı.
- $\frac{di}{dt}$: Anlık akım artış hızı.

$V_{\text{sag}}$ transistör eşik voltajının altına düşerse kurma süresi katlanarak artar ve geçici zamanlama aksaklıklarına neden olur.

---

## Silikon Telemetri HUD'ı ve Analog Göstergeler

Üst gezinme başlığı ve özel Telemetri çekmecesi senkronize edilmiş analog göstergeleri görüntüler:

```
+-------------------------------------------------------------------------------+
| Silicon Telemetry Radar:                                                      |
| [ Power: 42.8 mW ]    [ Current: 42.8 mA ]   [ Voltage: 0.982 V (-18 mV Sag) ]|
+-------------------------------------------------------------------------------+
| Real-Time Power Strip-Chart (mW vs. Physical Time):                           |
| mW ^                                                                          |
| 60 |         /\                                                               |
| 40 |      /\/  \  /\                                                          |
| 20 |_____/      \/  \________________________________________________________ |
|  0 +-----+-----+-----+-----+-----+-----+-----+-----+-----+------------------> |
|    0 ns  10 ns 20 ns 30 ns 40 ns 50 ns 60 ns 70 ns 80 ns                     |
+-------------------------------------------------------------------------------+
```

### İzlenen Telemetri Parametreleri
- **Dinamik Güç (mW)**: Mantık hücreleri ve saat ağaçları tarafından tüketilen gerçek zamanlı dinamik anahtarlama gücü.
- **Besleme Akımı (mA)**: $V_{\text{dd}}$ hattı üzerinden çekilen toplam çekirdek akımı.
- **Çekirdek Hat Voltajı (V)**: Nominal hat voltajı (1.000V) eksi anlık endüktif düşüm ($V_{\text{sag}}$).
- **Kümülatif Enerji (pJ / nJ)**: Simülasyon başlangıcından bu yana harcanan toplam elektriksel enerji.

---

## Synopsys SAIF 2.0 Dışa Aktarımı

Axiom yerel olarak **Anahtarlama Etkinliği Değişim Formatı (SAIF 2.0)** dosyalarını dışa aktarır:
- Her hat için geçiş sayılarını (`TC`), lojik yüksekte (`T1`), lojik düşükte (`T0`) ve bilinmeyende (`TX`) geçirilen süreyi yakalar.
- Dışa aktarılan `.saif` dosyaları, resmi FPGA termal yayılım raporları için doğrudan AMD Vivado Güç Analizörüne (`read_saif`) aktarılabilir.
