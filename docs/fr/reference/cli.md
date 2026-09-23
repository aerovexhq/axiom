# Manuel de référence CLI

Axiom inclut un pilote en ligne de commande rapide et autonome pour les pipelines CI/CD, les tests sans interface graphique et les séries de régression de bancs d'essai.

---

## Utilisation globale

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### Drapeaux globaux
- `-h, --help` : Affiche l'aide et les informations d'utilisation.
- `-v, --version` : Affiche la version actuelle d'Axiom EDA.

---

## Sous-commandes

### 1. `compile`
Exécute l'analyse lexicale en mémoire, l'analyse syntaxique de Pratt, l'élaboration hiérarchique de netlist et la compilation JIT en RAM avec Cranelift sans sérialisation sur disque.

```bash
axiom compile <FILE> -t <TOP>
```

#### Arguments
- `<FILE>` : Chemin vers le fichier HDL Verilog ou SystemVerilog (`.v` ou `.sv`).
- `-t, --top <TOP>` : Identifiant du module de niveau supérieur à élaborer.

#### Exemple
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run`
Compile la conception HDL spécifiée et la simule pendant un nombre déterminé de cycles d'horloge, avec génération optionnelle en temps réel de sorties VCD et SAIF.

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### Options
- `-t, --top <TOP>` : Nom du module de niveau supérieur (requis).
- `--ticks <N>` : Nombre de cycles d'horloge à simuler (par défaut : 100).
- `--vcd <FILE>` : Chemin du fichier pour exporter les formes d'onde Logique à 4 états / Value Change Dump (VCD) IEEE 1364.
- `--saif <FILE>` : Chemin du fichier pour exporter les données d'activité de commutation SAIF 2.0.

#### Exemple
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark`
Exécute des micro-bancs d'essai statistiques mesurant le temps de compilation JIT de bout en bout et le débit brut d'événements de simulation.

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### Options
- `-t, --top <TOP>` : Nom du module de niveau supérieur (requis).
- `--cycles <N>` : Nombre de cycles d'horloge simulés (par défaut : 5000).

#### Exemple
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
