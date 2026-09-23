# Verilog Veri Tipleri, Hatlar ve Değişkenler

Verilog HDL’de fiziksel donanım bağlantıları ve depolama elemanları iki temel grupta kategorize edilir: **Hatlar (Nets)** (fiziksel elektriksel kabloları temsil eder) ve **Değişkenler (Variables)** (davranışsal yordamsal depolamayı temsil eder).

---

## Bağlantı Hattı (Net) Veri Tipleri

Hatlar, donanım elemanları arasındaki fiziksel bağlantıları temsil eder. Mantık değerlerini depolamazlar; değerleri sürücüleri tarafından sürekli olarak belirlenir.

### 1. `wire` ve `tri`
Fiziksel bakır iletken hatları temsil eden birincil hat türü. `wire` ve `tri` sentezde işlevsel olarak özdeştir ve standart ara bağlantı hatlarını temsil eder.

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. Hat Güçleri ve Çoklu Sürücü Çatışması
Birden fazla etkin sürekli atama standart bir `wire` hattını çelişkili değerlerle (`1` ve `0`) eşzamanlı sürerse, Axiom çakışmayı bilinmeyen (`X`) olarak değerlendirir ve `AXIOM_E002_MULTI_DRIVER_NET` linter hatasını tetikler.

---

## Değişken Veri Tipleri

Değişkenler değerlerini bir yordamsal atamadan diğerine korurlar.

### 1. `reg`
Standart yordamsal değişken. Adına rağmen bir `reg` her zaman fiziksel bir flip-flop yazmacına sentezlenmez; tamamen kombinasyonel bir blok (`always @*`) içinde atanırsa kombinasyonel mantığa sentezlenir.

```verilog
// 1-bit register variable
reg state;

// 32-bit register vector
reg [31:0] accumulator;

// Sequential clocked assignment
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        accumulator <= 32'd0;
    else
        accumulator <= accumulator + 32'd1;
end
```

### 2. `integer` ve `time`
- `integer`: `for` döngülerinde ve test ortamı yinelemelerinde yaygın olarak kullanılan işaretli 32-bitlik değişken.
- `time`: `$time` aracılığıyla simülasyon zaman damgalarını kaydetmek için kullanılan 64-bitlik işaretsiz değişken.

---

## Vektörler ve İndeksli Parça Seçimleri

Vektörler, `[MSB:LSB]` aralıklarıyla bildirilen çok bitli veri yollarını temsil eder:

```verilog
wire [15:0] packet;

// Static slice part-select
wire [7:0] lower_byte = packet[7:0];
wire [7:0] upper_byte = packet[15:8];

// IEEE 1364-2001 Variable Indexed Part-Select (+: and -:)
// Syntax: [base_expr +: width]  (starts at base, selects width bits upward)
// Syntax: [base_expr -: width]  (starts at base, selects width bits downward)
wire [7:0] byte_0 = packet[0 +: 8];   // Selects packet[7:0]
wire [7:0] byte_1 = packet[8 +: 8];   // Selects packet[15:8]
wire [3:0] nibble = packet[7 -: 4];   // Selects packet[7:4]
```

---

## Paketlenmemiş Bellek Dizileri

Axiom; Yazmaç Dosyaları, Doğruluk Tabloları (LUT) ve SRAM bellek bloklarını modellemek için çok boyutlu paketlenmemiş dizileri destekler:

```verilog
// Array of 1024 registers, each 32 bits wide (4 KB RAM block)
reg [31:0] memory_array [0:1023];

// Synchronous memory write
always @(posedge clk) begin
    if (write_enable)
        memory_array[addr] <= write_data;
end

// Continuous read
assign read_data = memory_array[addr];
```

Axiom'un sentez motoru paketlenmemiş eşzamanlı bellekleri otomatik olarak algılar ve bunları Xilinx `RAMB18E2` veya `RAMB36E2` donanımsal Blok RAM'lerine dönüştürür.

---

## Boyutlandırılmış Sayı Sabitleri

Verilog sayıları boyutsuz ondalıklar veya açık taban öneklerine sahip boyutlandırılmış sabitler olarak belirtilebilir:

$$\text{Format: } <\text{size}>'<\text{base}><\text{value}>$$

| Sabit Değer | Bit Genişliği | Taban | Değer |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | İkili (Binary) | `0xAC` |
| `8'hFF` | 8 | Onaltılık (Hexadecimal) | `255` |
| `16'd1024` | 16 | Ondalık (Decimal) | `1024` |
| `4'o17` | 4 | Sekizlik (Octal) | `15` |
| `'d50` | Boyutsuz (32) | Ondalık (Decimal) | `50` |
| `1'b1` | 1 | İkili (Binary) | Lojik-yüksek |
