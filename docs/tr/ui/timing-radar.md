# Statik Zamanlama Analizi & Zamanlama Radarı

Axiom EDA, tam özellikli bir Statik Zamanlama Analizi (STA) motoru ve etkileşimli Zamanlama Radarı görselleştiricisi (`crates/sta`) içerir. Sentezlenebilir netlistler üzerinde topolojik yol yayılımı gerçekleştirir, hedef saat kısıtlamalarına göre kurma ve tutma payını hesaplar ve fiziksel uygulamadan önce kritik yol darboğazlarını tanımlar.

---

## Statik Zamanlama Motoru Mimarisi

STA motoru, netlisti zamanlama düğümleri ve kenarlarından oluşan bir Yönlü Döngüsüz Grafiğe (DAG) ayrıştırır:
- **Zamanlama Düğümleri**: Kapı pinleri, flip-flop girişleri (`D`, `CE`, `R`), flip-flop çıkışları (`Q`) ve birincil G/Ç portları.
- **Zamanlama Kenarları**: Hücre yayılma gecikmeleri ($t_{\text{logic}}$) ve hat yönlendirme gecikmeleri ($t_{\text{route}}$).

### Zamanlama Payı (Slack) Formülasyonu
Bir kaynak flip-floptan ($FF_1$) başlayan ve bir hedef flip-flopta ($FF_2$) sonlanan her yol için:
$$\text{Veri Varış Zamanı} = T_{\text{clk1}} + t_{\text{cq}} + t_{\text{logic}} + t_{\text{route}}$$
$$\text{Veri Gerekli Zamanı} = T_{\text{period}} + T_{\text{clk2}} - t_{\text{setup}} - t_{\text{skew}} - t_{\text{jitter}}$$
$$\text{Kurma Payı (Setup Slack)} = \text{Veri Gerekli Zamanı} - \text{Veri Varış Zamanı}$$

Bir yol $\text{Slack} \ge 0$ olduğunda zamanlamayı karşılar. Negatif bir pay ($\text{Slack} < 0$), mantık indirgemesi veya boru hattı eklenmesini gerektiren bir zamanlama ihlalini gösterir.

---

## Zamanlama Radarı Gösterge Paneli

Zamanlama Radarı görünümü, tasarım başarımının yönetici özetini sunar:

```
+-------------------------------------------------------------------------------+
| Timing Radar: Target Clock = 100.0 MHz (Period: 10.0 ns)                      |
| Worst Negative Slack (WNS): +1.42 ns (MET) | Total Negative Slack (TNS): 0.00 |
+-------------------------------------------------------------------------------+
| Critical Path Timing Waterfall:                                               |
| Hop | Element                 | Delay (ps) | Incr (ps) | Total Arrival (ns)   |
|-----+-------------------------+------------+-----------+----------------------|
| 1   | reg_a_reg[3]/C -> Q     | 240 ps     | +240 ps   | 0.240 ns             |
| 2   | net_wire_1 (route)      | 350 ps     | +350 ps   | 0.590 ns             |
| 3   | alu_inst/lut_add_3/I0->O| 480 ps     | +480 ps   | 1.070 ns             |
| 4   | net_sum_3 (route)       | 520 ps     | +520 ps   | 1.590 ns             |
| 5   | reg_result_reg[3]/D     | setup check|           | Required: 8.580 ns   |
+-------------------------------------------------------------------------------+
| Slack Distribution Histogram: [ -2ns | -1ns | 0ns | +1ns | +2ns | +3ns ]      |
+-------------------------------------------------------------------------------+
```

### 1. Zamanlama Temel Göstergeleri (KPI)
- **En Kötü Negatif Pay (WNS)**: Tüm zamanlama uç noktaları arasındaki en kötü durum payı. WNS negatifse tasarım hedef saat frekansında çalışamaz.
- **Toplam Negatif Pay (TNS)**: Tasarım genelindeki zamanlama baskısının ciddiyetini gösteren, tüm ihlal eden uç noktalardaki negatif payların toplamı.
- **Başarısız Uç Noktalar**: Kurma veya tutma gereksinimlerini karşılayamayan yazmaçların veya birincil çıkışların sayısı.

### 2. Kritik Yol Şelale Tablosu
En uzun yayılma gecikmesine katkıda bulunan hücre mantık geçişlerinin ve arabağlantı yönlendirme atlamalarının tam fiziksel sırasını görüntüler. Her satır eleman adını, artımlı gecikmeyi, kümülatif varış zamanını ve kalan pay bütçesini listeler.

### 3. Pay Dağılım Histogramı
Tasarım genelinde uç nokta paylarının istatistiksel yayılımını görselleştirir. 0 ns çizgisinin solundaki aralıklar optimizasyon gerektiren ihlal yollarını vurgular.

---

## Saat Etki Alanı Geçişi (CDC) Senkronizörleri

STA motoru, birden çok asenkron saat etki alanına sahip tasarımları otomatik olarak analiz eder:
- İlişkisiz saatler arasındaki yazmaçsız sinyal geçişlerini algılar.
- 2 aşamalı ve 3 aşamalı flip-flop senkronizörlerini (`cdc_sync`) tanımlar ve doğrular.
- Kısıtlanmamış CDC yollarını yüksek riskli yarı kararlılık (metastability) tehlikeleri olarak işaretler.
