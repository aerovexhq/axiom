# Biçimsel Özellik Doğrulama (FPV) Stüdyosu

Axiom EDA; motor içi Sınırlı Model Denetimi (BMC) ve $k$-tümevarım biçimsel doğrulama paketi (`crates/sim/src/formal/`, `FormalVerificationViewer.tsx`) sunar. Belirsiz uç durumları gözden kaçırabilecek sözde rastgele test vektörlerine güvenmek yerine, biçimsel doğrulama tüm olası giriş senaryolarında SystemVerilog Savlarını (SVA) matematiksel olarak kanıtlar veya çürütür.

---

## Sınırlı Model Denetimi ve k-Tümevarım

```
+-------------------------------------------------------------------------------+
| Formal Verification Studio: Bound Depth K = 20 | Mode: k-Induction           |
| Proven: 8 | Falsified: 1 (Counterexample) | Witnessed: 4 | Inconclusive: 0    |
+-------------------------------------------------------------------------------+
| Verification Goals:                                                           |
| Status    | Goal Name           | Type   | Bound | Time (ms) | Trace          |
|-----------+---------------------+--------+-------+-----------+----------------|
| [PROVEN]  | p_fifo_no_overflow  | assert | K=20  | 14.2 ms   | -              |
| [PROVEN]  | p_fsm_legal_state   | assert | K=20  |  8.1 ms   | -              |
| [FALSIFY] | p_ack_within_4_cyc  | assert | K=12  | 24.8 ms   | [View Trace]   |
| [WITNESS] | c_fifo_full_reached | cover  | K=8   |  5.3 ms   | [View Trace]   |
+-------------------------------------------------------------------------------+
```

### 1. Sınırlı Model Denetimi (BMC)
BMC, donanım durumu geçiş ilişkisini $k$ ayrık saat döngüsü boyunca açar ($s_0 \to s_1 \to \dots \to s_k$). Motor, ulaşılabilir herhangi bir durumun bir savı ihlal edip etmediğini değerlendirir. $j \le k$ adımında geçersiz bir durumla karşılaşılırsa motor kesin bir **karşıt örnek izi** çıkarır.

### 2. $k$-Tümevarım (Eksiksiz Kanıtlar)
$k$-Tümevarım; bir özelliğin ilk $k$ temel adım için geçerli olduğunu ve rastgele bir $k$ adım dizisi için geçerli olduğu varsayımının $k+1$ adımı için de geçerli olduğunu ima ettiğini kanıtlarsa, özelliğin sonsuz zaman ($t \to \infty$) boyunca **koşulsuz olarak kanıtlandığını** gösterir.

---

## Otomatik Yapısal Doğrulama Hedefleri

Formal Studio’da bir tasarım açılırken Axiom, manuel SVA yazımına gerek kalmadan temel yapısal güvenlik özelliklerini otomatik olarak sentezler:
- **`p_no_unknown_out`**: Birincil çıkışların sıfırlama kalktıktan sonra asla yüksek empedans (`Z`) veya bilinmeyen (`X`) durumlara geçmediğini kanıtlar.
- **`p_fsm_state_valid`**: One-hot ve ikili durum yazmaçlarının asla belgelenmemiş veya kural dışı durum vektörlerine girmediğini kanıtlar.
- **`p_reset_stability`**: Sıfırlama hattı etkinken dahili yazmaçların güvenli sıfırlama durumlarını koruduğunu kanıtlar.
- **`c_fsm_active`**: Bildirilen her FSM durumunun erişilebilir olduğunu kanıtlayan kapsama özelliklerini otomatik olarak üretir.

---

## Karşıt Örnek İnceleyici ve Dalga Biçimi İzi Enjeksiyonu

Bir sav başarısız olduğunda Axiom minimum bir karşıt örnek izi oluşturur:
- **Döngü Döngü Tarayıcı**: Hangi hatların hatayı tetiklediğini gösteren bir sinyal fark tablosu ile sav ihlaline yol açan her döngüyü adım adım inceleyin.
- **Tek Tıkla Dalga Formu Enjeksiyonu**: **Inject Trace to Waveform** düğmesine tıklanması, karşıt örnek izini doğrudan Dalga Formu Görüntüleyicisine yükler ve zaman işaretçisini tam ihlal döngüsüne yerleştirir.

---

## SVA Özellik Yardımcısı Modalı

Formal Studio, etkileşimli bir SVA Özellik Asistanı (`SvaAssistantModal`) içerir:
- **Anlık Savlar (Immediate Assertions)**: Basit değişmez savlar (`assert (ready == 1);`).
- **İstek-Onay Tokalaşması**: Yanıtın sınırlı döngüler içinde ulaşmasını sağlayan `req |-> ##[1:4] gnt`.
- **FIFO Sıralaması**: Yazılan verilerin çıkışta bozulma olmaksızın tam ilk giren ilk çıkar sırasında göründüğünü doğrular.
- **Duraklatma Altında Kararlılık**: `stall` etkinleştirildiğinde veri yolunun sabit kalmasını sağlar (`stall |-> $stable(data)`).
