# VHDL-Pakete & Standard-Datentypen

VHDL ist eine streng typisierte Sprache. Operationen zwischen verschiedenen Typen erfordern explizite Typumwandlungen.

---

## Standard-IEEE-Bibliotheken

Jedes synthetisierbare VHDL-Design bindet Standard-IEEE-Pakete ein:
```vhdl
library IEEE;
use IEEE.std_logic_1164.all; -- Defines std_logic and std_logic_vector
use IEEE.numeric_std.all;    -- Defines signed, unsigned, and arithmetic operators
```

---

## Grundlegende Datentypen

### 1. `std_logic` und `std_logic_vector`
Der universelle 9-wertige Logiktyp, definiert in `IEEE.std_logic_1164`:
- `'0'`: Forciertes Logisch-Tief
- `'1'`: Forciertes Logisch-Hoch
- `'Z'`: Hochohmig (Tri-State)
- `'X'`: Nicht initialisiert oder Kollision unbekannt
- `'W'`, `'L'`, `'H'`, `'-'`, `'U'`: Schwache und nicht initialisierte Werte

### 2. `signed` und `unsigned`
Definiert in `IEEE.numeric_std` zur Darstellung numerischer Ganzzahl-Vektoren:
```vhdl
signal counter : unsigned(7 downto 0) := (others => '0');
signal delta_y : signed(15 downto 0);
```

---

## Typumwandlungen

Da VHDL implizite Typumwandlungen verbietet, verwenden Entwickler explizite Konvertierungsfunktionen:

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
