# VHDL Concurrent vs. Sequential Statements

VHDL strictly distinguishes between **Concurrent Statements** (which execute outside processes in parallel) and **Sequential Statements** (which execute inside `process` blocks in algorithmic order).

---

## Concurrent Statements

Concurrent statements model parallel hardware outside of `process` blocks:

### 1. Simple Signal Assignment (`<=`)
```vhdl
sum <= a xor b;
```

### 2. Conditional Signal Assignment (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. Selected Signal Assignment (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## Sequential Processes (`process`)

A `process` encapsulates sequential statements. It is triggered whenever any signal in its **sensitivity list** changes:

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

### Signals (`<=`) vs. Variables (`:=`)
- **Signals (`<=`)**: Updated at the end of the simulation delta cycle. Represents physical wiring.
- **Variables (`:=`)**: Declared locally inside a process; updated immediately. Represents transient computational state.

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
