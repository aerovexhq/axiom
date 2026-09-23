# Verilog Akış Denetim İfadeleri

Yordamsal akış denetim ifadeleri (`if-else`, `case` ve döngüler), tasarımcıların yordamsal bloklar içinde karmaşık karar ağaçlarını, koşul öncelikli kodlayıcıları ve durum geçiş mantığını ifade etmelerini sağlar.

---

## Koşullu İfadeler (`if-else`)

`if-else` ifadesi Boole koşullarını öncelik sırasına göre değerlendirir:

```verilog
always @(*) begin
    if (interrupt_high) begin
        active_irq = 2'b11;
    end else if (interrupt_med) begin
        active_irq = 2'b10;
    end else if (interrupt_low) begin
        active_irq = 2'b01;
    end else begin
        active_irq = 2'b00;
    end
end
```

### İstenmeyen Mandal Tehlikesi
Kombinasyonel bir süreçte, bir değişkene bir `if` dalında atama yapılır ancak `else` dalında atlama yapılırsa, koşul yanlış olduğunda donanım önceki değerini korumalıdır. Bu durum sentez araçlarını **şeffaf seviyeye duyarlı bir mandal** çıkarmaya zorlar.
- Axiom'un linter'ı kombinasyonel bloklarda eksik bir dal algılandığında `AXIOM_W006_TRANSPARENT_LATCH` uyarısı verir.

---

## Çok Yönlü Dallanma (`case`, `casez`, `casex`)

### 1. Standart `case`
Seçici ifadeyi case öğesi değerleriyle karşılaştırır:

```verilog
reg [1:0] state;
reg [7:0] data_out;

always @(*) begin
    case (state)
        2'b00:   data_out = 8'h00;
        2'b01:   data_out = 8'hAA;
        2'b10:   data_out = 8'h55;
        2'b11:   data_out = 8'hFF;
        default: data_out = 8'h00; // Always include default!
    endcase
end
```
- Bir `case` ifadesi `default:` dalını atlarsa Axiom'un linter'ı `AXIOM_W007_MISSING_DEFAULT` uyarısı verir.

### 2. `casez` (Farketmez Bit Eşleme)
`case` ifadelerindeki `?` veya `z` bitlerini önemsiz (don't-care) değerler olarak ele alır. Adres kod çözücüler ve öncelik kodlayıcılar için idealdir:

```verilog
always @(*) begin
    casez (req_lines)
        4'b1???: grant = 4'b1000; // Bit 3 active, ignore lower bits
        4'b01??: grant = 4'b0100; // Bit 2 active
        4'b001?: grant = 4'b0010; // Bit 1 active
        4'b0001: grant = 4'b0001; // Bit 0 active
        default: grant = 4'b0000;
    endcase
end
```

---

## Yordamsal Döngüler (`for`, `while`, `repeat`, `forever`)

Sentezlenebilir donanım içindeki döngüler paralel uzamsal mantığa açılır:

```verilog
// 8-bit Population Count (Bit Counter) unrolled in parallel
integer i;
reg [3:0] ones_count;

always @(*) begin
    ones_count = 0;
    for (i = 0; i < 8; i = i + 1) begin
        if (input_byte[i])
            ones_count = ones_count + 1;
    end
end
```

Test ortamı kodunda `repeat` ve `forever` döngüleri tekrarlayan saat dizilerini modeller:
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
