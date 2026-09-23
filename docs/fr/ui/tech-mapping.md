# Studio de mappage technologique au niveau des portes

Le studio de mappage technologique d'Axiom (`crates/ir/src/synth/`) fait le pont entre le RTL comportemental et les architectures physiques de FPGA. Il décompose les équations logiques booléennes génériques, les multiplexeurs et les opérateurs arithmétiques en primitives silicium natives des composants AMD/Xilinx 7-Series et UltraScale+.

---

## Abaissement en primitives spécifiques à l'architecture

```
+-------------------------------------------------------------------------------+
| RTL Verilog Code:                       | Mapped Silicon Primitives:          |
|                                         |                                     |
| assign F = (cond) ? (a + b) : (c & d);  | - LUT6_2 (INIT = 64'hE2E2_0000_...) |
|                                         | - CARRY4 (Fast Arithmetic)          |
|                                         | - FDRE   (D Flip-Flop with Enable)  |
+-------------------------------------------------------------------------------+
```

### Cibles silicium FPGA prises en charge
Les ingénieurs peuvent choisir parmi des architectures matérielles préconfigurées :
1. **AMD Artix-7 (XC7A35T / XC7A100T)** : LUT à 6 entrées, arithmétique CARRY4, tranches DSP48E1, mémoires RAMB36E1.
2. **AMD Kintex-7 (XC7K325T)** : Architecture 7-Series haute vitesse.
3. **AMD Zynq-7000 (XC7Z020)** : SoC double ARM Cortex-A9 avec matrice logique programmable 7-Series.
4. **AMD Kintex UltraScale+ (XCKU5P)** : Architecture moderne FinFET 16 nm avec chaînes CARRY8, tranches DSP48E2 et blocs UltraRAM.
5. **Axiom Virtual Silicon** : Architecture virtuelle générique haute capacité optimisée pour l'enseignement et le prototypage rapide.

---

## Décomposition de réseau booléen et mappage K-LUT

### 1. Décomposition en $K$-LUT
Axiom décompose les expressions logiques booléennes arbitraires en tables de correspondance (Look-Up Tables) à $K$ entrées (où $K=6$ pour les FPGA Xilinx modernes) :
- Les sous-fonctions avec $\le 6$ entrées uniques sont directement mappées dans une seule `LUT6`.
- Les fonctions logiques à deux sorties partageant jusqu'à 5 entrées sont mappées dans des primitives `LUT6_2` à double sortie (`O5`, `O6`).
- Les fonctions logiques larges ($N > 6$) sont partitionnées à l'aide de l'expansion de Shannon en réseaux de LUT en cascade.

### 2. Calcul exact du paramètre hexadécimal `INIT`
Chaque LUT mappée voit sa table de vérité sérialisée en un paramètre hexadécimal `INIT` de 64 bits :
$$\text{INIT}[i] = f(i_5, i_4, i_3, i_2, i_1, i_0)$$
Par exemple, une porte ET à 2 entrées est mappée sur une `LUT6` avec `INIT = 64'h0000_0000_0000_0008`.

---

## Inférence de macro-primitives

Le moteur de synthèse identifie automatiquement les motifs structurels de haut niveau :
- **Inférence de tranches DSP (`DSP48E1` / `DSP48E2`)** : Les multiplications multi-bits (`a * b`), les opérations d'accumulation-multiplication (`P = P + (A * B)`) et les séquences de pré-additionneurs sont directement mappées sur des blocs DSP matériels dédiés plutôt que de consommer des centaines de LUT logiques.
- **Inférence de RAM bloc (`RAMB18E2` / `RAMB36E2`)** : Les tableaux décompressés avec cadencement synchrone (`reg [31:0] mem [0:1023]`) sont automatiquement abaissés en RAM blocs matérielles à double port réel ou à double port simple.

---

## Inspection de la netlist mappée et export Verilog structurel

Le visualiseur de mappage technologique propose :
- **Graphique à barres d'utilisation des ressources** : Affiche les décomptes et pourcentages pour les LUT de tranches, les registres de tranches (FF), les chaînes CARRY, les tranches DSP et les RAM blocs.
- **Tableau d'inspection des cellules** : Recherche et filtre les instances de primitives mappées.
- **HUD de table de vérité** : Inspecte la table de vérité booléenne exacte représentée par toute LUT mappée.
- **Export Verilog structurel** : Génération en un clic de netlists de portes purement structurelles (`.v`) instanciées avec les primitives standard Xilinx.
