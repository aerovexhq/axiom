# Verilog-Datentypen, Netze & Variablen

In Verilog HDL werden physische Hardwareverbindungen und Speicherelemente in zwei grundlegende Gruppen eingeteilt: **Netze** (physische elektrische Leitungen) und **Variablen** (verhaltensbezogener prozeduraler Speicher).

---

## Netz-Datentypen

Netze repräsentieren physische Verbindungen zwischen Hardware-Elementen. Sie speichern keine Logikwerte; ihr Wert wird kontinuierlich von ihren Treibern bestimmt.

### 1. `wire` und `tri`
Der primäre Netztyp, der physische Kupferbahnen darstellt. `wire` und `tri` sind in der Synthese funktional identisch und repräsentieren Standardverbindungsleitungen.

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. Signalstärken und Mehrfachtreiber-Kollision
Wenn mehrere aktive kontinuierliche Zuweisungen ein Standard-`wire` gleichzeitig mit widersprüchlichen Werten (`1` und `0`) treiben, wertet Axiom den Konflikt als unbekannt (`X`) aus und löst den Linter-Fehler `AXIOM_E002_MULTI_DRIVER_NET` aus.

---

## Variablen-Datentypen

Variablen behalten ihren Wert von einer prozeduralen Zuweisung zur nächsten bei.

### 1. `reg`
Die standardmäßige prozedurale Variable. Trotz ihres Namens synthetisiert ein `reg` nicht immer zu einem physischen Flipflop-Register; wird es innerhalb eines rein kombinatorischen Blocks (`always @*`) zugewiesen, synthetisiert es zu kombinatorischer Logik.

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

### 2. `integer` und `time`
- `integer`: Vorzeichenbehaftete 32-Bit-Variable, die häufig in `for`-Schleifen und Testbench-Iterationen verwendet wird.
- `time`: Vorzeichenlose 64-Bit-Variable zur Aufzeichnung von Simulationszeitstempeln über `$time`.

---

## Vektoren & indexierte Teilbereichsauswahlen

Vektoren repräsentieren Multi-Bit-Busse, die mit `[MSB:LSB]`-Bereichen deklariert werden:

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

## Entpackte Speicher-Arrays

Axiom unterstützt mehrdimensionale entpackte Arrays zur Modellierung von Registerdateien, Look-Up-Tabellen und SRAM-Speicherblöcken:

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

Die Synthese-Engine von Axiom erkennt entpackte synchrone Speicher automatisch und inferiert sie in Xilinx `RAMB18E2`- oder `RAMB36E2`-Hardware-Block-RAMs.

---

## Zahlenliterale mit expliziter Bitbreite

Verilog-Zahlen können als Dezimalzahlen ohne Größenangabe oder als Konstanten mit expliziten Basispräfixen angegeben werden:

$$\text{Format: } <\text{Größe}>'<\text{Basis}><\text{Wert}>$$

| Literal | Bitbreite | Basis | Wert |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | Binär | `0xAC` |
| `8'hFF` | 8 | Hexadezimal | `255` |
| `16'd1024` | 16 | Dezimal | `1024` |
| `4'o17` | 4 | Oktal | `15` |
| `'d50` | Ohne feste Größe (32) | Dezimal | `50` |
| `1'b1` | 1 | Binär | Logisch-Hoch |
