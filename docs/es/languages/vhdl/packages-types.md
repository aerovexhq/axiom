# Paquetes y tipos de datos estándar en VHDL

VHDL es un lenguaje fuertemente tipado. Las operaciones entre diferentes tipos requieren conversiones de tipo explícitas.

---

## Bibliotecas estándar de IEEE

Cada diseño VHDL sintetizable incluye paquetes estándar de IEEE:
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## Tipos de datos fundamentales

### 1. `std_logic` y `std_logic_vector`
El tipo lógico universal de 9 valores definido en `IEEE.std_logic_1164`:
- `'0'`: Forzado a nivel bajo lógico
- `'1'`: Forzado a nivel alto lógico
- `'Z'`: Alta impedancia (tri-state)
- `'X'`: Desconocido no inicializado o por contención
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'`: Valores débiles y no inicializados

### 2. `signed` y `unsigned`
Definidos en `IEEE.numeric_std` para representar vectores enteros numéricos:
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## Conversiones de tipos

Debido a que VHDL prohíbe la coerción implícita de tipos, los diseñadores utilizan funciones de conversión explícitas:

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
