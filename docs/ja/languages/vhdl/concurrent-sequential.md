# VHDL並行処理 vs. 逐次処理文

VHDLは、プロセスの外部で並列に実行される**並行処理文**と、`process` ブロック内でアルゴリズム順に実行される**逐次処理文**を厳密に区別します。

---

## 並行処理文

並行処理文は、`process` ブロックの外部で並列ハードウェアをモデル化します:

### 1. 単純信号代入 (`<=`)
```vhdl
sum <= a xor b;
```

### 2. 条件付き信号代入 (`when-else`)
```vhdl
mux_out <= in_1 when sel = '1' else in_0;
```

### 3. 選択的信号代入 (`with-select`)
```vhdl
with state_sel select
    alu_res <= a + b when "00",
               a - b when "01",
               a and b when "10",
               (others => '0') when others;
```

---

## 逐次プロセス (`process`)

`process` は逐次文をカプセル化します。その**感度リスト**内のいずれかの信号が変化するたびにトリガーされます:

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

### 信号 (`<=`) vs. 変数 (`:=`)
- **信号 (`<=`)**: シミュレーションのデルタサイクル終了時に更新されます。物理的な配線を表します。
- **変数 (`:=`)**: プロセス内でローカルに宣言され、即座に更新されます。一時的な計算状態を表します。

```vhdl
process(a, b, c)
    variable temp : std_logic_vector(7 downto 0);
begin
    temp   := a and b;   -- Updated immediately!
    result <= temp or c; -- Scheduled for next delta step
end process;
```
