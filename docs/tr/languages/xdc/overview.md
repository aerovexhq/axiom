# Xilinx Tasarım Kısıtlamalarına (XDC / SDC) Genel Bakış

Axiom EDA; **Xilinx Tasarım Kısıtlamaları (XDC)** dosyaları (`crates/lsp/src/xdc.rs`, `crates/sta/src/sdc_parser.rs`) için yerel ayrıştırma, doğrulama ve yürütme desteği sunar. XDC, fiziksel FPGA aygıtı yapılandırması için Tcl tabanlı özelliklerle genişletilmiş endüstri standardı Synopsys Tasarım Kısıtlamaları (SDC) sözdizimine dayanır.

---

## Axiom'da XDC'nin İkili Rolü

```
+-------------------------------------------------------------------------------+
| XDC Constraints File (constrs_1/timing.xdc)                                   |
+---------------------------------------+---------------------------------------+
| Physical Constraints                  | Static Timing Constraints             |
|---------------------------------------+---------------------------------------|
| - Package pin allocation (PACKAGE_PIN)| - Clock definitions (create_clock)    |
| - I/O electrical standard (IOSTANDARD)| - I/O setup/hold delays               |
| - Drive strength & slew rate          | - False paths & multicycle exceptions |
| - Pull-up & pull-down resistors       | - Asynchronous clock domain isolation |
+---------------------------------------+---------------------------------------+
|                   \                               /                           |
|                    v                             v                            |
|       [Floorplanning & Virtual Lab]       [Static Timing Analysis Engine]     |
|       - Physical die placement            - Critical path waterfall           |
|       - Basys 3 board mapping             - Setup & hold slack calculation    |
+-------------------------------------------------------------------------------+
```

### Axiom'daki Temel Yetenekler
1. **Sıfır Hatalı Pozitifli LSP**: Axiom'un bellek içi XDC Dil Sunucusu `#` yorumlarını ayrıştırır, komut anahtar kelimelerini doğrular ve geçerli kısıtlamaları sözdizimi hataları olarak işaretlemeden portlar için otomatik tamamlama sağlar.
2. **Sanal Laboratuvar Doğrudan Bağlama**: Fiziksel pin eşlemeleri (`PACKAGE_PIN V17`, `PACKAGE_PIN U16`), Axiom'un dokunsal Sanal Laboratuvar Rafına dinamik olarak bağlanarak simüle edilmiş RTL'yi doğrudan Basys 3 sürgülü anahtarlarına ve LED'lerine bağlar.
3. **STA Motoru Entegrasyonu**: Saat tanımları (`create_clock -period 10.0`), Statik Zamanlama Analizi motoru ve Zamanlama Radarı için zamanlama referans frekansını belirler.
