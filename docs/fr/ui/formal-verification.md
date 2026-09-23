# Studio de vérification formelle de propriétés (FPV)

Axiom EDA intègre une suite de vérification formelle avec vérificateur de modèles bornés (BMC) et $k$-induction (`crates/sim/src/formal/`, `FormalVerificationViewer.tsx`). Plutôt que de s'en remettre uniquement à des vecteurs de test pseudo-aléatoires susceptibles de manquer des cas limites obscurs, la vérification formelle prouve ou réfute mathématiquement les assertions SystemVerilog (SVA) sur tous les scénarios d'entrée possibles.

---

## Vérification de modèles bornés et k-induction

```
+-------------------------------------------------------------------------------+
| Formal Verification Studio: Bound Depth K = 20 | Mode: k-Induction           |
| Proven: 8 | Falsified: 1 (Counterexample) | Witnessed: 4 | Inconclusive: 0    |
+-------------------------------------------------------------------------------+
| Verification Goals:                                                           |
| Status    | Goal Name           | Type   | Bound | Time (ms) | Trace          |
|-----------+---------------------+--------+-------+-----------+----------------|
| [PROVEN]  | p_fifo_no_overflow  | assert | K=20  | 14.2 ms   | -              |
| [PROVEN]  | p_fsm_legal_state   | assert | K=20  |  8.1 ms   | -              |
| [FALSIFY] | p_ack_within_4_cyc  | assert | K=12  | 24.8 ms   | [View Trace]   |
| [WITNESS] | c_fifo_full_reached | cover  | K=8   |  5.3 ms   | [View Trace]   |
+-------------------------------------------------------------------------------+
```

### 1. Vérification de modèles bornés (BMC)
Le BMC déroule la relation de transition d'état matériel sur $k$ cycles d'horloge discrets ($s_0 \to s_1 \to \dots \to s_k$). Le moteur évalue si un état atteignable viole une assertion. Si un état invalide est rencontré à l'étape $j \le k$, le moteur extrait une **trace de contre-exemple** exacte.

### 2. $k$-Induction (Preuves complètes)
La $k$-induction prouve que si une propriété est vérifiée pour les $k$ premières étapes de base, et que supposer qu'elle est vérifiée pour toute séquence arbitraire de $k$ étapes implique qu'elle l'est à l'étape $k+1$, alors la propriété est **inconditionnellement prouvée** pour tout temps infini ($t \to \infty$).

---

## Objectifs de vérification structurelle automatisée

Lors de l'ouverture d'une conception dans le Formal Studio, Axiom synthétise automatiquement des propriétés de sûreté structurelle fondamentales sans exiger la rédaction manuelle de SVA :
- **`p_no_unknown_out`** : Prouve que les sorties primaires ne passent jamais à l'état de haute impédance (`Z`) ou inconnu (`X`) après la désactivation de la réinitialisation.
- **`p_fsm_state_valid`** : Prouve que les registres d'état 1-parmi-N et binaires n'entrent jamais dans des vecteurs d'état non documentés ou illégaux.
- **`p_reset_stability`** : Prouve que les registres internes maintiennent des états de réinitialisation sûrs tant que la ligne de réinitialisation est active.
- **`c_fsm_active`** : Génère automatiquement des propriétés cover prouvant que chaque état FSM déclaré est atteignable.

---

## Explorateur de contre-exemples et injection de traces de formes d'onde

Lorsqu'une assertion échoue, Axiom génère une trace de contre-exemple minimale :
- **Explorateur cycle par cycle** : Parcourez chaque cycle menant à la violation de l'assertion avec une table de différence de signaux montrant quelles équipotentielles ont provoqué l'échec.
- **Injection de forme d'onde en 1 clic** : Cliquer sur **Injecter la trace dans les formes d'onde** charge la trace du contre-exemple directement dans le visualiseur de formes d'onde, plaçant le marqueur temporel exactement au cycle de la violation.

---

## Boîte de dialogue de l'assistant de propriétés SVA

Le Formal Studio inclut un assistant interactif de propriétés SVA (`SvaAssistantModal`) :
- **Assertions immédiates** : Assertions d'invariants simples (`assert (ready == 1);`).
- **Handshake Requête-Accord** : `req |-> ##[1:4] gnt` garantissant que la réponse arrive dans un nombre borné de cycles.
- **Ordre FIFO** : Vérifie que les données écrites apparaissent en sortie dans l'ordre premier entré, premier sorti exact sans corruption.
- **Stabilité sous blocage** : Garantit que le bus de données reste constant tant que `stall` est actif (`stall |-> $stable(data)`).
