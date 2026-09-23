# Axiom Statik Linter ve Tanılama Kuralları

Axiom EDA, gerçek zamanlı bellek içi (in-RAM) statik analiz linteri (`crates/lsp/src/linter.rs`) içerir. Linter, kod yazılırken sentez tehlikelerini, benzetim yarış koşullarını ve elektriksel hataları tespit etmek için soyut sözdizimi ağaçlarını ve netlist bağlantılarını analiz eder.

---

## Tanılama Kuralları Kataloğu

```
+-------------------------------------------------------------------------------+
| Axiom Static Linter Dashboard (Problems Dock)                                 |
| 0 Errors | 2 Warnings | 1 Informational | Real-Time Latency: 1.8 ms           |
+-------------------------------------------------------------------------------+
| [AXIOM_W001] Line 42: Blocking assignment (=) inside clocked sequential block |
| [AXIOM_W007] Line 88: Case statement missing default branch                   |
+-------------------------------------------------------------------------------+
```

### 1. `AXIOM_W001`: Ardışıl Süreçte Engelleyici Atama
- **Önem Derecesi**: Uyarı
- **Kural İhlali**: Kenar tetiklemeli bir süreç (`always @(posedge clk)`) içinde `<=` yerine `=` kullanılması.
- **Tehlike**: İş parçacığı yürütme sırasına bağlı olarak yazmaç değerlerinin güncellemeden önce veya sonra okunabildiği simülatöre bağımlı yarış durumları yaratır.
- **Çözüm**: `=` işlemini `<=` ile değiştirin.

### 2. `AXIOM_W002`: Kombinasyonel Süreçte Engelleyici Olmayan Atama
- **Önem Derecesi**: Uyarı
- **Kural İhlali**: Seviyeye duyarlı bir süreç (`always @*` veya `always @(a or b)`) içinde `<=` kullanılması.
- **Tehlike**: Gereksiz simülasyon delta döngüsü ek yüküne ve potansiyel sentez uyuşmazlıklarına neden olur.
- **Düzeltme**: `<=` yerine `=` kullanın.

### 3. `AXIOM_W003`: Sürülmeyen Hat
- **Önem Derecesi**: Uyarı
- **İhlal**: Bildirilen bir `wire` veya hat sürekli sürücüye (`assign`), kapı çıkışına veya alt modül port bağlantısına sahip değildir.
- **Tehlike**: Hat kalıcı olarak yüksek empedansta (`Z`) veya bilinmeyende (`X`) yüzer durumda kalır.
- **Düzeltme**: Bir sürücü ekleyin veya kullanılmayan hat bildirimini kaldırın.

### 4. `AXIOM_W004`: Kullanılmayan Sinyal
- **Önem Derecesi**: Uyarı
- **İhlal**: Bildirilen bir yazmaç veya hat yazılır ya da tanımlanır ancak hiçbir ardıl mantık konisinde okunmaz.
- **Tehlike**: Ölü silikon alanı ve gereksiz kapı çıkarımı.
- **Düzeltme**: Kullanılmayan sinyali kaldırın veya hedef tüketiciye bağlayın.

### 5. `AXIOM_E002`: Çok Sürücülü Hat Çatışması
- **Önem Derecesi**: Hata
- **İhlal**: Birden fazla sürekli atama veya eşzamanlı sürücü aynı `wire` hattını sürüyor.
- **Tehlike**: Fiziksel silikonda elektriksel kısa devre; benzetimde çekişme bilinmeyeni (`X`) olarak değerlendirilir.
- **Düzeltme**: Bir çoklayıcı ekleyin veya hattı yalnızca tek bir sürücünün denetlediğinden emin olun.

### 6. `AXIOM_W006`: Şeffaf Mandal Çıkarımı Yapıldı
- **Önem Derecesi**: Uyarı
- **İhlal**: Kombinasyonel bir süreç hedef değişkeni bir veya daha fazla koşullu yürütme yolu boyunca atamasız bırakır.
- **Tehlike**: Sentez araçları asenkron seviye duyarlı mandal (latch) çıkarır; bu da ciddi zamanlama kapanış sorunlarına ve saat paraziti duyarlılığına yol açar.
- **Düzeltme**: Tüm değişkenlerin her `if-else` dalında atandığından emin olun veya `always @*` bloğunun başında varsayılan bir değer atayın.

### 7. `AXIOM_W007`: Eksik Case Default Dalı
- **Önem Derecesi**: Uyarı
- **İhlal**: Bir `case` ifadesi `default:` dalını atlar.
- **Tehlike**: Kapsanmayan giriş kombinasyonları mandal çıkarımına neden olur veya durum makinelerini kilitler.
- **Düzeltme**: `default: <guvenli_durum>;` ekleyin.

### 8. `AXIOM_W008`: Bit Genişliği Uyuşmazlığı
- **Önem Derecesi**: Uyarı
- **İhlal**: Sol taraftaki hattın bit genişliği sağ taraftaki ifadenin bit genişliğine eşit değildir.
- **Tehlike**: Sessiz MSB kesilmesi veya istenmeyen sıfır/işaret uzatması.
- **Düzeltme**: Bit genişliklerini açıkça hizalayın veya parça seçme dilimlemesi kullanın.
