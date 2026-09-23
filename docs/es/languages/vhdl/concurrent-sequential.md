# Sentencias concurrentes frente a secuenciales en VHDL

VHDL distingue estrictamente entre **Sentencias concurrentes** (que se ejecutan fuera de los procesos en paralelo) y **Sentencias secuenciales** (que se ejecutan dentro de bloques `process` en orden algorítmico).

---

## Sentencias concurrentes

Las sentencias concurrentes modelan hardware paralelo fuera de los bloques `process`:

### 1. Asignación simple de señal (`<=`)
```vhdl
sum <= a xor b;
```

### 2. Asignación condicional de señal (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. Asignación seleccionada de señal (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## Procesos secuenciales (`process`)

Un `process` encapsula sentencias secuenciales. Se activa cada vez que cambia cualquier señal en su **lista de sensibilidad**:

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

### Señales (`<=`) frente a variables (`:=`)
- **Señales (`<=`)**: Se actualizan al final del ciclo delta de simulación. Representan cableado físico.
- **Variables (`:=`)**: Se declaran localmente dentro de un proceso; se actualizan de inmediato. Representan un estado computacional transitorio.

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
