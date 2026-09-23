# Sanal Laboratuvar Rafı ve Kart Emülasyonu

Axiom'un Sanal Laboratuvar Rafı, HDL simülasyonu ile fiziksel donanım testi arasında köprü kurar. Öğrencilerin ve FPGA mühendislerinin dokunsal anahtarlar, butonlar, LED'ler ve 7 parçalı göstergeler kullanarak tasarımlarıyla gerçek zamanlı olarak etkileşime girmelerini sağlayan özgün bir dijital devre tahtası emülasyonu sunar.

---

## Digilent Basys 3 FPGA Kart Bölmesi

Basys 3 FPGA bölmesi, Digilent'in popüler Artix-7 geliştirme kartının doğru bir dijital ikizini sağlar:

```
+-------------------------------------------------------------------------------+
| Axiom Basys 3 Artix-7 Hardware Emulation Bay                                  |
+-------------------------------------------------------------------------------+
| [SSEG Display:  1 0 4 2 ]       [BTNU]                 [LD15 .. LD0]          |
| Anode: AN3..AN0 Active        [BTNL] [BTNC] [BTNR]     * * * * * * * *        |
| Segments: CA..CG, DP            [BTND]                 O O O O O O O O        |
|                                                                               |
| Tactile Slide Switches:                                                       |
| [SW15] [SW14] [SW13] [SW12] [SW11] [SW10] [SW9] [SW8] ... [SW1] [SW0]         |
|  [ON]   [OFF]  [OFF]  [ON]   [ON]   [OFF]  [OFF] [ON]       [OFF] [ON]        |
+-------------------------------------------------------------------------------+
```

### 1. 16 Dokunsal Sürgülü Anahtar (`SW0`..`SW15`)
- XDC fiziksel kısıtlamaları (`PACKAGE_PIN V17` vb.) aracılığıyla doğrudan giriş portlarına eşlenir.
- Etkileşimli tıklama, özgün ses efektleri ve durum kalıcılığı ile anahtar konumunu değiştirir.
- Yeşil gösterge noktalarına sahip yüksek kontrastlı görsel geçiş kolları.

### 2. 16 Yüzey Montajlı LED (`LD0`..`LD15`)
- XDC kısıtlamaları (`PACKAGE_PIN U16` vb.) aracılığıyla çıkış portlarına eşlenir.
- Aktif lojik-yüksek durumları (`1`) gösteren gerçekçi zümrüt ışıltısı çizimi.

### 3. 5 Geçici Buton (`BTNC`, `BTNU`, `BTNL`, `BTNR`, `BTND`)
- Orta, Yukarı, Sol, Sağ ve Aşağı butonları için yönlü haç yapılandırması.
- Basmak lojik-yüksekte (`1`) tutar; bırakmak lojik-düşüğe (`0`) döndürür. Manuel sıfırlama darbeleri veya saati tek adımlama için mükemmeldir.

### 4. 4 Basamaklı Çoğullanmış 7 Parçalı Gösterge (`SSEG`)
- Özgün katot-anot dinamik taramasını uygular.
- Aktif-düşük anot seçim hatları (`AN0` ila `AN3`) tarafından kontrol edilen parçaları (`CA` ila `CG`) ve ondalık noktayı (`DP`) doğru bir şekilde çizer.

---

## Kombinasyonel Mantık Bölmesi

Giriş düzeyinde dijital mantık ve doğruluk tablosu doğrulaması için tasarlanan Kombinasyonel Mantık Bölmesi özel bir dokunsal arayüz sunar:
- **Etkileşimli Girişler**: Üç belirgin geçiş anahtarı (`A`, `B`, `C`).
- **Geçit Yoklamaları**: Ara hatlar (`w1`, `w2`, `w3`, `w4`) için gerçek zamanlı sinyal değerleme pinleri.
- **Çıkış LED'i**: Devre çıkışını `F` görüntüleyen belirgin gösterge diyodu.
- **Senkronize Edilmiş 8 Satırlı Doğruluk Tablosu HUD'ı**: Tüm $2^3 = 8$ giriş kombinasyonunu ($000$ ila $111$) görüntüler. Aktif satır geçerli anahtar durumlarına göre dinamik olarak aydınlanarak Boole doğruluğunun anında görsel onayını sağlar.

---

## Otomatik Laboratuvar Değerlendiricisi (`LabGraderModal`)

Üniversite dijital tasarım dersleriyle (İstanbul Üniversitesi - Cerrahpaşa dahil) ortaklaşa geliştirilmiştir:
- **Otomatik Doğrulama**: Öğrenci RTL uygulamalarına (`uygulama_0.v`) karşı test ortamı matrisini otomatik olarak yürütür.
- **Yönetici Not Kartları**: Yüzde puanlarını, zamanlama doğruluğunu ve işlevsel kapsamı hesaplar.
- **Test Vektör Matrisi**: Her simülasyon adımı boyunca beklenen ve gerçek sinyal çıkışlarını ayrıntılandırır.
- **Markdown Not Kartı Dışa Aktarımı**: Eğitmenler için biçimlendirilmiş laboratuvar teslim raporlarının tek tıkla üretimi.
