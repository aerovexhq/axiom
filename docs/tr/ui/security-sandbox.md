# Proje Güveni ve Çalışma Alanı İzolasyonu

Axiom EDA, güvenli dijital donanım tasarımı için tasarlanmıştır. Donanım tanımlama dosyaları ve simülasyon modelleri karmaşık yordamsal döngüleri çalıştırabildiğinden veya harici bellek içeriklerini içe aktarabildiğinden Axiom, havacılık düzeyinde **Proje Güven İzin Sistemi**, **Yerel Ana Bilgisayar Dosya Sistemi İzolasyon Koruması** ve **Yapılandırılabilir Depolama Kotaları** uygular.

---

## Proje Güven İzin Sistemi

Güvenilmeyen bir kaynaktan veya iş arkadaşından harici bir proje paketi (`.json`) açarken veya içe aktarırken Axiom, varsayılan olarak projeyi **Kısıtlı Modda** açarak ana bilgisayarı korur.

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### Kısıtlı ve Güvenilir Mod Matrisi

| Özellik | Kısıtlı Mod | Güvenilir Mod |
| :--- | :--- | :--- |
| **Simülasyon Yürütme** | İzin verilir (katı döngü sınırları) | İzin verilir (tam performans) |
| **Maksimum Delta Döngüsü (\(\delta\))** | 50.000 döngü / adım | 100.000 döngü / adım (yapılandırılabilir) |
| **Bellek Ayırma Sınırı** | 64 KKelime (256 KB) | 16 MKelime (64 MB) |
| **Ana Bilgisayar Dosya Sistemine Dışa Aktarma** | Engellendi | İzin Verildi |
| **Veri Dizini İzolasyonu** | Kesin olarak zorunlu kılınır (`.axiom/data/`) | Varsayılan olarak uygulanır |
| **Başlık Göstergesi** | `[ Restricted Mode ]` Kalkan Uyarısı | Zarif proje rozeti |

Mühendisler, başlıktaki `[ Kısıtlı Mod ]` rozetine tıklayarak veya proje menüsündeki **Proje Ayarları & Güvenlik...** seçeneği aracılığıyla istedikleri zaman güven durumunu değiştirebilirler.

---

## Yerel Ana Bilgisayar Dosya Sistemi İzolasyon Koruması

Yerel masaüstü kurulumları (Tauri v2) için Axiom, Rust arka ucunda (`crates/desktop/src/lib.rs`) `validate_sandboxed_path` aracılığıyla çekirdek düzeyinde yol sınırlaması uygular:

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### İzolasyon Korumaları
1. **Çapraz Platform Yol Normalleştirmesi**: Windows ters eğik çizgilerini (`\`) ve Unix düz eğik çizgilerini (`/`) otomatik olarak dönüştürür ve kelimesi kelimesine önekleri (`\\?\`) kaldırır.
2. **Dizin Geçişi Engelleme**: Hem ham girdi dizesinde hem de çözümlenen standart yolda `..` üst dizin geçiş dizilerini kesinlikle yasaklar.
3. **Hassas Sistem Dizini Kara Listesi**: İşletim sisteminin kritik dizinlerini okumayı veya bunlara yazmayı yasaklar:
   - Linux/macOS: `/etc`, `/proc`, `/sys`, `/boot`, `/root`, `/bin`, `/sbin`, `/usr`
   - Windows: `C:\Windows`, `C:\System32`, `C:\Program Files`
4. **Kimlik Bilgisi Deposu Karantinası**: Özel anahtarlara, kimlik bilgilerine ve kimlik doğrulama depolarına erişen tüm işlemleri engeller:
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Tauri IPC Komut Kapsamı**: Her dosya sistemi IPC çağrısı (`fs_read_file`, `fs_write_file`, `fs_remove_file`, `fs_list_dir`, `fs_create_dir`, `fs_exists`), `validate_sandboxed_path` ile korunur. Yetkisiz yol istekleri derhal bir `[SandboxViolation]` hatası döndürür.

---

## Yapılandırılabilir Depolama Kotaları

Kontrolden çıkan benzetim izleme dosyalarının (`.vcd`, `.saif`) veya sentetik döngülerin ana bilgisayar disk alanını tüketmesini önlemek için Axiom bayt düzeyinde depolama kotaları uygular:

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### Depolama Kotası Seçenekleri
- **10 MB**: Hafif kapı seviyesi ders çalışmaları için minimum ayak izi.
- **25 MB**: Standart FSM ve küçük işlemci tasarımları için uygundur.
- **50 MB (Varsayılan)**: Binlerce benzetim döngüsünü ve dalga formu izini barındıran standart mühendislik kotası.
- **100 MB / 250 MB / 500 MB**: Derin doğrulama çalıştırmaları, çok megabaytlık VCD dalga formları ve sentez sonrası netlistler için genişletilmiş limitler.
- **Sınırsız**: Büyük kurumsal projeler için sınırsız tahsis.

Kota uygulaması hem Tarayıcı IndexedDB (`BrowserIndexedDbFileSystem`) hem de yerel masaüstü depolaması (`TauriIpcFileSystem`) genelinde etkindir. Kotayı aşan yazma girişimi çalışma zamanını çökertmeden temiz bir `[StorageQuota]` istisnası tetikler.

---

## Özel Üretilen Veri Dizini (`.axiom/data/`)

Axiom oluşturulan tüm çıktıları özel bir çalışma alanı alt klasöründe yalıtır:
- Değer Değişim Dökümleri (`.vcd`)
- Anahtarlama Etkinliği Değişim Biçimi (SAIF) dosyaları (`.saif`)
- Statik Zamanlama Raporları (`timing_report.txt`)
- Eşlenmiş yapısal Verilog netlistleri (`synth_netlist.v`)
- Protokol paket yakalamaları (`.pcap`)

### Tek Tıkla Veri Temizleme Alt Sistemi
**Proje Güvenlik Modali** tek tıkla **Oluşturulan Verileri Temizle** düğmesi sağlar. Bu işlem `.axiom/data/` içeriğinin tamamını siler ve herhangi bir Verilog, SystemVerilog, VHDL veya XDC dosyasını değiştirmeden veya silmeden depolama kullanımını anında ham kaynak dosyalarına sıfırlar.
