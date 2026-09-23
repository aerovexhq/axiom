# 并行赋值与顺序进程

VHDL 严格区分**并行语句**（在进程块外部并行并发执行）与**顺序语句**（在 `process` 进程块内部按算法先后顺序依次执行）。

---

## 并行语句

并行语句用于在 `process` 进程块之外对并行硬件逻辑进行建模：

### 1. 简单信号赋值 (`<=`)
```vhdl
sum <= a xor b;
```

### 2. 条件信号赋值 (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. 选择信号赋值 (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## 顺序进程 (`process`)

`process` 进程块封装了顺序执行语句。每当其**敏感列表**中的任意信号发生变化时，进程都会被唤醒触发：

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

### 信号 (`<=`) 对比 变量 (`:=`)
- **信号 (`<=`)**：在仿真零时间 delta 周期 (δ周期) 末尾统一更新。代表物理电路中的实体导线连接。
- **变量 (`:=`)**：仅在进程局部声明，执行时立即求值更新。代表算法中的瞬态中间计算状态。

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
