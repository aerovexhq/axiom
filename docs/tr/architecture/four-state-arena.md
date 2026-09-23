# 4 Durumlu Mantık Arenası

Donanım Tanımlama Dilleri tam IEEE 1800 4 durumlu mantık anlambilimi gerektirir:
- `0`: Güçlü lojik düşük seviye.
- `1`: Güçlü lojik yüksek seviye.
- `X`: Bilinmeyen veya başlatılmamış lojik seviye (tehlike veya çekişme).
- `Z`: Yüksek empedans (üç durumlu yüzen hat).

Lojik durumları 8-bit veya 32-bit enum yapılarıyla safça temsil etmek önbellek yerelliğini yok eder ve bit-paralel SIMD işlemlerini engeller.

---

## Çift Vektörlü Bit-Paralel Kodlama

Axiom, çift kelimelik bit gösterimi kullanarak tüm devre hatlarını bitişik bir bellek arenasında (`SimStateArena`) yerleştirir:

| Mantık Değeri | `value` Biti | `mask` Biti | Açıklama |
| :--- | :---: | :---: | :--- |
| **`0`** | `0` | `0` | Kesin mantık sıfır (düşük) |
| **`1`** | `1` | `0` | Kesin mantık bir (yüksek) |
| **`X`** | `0` | `1` | Bilinmeyen / başlatılmamış durum |
| **`Z`** | `1` | `1` | Yüksek empedans / bağlantısız |

### Bellek Düzeni
- `values: Box<[u64]>` ve `masks: Box<[u64]>` için bitişik 64-bit hizalı bellek blokları.
- 32-bitlik bir hat her iki vektörde de $i$ ofsetini kaplar.
- Bir hattı okumak veya yazmak $O(1)$ işaretçi ofseti erişimi gerektirir.

### Bit Düzeyinde Mantık İşlemleri
Çift vektörler kullanılarak, 4 durumlu Boole işlemleri 64 bitin tamamında aynı anda paralel olarak yürütülür:

```rust
// 4-State Bitwise AND:
// result_val  = val_a & val_b
// result_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a))

let res_val = val_a & val_b;
let res_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a));
```
Bu, ana bilgisayar CPU saat döngüsü başına binlerce bit işleminin yürütülmesini sağlar.
