# Sürekli Atamalar & Geçit Primitifleri

Sürekli atamalar ve yapısal geçit primitifleri, Verilog'da statik kombinasyonel donanımı temsil eder. Eşzamanlı ve sürekli olarak yürütülürler: sağ taraftaki herhangi bir sinyal değiştiğinde çıkış hattı anında güncellenir.

---

## Sürekli Atamalar (`assign`)

Sürekli atamalar değerleri `wire` hatlarına sürer:

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### Atama Kuralları
1. **Hedef Hat Tipi**: Sol taraf skalar veya vektörel bir bağlantı hattı (`wire`) olmalıdır. Bir yazmaç değişkeni (`reg`) olamaz.
2. **Dinamik Yeniden Değerlendirme**: `a` veya `b` her değiştiğinde, `sum` geçerli simülasyon zaman adımı içinde güncellenir.
3. **Örtük Sıfır-Gecikme**: Değişiklikler sürekli atamalar üzerinden sıfır simülasyon süresinde yayılır ve tüm hatlar kararlı duruma ulaşana kadar ara delta döngüleri ($\delta$) üretir.

---

## Dahili Yapısal Geçit Primitifleri

Verilog, Axiom'un açımlayıcısı tarafından doğrudan tanınan ve Şematik DAG Görselleştiriciye eşlenen dahili geçit primitifleri içerir:

```verilog
// Basic Boolean Gates
// Syntax: gate_type [instance_name] (output, input1, input2, ...);
and  and1 (out_and, in_a, in_b);
or   or1  (out_or,  in_a, in_b);
xor  xor1 (out_xor, in_a, in_b);
nand nand1(out_nand, in_a, in_b);
nor  nor1 (out_nor, in_a, in_b);
xnor xnor1(out_xnor, in_a, in_b);

// Inverters and Buffers
// Syntax: not/buf [instance_name] (output, input);
not  inv1 (out_not, in_a);
buf  buf1 (out_buf, in_a);

// Tristate Buffers
// Syntax: bufif0/bufif1 [instance_name] (output, input, control);
bufif1 tri_buf (bus_line, tx_data, enable); // Enabled when enable == 1
bufif0 tri_inv (bus_line, tx_data, n_en);   // Enabled when n_en == 0
```

---

## Kombinasyonel Mantık Örneği: Geçit Düzeyinde Tam Toplayıcı

```verilog
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire s1, c1, c2;

    // First half adder stage
    xor xor1 (s1, a, b);
    and and1 (c1, a, b);

    // Second half adder stage
    xor xor2 (sum, s1, cin);
    and and2 (c2, s1, cin);

    // Carry out calculation
    or  or1  (cout, c1, c2);

endmodule
```

Axiom Stüdyo'da bu tasarımın açılması; Şematik Görüntüleyicide çarpışmasız dik açılı kablolama, sıfır dönüşlü pin hizalama ve gerçek zamanlı hat değerleriyle 5 kapının tümünü otomatik olarak yerleştirir.
