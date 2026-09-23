# Éditeur de code Monaco HDL et serveur de langage

L'éditeur de code Axiom HDL intègre l'éditeur Monaco de Microsoft avec un démon de protocole de serveur de langage (LSP) Verilog, SystemVerilog et VHDL en RAM (`crates/lsp`). Il combine coloration syntaxique, vérification statique des règles de conception en temps réel, info-bulles AST au survol et extraits d'autocomplétion dans un IDE de qualité aérospatiale.

---

## Le tokeniseur Monarch HDL

Axiom intègre un tokeniseur Monarch personnalisé spécialement conçu pour le Verilog IEEE 1364, le SystemVerilog IEEE 1800 et le VHDL IEEE 1076.

### Style visuel (`axiom-dark`)
L'éditeur adopte la palette sombre d'Axiom :
- **Mots-clés** (`module`, `always_ff`, `assign`, `wire`, `reg`) : Cyan à fort contraste (`#00f0ff`)
- **Tâches et fonctions système** (`$display`, `$finish`, `$time`, `$clog2`) : Violet (`#a855f7`)
- **Chaînes** : Ambre (`#fbbf24`)
- **Nombres et littéraux dimensionnés** (`8'hFF`, `1'b0`, `32'd100`) : Vert émeraude (`#34d399`)
- **Commentaires** (`//`, `/* ... */`) : Ardoise atténué (`#64748b`)
- **Identifiants et noms de signaux** : Blanc doux (`#f1f5f9`)

---

## Linter statique en temps réel en RAM

Contrairement aux outils hérités qui exigent des pipelines de compilation de plusieurs minutes pour signaler les erreurs de syntaxe ou les aléas de conception, le linter d'Axiom opère en continu en RAM avec une fenêtre de stabilisation de 250 ms.

### Règles de conception statique intégrées

| Identifiant de règle | Gravité | Nom | Description et aléa évité |
| :--- | :--- | :--- | :--- |
| `AXIOM_W001` | Avertissement | **Assignation bloquante dans un bloc séquentiel** | L'utilisation d'assignations bloquantes (`=`) dans des blocs cadencés (`always @(posedge clk)`) introduit des conditions de course entre simulation et synthèse. |
| `AXIOM_W002` | Avertissement | **Assignation non bloquante dans un bloc combinatoire** | L'utilisation d'assignations non bloquantes (`<=`) dans des blocs combinatoires (`always @*`) crée des aléas de course multi-delta et des divergences de synthèse. |
| `AXIOM_W003` | Avertissement | **Équipotentielle non pilotée** | Un fil ou une équipotentielle déclarée n'a aucun pilote continu (`assign`), sortie de primitive ou pilote de sous-module connecté. |
| `AXIOM_W004` | Avertissement | **Signal inutilisé** | Un registre ou une équipotentielle déclarée est écrit ou défini mais jamais lu dans un cône logique aval. |
| `AXIOM_E002` | Erreur | **Conflit multi-pilotes** | Plusieurs assignations continues ou pilotes simultanés pilotent la même équipotentielle, provoquant des courts-circuits électriques et des conflits `X`. |
| `AXIOM_W006` | Avertissement | **Verrou transparent inféré** | Des branches conditionnelles incomplètes (`if` sans `else`, ou `case` sans toutes les branches) infèrent des verrous transparents involontaires. |
| `AXIOM_W007` | Avertissement | **Absence de default dans le case** | Une instruction `case` n'inclut pas de branche `default:`, risquant le blocage d'état sur des vecteurs non couverts. |
| `AXIOM_W008` | Avertissement | **Discordance de largeur de bits** | La largeur d'assignation d'équipotentielle ou de port diffère entre les expressions de gauche et de droite, conduisant à une troncature silencieuse de bits. |

Des soulignements ondulés apparaissent directement sous les jetons en faute dans l'éditeur. Cliquer sur une carte d'erreur dans le dock **Problèmes et linter** déplace immédiatement le curseur de l'éditeur sur la ligne et la colonne exactes.

---

## Cartes AST au survol

Survoler un identifiant avec le curseur de la souris dans l'éditeur ouvre une info-bulle de métadonnées AST interactive :
- **Déclaration de signal** : Affiche le type d'équipotentielle (`wire`, `reg`, `logic`), la plage de bits (`[31:0]`) et le caractère signé/non signé.
- **Emplacement du pilote** : Indique le numéro de ligne exact où le signal est assigné ou piloté.
- **Documentation des primitives Xilinx** : Le survol des primitives matérielles (`LUT6_2`, `DSP48E2`, `RAMB36E2`, `BUFG`, `CARRY8`) affiche la documentation complète du brochage, les paramètres de table de vérité et les descriptions comportementales.

---

## Autocomplétion intelligente

Le serveur de langage d'Axiom fournit une autocomplétion instantanée :
- **Mots-clés IEEE 1364/1800** : Génération automatique de squelettes pour `module`, `always_ff`, `always_comb`, `case` et `generate`.
- **Tâches système** : Modèles d'arguments formatés pour `$display`, `$monitor`, `$finish` et `$dumpvars`.
- **Signaux de la portée** : Suggère les équipotentielles, registres et paramètres déclarés dans la hiérarchie du module actif.
- **Primitives Xilinx Série 7 / UltraScale+** : Modèles complets d'instanciation de mappage de ports pour les cellules matérielles.

---

## Ergonomie et persistance de l'éditeur

- **Gestion de fichiers multi-onglets** : Ouvrez plusieurs sources de conception simultanément. Les onglets de fichiers actifs persistent lors du rechargement du navigateur.
- **Navigation par fil d'Ariane** : La barre de chemin au-dessus de l'éditeur affiche le projet actuel, l'ensemble de fichiers, le fichier actif et le module parent.
- **Persistance de position d'affichage** : La position de défilement de l'éditeur Monaco (ligne verticale et décalage horizontal) est mise en cache par fichier dans `localStorage` afin que le retour à un fichier restaure la vue exacte.
