# 4-State Logic State Arena

Hardware Description Languages require full IEEE 1800 4-state logic semantics:
- `0`: Strong low logic level.
- `1`: Strong high logic level.
- `X`: Unknown or uninitialized logic level (hazard or contention).
- `Z`: High impedance (tri-state floating net).

Naively representing logic states with 8-bit or 32-bit enums destroys cache locality and prevents bit-parallel SIMD operations.

---

## Dual-Vector Bit-Parallel Encoding

Axiom lays out all circuit nets in a contiguous memory arena (`SimStateArena`) using a dual-word bit representation:

| Logic Value | `value` Bit | `mask` Bit | Description |
| :--- | :---: | :---: | :--- |
| **`0`** | `0` | `0` | Definite logic low |
| **`1`** | `1` | `0` | Definite logic high |
| **`X`** | `0` | `1` | Unknown / uninitialized state |
| **`Z`** | `1` | `1` | High impedance / disconnected |

### Memory Layout
- Continuous 64-bit aligned memory blocks for `values: Box<[u64]>` and `masks: Box<[u64]>`.
- A 32-bit net occupies offset $i$ in both vectors.
- Reading or writing a net requires an $O(1)$ pointer offset dereference.

### Bitwise Logic Operations
By using dual vectors, 4-state Boolean operations execute in parallel across all 64 bits simultaneously:

```rust
// 4-State Bitwise AND:
// result_val  = val_a & val_b
// result_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a))

let res_val = val_a & val_b;
let res_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a));
```
This enables thousands of bit operations to execute per host CPU clock cycle.
