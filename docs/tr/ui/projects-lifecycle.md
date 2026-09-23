# Projeler ve Dosya Kümeleri Yaşam Döngüsü

Axiom EDA, hafif web kalıcılığı ve masaüstü dosya sistemi entegrasyonuyla birleştirilmiş özgün bir Vivado sınıfı proje yönetim sistemi uygular. Projeler; tasarım RTL kaynakları, benzetim test ortamları ve fiziksel/zamanlama kısıtlamaları arasında katı bir ayrım sürdürür.

---

## Karşılama Başlatıcısı

Açık bir proje olmadan başlatıldığında Axiom, temiz ve havacılık-uzay sınıfı bir Hoş Geldiniz Başlatıcısı sunar:

```
+-------------------------------------------------------------------------------+
| Axiom EDA v1.0.0 — In-RAM Cranelift JIT & Silicon Telemetry Engine            |
+---------------------------------------+---------------------------------------+
| [ Create New Project ]                | [ Open Project from File ]            |
| Wizard with device selection          | Import serialized .json bundle        |
+---------------------------------------+---------------------------------------+
| Starter Engineering Blueprints (1-Click Launch):                              |
| 1. Logic Circuit (Gate-Level Booleans)| 5. SPI Master Controller              |
| 2. UART Transceiver (115200 Baud)     | 6. FSM Traffic Controller             |
| 3. Synchronous FIFO Buffer (32x8)     | 7. IUC Cerrahpasa Digital Logic Lab   |
| 4. 32-Bit Arithmetic Logic Unit (ALU) |                                       |
+-------------------------------------------------------------------------------+
| Recent Projects: [ Active Projects (3) ]  |  [ Trashed Projects (1) ]         |
+-------------------------------------------------------------------------------+
```

### Başlangıç Şablonları
Axiom, endüstride test edilmiş 7 başlangıç taslağı sunar:
1. **Kombinasyonel Mantık Devresi**: 9 geçit hücresi (`inv1`, `inv2`, `and1`, `and2`, `or1`) ve özel Sanal Laboratuvar dokunsal bölmesi ile \(F = ((\neg A \land B) \land C) \lor \neg B\) hesaplayan geçit düzeyinde Boole mantık sistemi.
2. **UART Alıcı-Verici**: 8 veri biti, 1 durdurma biti, aşırı örneklemeli saat üreteci ve durum yazmaçlarına sahip eksiksiz verici ve alıcı boru hattı.
3. **Senkron FIFO Arabelleği**: Dolu, boş, neredeyse dolu ve neredeyse boş eşik bayraklarına sahip çift işaretçili 32x8 dairesel bellek arabelleği.
4. **32-Bit ALU**: Sıfır bayrağı ve taşma algılamasıyla IEEE işaretli toplama, çıkarma, fıçı kaydırma, karşılaştırma ve Boole mantığını uygulayan Aritmetik Mantık Birimi.
5. **SPI Master**: Programlanabilir saat bölücüler ile Mod 0, 1, 2 ve 3’ü destekleyen motor kontrolü sınıfı Seri Çevresel Arayüz.
6. **FSM Trafik Kontrolcüsü**: Yeşil, sarı, kırmızı dizilimleri, yaya talep mandalları ve zamanlayıcı sayaçları içeren 4 yönlü kavşak sonlu durum makinesi.
7. **İÜC Cerrahpaşa Sayısal Mantık Laboratuvarı**: `uygulama_0.v`, otomatik test ortamları ve Basys 3 Artix-7 kısıtlamalarını içeren İstanbul Üniversitesi - Cerrahpaşa ders projesi.

---

## Vivado Dosya Kümeleri Yapısı

Axiom, proje dosyalarını standart Vivado dosya kümesi kategorilerinde düzenler:

```
project_root/
|-- sources_1/           # Design Sources
|   |-- logic_circuit.v  # Primary RTL implementation [TOP]
|   `-- uart_tx.v        # Submodules
|-- sim_1/               # Simulation Sources
|   `-- tb_circuit.v     # Testbench harness
`-- constrs_1/           # Physical & Timing Constraints
    `-- timing.xdc       # XDC pinouts and clock declarations
```

### 1. Tasarım Kaynakları (`sources_1`)
Verilog, SystemVerilog veya VHDL ile uygulanan tüm sentezlenebilir donanım modüllerini içerir.
- **Tepe Modülü Belirleme (`[TOP]`)**: Sentez, şematik oluşturma ve fiziksel yerleşim planlama için etkin kök modül. Dosya kartındaki dikey 3 noktalı kebap menüsünden herhangi bir modülü tepe (top) olarak belirleyebilirsiniz.
- **Kaynak Ekle (`+`) Eylemi**: Tasarım Kaynakları başlığındaki `+` düğmesine tıklanması, `sources_1` kategorisi önceden seçilmiş olarak `AddSourceModal`ı açar.

### 2. Simülasyon Kaynakları (`sim_1`)
Test ortamı donanımlarını (`tb_*.v`), uyarıcı vektörleri ve doğrulama dizilimlerini içerir. Hatalı çoklu sürücü veya kısıtlanmamış pin uyarılarını önlemek için test ortamı dosyaları fiziksel sentezden ve teknoloji eşlemeden hariç tutulur.

### 3. Kısıtlamalar (`constrs_1`)
FPGA paket pin bağlamalarını (`PACKAGE_PIN`, `IOSTANDARD`) ve Statik Zamanlama Analizi (STA) saat hedeflerini (`create_clock`) tanımlayan Xilinx Tasarım Kısıtlamaları (`.xdc`) dosyalarını içerir.

---

## Proje Başlık Menüsü (`ProjectDropdown`)

Sol üstteki proje açılır rozeti, temel yaşam döngüsü işlemlerine doğrudan erişim sağlar:
- **Projeyi Kaydet (`Ctrl + S`)**: Anında görsel onay ile tüm düzenleyici arabelleklerini diske (Masaüstü) veya IndexedDB’ye (Web) yazar.
- **Proje Paketini Dışa Aktar (`.json`)**: Tüm dosya kümelerini, hedef FPGA parça numaralarını, etkin tepe modülünü ve güvenlik bayraklarını paketleyen bağımsız, taşınabilir bir JSON dosyası oluşturur.
- **Kaynak Ekle...**: Çok formatlı kaynak oluşturma sihirbazını başlatır.
- **Proje Ayarları ve Güvenlik...**: Proje güven modunu, depolama kotalarını, veri yalıtımını ve benzetim güvenlik sınırlarını yapılandırır.
- **Yeni Proje Sihirbazı**: Proje oluşturma sihirbazını başlatır.
- **Projeyi Kapat**: Etkin durumu güvenle kaydeder ve kaydedilmemiş düzenlemeleri kaybetmeden Hoş Geldiniz Başlatıcısına döner.

---

## Proje Çöpe Atma ve Kurtarma Yaşam Döngüsü

Kazara veri kaybını önlemek için Axiom iki aşamalı bir silme yaşam döngüsü uygular:
1. **Çöp Kutusuna Taşı**: Başlatıcıdaki herhangi bir proje kartında bulunan dikey 3 noktalı kebap düğmesiyle erişilebilir. Çöpe atılan projeler hemen `isTrashed: true` olarak kaydedilir, Etkin sekmesinden kaybolur ve Çöp Kutusu rozet sayısını artırır.
2. **Çöpe Atılan Projelere Erişme**: Başlatıcıdaki **Çöp Kutusu** sekmesine tıklanması, silinme tarihleriyle birlikte çöpe atılmış tüm tasarımları gösterir.
3. **Projeyi Geri Yükle**: Projeyi tüm dosyaları ve yapılandırmaları bozulmadan Etkin sekmesine geri yükler.
4. **Kalıcı Silme**: Akrilik bir onay modali (`ConfirmModal.tsx`) görüntüler. Onaylandıktan sonra proje kayıtlarını kalıcı olarak siler ve ilişkili depolama dizinlerini dosya sisteminden kaldırır.
