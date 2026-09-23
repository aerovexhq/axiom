# Arena de estado de lógica de 4 estados

Los lenguajes de descripción de hardware requieren la semántica completa de lógica de 4 estados IEEE 1800:
- `0`: Nivel lógico bajo fuerte.
- `1`: Nivel lógico alto fuerte.
- `X`: Nivel lógico desconocido o no inicializado (riesgo o contención).
- `Z`: Alta impedancia (red flotante de tercer estado).

Representar ingenuamente los estados lógicos con enumeraciones de 8 o 32 bits destruye la localidad de caché e impide operaciones SIMD en paralelo de bits.

---

## Codificación bit a bit en paralelo de doble vector

Axiom organiza todas las redes del circuito en una arena de memoria contigua (`SimStateArena`) mediante una representación de doble palabra de bits:

| Valor lógico | Bit de `value` | Bit de `mask` | Descripción |
| :--- | :---: | :---: | :--- |
| **`0`** | `0` | `0` | Bajo lógico definido |
| **`1`** | `1` | `0` | Alto lógico definido |
| **`X`** | `0` | `1` | Estado desconocido / no inicializado |
| **`Z`** | `1` | `1` | Alta impedancia / desconectado |

### Disposición de memoria
- Bloques continuos de memoria alineados a 64 bits para `values: Box<[u64]>` y `masks: Box<[u64]>`.
- Una red de 32 bits ocupa el desplazamiento $i$ en ambos vectores.
- Leer o escribir una red requiere una desreferenciación de desplazamiento de puntero en $O(1)$.

### Operaciones lógicas bit a bit
Al utilizar vectores dobles, las operaciones booleanas de lógica de 4 estados se ejecutan en paralelo en los 64 bits simultáneamente:

```rust
// 4-State Bitwise AND:
// result_val  = val_a & val_b
// result_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a))

let res_val = val_a & val_b;
let res_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a));
```
Esto permite ejecutar miles de operaciones de bits por ciclo de reloj de la CPU del host.
