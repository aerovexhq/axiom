# 4-Zustands-Logikarena

Hardware-Beschreibungssprachen erfordern eine vollständige IEEE 1800 4-Zustands-Logik-Semantik:
- `0`: Starker logischer Tiefpegel.
- `1`: Starker logischer Hochpegel.
- `X`: Unbekannter oder nicht initialisierter Logikpegel (Hazard oder Kollision).
- `Z`: Hochohmig (hochohmiges, unbeschaltetes Tri-State-Netz).

Eine naive Darstellung von Logikzuständen mit 8-Bit- oder 32-Bit-Enums zerstört die Cache-Lokalität und verhindert bitparallele SIMD-Operationen.

---

## Bit-parallele Doppel-Vektor-Kodierung

Axiom ordnet alle Schaltkreisnetze in einer zusammenhängenden Speicherarena (`SimStateArena`) unter Verwendung einer Doppelwort-Bit-Darstellung an:

| Logikwert | `value`-Bit | `mask`-Bit | Beschreibung |
| :--- | :---: | :---: | :--- |
| **`0`** | `0` | `0` | Sicheres Logisch-Tief (0) |
| **`1`** | `1` | `0` | Sicheres Logisch-Hoch (1) |
| **`X`** | `0` | `1` | Unbekannter / nicht initialisierter Zustand |
| **`Z`** | `1` | `1` | Hochohmig / nicht verbunden |

### Speicher-Layout
- Fortlaufende 64-Bit-ausgerichtete Speicherblöcke für `values: Box<[u64]>` und `masks: Box<[u64]>`.
- Ein 32-Bit-Netz belegt den Offset $i$ in beiden Vektoren.
- Das Lesen oder Schreiben eines Netzes erfordert eine Zeiger-Offset-Dereferenzierung in $O(1)$.

### Bitweise Logikoperationen
Durch die Verwendung von Doppelvektoren werden boolesche 4-Zustands-Operationen parallel über alle 64 Bits gleichzeitig ausgeführt:

```rust
// 4-State Bitwise AND:
// result_val  = val_a & val_b
// result_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a))

let res_val = val_a & val_b;
let res_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a));
```
Dies ermöglicht die Ausführung von Tausenden von Bitoperationen pro Taktzyklus der Host-CPU.
