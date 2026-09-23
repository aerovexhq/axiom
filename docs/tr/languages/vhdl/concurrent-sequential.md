# VHDL Eşzamanlı ve Sıralı İfadeler

VHDL, **Eşzamanlı İfadeler** (süreçlerin dışında paralel olarak yürütülür) ile **Sıralı İfadeler** (`process` blokları içinde algoritmik sırada yürütülür) arasında kesin bir ayrım yapar.

---

## Eşzamanlı İfadeler

Eşzamanlı ifadeler `process` bloklarının dışındaki paralel donanımı modeller:

### 1. Basit Sinyal Ataması (`<=`)
```vhdl
sum <= a xor b;
```

### 2. Koşullu Sinyal Ataması (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. Seçili Sinyal Ataması (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## Sıralı Süreçler (`process`)

Bir `process`, sıralı ifadeleri kapsüller. **Duyarlılık listesindeki** herhangi bir sinyal değiştiğinde tetiklenir:

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

### Sinyaller (`<=`) ve Değişkenler (`:=`)
- **Sinyaller (`<=`)**: Simülasyon delta döngüsünün sonunda güncellenir. Fiziksel kablolamayı temsil eder.
- **Değişkenler (`:=`)**: Bir sürecin içinde yerel olarak bildirilir; anında güncellenir. Geçici hesaplama durumunu temsil eder.

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
