# Simülasyon Komut Şeridi ve Birleşik Çekmece

Axiom simülasyon kontrol sistemi, yüksek hızlı bir yürütme motorunu sezgisel bir komut şeridi ve birleşik alt çekmeceyle (`BottomConsole.tsx`, `UnifiedBottomDock.tsx`) birleştirir. Fiziksel simülasyon zamanı ve ayrık delta döngüleri üzerinde anında denetim sağlar.

---

## Başlık Simülasyon Komut Şeridi

Üst başlık çubuğu simülasyon telemetrisini ve denetimlerini görüntüler:

```
+-------------------------------------------------------------------------------+
| [ Run ] [ Pause ] | [ +1 ns ] [ +100 ps ] [ Step Delta ] | [ Reset (t=0) ]    |
| Time: 125,400 ps (125.4 ns) | Delta: 0 | Core: 0.988 V | Power: 34.2 mW       |
+-------------------------------------------------------------------------------+
```

### Denetim Eylemleri
- **Çalıştır (`Space` / `Ctrl + Enter`)**: Arka plan Web Worker veya Cranelift JIT motorunda yüksek frekansta sürekli otonom saat vuruşunu başlatır.
- **Duraklat (`Space`)**: Simülasyon yürütmesini anında askıya alarak inceleme için tüm sinyal izlerini ve yazmaç durumlarını dondurur.
- **+1 ns (`F10`)**: Fiziksel simülasyon zamanını tam olarak 1.000 pikosaniye ilerletir.
- **+100 ps (`Shift + F10`)**: Hassas zamanlama analizi için fiziksel simülasyon zamanını tam olarak 100 pikosaniye ilerletir.
- **Delta Adımla (`F11`)**: Fiziksel simülasyon zamanını artırmadan tek bir ayrık sıfır-zamanlı değerlendirme döngüsü ($\delta \to \delta + 1$) ilerleterek kombinasyonel yarış durumlarını ve ara kapı geçişlerini açığa çıkarır.
- **Sıfırla (`Ctrl + R`)**: Simülasyon süresini $t=0$'a geri sarar, sinyal vektörlerini başlangıç durumlarına sıfırlar ve tasarımı derlenmiş halde tutarak yeniden açımlama yapmadan yürütmenin hemen devam etmesini sağlar.

---

## Birleşik Alt Çekmece Sekmeleri

Daraltılabilir alt panel, temel ikincil mühendislik araçlarını düzenler:

### 1. Konsol ve REPL
- Derleyici geçişlerini, AST açımlama metriklerini ve aktif modül örneklerini görüntüler.
- Verilog simülasyonundan gerçek zamanlı `$display`, `$write` ve `$monitor` çıktılarını aktarır.
- Sinyal ifadelerini değerlendirmek veya hat değerlerini sorgulamak için etkileşimli bir komut istemi sağlar.

### 2. Sorunlar ve Linter
- Etkin statik analiz uyarılarını ve sözdizimi hatalarını listeler.
- Kural kimliğini (`AXIOM_W001` vb.), önem derecesi rozetlerini ve kaynak dosya adlarını görüntüler.
- Herhangi bir sorun kartına tıklanması, Monaco düzenleyiciyi anında ilgili sorunlu satıra yönlendirir.

### 3. Telemetri Radarı
- Çekirdek gerilimi, endüktif PDN gerilim düşümü (IR + L di/dt), besleme akımı ve dinamik güç tüketimi için gerçek zamanlı analog göstergeler sunar.

### 4. Dalga Biçimleri Çekmecesi
- Birincil görselleştirici bölmesi Şematik, Sanal Lab veya Zamanlama Radarına odaklanmışken yardımcı bir dalga formu önizlemesi oluşturur.
