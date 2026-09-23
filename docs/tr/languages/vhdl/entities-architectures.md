# VHDL Varlıkları ve Mimarileri

VHDL'de donanım modülleri kesin olarak iki ayrı bildirime ayrılır: **Entity (Varlık)** (harici G/Ç arayüzünü tanımlar) ve **Architecture (Mimari)** (dahili uygulamayı tanımlar).

---

## Varlık Bildirimleri (`entity`)

Varlık, jenerik parametreler ve port pinleri dahil olmak üzere donanım modülünün birincil arayüzünü tanımlar:

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

## Mimari Gövdeleri (`architecture`)

Mimari, varlığın dahili davranışını veya yapısal netlistini açıklar:

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

## Yapısal Bileşen Örneklendirme

VHDL, yapısal bileşen bildirimleri ve port eşlemeleri aracılığıyla hiyerarşik tasarımı destekler:

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
