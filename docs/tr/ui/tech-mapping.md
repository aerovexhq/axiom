# Geçit Düzeyinde Teknoloji Eşleme Stüdyosu

Axiom'un Teknoloji Eşleme Stüdyosu (`crates/ir/src/synth/`), davranışsal RTL ile fiziksel FPGA mimarileri arasında köprü kurar. Genel Boole mantık denklemlerini, çoğullayıcıları ve aritmetik işleçleri AMD/Xilinx 7-Serisi ve UltraScale+ aygıtlarına özgü silikon primitiflerine ayrıştırır.

---

## Mimariye Özgü Primitif İndirgeme

```
+-------------------------------------------------------------------------------+
| RTL Verilog Code:                       | Mapped Silicon Primitives:          |
|                                         |                                     |
| assign F = (cond) ? (a + b) : (c & d);  | - LUT6_2 (INIT = 64'hE2E2_0000_...) |
|                                         | - CARRY4 (Fast Arithmetic)          |
|                                         | - FDRE   (D Flip-Flop with Enable)  |
+-------------------------------------------------------------------------------+
```

### Desteklenen FPGA Silikon Hedefleri
Mühendisler önceden yapılandırılmış donanım mimarileri arasından seçim yapabilir:
1. **AMD Artix-7 (XC7A35T / XC7A100T)**: 6 girişli LUT'lar, CARRY4 aritmetiği, DSP48E1 dilimleri, RAMB36E1 bellekleri.
2. **AMD Kintex-7 (XC7K325T)**: Yüksek hızlı 7-Serisi mimarisi.
3. **AMD Zynq-7000 (XC7Z020)**: 7-Serisi programlanabilir mantık örgüsüne sahip çift ARM Cortex-A9 SoC.
4. **AMD Kintex UltraScale+ (XCKU5P)**: CARRY8 zincirleri, DSP48E2 dilimleri ve UltraRAM blokları içeren modern 16nm FinFET mimarisi.
5. **Axiom Sanal Silikon**: Eğitim ve hızlı prototipleme için optimize edilmiş genel yüksek kapasiteli sanal mimari.

---

## Boole Ağı Ayrıştırma ve K-LUT Eşleme

### 1. $K$-LUT Ayrıştırması
Axiom, rastgele Boole mantık ifadelerini $K$ girişli Doğruluk Tablolarına (LUT) ayrıştırır (modern Xilinx FPGA'ları için $K=6$):
- $\le 6$ benzersiz girişe sahip alt fonksiyonlar doğrudan tek bir `LUT6`'ya eşlenir.
- 5 girişe kadar paylaşan çift çıkışlı mantık fonksiyonları, çift çıkışlı `LUT6_2` primitiflerine (`O5`, `O6`) eşlenir.
- Geniş mantık fonksiyonları ($N > 6$), Shannon açılımı kullanılarak basamaklı LUT ağlarına bölünür.

### 2. Kesin `INIT` Onaltılık Parametre Hesaplaması
Eşlenen her LUT, doğruluk tablosunu 64-bitlik bir onaltılık `INIT` parametresine serileştirir:
$$\text{INIT}[i] = f(i_5, i_4, i_3, i_2, i_1, i_0)$$
Örneğin, 2 girişli bir VE geçidi `INIT = 64'h0000_0000_0000_0008` ile bir `LUT6`'ya eşlenir.

---

## Makro Primitif Çıkarımı

Sentez motoru üst düzey yapısal kalıpları otomatik olarak tanımlar:
- **DSP Dilimi Çıkarımı (`DSP48E1` / `DSP48E2`)**: Çok bitli çarpmalar (`a * b`), çarpma-biriktirme işlemleri (`P = P + (A * B)`) ve ön toplayıcı dizilimleri, yüzlerce mantık LUT’u tüketmek yerine doğrudan özel donanımsal DSP bloklarına eşlenir.
- **Blok RAM Çıkarımı (`RAMB18E2` / `RAMB36E2`)**: Eşzamanlı saatli paketlenmemiş diziler (`reg [31:0] mem [0:1023]`), otomatik olarak gerçek çift portlu veya basit çift portlu donanımsal Blok RAM’lere indirgenir.

---

## Eşlenmiş Netlist İncelemesi ve Yapısal Verilog Dışa Aktarımı

Teknoloji Eşleme Görüntüleyicisi şu özelliklere sahiptir:
- **Kaynak Kullanımı Çubuk Grafiği**: Dilim LUT'ları, Dilim Yazmaçları (FF'ler), CARRY zincirleri, DSP dilimleri ve Blok RAM'ler için sayıları ve yüzdeleri görüntüler.
- **Hücre Denetleyici Tablosu**: Eşlenen primitif örneklerini arayın ve filtreleyin.
- **Doğruluk Tablosu HUD'ı**: Eşlenen herhangi bir LUT tarafından temsil edilen kesin Boole doğruluk tablosunu inceleyin.
- **Yapısal Verilog Dışa Aktarımı**: Standart Xilinx primitifleri ile örneklendirilmiş saf yapısal geçit netlistlerinin (`.v`) tek tıkla üretimi.
