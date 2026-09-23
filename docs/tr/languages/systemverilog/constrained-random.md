# Kısıtlı Rastgele Doğrulama

Axiom EDA, kısıtlı rastgele test üretimini (`crates/syntax/src/stimulus.rs`) destekleyerek, doğrulama mühendislerinin yasal giriş parametre alanlarını, değer dağılımlarını ve kısıtlamaları tanımlayarak zorlu sınır durumu hatalarını ortaya çıkarmasını sağlar.

---

## Rastgele Değişkenler (`rand`, `randc`)

- `rand`: Düzgün dağılımlı sözde rastgele tamsayılar üretir.
- `randc`: Döngüsel rastgele üretim (tekrarlamadan önce aralıktaki her permütasyonun örneklenmesini garanti eder).

```verilog
class ethernet_packet;
    rand  bit [15:0] length;
    rand  bit [7:0]  payload[];
    randc bit [3:0]  priority_id;

    // Constraint block defining legal packet size
    constraint c_length {
        length inside {[64:1518]}; // Standard Ethernet frame size
    }

    // Weighted distribution constraint
    constraint c_priority {
        priority_id dist {
            0       := 50,  // 50% probability for background priority
            [1:3]   := 30,  // 30% divided across normal priority
            [4:7]   := 20   // 20% for high priority
        };
    }
endclass
```

---

## Kısıtlama Blokları ve Çözümleme

Axiom'un motor içi kısıtlama çözücüsü doğrusal aritmetik eşitsizlikleri ve küme üyeliğini değerlendirir:
- **Küme Üyeliği (`inside`)**: Değerleri aralıklarla sınırlandırır (`val inside {[10:50], [100:200]};`).
- **Gerektirme Kısıtlamaları (`->`)**: Koşullu kısıtlamalar (`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`).
- **Önce Çöz (`solve a before b`)**: Ortak olasılık dağılımlarında örnekleme öncelik sırasını kontrol eder.

---

## Otomatik Test Ortamı Üretimi

Axiom Stüdyo'da mühendisler, tek tıkla HDL dışa aktarımı ile tohum tekrarlanabilir kısıtlı rastgele test ortamları (`tb_<top>.v`) oluşturmak için **Görsel Uyarıcı Editörünü** (`StimulusGeneratorModal.tsx`) kullanabilir.
