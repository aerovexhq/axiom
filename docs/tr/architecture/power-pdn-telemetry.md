# Fiziksel Silikon Telemetrisi ve PDN Modellemesi

Yalnızca simülasyon sonrası statik elektronik tablo hesaplamalarına dayanan geleneksel simülatörlerin aksine Axiom, gerçek zamanlı fiziksel güç denklemlerini doğrudan simülasyon döngüsüne entegre eder.

---

## Dinamik Güç Tüketimi

Dinamik güç tüketimi, sinyal geçişleri sırasında fiziksel kapasitif yüklerin şarj edilmesi ve deşarj edilmesiyle yönetilir:

$$P_{\text{dynamic}} = \frac{1}{2} C_{\text{lumped}} V_{\text{rail}}^2 f \alpha$$

Burada:
- $C_{\text{lumped}}$: Hattın toplam fiziksel kapasitansı (sürücü pini + kablo yönlendirme + hedef fanout pinleri).
- $V_{\text{rail}}$: Sürücünün güç etki alanının besleme gerilimi hattı (ör. 1.20V Çekirdek).
- $f$: Saat frekansı.
- $\alpha$: Anahtarlama etkinlik faktörü (Hamming mesafesi geçiş oranı).

---

## Olay Başına Enerji Birikimi

$i$ hattının her durum geçişinde:
$$\Delta E_i = \frac{1}{2} C_i V_{\text{rail}}^2 \times \text{bit\_flips}$$

Axiom'un `TelemetryCollector` bileşeni, hiyerarşik modül örneği başına harcanan enerjiyi gerçek zamanlı olarak biriktirir; anlık güç tüketimini milivat ($mW$) ve kümülatif enerjiyi mikrojul ($\mu J$) cinsinden izler.

---

## Güç Dağıtım Ağı (PDN) Gerilim Düşümü

Eşzamanlı anahtarlama gürültüsü (SSN), birden çok yazmaç veya veri yolu hattı aynı saat kenarında tetiklendiğinde yonga üzerindeki güç hattından yüksek geçici akımlar çekildiğinde meydana gelir.

Axiom, Güç Dağıtım Ağı'nın empedansını ($R + L \frac{di}{dt}$) modeller:

$$V_{\text{sag}}(t) = I(t) \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$

$$V_{\text{effective}}(t) = V_{\text{nominal}} - V_{\text{sag}}(t)$$

Veri yolu sinyalleri eşzamanlı olarak tetiklendiğinde Axiom şunları yakalar:
- Anlık geçici akım sıçramaları ($mA$).
- Nominal seviyelerin altına inen besleme hattı gerilim düşümü ($mV$).
- Saat kenarları ile güç kaynağı sıçraması arasındaki doğrudan korelasyon.
