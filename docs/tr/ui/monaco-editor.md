# Monaco HDL Kod Editörü ve Dil Sunucusu

Axiom HDL Kod Düzenleyicisi, Microsoft Monaco Editor'ü bellek içi (in-RAM) Verilog, SystemVerilog ve VHDL Dil Sunucusu Protokolü (LSP) arka plan programı (`crates/lsp`) ile entegre eder. Sözdizimi vurgulama, gerçek zamanlı statik tasarım kuralı denetimi, AST vurgu ipuçları ve otomatik tamamlama parçacıklarını havacılık ve uzay sınıfı bir IDE'de birleştirir.

---

## Monarch HDL Belirteç Oluşturucusu

Axiom, IEEE 1364 Verilog, IEEE 1800 SystemVerilog ve IEEE 1076 VHDL için özel olarak tasarlanmış özel bir Monarch belirteçleştiricisine sahiptir.

### Görsel Stil (`axiom-dark`)
Düzenleyici Axiom'un koyu paleti ile stillendirilmiştir:
- **Anahtar Kelimeler** (`module`, `always_ff`, `assign`, `wire`, `reg`): Yüksek kontrastlı camgöbeği (`#00f0ff`)
- **Sistem Görevleri ve Fonksiyonları** (`$display`, `$finish`, `$time`, `$clog2`): Menekşe (`#a855f7`)
- **Dizgeler**: Kehribar (`#fbbf24`)
- **Sayılar ve Boyutlandırılmış Değişmezler** (`8'hFF`, `1'b0`, `32'd100`): Zümrüt yeşili (`#34d399`)
- **Yorumlar** (`//`, `/* ... */`): Yumuşak arduvaz (`#64748b`)
- **Tanımlayıcılar ve Sinyal Adları**: Yumuşak beyaz (`#f1f5f9`)

---

## Gerçek Zamanlı RAM İçi Statik Linter

Sözdizimi hatalarını veya tasarım tehlikelerini işaretlemek için çok dakikalık derleme hatları gerektiren eski araçların aksine, Axiom'un linteri 250 ms'lik bir bekleme penceresiyle bellekte sürekli çalışır.

### Dahili Statik Tasarım Kuralları

| Kural Kimliği | Önem Derecesi | Ad | Açıklama & Önlenen Tehlike |
| :--- | :--- | :--- | :--- |
| `AXIOM_W001` | Uyarı | **Ardışıl Süreçte Engelleyici Atama** | Saatli bloklarda (`always @(posedge clk)`) engelleyici atamalar (`=`) kullanmak benzetim ve sentez yarış koşullarına (race condition) yol açar. |
| `AXIOM_W002` | Uyarı | **Kombinasyonel Blokta Engelleyici Olmayan Atama** | Kombinasyonel bloklarda (`always @*`) engelleyici olmayan atamalar (`<=`) kullanmak çoklu-delta yarış tehlikeleri ve sentez uyumsuzlukları yaratır. |
| `AXIOM_W003` | Uyarı | **Sürücüsü Olmayan Hat (Undriven Net)** | Bildirilen bir kablo veya hat bağlı sürekli sürücüye (`assign`), ilkel çıkışa veya alt modül sürücüsüne sahip değildir. |
| `AXIOM_W004` | Uyarı | **Kullanılmayan Sinyal** | Bildirilen bir yazmaç veya hat yazılır veya tanımlanır ancak hiçbir ardıl mantık konisinde okunmaz. |
| `AXIOM_E002` | Hata | **Çok Sürücülü Çatışma** | Birden fazla sürekli atama veya eşzamanlı sürücü aynı hattı sürerek elektriksel kısa devrelere ve `X` çekişmesine yol açar. |
| `AXIOM_W006` | Uyarı | **Şeffaf Mandal (Latch) Çıkarıldı** | Eksik koşullu dallar (`else` içermeyen `if` veya tüm kolları içermeyen `case`) istenmeyen şeffaf mandalların çıkarılmasına neden olur. |
| `AXIOM_W007` | Uyarı | **Eksik Case Default Dalı** | Bir `case` ifadesi `default:` kolu içermemektedir; bu da kapsanmayan vektörlerde durumun kilitlenmesi riskini doğurur. |
| `AXIOM_W008` | Uyarı | **Bit Genişliği Uyuşmazlığı** | Hat veya port atama genişliği sol ve sağ taraf ifadeleri arasında farklılık göstermekte olup sessiz bit kesilmesine yol açar. |

Düzenleyicide ihlal eden belirteçlerin doğrudan altında dalgalı alt çizgiler görünür. **Sorunlar ve Linter** panelindeki herhangi bir hata kartına tıklanması, düzenleyici imlecini hemen tam satır ve sütuna taşır.

---

## AST Üzerine Gelme Kartları

Fare imlecini düzenleyicideki herhangi bir tanımlayıcının üzerine getirmek etkileşimli bir AST meta veri araç ipucu açar:
- **Sinyal Bildirimi**: Hat türünü (`wire`, `reg`, `logic`), bit aralığını (`[31:0]`) ve işaretlilik durumunu görüntüler.
- **Sürücü Konumu**: Sinyalin atandığı veya sürüldüğü tam satır numarasını gösterir.
- **Xilinx İlkel Belgelendirmesi**: Donanım ilkellerinin (`LUT6_2`, `DSP48E2`, `RAMB36E2`, `BUFG`, `CARRY8`) üzerine gelindiğinde tam bacak (pinout) belgelendirmesi, doğruluk tablosu parametreleri ve davranışsal açıklamalar sunulur.

---

## Akıllı Otomatik Tamamlama

Axiom Dil Sunucusu anında otomatik tamamlamalar sunar:
- **IEEE 1364/1800 Anahtar Kelimeleri**: `module`, `always_ff`, `always_comb`, `case` ve `generate` için otomatik iskelet oluşturma.
- **Sistem Görevleri**: `$display`, `$monitor`, `$finish` ve `$dumpvars` için biçimlendirilmiş argüman şablonları.
- **Kapsam İçi Sinyaller**: Etkin modül hiyerarşisinde bildirilen hatları, yazmaçları ve parametreleri önerir.
- **Xilinx 7-Series / UltraScale+ İlkelleri**: Donanım hücreleri için eksiksiz port eşleme örnekleme şablonları.

---

## Editör Ergonomisi ve Kalıcılık

- **Çoklu Sekmeli Dosya Yönetimi**: Birden fazla tasarım kaynağını eşzamanlı olarak açın. Etkin dosya sekmeleri tarayıcı yenilemelerinde korunur.
- **İçerik Haritası (Breadcrumb) Gezinimi**: Düzenleyicinin üzerindeki yol çubuğu geçerli projeyi, dosya kümesini, etkin dosyayı ve üst modülü görüntüler.
- **Görünüm Konumu Kalıcılığı**: Monaco düzenleyici kaydırma konumu (dikey satır ve yatay kaydırma) her dosya için `localStorage` içinde önbelleğe alınır, böylece bir dosyaya geri dönüldüğünde tam görünüm noktası geri yüklenir.
