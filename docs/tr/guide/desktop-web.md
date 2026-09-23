# Masaüstü & Web Mimarisi

Axiom birleşik bir çift hedefli mimariye sahiptir: hafif bir yerel masaüstü uygulaması ve sıfır kurulumlu, %100 tarayıcı içi WebAssembly mühendislik paneli.

---

## Çift Hedef Mimarisine Genel Bakış

```
                        Axiom Core Architecture
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        Native Desktop Target                WebAssembly Target
        - Tauri v2 (Rust IPC)               - wasm32-unknown-unknown
        - Linux, macOS, Windows             - 100% Client-Side In-Browser
        - Direct Cranelift JIT in RAM       - Portable Evaluator in WebWorker
        - Sub-50 MB Binary                  - Zero Backend Server Dependencies
```

---

## Modern Obsidian Koyu Tema Arayüzü

Mühendislik ön ucu **React 19**, **TypeScript 5.7**, **PostCSS** ve **Vite 6** kullanılarak geliştirilmiştir ve Obsidian/Linear esintili karanlık bir çalışma alanı sunar:

1. **Simülasyon Denetim Başlığı**:
   - Ayrık adımlama kontrolleri: `Serbest Çalıştır`, `Duraklat`, `+1 ns`, `+100 ps` ve `Delta Adımla (δ)` (Sıfır-Zamanlı Delta Döngüsü).
   - Canlı telemetri göstergeleri: Simülasyon Zaman Damgası ($ps / ns$), Aktif Delta Döngüsü ($\delta$), Tepe Geçici Akım ($mA$) ve Maksimum Gerilim Düşümü ($mV$).
2. **Açımlanmış Netlist Hiyerarşi Gezgini**:
   - Açımlanmış kapsamların, modül örneklerinin, yazmaçların, bağlantı hatlarının ve yordamsal süreçlerin özyinelemeli ağaç görünümü.
   - Dahili test düzeneği değiştirici (ALU, Aksaklıklı Sayaç, Hiyerarşik Çekirdek).
3. **Yüksek Başarımlı Canvas 2D Dalga Biçimi Görüntüleyici**:
   - Sanallaştırılmış 60+ FPS dijital mantık çizimi.
   - Belirgin 4 durumlu mantık renkleri: 0 (arduvaz), 1 (zümrüt), X (gül), Z (kehribar).
   - Ortalanmış onaltılık değerlerle çok bitli veri yolu elmas geçiş zarfları.
   - **Delta Aksaklık Büyüteci**: Pembe hata bayraklarıyla geçici sıfır-zamanlı tehlikeleri vurgular.
4. **Fiziksel Silikon Telemetri Grafikleri**:
   - Camgöbeği degrade dolgulu analog geçici akım eğrisi ($I(t)$).
   - Endüktif besleme hattı gerilim düşümü ($V_{sag} = IR + L \frac{di}{dt}$).
   - Dinamik özet kartları: Ortalama Güç ($mW$), Tepe Akımı ($mA$), Maksimum Düşüm ($mV$) ve Toplam Tüketilen Enerji ($nJ$).
5. **Simülasyon Çekirdeği Konsolu ve Dışa Aktarıcılar**:
   - Gerçek zamanlı olay günlüğü akışı.
   - IEEE 1364 `.vcd` ve Synopsys `.saif` dosyaları için tek tıkla indirme.
