# SystemVerilog-Datentypen & Deklarationen

SystemVerilog modernisiert die Hardware-Modellierung, indem es die verwirrende Dichotomie zwischen `wire` und `reg` im klassischen Verilog aufhebt und benutzerdefinierte Typen, Strukturen und Aufzählungen einführt.

---

## Der universelle `logic`-Typ

Im klassischen Verilog mussten Entwickler ständig zwischen `wire` (für kontinuierliche Zuweisungen) und `reg` (für prozedurale Blöcke) wählen. SystemVerilog löst dies mit dem 4-Zustands-Typ `logic`:

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
*Hinweis: Ein `logic`-Netz darf maximal einen kontinuierlichen Treiber besitzen. Wenn Wired-OR- oder Wired-AND-Busse mit mehreren Treibern erforderlich sind, wird standardmäßiges `wire` verwendet.*

---

## 2-Zustands-Datentypen

Für hochperformante Simulationen und Testbench-Modellierungen, bei denen hochohmige (`Z`) und unbekannte (`X`) Zustände nicht benötigt werden, führt SystemVerilog 2-Zustands-Typen ein:

| Typ | Bitbreite | Vorzeichen | Werte |
| :--- | :--- | :--- | :--- |
| `bit` | 1-Bit | Vorzeichenlos | `0`, `1` |
| `byte` | 8-Bit | Vorzeichenbehaftet | `-128` bis `127` |
| `shortint` | 16-Bit | Vorzeichenbehaftet | `-32.768` bis `32.767` |
| `int` | 32-Bit | Vorzeichenbehaftet | Standard-32-Bit-Ganzzahl |
| `longint` | 64-Bit | Vorzeichenbehaftet | Standard-64-Bit-Ganzzahl |

Axiom kompiliert 2-Zustands-Variablen direkt in native CPU-Maschinenregister und erreicht so maximale Ausführungsgeschwindigkeiten.

---

## Benutzerdefinierte Typen (`typedef`)

Entwickler können lesbare, wiederverwendbare Typ-Aliase erstellen:

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## Aufzählungstypen (`enum`)

Aufzählungen weisen Hardware-Zuständen symbolische Namen zu und verbessern die Lesbarkeit von Zustandsautomaten (FSMs) erheblich:

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
Der Mikroarchitektur-Inspektor von Axiom erkennt `enum`-Zustandsvariablen automatisch und rendert beschriftete Zustandsblasen im FSM-Visualisierer.

---

## Strukturen (`struct`)

Strukturen bündeln zusammengehörige Signale in einer einzigen benannten Datenstruktur:

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
