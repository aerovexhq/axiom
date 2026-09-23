# VHDLパッケージ＆標準データ型

VHDLは強い型付けを持つ言語です。異なる型間の演算には明示的な型変換が必要です。

---

## 標準IEEEライブラリ

論理合成可能なすべてのVHDL設計には、標準のIEEEパッケージが含まれます:
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## 基本データ型

### 1. `std_logic` および `std_logic_vector`
`IEEE.std_logic_1164` で定義されている汎用9値論理型:
- `'0'`: 強制Low論理レベル
- `'1'`: 強制High論理レベル
- `'Z'`: 高インピーダンス (トライステート)
- `'X'`: 未初期化または競合による不定値
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'`: 弱信号および未初期化値

### 2. `signed` および `unsigned`
数値整数ベクターを表すために `IEEE.numeric_std` で定義されています:
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## 型変換

VHDLでは暗黙的な型変換が禁止されているため、設計者は明示的な変換関数を使用します:

```
+-------------------------------------------------------------------------------+
| VHDL Type Conversion Map (numeric_std)                                        |
+-------------------------------------------------------------------------------+
|  std_logic_vector(7 downto 0)                                                 |
|        ^                       \                                              |
|        | std_logic_vector(...)  \ unsigned(...)                               |
|        v                         v                                            |
|   unsigned(7 downto 0) --------> to_integer(...) ------> integer              |
|        ^               to_unsigned(int, 8)                |                   |
|        |                                                  |                   |
|        +--------------------------------------------------+                   |
+-------------------------------------------------------------------------------+
```

```vhdl
signal slv_bus : std_logic_vector(7 downto 0);
signal u_val   : unsigned(7 downto 0);
signal int_val : integer;

-- Convert std_logic_vector to unsigned
u_val <= unsigned(slv_bus);

-- Convert unsigned to integer
int_val <= to_integer(u_val);

-- Convert integer back to std_logic_vector
slv_bus <= std_logic_vector(to_unsigned(int_val, 8));
```
