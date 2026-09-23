# Verilog-Ablaufsteuerungs-Anweisungen

Prozedurale Ablaufsteuerungsanweisungen (`if-else`, `case` und Schleifen) ermöglichen Entwicklern den Ausdruck komplexer Entscheidungsbäume, Bedingungsprioritäts-Encodern und Zustandsübergangslogik innerhalb prozeduraler Blöcke.

---

## Bedingte Anweisungen (`if-else`)

Die `if-else`-Anweisung wertet boolesche Bedingungen in Prioritätsreihenfolge aus:

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

### Das unbeabsichtigte Latch-Hazard-Risiko
Wenn in einem kombinatorischen Prozess eine Variable in einem `if`-Zweig zugewiesen, im `else`-Zweig jedoch weggelassen wird, muss die Hardware ihren vorherigen Wert beibehalten, wenn die Bedingung falsch ist. Dies zwingt Synthese-Tools, einen **transparenten pegelgesteuerten Latch** zu inferieren.
- Der Linter von Axiom gibt die Warnung `AXIOM_W006_TRANSPARENT_LATCH` aus, sobald ein unvollständiger Zweig in kombinatorischen Blöcken erkannt wird.

---

## Mehrfachverzweigungen (`case`, `casez`, `casex`)

### 1. Standard `case`
Vergleicht den Selektorausdruck mit den Werten der Case-Elemente:

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
- Der Linter von Axiom gibt `AXIOM_W007_MISSING_DEFAULT` aus, wenn eine `case`-Anweisung den `default:`-Zweig auslässt.

### 2. `casez` (Don't-Care Bit-Abgleich)
Behandelt `?`- oder `z`-Bits in Case-Ausdrücken als Don't-Care-Werte. Ideal für Adressdecoder und Prioritäts-Encoder:

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

## Prozedurale Schleifen (`for`, `while`, `repeat`, `forever`)

Schleifen innerhalb synthetisierbarer Hardware entrollen sich in parallele räumliche Logik:

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

Im Testbench-Code modellieren `repeat`- und `forever`-Schleifen wiederkehrende Taktsequenzen:
```verilog
initial begin
    // Repeat pulse train 5 times
    repeat (5) begin
        #10 strobe = 1;
        #10 strobe = 0;
    end
end
```
