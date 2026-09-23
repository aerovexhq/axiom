# IEEE 1364 Sistem Görevleri ve Fonksiyonları

Verilog, dolar işareti (`$`) ile başlayan standart yerleşik sistem görevleri ve fonksiyonları sağlar. Axiom EDA, harici C/C++ PLI veya VPI kütüphanelerine ihtiyaç duymadan bu rutinleri doğrudan bellekte (in-RAM) yakalar ve yürütür.

---

## Görüntüleme ve Dize Biçimlendirme Görevleri

### 1. `$display` ve `$write`
Biçimlendirilmiş metni doğrudan Axiom'un etkileşimli **Konsol ve REPL** paneline yazdırır. `$display` otomatik bir yeni satır karakteri eklerken, `$write` eklemez.

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### Desteklenen Biçim Belirteçleri
- `%d` / `%0d`: Ondalık tamsayı (dolgusuz)
- `%h` / `%0h`: Onaltılık değer
- `%b`: İkili vektör
- `%o`: Sekizlik değer
- `%c`: ASCII karakteri
- `%s`: Dize (String)
- `%t`: Biçimlendirilmiş benzetim zamanı

### 2. `$monitor` ve `$strobe`
- `$monitor`: Sinyal argümanlarını izler ve izlenen herhangi bir sinyal değer değiştirdiğinde otomatik olarak bir mesaj yazdırır.
- `$strobe`: Mesaj çıktısını mevcut zaman adımının en sonundaki Monitor bölgesine erteleyerek tüm engelleyici olmayan atamaların (NBA) oturmasını garanti eder.

---

## Simülasyon Denetim Görevleri

### 1. `$finish`
Benzetim çalıştırmasını sonlandırır, otonom saat vuruşunu askıya alır ve Konsolda nihai yürütme metriklerini görüntüler.
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop`
Benzetimi duraklatır, benzetim şeridini **Duraklatıldı** durumuna geçirir ve inceleme için tüm sinyal izlerini ve yazmaç durumlarını korur.

### 3. `$time` ve `$realtime`
- `$time`: Etkin `` `timescale `` yönergesine göre geçerli benzetim süresini 64-bit tamsayı olarak döndürür.
- `$realtime`: Geçerli benzetim süresini reel kayan noktalı sayı olarak döndürür.

---

## Matematiksel ve Yardımcı Fonksiyonlar

### 1. `$clog2` (Tavan Taban-2 Logaritması)
$\lceil \log_2(N) \rceil$ değerini hesaplar. Bellek derinliklerinden adres yolu genişliklerini hesaplamak için vazgeçilmezdir:
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random`
İşaretli 32-bit sözde rastgele bir tamsayı üretir. Rastgele test vektörleri oluşturmak için sıklıkla maskelenir:
```verilog
test_byte = $random % 256;
```

---

## Dalga Biçimi Döküm Görevleri

Axiom, VCD sistem çağrılarını yerel olarak yakalar:
- `$dumpfile("waveform.vcd");`: Çıkış dalga formu dosya adını belirtir.
- `$dumpvars(0, top_tb);`: Tasarım hiyerarşisi boyunca tüm 4 Durumlu Mantık / Değer Değişim Dökümü (VCD) sinyal değeri değişikliklerini Axiom'un bellek içi iz belleğine aktarır ve IEEE 1364 VCD dosyası olarak indirir.

---

## Bellek Dosyası Başlatma (`$readmemb`, `$readmemh`)

Bellek dizisi içeriklerini doğrudan metin dosyalarından yükler:
- `$readmemb("rom.bin", memory_array);`: İkili (binary) verileri yükler (`10101100`).
- `$readmemh("rom.hex", memory_array);`: Onaltılık (hexadecimal) verileri yükler (`AF 04 C2`).

Axiom Studio'da bellek başlatma dosyaları, ana bilgisayar dosya sistemi yalıtım alanı sınırlarını ihlal etmeden proje dosya kümeleri içinde güvenli bir şekilde okunur.
