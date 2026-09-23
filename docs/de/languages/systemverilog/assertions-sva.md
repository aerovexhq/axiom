# SystemVerilog-Assertionen (SVA) & Formale Verifikation

SystemVerilog-Assertionen (SVA) spezifizieren erwartetes Verhalten und temporale Protokolle mathematisch. Axiom EDA integriert SVA in seinen integrierten Bounded Model Checker (`crates/sim/src/formal/`), wodurch Eigenschaften während der transienten Simulation verifiziert oder für alle Zeiten formal bewiesen werden können.

---

## Sofortige vs. Nebenläufige Assertionen

### 1. Sofortige Assertionen (Immediate Assertions)
Ausgewertet als prozedurale Anweisungen in einem einzelnen Simulationszeitschritt:

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. Nebenläufige Assertionen (Concurrent Assertions)
Synchron an Taktflanken über temporale Sequenzen von Zyklen abgetastet:

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## Temporale Sequenzen & Operatoren

| Operator | Syntax | Beschreibung |
| :--- | :--- | :--- |
| **Taktverzögerung** | `##n` | Exakt $n$ Taktzyklen später |
| **Begrenzter Bereich** | `##[min:max]` | Zwischen $min$ und $max$ Taktzyklen später |
| **Aufeinanderfolgende Wiederholung** | `expr [*n]` | Ausdruck bleibt für $n$ aufeinanderfolgende Zyklen wahr |
| **Überlappende Implikation** | `ante \ | -> cons` | Wenn Antezedenz gilt, muss Konsequenz im **selben** Zyklus gelten |
| **Nicht-überlappende Implikation** | `ante \ | => cons` | Wenn Antezedenz gilt, muss Konsequenz im **nächsten** Zyklus gelten |
| **Systemfunktion** | `$rose(signal)` | Wertet zu wahr aus bei einer 0-zu-1 steigenden Flanke |
| **Systemfunktion** | `$fell(signal)` | Wertet zu wahr aus bei einer 1-zu-0 fallenden Flanke |
| **Systemfunktion** | `$stable(signal)` | Wertet zu wahr aus, wenn der Signalwert seit dem vorherigen Zyklus unverändert ist |

---

## Verifikations-Direktiven: `assert`, `assume`, `cover`

- **`assert property`**: Beweist, dass die Designlogik die Eigenschaft niemals verletzt. Verletzungen erzeugen Gegenbeispiel-Traces in Axioms Formal Studio.
- **`assume property`**: Beschränkt Primäreingänge während des formalen Bounded Model Checking auf gültige Betriebsumgebungen.
- **`cover property`**: Beweist, dass ein funktionaler Zielzustand erreichbar ist, und erzeugt Zeugen-Ausführungs-Traces.
