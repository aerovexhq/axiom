# SystemVerilog Veri Tipleri ve Bildirimleri

SystemVerilog, klasik Verilog'daki `wire` ve `reg` arasındaki kafa karıştırıcı ikiliği ortadan kaldırarak ve kullanıcı tanımlı tipleri, yapıları ve numaralandırmaları sunarak donanım modellemeyi modernize eder.

---

## Evrensel `logic` Tipi

Klasik Verilog'da tasarımcılar sürekli olarak `wire` (sürekli atamalar için) ve `reg` (yordamsal bloklar için) arasında seçim yapmak zorundaydı. SystemVerilog bunu 4 durumlu `logic` tipiyle çözer:

```verilog
// 1-bit logic signal driven by continuous assignment
logic valid;
assign valid = ready & req;

// Multi-bit logic bus driven procedurally
logic [31:0] data_reg;
always_ff @(posedge clk) begin
    data_reg <= next_data;
end
```
*Not: Bir `logic` hattı en fazla bir sürekli sürücüye sahip olabilir. Çok sürücülü kablolu-VEYA veya kablolu-VE veri yolları gerekiyorsa standart `wire` kullanılır.*

---

## İki Durumlu Veri Tipleri

Yüksek empedans (`Z`) ve bilinmeyen (`X`) durumların gerekmediği yüksek başarımlı simülasyon ve test ortamı modellemesi için SystemVerilog 2 durumlu tipleri sunar:

| Tip | Bit Genişliği | İşaretlilik | Değerler |
| :--- | :--- | :--- | :--- |
| `bit` | 1-bit | İşaretsiz | `0`, `1` |
| `byte` | 8-bit | İşaretli | `-128` ile `127` arası |
| `shortint` | 16-bit | İşaretli | `-32.768` ile `32.767` arası |
| `int` | 32-bit | İşaretli | Standart 32-bit tamsayı |
| `longint` | 64-bit | İşaretli | Standart 64-bit tamsayı |

Axiom, 2 durumlu değişkenleri doğrudan yerel CPU makine yazmaçlarına derleyerek en yüksek yürütme hızlarına ulaşır.

---

## Kullanıcı Tanımlı Tipler (`typedef`)

Tasarımcılar okunabilir, yeniden kullanılabilir tip takma adları oluşturabilir:

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## Numaralandırılmış Tipler (`enum`)

Numaralandırmalar donanım durumlarına sembolik adlar atayarak Sonlu Durum Makinesi (FSM) okunabilirliğini önemli ölçüde artırır:

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
Axiom'un Mikromimari Denetleyicisi, `enum` durum değişkenlerini otomatik olarak algılar ve FSM görselleştiricide etiketli durum baloncukları oluşturur.

---

## Yapılar (`struct`)

Yapılar ilgili sinyalleri tek bir adlandırılmış veri yapısında bir araya getirir:

```verilog
// Packed structure: contiguous bit-vector representation in hardware
typedef struct packed {
    logic [7:0]  opcode;
    logic [3:0]  reg_dest;
    logic [3:0]  reg_src1;
    logic [3:0]  reg_src2;
    logic [11:0] immediate;
} instruction_t; // Total 32 bits

instruction_t current_instr;
assign current_instr.opcode = 8'h01;
```
