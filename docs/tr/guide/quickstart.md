# Hızlı Başlangıç & Kurulum

**Axiom EDA** ile 60 saniyeden kısa sürede çalışmaya başlayın.

---

## 1. Tek Satırda Kurulum

Axiom, sıfır harici araç zinciri gereksinimiyle hafif, bağımsız tekil ikili dosyalar (<50 MB) sunar.

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

Yükleyici, işletim sisteminizi ve mimarinizi (`x86_64` veya `aarch64` / Apple Silicon) otomatik olarak algılar, `axiom` ikilisini `~/.axiom/bin` (veya `%USERPROFILE%\.axiom\bin`) dizinine kurar ve `$PATH` ortam değişkeninizi yapılandırır.

---

## 2. Sürüm Yönetimi ve Özel Seçenekler

Özel bir sürüm belirtebilir veya hedef dizini geçersiz kılabilirsiniz.

### Belirli Bir Sürümü Hedefleme

::: code-group

```bash [Linux & macOS (Env Var)]
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```bash [Linux & macOS (Flag)]
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --version v1.0.0
```

```powershell [Windows (Env Var)]
$env:AXIOM_VERSION="v1.0.0"; irm https://axiom.aerovex.net/install.ps1 | iex
```

```powershell [Windows (Parameter)]
& ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v1.0.0
```

:::

### Özel Kurulum Dizini

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. Özel Kaynaktan Derleme Betiği

Kaynaktan derlemeyi veya motoru değiştirmeyi tercih ederseniz Axiom, `scripts/` dizininde otomatik bir derleme sürücüsü içerir:

### Linux & macOS (`scripts/build_from_source.sh`)

Depoyu klonlayın ve otomatik sürücüyü çalıştırın:

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**Derleme Betiği Seçenekleri:**

- `--cli-only`: Node/Arayüz adımlarını atlayın ve yalnızca arayüzsüz Rust CLI'yı derleyin:
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>`: Özel bir sisteme veya kullanıcı dizinine kurun:
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug`: Hızlı, optimize edilmemiş hata ayıklama derlemesi:
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

PowerShell'de:
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. Manuel Cargo Derlemesi

Cargo'yu doğrudan da çağırabilirsiniz:

```bash
cargo build --release --bin axiom
```

Çıktı ikili dosyası `target/release/axiom` konumunda yer alacaktır.

Kurulumunuzu doğrulayın:
```bash
axiom --version
```

Çıktı:
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. İlk HDL Tasarımınızı Derleyin

Axiom, `tests/fixtures/` dizininde standart doğrulanmış donanım düzenekleri içerir. 32-bit ALU'yu doğrudan RAM'de yerel makine koduna derleyin:

```bash
axiom compile tests/fixtures/alu.v -t alu
```

Çıktı:
```text
============================================================
 Axiom HDL In-RAM Compiler: tests/fixtures/alu.v
 Top-Level Target: alu
============================================================
  [1/3] Lexing & Parsing in 172.70µs
  [2/3] Elaboration: 6 nets, 1 processes, 1 continuous assigns in 218.86µs
  [3/3] In-RAM Cranelift JIT Compilation in 2.41ms
------------------------------------------------------------
 Compilation successful! Total latency: 2.81ms
 In-RAM Arena Footprint: 6 64-bit words (48 bytes)
============================================================
```

---

## 6. Dalga Biçimi ve SAIF Dışa Aktarımı ile Toplu Simülasyon Çalıştırın

Standart IEEE 1364 VCD dalga biçimlerini ve Synopsys SAIF 2.0 anahtarlama etkinliği dosyalarını dışa aktararak 100 saat vuruşu yürütün:

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

Çıktı:
```text
============================================================
 Axiom In-RAM Batch Simulator: tests/fixtures/counter.v
 Target: counter | Steps: 100 ticks
============================================================
 Simulation completed in 410.15µs
 Final SimTime: 50000 ps (50.000 ns) | Total Deltas: 0
 Glitches Detected: 0
 Exported IEEE 1364 VCD to: waveforms.vcd
 Exported SAIF 2.0 to: power.saif
============================================================
```

---

## 7. Yüksek Çözünürlüklü Kıyaslama Testlerini Çalıştırın

Simülasyon çekirdeğine stres testi uygulayın ve olay işleme hızını ölçün:

```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 8. Modern Masaüstü Stüdyosu ve Web Arayüzünü Başlatın

### Bağımsız Yerel Masaüstü Uygulaması
Yerel masaüstü penceresini doğrudan başlatın (sıfır bağlantı noktası barındırma ve RAM'de doğrudan Cranelift JIT ile Tauri v2 tarafından desteklenir):
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### Tarayıcı İçi WebAssembly Stüdyosu
**[https://axiom.aerovex.net/studio/](https://axiom.aerovex.net/studio/)** adresinde yayında olan sıfır kurulumlu canlı stüdyoyu açın.

### Yerel Arayüz Geliştirme Sunucusu
```bash
cd ui
npm install
npm run dev
```

Temel yetenekler:
- **Birleşik Arama Çubuğu (`Ctrl+K`)**: Sinyaller, netlist hiyerarşisi, eylemler ve belgeler arasında anında bulanık arama.
- **Yüksek Yoğunluklu Dalga Biçimi Görüntüleyici**: Çok tabanlı veri yolu açıcı, çift imleç ($\Delta t$) ve sıfır-zamanlı $\delta$-döngüsü tehlike çekmecesi.
- **GPU Hızlandırmalı Şematik DAG**: 1 tıkla kritik mantık konisi dilimleyicileri (`F` / `O`) içeren 60+ FPS Canvas 2D motoru.
- **Sanal Enstrüman Rafı**: 8-bit DIP anahtar grubu, dokunsal butonlar, döner onaltılık kadran, 7 parçalı göstergeler ve test deseni üreteci.
- **Zamanlama Radarı & Silikon Enerji Ağaç Haritası**: Statik Zamanlama Analizi (STA) kritik yol şelalesi ve dinamik güç ayrışımı ($P = \frac{1}{2} C V^2 f \alpha$).
- **Gömülü Betik Kabuğu**: Doğrudan bellek içi simülasyon REPL'i (`run`, `step delta`, `force`, `get`).
