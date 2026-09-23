# Blocs procéduraux spécialisés (`always_comb`, `always_ff`, `always_latch`)

En Verilog classique, le mot-clé générique `always` était utilisé indistinctement pour la logique combinatoire, les registres cadencés et les verrous, conduisant à des erreurs subtiles en cas de listes de sensibilité incomplètes ou de branches omises. SystemVerilog introduit des blocs procéduraux explicites garantissant l'intention de conception.

---

## `always_comb` (Logique combinatoire)

`always_comb` déclare explicitement un processus combinatoire :
- **Sensibilité automatique** : Les concepteurs n'ont plus besoin d'écrire `@*` ou d'énumérer les entrées. Le simulateur infère automatiquement la liste complète de sensibilité de toutes les variables lues.
- **Évaluation immédiate au démarrage** : S'exécute automatiquement au temps de simulation $t=0$ pour s'assurer que les sorties sont valides avant le premier front d'horloge.
- **Prévention stricte des verrous** : Le linter d'Axiom signale une erreur si un bloc `always_comb` infère un verrou transparent en raison de branches incomplètes.

```verilog
always_comb begin
    case (alu_op)
        4'b0000: alu_result = operand_a + operand_b;
        4'b0001: alu_result = operand_a - operand_b;
        4'b0010: alu_result = operand_a & operand_b;
        4'b0011: alu_result = operand_a | operand_b;
        default: alu_result = 32'd0;
    endcase
end
```

---

## `always_ff` (Logique séquentielle cadencée)

`always_ff` modélise les registres et bascules déclenchés sur front :
- Doit posséder une liste de sensibilité déclenchée sur front (`@(posedge clk)` ou `@(posedge clk or negedge rst_n)`).
- Ne peut pas contenir d'assignations bloquantes (`=`) pour les registres d'état séquentiels.
- Interdit les horloges multiples ou les boucles à délai nul.

```verilog
always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        q_reg <= 16'h0000;
    end else if (enable) begin
        q_reg <= d_in;
    end
end
```

---

## `always_latch` (Verrous sensibles au niveau)

Lorsqu'un verrou asynchrone sensible au niveau est réellement souhaité (ex. dans des cellules de gating d'horloge basse consommation) :

```verilog
always_latch begin
    if (gate_enable)
        latched_val <= data_in;
end
```
En isolant les verrous dans des blocs `always_latch` explicites, les concepteurs éliminent toute inférence involontaire de verrous dans leurs modules RTL principaux.
