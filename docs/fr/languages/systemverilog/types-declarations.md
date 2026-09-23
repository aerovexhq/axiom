# Types de données et déclarations SystemVerilog

SystemVerilog modernise la modélisation matérielle en éliminant la dichotomie déroutante entre `wire` et `reg` du Verilog classique, tout en introduisant des types définis par l'utilisateur, des structures et des énumérations.

---

## Le type universel `logic`

En Verilog classique, les concepteurs devaient constamment choisir entre `wire` (pour les assignations continues) et `reg` (pour les blocs procéduraux). SystemVerilog résout cela avec le type `logic` à logique à 4 états :

```verilog
// 1-bit logic signal driven by continuous assignment
logic valid;
assign valid = ready & req;

// Multi-bit logic bus driven procedurally
logic [31:0] data_reg;
always_ff @(posedge clk) begin
    data_reg <= next_data;
end
```
*Remarque : Une équipotentielle `logic` ne peut avoir au plus qu'un seul pilote continu. Si des bus câblés en OU ou en ET multi-pilotes sont requis, le type `wire` standard est utilisé.*

---

## Types de données à 2 états

Pour la simulation haute performance et la modélisation de bancs de test où les états de haute impédance (`Z`) et inconnus (`X`) ne sont pas nécessaires, SystemVerilog introduit des types à 2 états :

| Type | Largeur en bits | Signé / Non signé | Valeurs |
| :--- | :--- | :--- | :--- |
| `bit` | 1 bit | Non signé | `0`, `1` |
| `byte` | 8 bits | Signé | `-128` à `127` |
| `shortint` | 16 bits | Signé | `-32 768` à `32 767` |
| `int` | 32 bits | Signé | Entier 32 bits standard |
| `longint` | 64 bits | Signé | Entier 64 bits standard |

Axiom compile les variables à 2 états directement dans les registres natifs du processeur hôte, atteignant des vitesses d'exécution maximales.

---

## Types définis par l'utilisateur (`typedef`)

Les concepteurs peuvent créer des alias de types lisibles et réutilisables :

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## Types énumérés (`enum`)

Les énumérations attribuent des noms symboliques aux états matériels, améliorant considérablement la lisibilité des machines à états finis (FSM) :

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
L'inspecteur de microarchitecture d'Axiom détecte automatiquement les variables d'état `enum` et affiche des bulles d'état étiquetées dans le visualiseur de FSM.

---

## Structures (`struct`)

Les structures regroupent les signaux associés dans une structure de données nommée unique :

```verilog
// Packed structure: contiguous bit-vector representation in hardware
typedef struct packed {
    logic [7:0]  opcode;
    logic [3:0]  reg_dest;
    logic [3:0]  reg_src1;
    logic [3:0]  reg_src2;
    logic [11:0] immediate;
} instruction_t; // Total 32 bits

instruction_t current_instr;
assign current_instr.opcode = 8'h01;
```
