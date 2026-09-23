# Bloc logique configurable (CLB) et primitives logiques

Les blocs logiques configurables contiennent les tables de correspondance (LUT), la logique de retenue et les éléments de stockage séquentiels au cœur des FPGA Xilinx.

---

## Tables de correspondance (`LUT1` à `LUT6`, `LUT6_2`)

### 1. `LUT6_2` (LUT à 6 entrées et double sortie)
La base des CLB modernes de Xilinx. Elle peut implémenter n'importe quelle fonction booléenne à 6 entrées (`O6`), ou deux fonctions booléennes distinctes à 5 entrées partageant les entrées `I0` à `I4` (`O5` et `O6`) :

```verilog
LUT6_2 #(
    .INIT(64'h8000_0000_0000_0000) // 6-input AND gate
) u_lut (
    .O6 (and_out),
    .O5 (), // Unused in single-output mode
    .I0 (in0), .I1 (in1), .I2 (in2),
    .I3 (in3), .I4 (in4), .I5 (in5)
);
```

---

## Logique de retenue rapide (`CARRY4`, `CARRY8`)

Des chaînes de retenue rapide dédiées implémentent des additionneurs et accumulateurs haute vitesse sans router les signaux de retenue via l'interconnexion générale plus lente :
- **`CARRY4` (Série 7)** : Macro de retenue anticipée 4 bits avec propagation (`S[3:0]`), génération (`DI[3:0]`), retenue entrante (`CI`) et retenues sortantes (`CO[3:0]`, `O[3:0]`).
- **`CARRY8` (UltraScale+)** : Macro de retenue anticipée 8 bits offrant une densité de retenue double par tranche de CLB.

---

## Bascules et verrous (`FDRE`, `FDSE`, `FDCE`, `FDPE`)

Les registres de tranches Xilinx prennent en charge les validations d'horloge dédiées et les mises à 1/0 prioritaires :

| Primitive | Déclenchement | Type de réinitialisation | Priorité | Description |
| :--- | :--- | :--- | :--- | :--- |
| `FDRE` | `posedge C` | Réinitialisation synchrone (`R`) | Priorité à la réinitialisation | Bascule D avec validation d'horloge (`CE`) et réinitialisation synchrone |
| `FDSE` | `posedge C` | Mise à 1 synchrone (`S`) | Priorité à la mise à 1 | Bascule D avec validation d'horloge (`CE`) et mise à 1 synchrone |
| `FDCE` | `posedge C` | Effacement asynchrone (`CLR`) | Priorité à l'effacement | Bascule D avec validation d'horloge (`CE`) et effacement asynchrone |
| `FDPE` | `posedge C` | Préréglage asynchrone (`PRE`) | Priorité au préréglage | Bascule D avec validation d'horloge (`CE`) et préréglage asynchrone |

```verilog
FDRE #(
    .INIT(1'b0) // Power-on initial value
) u_ff (
    .Q  (q_out),
    .C  (clk),
    .CE (clk_en),
    .R  (sync_rst),
    .D  (d_in)
);
```
