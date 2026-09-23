# Sentez Yerleşimi & Yonga Düzeni Stüdyosu

Axiom EDA, etkileşimli bir 2B Silikon Yonga Yerleşim Stüdyosu (`crates/ir/src/floorplan/`, `FloorplanStudioViewer.tsx`) sunar. Gerçek FPGA yonga yerleşimlerinde fiziksel hücre yerleşimini, silikon konum ızgaralarını, ara bağlantı uçuş hatlarını ve termal/yoğunluk ısı haritalarını görselleştirir.

---

## FPGA Silikon Yonga Mimarisi Izgarası

Yerleşim planlayıcı hedef FPGA mimarisinin tam konum yerleşimini işler:

```
+-------------------------------------------------------------------------------+
| Top I/O Bank (IOB)                                                            |
+---+-----------------------------------------------------------------------+---+
| L | CLB Slice Grid (SliceL / SliceM)   | DSP Column | BRAM Column         | R |
| e | [x][x][x][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | i |
| f | [x][x][ ][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | g |
| t |------------------------------------+------------+---------------------| h |
|   | Global Clock Center Spine (BUFG / Clock Center)                       | t |
| I |------------------------------------+------------+---------------------|   |
| O | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | I |
| B | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | O |
+---+-----------------------------------------------------------------------+---+
| Bottom I/O Bank (IOB)                                                         |
+-------------------------------------------------------------------------------+
```

### Yonga Konum Tipleri
- **CLB Dilimleri (SliceL & SliceM)**: LUT'lar ve flip-floplar içeren mantık dilimleri. SliceM konumları ayrıca dağıtılmış RAM ve kaydırma yazmaçlarını (SRL) destekler.
- **DSP Sütunları**: Yüksek hızlı `DSP48E2` aritmetik bloklarını barındıran özel çoklu döşeme sütunları.
- **Blok RAM Sütunları**: `RAMB36E2` ve `RAMB18E2` gömülü bellekleri için ayrılmış dikey sütunlar.
- **Çevre G/Ç Bankaları**: Kılıf pinlerini dahili mantığa bağlayan Sol, Sağ, Üst ve Alt G/Ç tamponları (`IOB`).
- **Saat Omurgası**: `BUFG` ve saat yönlendirme ağlarına ev sahipliği yapan merkezi yatay dağıtım yolu.

---

## Analitik Yerleştirici (HPWL) ve Elde Kümeleme

Sentez yerleştiricisi analitik kuadratik yerleşim ve Yarı Çevre Tel Uzunluğu (HPWL) minimizasyonu kullanarak her hücre için en uygun $(x, y)$ koordinatlarını hesaplar:
$$\text{HPWL}(e) = \max_{v \in e}(x_v) - \min_{v \in e}(x_v) + \max_{v \in e}(y_v) - \min_{v \in e}(y_v)$$

### Dikey Elde Zinciri Sütun Kümelemesi
Hızlı elde zincirleri gerektiren aritmetik makrolar (`CARRY4` / `CARRY8`) yonga geneline rastgele dağıtılamaz. Yerleştirici, bağımlı elde elemanlarını özel yüksek hızlı silikon elde yolları boyunca bitişik dikey sütunlar halinde otomatik olarak kümeler.

---

## Silikon Yoğunluğu ve Termal Isı Haritaları

Yonga alanı normalize edilmiş $32 \times 32$ uzamsal döşeme matrisine bölünür:
- **Kullanım Isı Haritası**: Hücreler koyu lacivertten (boş / düşük kullanım) canlı kehribar ve kırmızıya (yüksek sıkışıklık $>%85$) kadar gölgelendirilir.
- **Termal Isı Haritası**: Silikon yonga üzerindeki termal sıcak noktaları görüntülemek için mantık anahtarlama frekansını ($\alpha$) yerel yoğunlukla birleştirir.

---

## Manhattan Uçuş Hatları ve Kritik Yol Katmanı

- **Noktadan Noktaya Uçuş Hatları**: Herhangi bir hücreye tıklanması, sürülen tüm çıkış yükü (fan-out) hedeflerini bağlayan Manhattan dikey yönlendirme kanallarını aydınlatır.
- **Kritik Yol Neon Katmanı**: Statik Zamanlama Analizi (STA) motoru tarafından tanımlanan en kötü durum zamanlama yolu, kaynak flip-flop’tan hedef uç noktaya kadar uzanan belirgin bir neon turuncu iz olarak oluşturulur.
