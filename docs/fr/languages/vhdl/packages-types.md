# Paquets VHDL et types de données standards

VHDL est un langage fortement typé. Les opérations entre différents types nécessitent des conversions de type explicites.

---

## Bibliothèques IEEE standards

Toute conception VHDL synthétisable inclut les paquets IEEE standards :
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## Types de données fondamentaux

### 1. `std_logic` et `std_logic_vector`
Le type logique universel à 9 états défini dans `IEEE.std_logic_1164` :
- `'0'` : Niveau bas logique forcé
- `'1'` : Niveau haut logique forcé
- `'Z'` : Haute impédance (trois états)
- `'X'` : État inconnu non initialisé ou conflit
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'` : Valeurs faibles et non initialisées

### 2. `signed` et `unsigned`
Défini dans `IEEE.numeric_std` pour représenter des vecteurs d'entiers numériques :
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## Conversions de type

Comme VHDL interdit la coercition de type implicite, les concepteurs utilisent des fonctions de conversion explicites :

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
