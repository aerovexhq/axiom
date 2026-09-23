# Özelleşmiş Yordamsal Bloklar (`always_comb`, `always_ff`, `always_latch`)

Klasik Verilog'da, genel `always` anahtar kelimesi kombinasyonel mantık, saatli yazmaçlar ve mandallar için kullanılıyordu; bu da duyarlılık listeleri eksik olduğunda veya dallar atlandığında sinsi tasarım hatalarına yol açıyordu. SystemVerilog, tasarım niyetini zorunlu kılan açık yordamsal bloklar sunar.

---

## `always_comb` (Kombinasyonel Mantık)

`always_comb` açıkça kombinasyonel bir süreci bildirir:
- **Otomatik Duyarlılık**: Tasarımcılar artık `@*` yazmaz veya girişleri listelemez. Simülatör, okunan tüm değişkenlerin tam duyarlılık listesini otomatik olarak çıkarır.
- **Anında Başlangıç Değerlendirmesi**: İlk saat kenarından önce çıkışların geçerli olmasını sağlamak için $t=0$ simülasyon zamanında otomatik olarak yürütülür.
- **Katı Mandal Önleme**: Eksik dallar nedeniyle bir `always_comb` bloğu şeffaf bir mandal çıkarırsa Axiom'un linter'ı bir hata bildirir.

```verilog
always_comb begin
    case (alu_op)
        4'b0000: alu_result = operand_a + operand_b;
        4'b0001: alu_result = operand_a - operand_b;
        4'b0010: alu_result = operand_a & operand_b;
        4'b0011: alu_result = operand_a | operand_b;
        default: alu_result = 32'd0;
    endcase
end
```

---

## `always_ff` (Saatli Ardışıl Mantık)

`always_ff` kenar tetiklemeli yazmaçları ve flip-flopları modeller:
- Kenar tetiklemeli bir duyarlılık listesine sahip olmalıdır (`@(posedge clk)` veya `@(posedge clk or negedge rst_n)`).
- Ardışıl durum yazmaçları için engelleyici atamalar (`=`) içeremez.
- Birden çok saati veya sıfır gecikmeli döngüleri yasaklar.

```verilog
always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        q_reg <= 16'h0000;
    end else if (enable) begin
        q_reg <= d_in;
    end
end
```

---

## `always_latch` (Seviyeye Duyarlı Mandallar)

Asenkron seviyeye duyarlı bir mandal gerçekten amaçlandığında (örneğin düşük güçlü saat kapılama hücrelerinde):

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
Tasarımcılar, mandalları açık `always_latch` bloklarına izole ederek ana RTL modüllerinde kasıtsız mandal çıkarımını ortadan kaldırır.
