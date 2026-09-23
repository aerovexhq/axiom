# Axiom Stüdyo Çalışma Alanına Genel Bakış

Axiom Studio; Rust ve React 19 ile yerel olarak tasarlanmış havacılık ve uzay sınıfı, platformlar arası bir Elektronik Tasarım Otomasyonu (EDA) arayüzüdür. Duyarlı bir Monaco HDL kod düzenleyicisini senkronize kapı seviyesi şematikler, dijital dalga formları, dokunsal donanım devre tahtaları, statik zamanlama analizörleri (STA) ve fiziksel silikon yerleşim planlamasıyla eşleştiren birleşik, yüksek performanslı bir çalışma alanı sunar.

---

## Çalışma Alanı Mimarisi

Axiom Studio, eski EDA araçlarının hantal, parçalanmış çoklu pencere arayüzlerini terk ederek uyumlu bir çift bölmeli çalışma alanını benimser:

```
+-------------------------------------------------------------------------------+
| Header: Brand | File Sets | Simulation Ribbon (Run, Step, Reset) | PDN Gauges |
+---------------------------------------+---------------------------------------+
| Left Pane (Monaco HDL Editor)         | Right Pane (Dynamic Visualizers)      |
|                                       | - Schematic DAG Visualizer            |
| - Verilog / SystemVerilog / VHDL      | - Virtual Lab & Basys 3 FPGA Bay      |
| - In-RAM LSP Real-Time Linter         | - Waveforms & Logic Analyzer          |
| - Monarch Tokenizer & Autocomplete    | - Timing Radar & Static Timing        |
| - AST Hover Cards & Breadcrumbs       | - Technology Mapping Studio           |
|                                       | - Floorplanning & Silicon Die         |
|                                       | - Formal Verification (BMC)           |
|                                       | - Protocol Analyzer & Dissector       |
|                                       | - Microarchitecture & Multi-Die       |
+---------------------------------------+---------------------------------------+
| Unified Bottom Dock: Console & REPL | Problems & Linter | Telemetry Radar     |
+-------------------------------------------------------------------------------+
```

### 1. Başlık ve Simülasyon Komut Şeridi
Üst gezinti başlığı proje kimlik etiketlerine, Vivado dosya kümesi seçicisine ve benzetim yürütme şeridine ev sahipliği yapar. Anında derleme, çalıştırma, duraklatma, ayrık sıfır-zamanlı delta döngüsü (δ-cycle) adımlama ve benzetim süresini geri sarma olanağı tanır. Gerçek zamanlı Güç Dağıtım Ağı (PDN) telemetri göstergeleri milivat cinsinden dinamik gücü ($P$), endüktif PDN gerilim düşümünü ($V_{\text{sag}}$, IR + L di/dt) ve toplam besleme akımını ($I$) raporlar.

### 2. Sol Bölme: Monaco HDL Kod Editörü
Axiom'un Monarch Verilog/SystemVerilog belirteçleştiricisi, koyu akrilik teması (`axiom-dark`), gerçek zamanlı AST vurgu ipuçları ve bellek içi (in-RAM) Dil Sunucusu Protokolü (LSP) tanılamaları ile yapılandırılmış özelleştirilmiş bir Microsoft Monaco Editor örneği.

### 3. Sağ Bölme: Görselleştirici Bölmesi
Axiom'un görsel analiz araçlarını barındıran tam yükseklikte, tam genişlikte bir tuval:
- **Şematik DAG**: Çakışmasız dikey kanal yönlendirmeli gerçek zamanlı IEEE kapı seviyesi netlist görselleştiricisi.
- **Sanal Laboratuvar**: Digilent Basys 3 Artix-7 kart anahtarları, LED’leri ve 7 bölütlü göstergeleriyle dokunsal donanım devre tahtası.
- **Dalga Formları**: Sürükleyerek ölçme pencereleri ve sıfır-zamanlı delta döngüsü (δ-cycle) denetimi içeren 60+ FPS dijital mantık analizörü.
- **Zamanlama Radarı**: Kritik yol şelalelerini ve kurma/tutma payı (slack) histogramlarını görüntüleyen topolojik statik zamanlama analizi (STA).
- **Teknoloji Eşleme**: RTL tasarımını hedef FPGA ilkellerine (LUT’lar, DSP48E2, RAMB36E2) indirgeyen kapı seviyesi teknoloji eşleme.
- **Yerleşim Planlama (Floorplanning)**: CLB yerleşimini, termal ısı haritalarını ve yönlendirme uçuş hatlarını gösteren 2B silikon yonga yerleşim stüdyosu.
- **Biçimsel Doğrulama**: SystemVerilog Savları (SVA) için Sınırlı Model Denetimi (BMC) ve $k$-tümevarım doğrulaması.
- **Protokol Analizörü**: UART, SPI, I2C, CAN Bus, USB ve Ethernet için donanımsal seri ayrıştırıcılar.
- **Mikromimari**: Otomatik veri yolu tespiti, ALU denetçileri, RegFile bellek görünümleri ve FSM durum balon grafikleri.

### 4. Orta Boyutlandırılabilir Ayırıcı
Mühendislerin düzenleyici ve görselleştirici dengesini ayarlamasına olanak tanıyan duyarlı bir ayırıcı. Axiom dinamik kamera orta nokta sabitleme özelliğine sahiptir: ayırıcının sürüklenmesi tuval dünya uzayı kamera orta noktasını sürekli olarak yeniden hesaplayarak şematik sıkışmasını veya yakınlaştırma kaybını önler.

### 5. Birleşik Alt Çekmece
İkincil analiz araçlarını temiz sekmeler halinde düzenleyen daraltılabilir bir alt panel:
- **Konsol ve REPL**: Etkileşimli Verilog derleyici çıktıları, `$display` ifadesi günlükleme ve benzetim durumu.
- **Sorunlar ve Linter**: Sözdizimi ve tasarım kuralı uyarılarına tek tıkla satır gezintisi sağlayan etkin tanı kartları.
- **Telemetri**: Çekirdek besleme gerilimi, endüktif PDN gerilim düşümü (IR + L di/dt) ve anahtarlama akımı için analog silikon telemetri göstergeleri.
- **Dalga Formu Önizlemesi**: Bölünmüş şematik modlarında çalışırken kompakt dalga formu görünümü.

---

## Genel Klavye Kısayolları

| Kısayol | Eylem | Açıklama |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | **Projeyi Kaydet** | Tüm tasarım dosyalarını ve meta verileri diske veya IndexedDB'ye kaydeder |
| `Ctrl + Enter` / `Cmd + Enter` | **Derle & Çalıştır** | Aktif tasarımı Cranelift JIT aracılığıyla RAM'e derler ve saati başlatır |
| `Space` | **Çalıştır / Duraklat** | Benzetim motorunun yürütülmesini açar/kapatır |
| `F10` | **Adım +1 ns** | Fiziksel benzetim süresini tam olarak 1.000 pikosaniye ilerletir |
| `Shift + F10` | **Adım +100 ps** | Fiziksel benzetim süresini tam olarak 100 pikosaniye ilerletir |
| `F11` | **Delta (\(\delta\)) Adımı** | Fiziksel zamanı ilerletmeden tek bir ayrık sıfır-zamanlı delta döngüsü (δ-cycle) adımlar |
| `Ctrl + R` / `Cmd + R` | **Benzetimi Sıfırla** | Benzetim saatini \(t=0\) anına geri sarar ve başlangıç sinyal vektörlerini geri yükler |
| `Ctrl + Alt + F` | **Floorplan Studio** | Fiziksel FPGA silikon yerleşim görselleştiricisini açar |
| `Ctrl + P` / `Cmd + P` | **Hızlı Dosya Aç** | Proje kaynakları arasında geçiş yapmak için Omnibar arama paletini açar |
| `Ctrl + \`` | **Alt Paneli Aç/Kapat** | Birleşik alt paneli genişletir veya daraltır |
| `Ctrl + B` / `Cmd + B` | **Kenar Çubuğunu Aç/Kapat** | Vivado proje dosya kümesi kenar çubuğunu gösterir veya gizler |
| `Escape` | **Modali Kapat / Seçimi Kaldır** | Etkin iletişim kutularını, denetçileri kapatır veya hat seçimini temizler |

---

## Mobil Stüdyo ve Duyarlı Çekmece

Mobil cihazlarda veya dar tarayıcı pencerelerinde (genişlik \(\le 768\text{px}\)) çalışırken Axiom Studio otomatik olarak uyum sağlar:
- Dar görüş alanlarını ortadan kaldırmak için çok bölmeli yeniden boyutlandırılabilir ayırıcılar devre dışı bırakılmıştır.
- Tuval dışı açılır çekmece (`MobileDrawer.tsx`), proje dosya kümelerine, benzetim kontrollerine ve görünüm seçimine erişim sağlar.
- Arayüz, ekran genişliğinin ve yüksekliğinin %100’ünü etkin görünüme ayırarak **Her Seferinde 1 Panel** modunda işlenir.
- Başparmak dostu mobil alt çubuk (`MobileBottomBar.tsx`), canlı sorun rozetleriyle birlikte 5 temel gezinti sekmesi sunar: **Kod**, **Şematik**, **Lab**, **Dalgalar** ve **Konsol**.
