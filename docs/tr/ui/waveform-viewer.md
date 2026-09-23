# Yüksek Yoğunluklu Dalga Biçimleri ve Mantık Analizörü

Axiom EDA, hızlandırılmış HTML5 tuvali üzerinde oluşturulan yüksek yoğunluklu, 60+ FPS dijital dalga biçimi görüntüleyicisi ve mantık analizörü sunar. Mühendislerin çok sinyalli zamanlama ilişkilerini incelemesine, veri yolu tabanlarını genişletmesine, aralıkları ölçmesine ve sıfır-zamanlı delta döngüsü aksaklıklarını tespit etmesine olanak tanır.

---

## Katmanlı Dijital Zaman Çizelgesi

Dalga biçimi görüntüleyici, sıfır arayüz gecikmesiyle yüzlerce sinyali barındırarak sanallaştırılmış dikey kaydırma ile dijital izleri işler:

```
Signal Name   Radix   | 0 ns      5 ns      10 ns     15 ns     20 ns     25 ns
----------------------+--------------------------------------------------------
clk           1-bit   | _/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_
rst_n         1-bit   | _____/=================================================
data_in[7:0]  Hex     | = 00 =X= 41 =X= 42 =X= 43 =X= 44 =X= 45 =X= 46 ======
valid_in      1-bit   | ______/===========\___________/=======================
busy_out      1-bit   | ____________/===========\___________/=================
----------------------+--------------------------------------------------------
                      |       |<---- Delta-T: 10.0 ns (100.0 MHz) ---->|
```

### Sinyal Görüntüleme Yetenekleri
- **Taban Değiştirme**: **Onaltılık (Hex)**, **İkili (Binary)**, **İşaretsiz Ondalık**, **İşaretli Ondalık** ve **ASCII** arasında geçiş yapmak için herhangi bir sinyalin taban kutucuğuna sağ tıklayın veya tıklayın.
- **Veri Yolu Genişletme**: Tek tek bit hatlarını genişletmek için herhangi bir çok bitli vektörün (`data[7:0]`) yanındaki köşeli köşebent simgesine (`>`) tıklayın.
- **Renk Vurgulama**: İzler mantık seviyeleri için yüksek kontrastlı camgöbeği, veri yolları için kehribar ve bilinmeyen/çatışma durumları (`X`, `Z`) için kırmızı renkte işlenir.

---

## Modern Sürükle-Ölç Penceresi

Axiom, eski iki imleçli ölçüm iş akışlarını sezgisel bir sürükle-ölç penceresiyle değiştirir:

1. **Tıkla ve Sürükle**: Bir ölçüm penceresini vurgulamak için dalga biçimi zaman çizelgesinin herhangi bir bölgesi boyunca sürükleyin.
2. **Sınır Tutamaçları ($[A, B]$)**: Ölçüm uç noktalarını pikosaniye hassasiyetiyle ayarlamak için sol veya sağ sınır tutamaçlarını sürükleyin.
3. **Kayan Pencere**: Tüm zaman aralığını zaman çizelgesi boyunca kaydırmak için ölçüm penceresinin merkezini sürükleyin.
4. **Canlı Ölçüm HUD'ı**: HUD şunları görüntüler:
   - **Zaman A ($T_A$)**: Kompakt mühendislik birimleriyle başlangıç zaman damgası (ps, ns, us, ms).
   - **Zaman B ($T_B$)**: Bitiş zaman damgası.
   - **Delta Zamanı ($\Delta t$)**: Kesin süre ($\Delta t = |T_B - T_A|$).
   - **Frekans ($f$)**: Eşdeğer saat frekansı ($f = 1 / \Delta t$).
5. **Pencereye Yakınlaştır**: Seçilen aralığı tuval genişliğinin %100'üne genişletmek için **Pencereye Yakınlaştır**'a tıklayın.

---

## Delta Döngüsü (\(\delta\)) ve Aksaklık Algılama

Geleneksel simülatörler, sıfır-zamanlı olayları tek bir zaman damgasında toplayarak kombinasyonel yarış durumlarını gizler. Axiom açık delta incelemesi sağlar:
- **Delta Adımla (`F11`)**: Bir ayrık sıfır-zamanlı değerlendirme döngüsü adımlar ($\delta 	o \delta + 1$).
- **Aksaklık Tehlikesi İşaretçileri**: Bir sinyal aynı fiziksel zaman damgası ($t_0$) içinde birden çok kez geçiş yaptığında dalga biçimi tuvali hattı kehribar rengi bir uyarı bayrağıyla vurgular.
- **Delta Genişletme Görünümü**: Sıfır-zaman aralıklarını yatay olarak genişleterek devre kararlı duruma ulaşmadan önce ara kapı geçişlerinin dahili basamağını ortaya çıkarır.

---

## IEEE 1364 VCD Dışa Aktarımı ve İçe Aktarma Farkı

- **VCD Dışa Aktar**: Geçerli simülasyon geçmişini GTKWave, ModelSim veya Vivado ile doğrudan uyumlu bir IEEE 1364 Değer Değişim Dökümü (`.vcd`) olarak dışa aktarın.
- **VCD İçe Aktar (`ImportVcdModal`)**: Harici VCD dosyalarını Axiom'a yükleyin.
- **Dalga Biçimi Farkı**: Simülasyon izlerini referans altın VCD dosyalarıyla otomatik olarak karşılaştırarak döngü döngü hata bayraklarıyla sinyal uyuşmazlıklarını vurgular.
