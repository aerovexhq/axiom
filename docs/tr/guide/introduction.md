# Giriş & Proje Manifestosu

## Axiom EDA'nın Misyonu

**Axiom**, AMD Vivado'nun Donanım Tanımlama Dili (HDL) işleme, simülasyon ve analiz motorunun, **Aerovex** tarafından **Rust** ile sıfırdan geliştirilmiş, yüksek başarımlı ve çapraz platformlu modern bir yeniden yapımıdır.

Vivado, FPGA geliştirme için tartışmasız endüstri standardıdır ancak onlarca yıllık teknik şişkinlikten muzdariptir:
- Karmaşık lisanslama arka plan programları ve uzun kurulum gerektiren **100+ GB kurulumlar**.
- Gigabaytlarca bellek tüketen ve dalga biçimi oluşturma sırasında donan **hantal Java Swing arayüzleri**.
- Küçük HDL değişiklikleri için bile dakikalar süren **çok aşamalı dosya tabanlı derleme boru hatları** (`xvlog` $\to$ kütüphane veritabanı $\to$ `xelab` $\to$ anlık görüntü ikilisi $\to$ `xsim`).
- macOS (Apple Silicon M1/M2/M3/M4) veya standart web tarayıcıları gibi **modern platformlar için tam destek eksikliği**.
- Dijital tasarımcılardan geçici kombinasyonel yarış durumlarını ve aksaklıkları gizleyen **opak sıfır-zamanlı delta döngüleri**.

**Axiom bu sınırlamaları ortadan kaldırır.** Obsidian esintili bir masaüstü ve web uygulamasıyla eşleştirilmiş 50 MB'tan küçük, anlık ve derinlemesine incelenebilir bir donanım simülasyon motoru sunar.

---

## Temel Mimari İlkeler

### 1. In-RAM Cranelift JIT Derlemesi
Axiom ara C++ dosya dökümlerini, harici GCC/Clang çağrılarını ve anlık görüntü serileştirmesini ortadan kaldırır. Ayrıntılı donanım netlistleri ve yordamsal süreçler, **Cranelift** (x86_64, AArch64) kullanılarak 3 milisaniyenin altında doğrudan RAM'de yerel makine koduna derlenir.

### 2. Manuel Delta-Zaman Saat Vuruşu & Olay Kuyruğu API'si
Simülasyon süresini körü körüne ilerlemeye zorlayan veya delta döngülerini tek bir zaman damgasında daraltan geleneksel simülatörlerin aksine Axiom, gömülebilir bir çağrıcı denetimli adımlama API'si sunar:
- `engine.tick(delta_time)`: Fiziksel zamanı pikosaniye veya nanosaniye cinsinden ilerletir.
- `engine.step_delta()`: Sinyaller oturmadan önce geçici tehlikeleri ortaya çıkararak, sıfır simülasyon süresi içinde tek bir ayrık delta döngüsünü ($\delta \to \delta + 1$) adımlar.

### 3. Fizik Tabanlı Gerilim, Enerji ve Güç Telemetrisi
Axiom, ilk ilkelerden fizik denklemlerini her sinyal geçişine gömer:
- **Dinamik Güç**: $P_{\text{dynamic}} = \frac{1}{2} C_{\text{net}} V_{\text{dd}}^2 f \alpha$
- **PDN Endüktif Gerilim Düşümü**: $V_{\text{sag}} = IR + L \frac{di}{dt}$
- Vivado'nun statik tahmin raporlarının kaçırdığı saat kenarları sırasındaki mikro akım sıçramalarını yakalar.

### 4. Çapraz Platform Masaüstü ve Web Mimarisi
**Tauri v2**, **React 19**, **TypeScript** ve **Vite** ile geliştirilen Axiom; Linux, macOS ve Windows'ta yerel bir masaüstü uygulaması olarak çalışırken, %100 tarayıcı içi simülasyon için sorunsuz bir şekilde **WebAssembly**'ye (`wasm32-unknown-unknown`) derlenir.
