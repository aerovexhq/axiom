# Assertions SystemVerilog (SVA) et vérification formelle

Les assertions SystemVerilog (SVA) spécifient mathématiquement les comportements attendus et les protocoles temporels. Axiom EDA intègre SVA avec son vérificateur de modèles bornés (BMC) intégré (`crates/sim/src/formal/`), permettant de vérifier les propriétés en simulation transitoire ou de les prouver formellement pour tous les cycles.

---

## Assertions immédiates vs concurrentes

### 1. Assertions immédiates
Évaluées comme des instructions procédurales à un pas de temps de simulation unique :

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. Assertions concurrentes
Échantillonnées de manière synchrone sur les fronts d'horloge au cours de séquences temporelles de cycles :

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## Séquences temporelles et opérateurs

| Opérateur | Syntaxe | Description |
| :--- | :--- | :--- |
| **Délai de cycle** | `##n` | Exactement $n$ cycles d'horloge plus tard |
| **Plage bornée** | `##[min:max]` | Entre $min$ et $max$ cycles d'horloge plus tard |
| **Répétition consécutive** | `expr [*n]` | L'expression est vraie pendant $n$ cycles consécutifs |
| **Implication avec chevauchement** | `ante \ | -> cons` | Si l'antécédent est vrai, le conséquent doit être vrai dans le **même** cycle |
| **Implication sans chevauchement** | `ante \ | => cons` | Si l'antécédent est vrai, le conséquent doit être vrai dans le cycle **suivant** |
| **Fonction système** | `$rose(signal)` | Évalué à vrai lors d'une transition de front montant 0 vers 1 |
| **Fonction système** | `$fell(signal)` | Évalué à vrai lors d'une transition de front descendant 1 vers 0 |
| **Fonction système** | `$stable(signal)` | Évalué à vrai si la valeur du signal est inchangée depuis le cycle précédent |

---

## Directives de vérification : `assert`, `assume`, `cover`

- **`assert property`** : Prouve que la logique de conception ne viole jamais la propriété. Les violations génèrent des contre-exemples de traces dans le Formal Studio d'Axiom.
- **`assume property`** : Restreint les entrées primaires aux environnements opérationnels valides pendant la vérification formelle de modèles bornés (BMC).
- **`cover property`** : Prouve qu'un état fonctionnel cible est atteignable, générant des traces d'exécution témoins.
