# Arène logique à 4 états

Les langages de description de matériel requièrent la sémantique complète de logique à 4 états IEEE 1800 :
- `0` : Niveau logique bas fort.
- `1` : Niveau logique haut fort.
- `X` : Niveau logique inconnu ou non initialisé (aléa ou conflit).
- `Z` : Haute impédance (équipotentielle flottante trois états).

Représenter naïvement les états logiques avec des énumérations 8 bits ou 32 bits détruit la localité du cache et empêche les opérations SIMD parallèles par bits.

---

## Encodage parallèle par bits à double vecteur

Axiom dispose toutes les équipotentielles du circuit dans une arène mémoire contiguë (`SimStateArena`) à l'aide d'une représentation binaire à double mot :

| Valeur logique | Bit `value` | Bit `mask` | Description |
| :--- | :---: | :---: | :--- |
| **`0`** | `0` | `0` | Niveau logique bas certain |
| **`1`** | `1` | `0` | Niveau logique haut certain |
| **`X`** | `0` | `1` | État inconnu / non initialisé |
| **`Z`** | `1` | `1` | Haute impédance / déconnecté |

### Disposition de la mémoire
- Blocs de mémoire continus alignés sur 64 bits pour `values: Box<[u64]>` et `masks: Box<[u64]>`.
- Une équipotentielle de 32 bits occupe le décalage $i$ dans les deux vecteurs.
- La lecture ou l'écriture d'une équipotentielle requiert un déréférencement de décalage de pointeur en $O(1)$.

### Opérations logiques bit à bit
Grâce aux vecteurs doubles, les opérations booléennes de logique à 4 états s'exécutent en parallèle sur les 64 bits simultanément :

```rust
// 4-State Bitwise AND:
// result_val  = val_a & val_b
// result_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a))

let res_val = val_a & val_b;
let res_mask = (mask_a & (val_b | mask_b)) | (mask_b & (val_a | mask_a));
```
Cela permet d'exécuter des milliers d'opérations sur les bits par cycle d'horloge du processeur hôte.
