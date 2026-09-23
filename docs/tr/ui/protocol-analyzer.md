# Protokol Analizörü ve Seri Paket Denetleyicisi

Axiom EDA; yerleşik bir donanımsal seri protokol analizörü ve çerçeve ayrıştırıcısı (`crates/sim/src/protocol/`, `ProtocolAnalyzer.tsx`) içerir. Doğrudan bellekte standart iletişim veriyolları için dijital sinyal geçişlerini izler, çerçevelemeyi çıkarır, sağlama toplamlarını doğrular ve paket veri yüklerinin kodunu çözer.

---

## Desteklenen Donanım Protokol Kod Çözücüleri

```
+-------------------------------------------------------------------------------+
| Protocol Analyzer: Active Decoder = UART (115200 Baud, 8N1)                   |
| Total Packets Decoded: 142 | Errors Detected: 0 | Framing: Valid              |
+-------------------------------------------------------------------------------+
| Packet Transaction Stream:                                                    |
| #   | Timestamp | Channel | Type | Payload (ASCII) | Payload (Hex) | Status   |
|-----+-----------+---------+------+-----------------+---------------+----------|
| 001 | 1.200 us  | TX      | DATA | "A"             | 0x41          | OK (ACK) |
| 002 | 1.286 us  | TX      | DATA | "X"             | 0x58          | OK (ACK) |
| 003 | 1.373 us  | TX      | DATA | "I"             | 0x49          | OK (ACK) |
| 004 | 1.460 us  | TX      | DATA | "O"             | 0x4F          | OK (ACK) |
| 005 | 1.547 us  | TX      | DATA | "M"             | 0x4D          | OK (ACK) |
+-------------------------------------------------------------------------------+
| Hex & ASCII Payload Inspector: [ 41 58 49 4F 4D ] -> "AXIOM"                  |
+-------------------------------------------------------------------------------+
```

### 1. UART (Evrensel Asenkron Alıcı/Verici)
- Yapılandırılabilir baud hızları (9600 ila 921600 Baud).
- Veri bitleri: 5, 6, 7, 8, 9.
- Eşlik denetimi: Yok, Çift (Even), Tek (Odd), Mark, Space.
- Durdurma bitleri: 1, 1.5, 2. Çerçeveleme hatalarını ve kesme koşullarını algılar.

### 2. SPI (Seri Çevre Birimi Arayüzü)
- Tam çift yönlü (full-duplex) eşzamanlı MOSI ve MISO kod çözme.
- 4 SPI saat modunun tümünü destekler: Mod 0 ($CPOL=0, CPHA=0$), Mod 1 ($CPOL=0, CPHA=1$), Mod 2 ($CPOL=1, CPHA=0$), Mod 3 ($CPOL=1, CPHA=1$).
- Etkin-düşük veya etkin-yüksek Yongası Seçimi (`CS_N`) nitelemesi.

### 3. I2C (Entegreler Arası İletişim)
- 7-bit ve 10-bit bağımlı (slave) adresleme.
- START, Yinelenen START ve STOP veri yolu koşullarını algılar.
- Bağımlı ACK/NACK bitlerini ve aktarım yönünü (Okuma/Yazma) doğrular.

### 4. CAN Veri Yolu 2.0A / 2.0B
- Otomotiv sınıfı denetleyici alan ağı (CAN) çerçeve ayrıştırma.
- Bit doldurma (bit-stuffing) algılama ve otomatik geri alma.
- 11-bit standart ve 29-bit genişletilmiş tanımlayıcı çıkarma.
- Veri Uzunluk Kodu (DLC) ve CRC-15 polinom sağlama toplamı doğrulaması.

### 5. USB 1.1 / 2.0
- Düşük Hızlı (1.5 Mbps) ve Tam Hızlı (12 Mbps) NRZI hat durumu takibi.
- Bit çıkarma (bit-unstuffing) kurtarma.
- Paket Tanımlayıcı (PID) kod çözme: Belirteç (OUT, IN, SOF, SETUP), Veri (DATA0, DATA1), Tokalaşma (ACK, NAK, STALL).
- CRC-5 (belirteçler) ve CRC-16 (veri paketleri) doğrulaması.

### 6. Ethernet MII / RMII
- 10/100 Mbps Ortamdan Bağımsız Arayüz (MII) ayrıştırıcısı.
- Çerçeve ayrıştırma: Başlangıç eki (`0x55`), Çerçeve Başlangıç Sınırlayıcısı (`0xD5`), Hedef MAC, Kaynak MAC, EtherType.
- IPv4 başlığı, ARP ve UDP veri yükü kod çözme.
- Çerçeve Kontrol Dizisi (FCS) CRC-32 doğrulaması.

---

## Paket Denetleyici HUD

- **İşlem Akış Tablosu**: Sıralı paket aktarımlarını zaman damgaları, kanal tanımlayıcıları ve doğrulama durumu rozetleri ile görüntüler.
- **Yük Hex/ASCII Görüntüleyicisi**: İkili veri yüklerini biçimlendirilmiş onaltılık veya temiz ASCII karakter gösterimleriyle inceleyin.
- **Hata İşaretleme**: Bozulmuş paketler (sağlama toplamı hatası, çerçeveleme hatası, eşlik ihlali) kırmızı uyarı rozetleriyle vurgulanır.
