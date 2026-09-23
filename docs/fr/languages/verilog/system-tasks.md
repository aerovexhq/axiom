# Tâches et fonctions système IEEE 1364

Verilog fournit des tâches et fonctions système standard intégrées préfixées par le signe dollar (`$`). Axiom EDA intercepte et exécute nativement ces routines en RAM sans nécessiter de bibliothèques C/C++ PLI ou VPI externes.

---

## Tâches d'affichage et de formatage de chaînes

### 1. `$display` et `$write`
Affiche du texte formaté directement dans le panneau interactif **Console et REPL** d'Axiom. `$display` ajoute automatiquement un retour à la ligne, contrairement à `$write`.

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### Spécificateurs de format pris en charge
- `%d` / `%0d` : Entier décimal (sans remplissage)
- `%h` / `%0h` : Valeur hexadécimale
- `%b` : Vecteur binaire
- `%o` : Valeur octale
- `%c` : Caractère ASCII
- `%s` : Chaîne de caractères
- `%t` : Temps de simulation formaté

### 2. `$monitor` et `$strobe`
- `$monitor` : Surveille les arguments de signal et affiche automatiquement un message dès qu'un signal surveillé change de valeur.
- `$strobe` : Diffère l'émission du message à la région Monitor tout à la fin du pas de temps courant, assurant que toutes les assignations NBA sont stabilisées.

---

## Tâches de contrôle de simulation

### 1. `$finish`
Termine l'exécution de la simulation, suspend les cycles d'horloge autonomes et affiche les métriques d'exécution finales dans la Console.
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop`
Met la simulation en pause, fait passer le ruban de simulation à l'état **Paused** et conserve toutes les traces de signaux et les états des registres pour inspection.

### 3. `$time` et `$realtime`
- `$time` : Renvoie le temps de simulation actuel sous la forme d'un entier 64 bits basé sur la directive `` `timescale `` active.
- `$realtime` : Renvoie le temps de simulation actuel sous la forme d'un nombre à virgule flottante réel.

---

## Fonctions mathématiques et utilitaires

### 1. `$clog2` (Logarithme en base 2 arrondi au supérieur)
Calcule $\lceil \log_2(N) \rceil$. Indispensable pour déterminer la largeur des bus d'adresses à partir de la profondeur de mémoire :
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random`
Génère un entier pseudo-aléatoire signé de 32 bits. Souvent masqué pour générer des vecteurs de test aléatoires :
```verilog
test_byte = $random % 256;
```

---

## Tâches d'export de formes d'onde

Axiom intercepte nativement les appels système VCD :
- `$dumpfile("waveform.vcd");` : Spécifie le nom du fichier de formes d'onde de sortie.
- `$dumpvars(0, top_tb);` : Exporte tous les changements de valeurs de signaux de la hiérarchie dans le tampon de trace en mémoire d'Axiom et télécharge sous forme de fichier Logique à 4 états / Value Change Dump (VCD) IEEE 1364.

---

## Initialisation de fichiers mémoire (`$readmemb`, `$readmemh`)

Charge le contenu d'un tableau de mémoire directement à partir de fichiers texte :
- `$readmemb("rom.bin", memory_array);` : Charge des données binaires (`10101100`).
- `$readmemh("rom.hex", memory_array);` : Charge des données hexadécimales (`AF 04 C2`).

Dans Axiom Studio, les fichiers d'initialisation de mémoire sont lus de manière sécurisée au sein des ensembles de fichiers du projet sans enfreindre les limites du bac à sable du système de fichiers hôte.
