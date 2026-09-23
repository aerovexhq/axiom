# Etkileşimli IEEE Geçit DAG Şematik Görselleştiricisi

Axiom EDA'nın Şematik Görselleştiricisi, ayrıştırılmış Verilog netlistlerini hızlandırılmış bir HTML5 Tuvalinde işlenen etkileşimli, yüksek performanslı bir Yönlendirilmiş Döngüsüz Grafa (DAG) dönüştürür. Kombinasyonel mantık konilerine, flip-flop'lara, aritmetik makrolara ve veriyolu yollarına döngü duyarlı, kapı seviyesinde görünürlük sağlar.

---

## Vivado Düzeyinde Çarpışmasız Hat Yönlendirme

Eski EDA görselleştiricileri genellikle izlenmesi zor olan çapraz, karmaşık spagetti kablolaması üretir. Axiom gelişmiş bir dikey kanal yönlendirme algoritmasına sahiptir:

```
+-------+                                     +-------+
| In A  |--------[ Straight Track ]---------> | In 0  |
+-------+                                     | AND1  |
                                       +----> | In 1  |
+-------+       +--------+             |      +---+---+
| In B  |------>|  INV1  |-------------+          |
+-------+       +--------+                        V
                                              [ Out F ]
```

### 1. Izgara Veri Yolu Satır Hizalaması
Giriş portları, mantık kapıları ve çıkış pinleri mantıksal veri yolu katmanlarına ($L_0, L_1, \dots, L_n$) ayrılır. Bağlı pinler aynı dikey satırlar boyunca matematiksel olarak hizalanır ($Y_{\text{out}} = Y_{\text{in}}$), bu da ana bağlantıların **sıfır dönüş hareketiyle** düz yatay çizgiler olarak işlenmesini sağlar.

### 2. Çok Katmanlı Hedef Adımlama
Bir kablo birden fazla katmanı aştığında ($dx \ge 150\text{px}$), bağlantı kaynak yatay yolunu korur ve dikey kaymasını hedef pinden hemen önceki özel açık kanalda ($dstX - 28$) gerçekleştirir.

### 3. Metin Koruyucu Kesme Plakaları
Her kapı örneği etiketi (`inv1`, `and1`, `or1`) ve pin tanımlayıcısı, düz koruyucu bir arka plan plakası (`#0c1017`) üzerinde işlenir. Bu, kabloların metin açıklamalarıyla çakışmasını veya bunları kesmesini tamamen önler.

### 4. Engele Duyarlı Kanal Sapmaları
Yönlendirme motoru (`routeOrthogonalEdge`), ara kapıların etrafındaki boşluk sınırlayıcı kutularını (`KeepOutBox`) dinamik olarak koruyarak kabloları açık dikey kanallardan temiz bir şekilde yönlendirir.

---

## Tuvalde Gezinme ve Dinamik Ortalamama

- **Sonsuz Kaydırma**: Büyük netlistlerde gezinmek için tuval üzerindeki herhangi bir boş alana tıklayıp sürükleyin.
- **Yumuşak Tekerlek Yakınlaştırma**: %10 ile %500 arasında sürekli yakınlaştırma yapmak için dokunmatik yüzeyi veya fare tekerleğini kaydırın.
- **Dinamik Orta Nokta Kamera Sabitleme**: Merkezdeki yeniden boyutlandırılabilir ayırıcıyı sürüklerken Axiom'un `ResizeObserver` bileşeni dünya uzayı kamera orta noktasını görselleştirici bölme merkezine matematiksel olarak kilitler:
  $$\Delta \text{offsetX} = \frac{\Delta W}{2}, \quad \Delta \text{offsetY} = \frac{\Delta H}{2}$$
  Bu, şematiğin herhangi bir yatay sıkışma veya yakınlaştırma sıçraması olmaksızın mükemmel şekilde ortalanmış ve kararlı kalmasını sağlar.

---

## Canlı Sinyal Yoklama ve HUD

Herhangi bir kablo veya kapının üzerine gelmek veya tıklamak anında donanım iç gözlemi sağlar:
- **Hat Yoklama**: Hat adını, bit genişliğini ve gerçek zamanlı mantık değerini (`0`, `1`, `X`, `Z`) görüntüler.
- **İmleç Takip Eden Vurgu Kartı**: Ayrıntıları görüş alanı içinde tutmak için sınır sınırlaması ile işaretçiyi takip eder.
- **Kapı Doğruluk Tablosu HUD**: Herhangi bir kombinasyonel kapıya (AND, OR, XOR, INV, MUX) tıklanması, etkin giriş vektörünü ve ortaya çıkan çıkış durumunu vurgulayan kayan bir doğruluk tablosu görüntüler.
- **Mantık Konisi Vurgulama**: Herhangi bir hattın seçilmesi, tüm yukarı akış fan-in konisini ve aşağı akış fan-out hedeflerini neon camgöbeği renginde aydınlatır.
