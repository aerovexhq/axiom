# Spezialisierte prozedurale Blöcke (`always_comb`, `always_ff`, `always_latch`)

Im klassischen Verilog wurde das generische Schlüsselwort `always` für kombinatorische Logik, getaktete Register und Latches verwendet, was zu subtilen Designfehlern führte, wenn Sensitivitätslisten unvollständig waren oder Zweige weggelassen wurden. SystemVerilog führt explizite prozedurale Blöcke ein, die die Designabsicht durchsetzen.

---

## `always_comb` (Kombinatorische Logik)

`always_comb` deklariert explizit einen kombinatorischen Prozess:
- **Automatische Sensitivität**: Entwickler schreiben nicht mehr `@*` oder Eingangslisten. Der Simulator inferiert automatisch die vollständige Sensitivitätsliste aller gelesenen Variablen.
- **Sofortige Auswertung beim Start**: Wird automatisch zur Simulationszeit $t=0$ ausgeführt, um sicherzustellen, dass die Ausgänge vor der ersten Taktflanke gültig sind.
- **Strikte Latch-Vermeidung**: Der Linter von Axiom gibt einen Fehler aus, wenn ein `always_comb`-Block aufgrund unvollständiger Zweige einen transparenten Latch inferiert.

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

## `always_ff` (Getaktete sequenzielle Logik)

`always_ff` modelliert flankengesteuerte Register und Flipflops:
- Muss eine flankengesteuerte Sensitivitätsliste besitzen (`@(posedge clk)` oder `@(posedge clk or negedge rst_n)`).
- Darf keine blockierenden Zuweisungen (`=`) für sequenzielle Zustandsregister enthalten.
- Verbietet mehrere Takte oder Null-Verzögerungs-Schleifen.

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

## `always_latch` (Pegelgesteuerte Latches)

Wenn ein asynchroner, pegelgesteuerter Latch tatsächlich beabsichtigt ist (z. B. in Low-Power-Clock-Gating-Zellen):

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
Durch die Isolation von Latches in expliziten `always_latch`-Blöcken eliminieren Entwickler unbeabsichtigte Latch-Inferenzen in ihren primären RTL-Modulen.
