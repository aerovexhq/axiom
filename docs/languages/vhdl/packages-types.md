# VHDL Packages & Standard Data Types

VHDL is a strongly-typed language. Operations between different types require explicit type conversions.

---

## Standard IEEE Libraries

Every synthesizable VHDL design includes standard IEEE packages:
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## Fundamental Data Types

### 1. `std_logic` and `std_logic_vector`
The universal 9-value logic type defined in `IEEE.std_logic_1164`:
- `'0'`: Forcing logic-low
- `'1'`: Forcing logic-high
- `'Z'`: High-impedance (tri-state)
- `'X'`: Uninitialized or contention unknown
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'`: Weak and uninitialized values

### 2. `signed` and `unsigned`
Defined in `IEEE.numeric_std` to represent numeric integer vectors:
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## Type Conversions

Because VHDL forbids implicit type coercion, designers use explicit conversion functions:

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
