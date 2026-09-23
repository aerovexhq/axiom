# 标准程序包与数据类型

VHDL 是一门强类型语言。不同类型之间的算术与逻辑运算必须经过显式类型转换。

---

## 标准 IEEE 库

每个可综合的 VHDL 设计通常都会包含以下标准 IEEE 程序包：
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## 基本核心数据类型

### 1. `std_logic` 与 `std_logic_vector`
`IEEE.std_logic_1164` 中定义的通用 9 态逻辑类型：
- `'0'`：强驱动低电平
- `'1'`：强驱动高电平
- `'Z'`：高阻态（三态悬空）
- `'X'`：未初始化或总线冲突未知态
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'`：弱电平与未定义值

### 2. `signed` 与 `unsigned`
在 `IEEE.numeric_std` 中定义，用于表示数值整数矢量：
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## 显式类型转换

由于 VHDL 严禁隐式类型强制转换，设计者需要使用显式类型转换函数：

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
