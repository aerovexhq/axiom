# Instructions concurrentes vs séquentielles en VHDL

VHDL distingue rigoureusement les **instructions concurrentes** (qui s'exécutent en parallèle en dehors des processus) des **instructions séquentielles** (qui s'exécutent dans l'ordre algorithmique à l'intérieur des blocs `process`).

---

## Instructions concurrentes

Les instructions concurrentes modélisent le matériel parallèle en dehors des blocs `process` :

### 1. Assignation de signal simple (`<=`)
```vhdl
sum <= a xor b;
```

### 2. Assignation conditionnelle de signal (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. Assignation sélective de signal (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## Processus séquentiels (`process`)

Un `process` encapsule des instructions séquentielles. Il est déclenché dès qu'un signal de sa **liste de sensibilité** change :

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

### Signaux (`<=`) vs Variables (`:=`)
- **Signaux (`<=`)** : Mis à jour à la fin du cycle delta de simulation. Représente le câblage physique.
- **Variables (`:=`)** : Déclarées localement à l'intérieur d'un processus ; mises à jour immédiatement. Représente l'état transitoire de calcul.

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
