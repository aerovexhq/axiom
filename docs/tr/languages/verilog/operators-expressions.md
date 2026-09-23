# Verilog İşleçleri ve İfadeleri

Axiom EDA, In-RAM Cranelift JIT derlemesi ve WebAssembly motorlarında bit düzeyinde, aritmetik, indirgeme ve ilişkisel işlemler için optimize edilmiş makine yönergeleri oluşturarak tam IEEE 1364 işleç öncelik hiyerarşisini uygular.

---

## İşleç Öncelik Tablosu

İşleçler en yüksek öncelikten (ilk değerlendirilen) en düşük önceliğe doğru listelenmiştir:

| Öncelik | İşleç | Kategori | Açıklama |
| :--- | :--- | :--- | :--- |
| 1 (En Yüksek) | `+`, `-`, `!`, `~` | Tekli | Tekli artı, eksi, mantıksal DEĞİL, bit düzeyinde DEĞİL |
| 2 | `**` | Aritmetik | Üs alma (kuvvet) |
| 3 | `*`, `/`, `%` | Aritmetik | Çarpma, Bölme, Modül |
| 4 | `+`, `-` | İkili (Binary) | İkili toplama, çıkarma |
| 5 | `<<`, `>>`, `<<<`, `>>>` | Kaydırma | Mantıksal ve aritmetik kaydırmalar |
| 6 | `<`, `<=`, `>`, `>=` | İlişkisel | Karşılaştırma eşitsizliği |
| 7 | `==`, `!=`, `===`, `!==` | Eşitlik | Mantıksal eşitlik, case eşitliği |
| 8 | `&`, `~&` | Bit Düzeyinde / İndirgeme | Bit düzeyinde VE, indirgeme VE DEĞİL |
| 9 | `^`, `~^`, `^~` | Bit Düzeyinde / İndirgeme | Bit düzeyinde ÖZEL VEYA, bit düzeyinde ÖZEL VEYA DEĞİL |
| 10 | `\ | `, `~\ | ` | Bit Düzeyinde / İndirgeme | Bit düzeyinde VEYA, indirgeme VEYA DEĞİL |
| 11 | `&&` | Mantıksal | Mantıksal VE |
| 12 | `\ | \ | ` | Mantıksal | Mantıksal VEYA |
| 13 (En Düşük) | `? :` | Koşullu | Üçlü koşullu çoklayıcı (multiplexer) |

---

## Bit Düzeyinde ve Mantıksal İşleçler

HDL tasarımındaki yaygın hata kaynaklarından biri, bit düzeyinde ve mantıksal işlemlerin karıştırılmasıdır:

```verilog
wire [3:0] a = 4'b1010;
wire [3:0] b = 4'b0101;

// Bitwise AND (&): operates bit-by-bit -> 4'b0000
wire [3:0] bitwise_and = a & b;

// Logical AND (&&): evaluates truthiness of operands -> 1'b1
wire logical_and = (a != 0) && (b != 0);

// Bitwise NOT (~): inverts each individual bit -> 4'b0101
wire [3:0] bitwise_inv = ~a;

// Logical NOT (!): evaluates whether operand is zero -> 1'b0
wire logical_inv = !a;
```

---

## İndirgeme İşleçleri

İndirgeme işleçleri tek bir çok bitli vektör işleneni alır ve tüm bitleri boyunca bit düzeyinde bir işlem gerçekleştirerek 1-bitlik bir sonuç üretir:

```verilog
wire [7:0] bus = 8'b1111_0000;

// Reduction AND (&): 1 & 1 & 1 & 1 & 0 & 0 & 0 & 0 -> 1'b0
wire all_ones = &bus;

// Reduction OR (|): 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 -> 1'b1
wire any_one = |bus;

// Reduction XOR (^): Parity generator -> 1'b0 (even parity)
wire odd_parity = ^bus;
```

---

## Birleştirme ve Çoğaltma

Verilog, daha küçük veriyollarını daha geniş vektörlerde birleştirmek için `{ ... }` parantez gösterimini sağlar:

```verilog
wire [3:0] high_nibble = 4'hA;
wire [3:0] low_nibble  = 4'h5;

// Concatenation: assemble two 4-bit vectors into an 8-bit byte
wire [7:0] full_byte = {high_nibble, low_nibble}; // 8'hA5

// Sign extension via replication {N{expr}}
wire [7:0] signed_val = 8'b1000_0011;
// Replicate MSB 8 times to sign-extend from 8 bits to 16 bits
wire [15:0] sign_extended = {{8{signed_val[7]}}, signed_val};
```

---

## Koşullu Üçlü İşleç (`? :`)

Üçlü işleç, sürekli atamalarda çoklayıcı mantığını modeller:

```verilog
wire sel;
wire [15:0] in_0, in_1;

// 2-to-1 Multiplexer
wire [15:0] mux_out = (sel) ? in_1 : in_0;

// Priority Encoder / Cascaded Multiplexers
wire [1:0] mode;
wire [7:0] result = (mode == 2'b00) ? 8'h00 :
                    (mode == 2'b01) ? 8'hAA :
                    (mode == 2'b10) ? 8'h55 : 8'hFF;
```
