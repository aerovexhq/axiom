# CLI Referans Kılavuzu

Axiom; CI/CD boru hatları, başsız (headless) testler ve kıyaslama regresyon çalıştırmaları için hızlı, bağımsız bir komut satırı sürücüsü içerir.

---

## Genel Kullanım

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### Genel Bayraklar
- `-h, --help`: Yardım ve kullanım bilgilerini görüntüler.
- `-v, --version`: Axiom EDA'nın geçerli sürümünü görüntüler.

---

## Alt Komutlar

### 1. `compile`
Disk serileştirmesi olmadan bellek içi sözcüksel analiz, Pratt ayrıştırması, hiyerarşik netlist açımlaması ve Cranelift JIT derlemesi gerçekleştirir.

```bash
axiom compile <FILE> -t <TOP>
```

#### Bağımsız Değişkenler
- `<FILE>`: Verilog veya SystemVerilog HDL dosyasının yolu (`.v` veya `.sv`).
- `-t, --top <TOP>`: Açımlanacak üst düzey modülün tanımlayıcısı.

#### Örnek
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run`
Belirtilen HDL tasarımını derler ve isteğe bağlı gerçek zamanlı VCD ve SAIF çıktı üretimi ile belirlenen sayıda saat vuruşu boyunca simüle eder.

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### Seçenekler
- `-t, --top <TOP>`: Üst düzey modülün adı (gerekli).
- `--ticks <N>`: Simüle edilecek saat vuruşu sayısı (varsayılan: 100).
- `--vcd <FILE>`: IEEE 1364 Değer Değişim Dökümü (VCD) dalga biçimlerinin aktarılacağı dosya yolu.
- `--saif <FILE>`: SAIF 2.0 anahtarlama etkinliği verilerinin aktarılacağı dosya yolu.

#### Örnek
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark`
Uçtan uca JIT derleme süresini ve ham simülasyon olay işleme hızını ölçen istatistiksel mikro kıyaslamaları yürütür.

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### Seçenekler
- `-t, --top <TOP>`: Üst düzey modülün adı (gerekli).
- `--cycles <N>`: Simüle edilen saat döngüsü sayısı (varsayılan: 5000).

#### Örnek
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
