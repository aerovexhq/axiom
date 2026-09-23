# VHDL Paketleri ve Standart Veri Tipleri

VHDL güçlü tipli bir dildir. Farklı tipler arasındaki işlemler açık tip dönüşümleri gerektirir.

---

## Standart IEEE Kütüphaneleri

Her sentezlenebilir VHDL tasarımı standart IEEE paketlerini içerir:
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## Temel Veri Tipleri

### 1. `std_logic` ve `std_logic_vector`
`IEEE.std_logic_1164` içinde tanımlanan evrensel 9 değerli mantık tipi:
- `'0'`: Zorlamalı mantık düşük
- `'1'`: Zorlamalı mantık yüksek
- `'Z'`: Yüksek empedans (üç durumlu)
- `'X'`: Başlatılmamış veya çatışma bilinmeyeni
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'`: Zayıf ve başlatılmamış değerler

### 2. `signed` ve `unsigned`
Sayısal tamsayı vektörlerini temsil etmek için `IEEE.numeric_std` içinde tanımlanmıştır:
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## Tip Dönüşümleri

VHDL örtük tip zorlamasını yasakladığından, tasarımcılar açık dönüşüm fonksiyonları kullanır:

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
