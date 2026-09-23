# 实体 (Entity) 与架构 (Architecture)

在 VHDL 中，硬件模块被严格解耦为两个独立的声明部分：**实体 (Entity)**（定义外部 I/O 接口规格）与**架构 (Architecture)**（定义内部逻辑具体实现）。

---

## 实体声明 (`entity`)

实体定义了硬件模块的外部顶层接口，包括参数化泛型 (generic) 与端口引脚 (port)：

```vhdl
library IEEE;
use IEEE.std_logic_1164.all;
use IEEE.numeric_std.all;

entity alu_8bit is
    generic (
        DATA_WIDTH : integer := 8
    );
    port (
        clk     : in  std_logic;
        rst_n   : in  std_logic;
        op_sel  : in  std_logic_vector(2 downto 0);
        a_in    : in  std_logic_vector(DATA_WIDTH-1 downto 0);
        b_in    : in  std_logic_vector(DATA_WIDTH-1 downto 0);
        res_out : out std_logic_vector(DATA_WIDTH-1 downto 0);
        zero    : out std_logic
    );
end entity alu_8bit;
```

---

## 架构体实现 (`architecture`)

架构体描述了实体的内部行为逻辑、数据流或结构化网表连接：

```vhdl
architecture behavioral of alu_8bit is
    -- Declarative region: internal signals and constants
    signal internal_res : unsigned(DATA_WIDTH-1 downto 0);
begin
    -- Concurrent statement region

    process(clk, rst_n)
    begin
        if rst_n = '0' then
            internal_res <= (others => '0');
        elsif rising_edge(clk) then
            case op_sel is
                when "000" => internal_res <= unsigned(a_in) + unsigned(b_in);
                when "001" => internal_res <= unsigned(a_in) - unsigned(b_in);
                when "010" => internal_res <= unsigned(a_in and b_in);
                when "011" => internal_res <= unsigned(a_in or b_in);
                when others => internal_res <= (others => '0');
            end case;
        end if;
    end process;

    -- Output signal assignments
    res_out <= std_logic_vector(internal_res);
    zero    <= '1' when internal_res = 0 else '0';

end architecture behavioral;
```

---

## 结构化组件例化

VHDL 通过结构化组件声明 (component) 与端口映射 (port map) 支持模块层次化设计：

```vhdl
architecture structural of full_adder is
    component half_adder is
        port (
            a, b     : in  std_logic;
            sum, cy  : out std_logic
        );
    end component half_adder;

    signal s1, c1, c2 : std_logic;
begin
    ha1: half_adder port map (a => a, b => b, sum => s1, cy => c1);
    ha2: half_adder port map (a => s1, b => cin, sum => sum, cy => c2);
    cout <= c1 or c2;
end architecture structural;
```
