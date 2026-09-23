# Mikromimari ve Çoklu Yonga Görüntüleyicileri

Axiom EDA, özel mikromimari inceleme araçları (`crates/ir/src/microarch/`, `MicroarchViewer.tsx`, `MultiDieViewer.tsx`, `PpaParetoViewer.tsx`) sunar. Bu araçlar işlemci veri yollarını, aritmetik mantık birimlerini, yazmaç dosyalarını ve durum makinelerini, ayrıca modern 2.5D/3D çok yongalı çiplet paketlerini otomatik olarak tespit eder.

---

## Otomatik Veri Yolu Algılama

RTL ayrıntılandırıcısı (elaborator), modül yapısını inceler ve standart mikromimari blokları çıkarır:

```
+-------------------------------------------------------------------------------+
| Microarchitecture Datapath Detector:                                          |
| Detected: 1 ALU (32-Bit) | 1 RegFile (32x32) | 1 FSM Controller (5 States)     |
+-------------------------------------------------------------------------------+
| ALU Inspector Modal:                                                          |
| - Opcode: 4'b0010 (ADD) | Operand A: 0x0000_0020 | Operand B: 0x0000_0014     |
| - Result: 0x0000_0034   | Zero Flag: 0           | Overflow: 0                |
+-------------------------------------------------------------------------------+
| FSM Bubble Diagram: [IDLE] --start--> [READ] --ready--> [EXEC] --done--> [IDLE]
+-------------------------------------------------------------------------------+
```

### 1. ALU İşlem Denetleyicisi
Çoklayıcı güdümlü aritmetik blokları otomatik olarak algılar. Etkin işlem kodu seçimlerini (ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT) ve canlı yazmaç işlenen değerlerini görüntüler.

### 2. Yazmaç Dosyası (RegFile) Denetleyicisi
Çok portlu bellek dizilerini (`reg [31:0] registers [0:31]`) algılar. Gerçek zamanlı yazma darbeleri vurgularıyla tüm mimari yazmaçların canlı onaltılık içeriklerini görüntüleyen etkileşimli 32 satırlı bir ızgara sağlar.

### 3. FSM Durum Baloncuğu Görselleştiricisi (`FsmViewer.tsx`)
Sonlu Durum Makinesi durum vektörlerini ve geçiş matrislerini otomatik olarak çıkarır:
- Durum baloncukları ve geçiş oklarıyla etkileşimli bir yönlü grafik çizer.
- Canlı simülasyon sırasında o anda aktif olan durum baloncuğunu aydınlatır.
- FSM yapısını denetler: erişilemeyen durumları, terminal tuzak durumlarını ve eksik varsayılan kurtarma dallarını algılar.

---

## 2.5D ve 3D Çoklu Yonga Silikon Paketleme

Modern çiplet ve çok yongalı mimariler için (örneğin AMD UltraScale+ Stacked Silicon Interconnect):
- **Ara Katman (Interposer) Yonga Düzeni**: Birden çok aktif mantık yongasını (SLR) birbirine bağlayan silikon ara katmanları görselleştirir.
- **Yongalar Arası Bağlantı (Super Long Lines - SLL)**: Fiziksel yongaları köprüleyen mikro tümsekler üzerindeki bant genişliğini, yayılma gecikmesini ve eğrilmeyi (skew) analiz eder.

---

## PPA Pareto Ödünleşim Gezgini

PPA Görüntüleyicisi, tasarımın üç temel mühendislik metriğindeki ödünleşimlerini analiz eder:
- **Güç (mW)**: Toplam dinamik ve sızıntı enerji tüketimi.
- **Performans (MHz)**: Statik Zamanlama Analizinden (STA) türetilen elde edilebilir maksimum saat frekansı.
- **Alan (LUT / FF)**: Toplam silikon kaynak ayak izi.

Görselleştirici Pareto-optimal yapılandırma sınırlarını çizerek tasarımcıların yüksek verimli veya düşük güçlü çalışma profilleri için en uygun boru hattı dengesini seçmelerine olanak tanır.
