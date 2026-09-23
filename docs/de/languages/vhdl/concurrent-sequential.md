# VHDL Nebenläufige vs. Sequenzielle Anweisungen

VHDL unterscheidet strikt zwischen **Nebenläufigen Anweisungen** (die außerhalb von Prozessen parallel ausgeführt werden) und **Sequenziellen Anweisungen** (die innerhalb von `process`-Blöcken in algorithmischer Reihenfolge ausgeführt werden).

---

## Nebenläufige Anweisungen

Nebenläufige Anweisungen modellieren parallele Hardware außerhalb von `process`-Blöcken:

### 1. Einfache Signalzuweisung (`<=`)
```vhdl
sum <= a xor b;
```

### 2. Bedingte Signalzuweisung (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. Selektierte Signalzuweisung (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## Sequenzielle Prozesse (`process`)

Ein `process` kapselt sequenzielle Anweisungen. Er wird ausgelöst, sobald sich ein Signal in seiner **Sensitivitätsliste** ändert:

```vhdl
process(clk, rst_n)
begin
    if rst_n = '0' then
        reg_q <= (others => '0');
    elsif rising_edge(clk) then
        if enable = '1' then
            reg_q <= data_in;
        end if;
    end if;
end process;
```

### Signale (`<=`) vs. Variablen (`:=`)
- **Signale (`<=`)**: Werden am Ende des Simulations-Delta-Zyklus aktualisiert. Repräsentiert physische Leitungen.
- **Variablen (`:=`)**: Lokal innerhalb eines Prozesses deklariert; werden sofort aktualisiert. Repräsentiert transienten Rechenzustand.

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
