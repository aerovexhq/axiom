---
layout: home
hero:
  name: Axiom EDA
  text: Yüksek Başarımlı HDL Motoru ve Silikon Telemetrisi
  tagline: Ultra hızlı RAM içi Cranelift JIT derlemesi, manuel delta döngüsü adımlama
    ve fizik tabanlı silikon telemetrisi. Aerovex bünyesinde Rust ile geliştirildi.
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
  - theme: brand
    text: Web Stüdyosunu Başlat
    link: /studio/
    target: _blank
  - theme: alt
    text: Masaüstü Uygulamasını İndir
    link: '#download-desktop-studio-msi-deb-dmg'
  - theme: alt
    text: Hızlı Başlangıç & Kurulum
    link: /tr/guide/quickstart
  - theme: alt
    text: GitHub'da Görüntüle
    link: https://github.com/aerovexsim/axiom
features:
- title: RAM İçi Cranelift JIT
  details: Verilog ve SystemVerilog tasarımlarını çok dakikalık C++ ve disk anlık
    görüntü yüklerini atlayarak, milisaniyeler içinde doğrudan RAM'de yerel makine
    koduna (x86_64, AArch64) derler.
- title: Ayrıntılı Delta Döngüsü Adımlama
  details: Ayrık sıfır-zamanlı delta döngülerini (step_delta) açığa çıkaran, eski
    simülatörlerin gizlediği kombinasyonel yarış durumlarını ve aksaklıkları ortaya
    çıkaran çağrıcı denetimli manuel saat vuruşu API'si.
- title: Fiziksel Silikon Telemetrisi
  details: Dijital izlerin yanında canlı senkronize analog telemetri akışı sağlayan,
    endüktif PDN gerilim düşümü (IR + L di/dt) ile birleştirilmiş ilk ilkelerden dinamik
    güç modellemesi (0.5 * C * V^2 * f * α).
- title: Çapraz Platform Masaüstü ve Web
  details: Tauri v2, React 19 ve Vite ile geliştirilmiş, %100 tarayıcı içi istemci
    tarafı simülasyonu için yerel olarak WebAssembly'ye derlenen hafif (<50 MB) masaüstü
    uygulaması.
- title: Yüksek Yoğunluklu Tuval Dalga Biçimleri
  details: Çok bitli veri yolu geçiş zarflarını, zaman imleci incelemesini ve delta
    aksaklık büyüteçlerini destekleyen sanallaştırılmış 60+ FPS dijital dalga biçimi
    görüntüleyicisi.
- title: '%100 Vivado Birlikte Çalışabilirlik'
  details: Vivado read_saif tarafından doğrudan tüketilebilen IEEE 1364 Değer Değişim
    Dökümü (.vcd) dalga biçimlerini ve Synopsys SAIF 2.0 anahtarlama etkinliği dosyalarını
    dışa aktarır.
---


## Masaüstü Stüdyosunu İndirin (.msi, .deb, .dmg)

RAM'de doğrudan Cranelift JIT derlemesi ve sıfır tarayıcı kısıtlaması ile yerel, yüksek başarımlı masaüstü paketlerini indirin. Sürümler GitHub'dan otomatik olarak alınır:

<ReleaseDownloader />

::: tip GitHub Sürümleri & SHA256 Doğrulaması
Tüm sürüm varlıkları, SHA256 sağlama toplamları ve sürüm notları [Axiom GitHub Sürümleri Sayfasında](https://github.com/aerovexsim/axiom/releases) mevcuttur.
:::

## Tek Satırda Kurulum

100+ GB yükleyici şişkinliği olmadan bağımsız Axiom EDA ikilisini saniyeler içinde kurun:

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip Sürüm Seçimi & Kaynaktan Derleme
Belirli bir yayın sürümünü kurmak için:
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

Veya cargo kullanarak doğrudan kaynaktan derleyin:
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## Kıyaslama Özeti: Axiom ve AMD Vivado

| Metrik | Axiom EDA (Aerovex) | AMD Vivado Tasarım Paketi | Avantaj |
| :--- | :--- | :--- | :--- |
| **Uçtan Uca Derleme Süresi** | **2,81 ms** (RAM İçi JIT) | 30,0 – 60,0 sn (`xelab` anlık görüntüsü) | **>10.000× daha hızlı** |
| **Simülasyon Olay İşleme Hızı** | **780.840 olay/sn** | ~100.000 – 250.000 olay/sn | **3–7× daha hızlı** |
| **Sıfır-Zamanlı Delta İnceleme** | Açık $\delta$-adımlama & aksaklık bayrakları | Kara kutu sıfır-zaman çöküşü | **Tam yarış görünürlüğü** |
| **Dinamik Enerji Telemetrisi** | Gerçek zamanlı $P = \frac{1}{2} C V^2 f \alpha$ | Simülasyon sonrası statik rapor | **Canlı senkronize dalga biçimleri** |
| **Kurulum Boyutu** | **<50 MB** bağımsız ikili dosya | **100+ GB** monolitik kurulum | **>2.000× daha hafif** |
| **Platform Uyumluluğu** | Linux, macOS (Apple Silicon), Windows, Web | Yalnızca Linux ve Windows | **Evrensel taşınabilirlik** |
