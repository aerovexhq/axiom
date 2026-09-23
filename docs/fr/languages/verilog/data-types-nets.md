# Types de données, équipotentielles et variables Verilog

En Verilog HDL, les connexions matérielles physiques et les éléments de stockage sont classés en deux groupes fondamentaux : les **Équipotentielles (Nets)** (représentant les fils électriques physiques) et les **Variables** (représentant le stockage procédural comportemental).

---

## Types de données d'équipotentielles

Les équipotentielles représentent les connexions physiques entre les éléments matériels. Elles ne stockent pas de valeurs logiques ; leur valeur est déterminée continuellement par leurs pilotes.

### 1. `wire` et `tri`
Le type d'équipotentielle principal représentant les pistes de cuivre physiques. `wire` et `tri` sont fonctionnellement identiques en synthèse, représentant des lignes d'interconnexion standard.

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. Forces des équipotentielles et conflit multi-pilotes
Si plusieurs assignations continues actives pilotent simultanément un fil `wire` standard avec des valeurs contradictoires (`1` et `0`), Axiom évalue le conflit comme inconnu (`X`) et déclenche l'erreur de linter `AXIOM_E002_MULTI_DRIVER_NET`.

---

## Types de données de variables

Les variables conservent leur valeur d'une assignation procédurale à la suivante.

### 1. `reg`
La variable procédurale standard. Malgré son nom, un `reg` ne se synthétise pas toujours en un registre physique de type bascule ; s'il est assigné dans un bloc purement combinatoire (`always @*`), il se synthétise en logique combinatoire.

```verilog
// 1-bit register variable
reg state;

// 32-bit register vector
reg [31:0] accumulator;

// Sequential clocked assignment
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        accumulator <= 32'd0;
    else
        accumulator <= accumulator + 32'd1;
end
```

### 2. `integer` et `time`
- `integer` : Variable signée 32 bits couramment utilisée dans les boucles `for` et l'itération de bancs de test.
- `time` : Variable non signée 64 bits utilisée pour enregistrer les horodatages de simulation via `$time`.

---

## Vecteurs et sélections de parties indexées

Les vecteurs représentent des bus multibits déclarés avec des plages `[MSB:LSB]` :

```verilog
wire [15:0] packet;

// Static slice part-select
wire [7:0] lower_byte = packet[7:0];
wire [7:0] upper_byte = packet[15:8];

// IEEE 1364-2001 Variable Indexed Part-Select (+: and -:)
// Syntax: [base_expr +: width]  (starts at base, selects width bits upward)
// Syntax: [base_expr -: width]  (starts at base, selects width bits downward)
wire [7:0] byte_0 = packet[0 +: 8];   // Selects packet[7:0]
wire [7:0] byte_1 = packet[8 +: 8];   // Selects packet[15:8]
wire [3:0] nibble = packet[7 -: 4];   // Selects packet[7:4]
```

---

## Tableaux de mémoire décompactés

Axiom prend en charge les tableaux décompactés multidimensionnels pour modéliser les bancs de registres, les tables de correspondance (LUT) et les blocs de mémoire SRAM :

```verilog
// Array of 1024 registers, each 32 bits wide (4 KB RAM block)
reg [31:0] memory_array [0:1023];

// Synchronous memory write
always @(posedge clk) begin
    if (write_enable)
        memory_array[addr] <= write_data;
end

// Continuous read
assign read_data = memory_array[addr];
```

Le moteur de synthèse d'Axiom détecte automatiquement les mémoires synchrones décompactées et les infère en mémoires RAM bloc matérielles Xilinx `RAMB18E2` ou `RAMB36E2`.

---

## Littéraux numériques dimensionnés

Les nombres en Verilog peuvent être spécifiés sous forme de décimaux non dimensionnés ou de constantes dimensionnées avec des préfixes de base explicites :

$$\text{Format : } <\text{taille}>'<\text{base}><\text{valeur}>$$

| Littéral | Largeur en bits | Base | Valeur |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | Binaire | `0xAC` |
| `8'hFF` | 8 | Hexadécimal | `255` |
| `16'd1024` | 16 | Décimal | `1024` |
| `4'o17` | 4 | Octal | `15` |
| `'d50` | Non dimensionné (32) | Décimal | `50` |
| `1'b1` | 1 | Binaire | Niveau haut logique |
