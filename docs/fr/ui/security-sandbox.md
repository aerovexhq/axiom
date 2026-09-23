# Confiance de projet et isolation en bac à sable de l'espace de travail

Axiom EDA est conçu pour une conception sécurisée de matériel numérique. Comme les fichiers de description matérielle et les modèles de simulation peuvent exécuter des boucles procédurales complexes ou importer des contenus de mémoire externes, Axiom implémente un **système de permission de confiance de projet**, une **protection en bac à sable du système de fichiers hôte natif** et des **quotas de stockage configurables** de qualité aérospatiale.

---

## Système de permissions de confiance de projet

Lors de l'ouverture ou de l'importation d'un paquet de projet externe (`.json`) provenant d'une source ou d'un collègue non approuvé, Axiom protège la machine hôte en ouvrant le projet en **Mode Restreint** par défaut.

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### Matrice Mode Restreint vs Mode Approuvé

| Fonctionnalité | Mode Restreint | Mode Approuvé |
| :--- | :--- | :--- |
| **Exécution de la simulation** | Autorisée (limites strictes de boucles) | Autorisée (pleine performance) |
| **Cycles delta max (\(\delta\))** | 50 000 cycles / pas | 100 000 cycles / pas (configurable) |
| **Limite d'allocation mémoire** | 64 KMots (256 Ko) | 16 MMots (64 Mo) |
| **Export sur système de fichiers hôte** | Bloqué | Autorisé |
| **Isolation du répertoire de données** | Strictement appliquée (`.axiom/data/`) | Appliquée par défaut |
| **Indicateur d'en-tête** | Alerte bouclier `[ Mode Restreint ]` | Badge de projet discret |

Les ingénieurs peuvent modifier le statut de confiance à tout moment en cliquant sur le badge `[ Mode Restreint ]` dans l'en-tête ou via **Paramètres du projet et sécurité...** dans le menu du projet.

---

## Protection en bac à sable du système de fichiers hôte natif

Pour les installations de bureau natives (Tauri v2), Axiom applique un confinement des chemins de niveau noyau dans le backend Rust (`crates/desktop/src/lib.rs`) via `validate_sandboxed_path` :

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### Protections du bac à sable
1. **Normalisation multiplateforme des chemins** : Convertit automatiquement les barres obliques inverses de Windows (`\`) et les barres obliques Unix (`/`), en supprimant les préfixes verbatim (`\\?\`).
2. **Blocage de traversée de chemin** : Interdit strictement les séquences de traversée de répertoire parent `..`, tant dans la chaîne d'entrée brute que dans le chemin canonique résolu.
3. **Liste noire des répertoires système sensibles** : Interdit la lecture et l'écriture dans les répertoires critiques du système d'exploitation :
   - Linux/macOS : `/etc`, `/proc`, `/sys`, `/boot`, `/root`, `/bin`, `/sbin`, `/usr`
   - Windows : `C:\Windows`, `C:\System32`, `C:\Program Files`
4. **Quarantaine des magasins d'identifiants** : Bloque toutes les opérations accédant aux clés privées, identifiants et magasins d'authentification :
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Couverture des commandes IPC Tauri** : Chaque invocation IPC du système de fichiers (`fs_read_file`, `fs_write_file`, `fs_remove_file`, `fs_list_dir`, `fs_create_dir`, `fs_exists`) est protégée par `validate_sandboxed_path`. Les requêtes de chemin non autorisées renvoient immédiatement une erreur `[SandboxViolation]`.

---

## Quotas de stockage configurables

Pour éviter que des fichiers de trace de simulation volumineux (`.vcd`, `.saif`) ou des boucles synthétiques n'épuisent l'espace disque de l'hôte, Axiom impose des quotas de stockage au niveau de l'octet :

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### Options de quota de stockage
- **10 Mo** : Empreinte minimale pour les cours de logique au niveau des portes.
- **25 Mo** : Adapté aux FSM standards et aux petites conceptions de processeurs.
- **50 Mo (Par défaut)** : Quota d'ingénierie standard accueillant des milliers de cycles de simulation et de traces de formes d'onde.
- **100 Mo / 250 Mo / 500 Mo** : Limites étendues pour les exécutions de vérification approfondies, les formes d'onde VCD de plusieurs mégaoctets et les netlists post-synthèse.
- **Illimité** : Allocation sans plafond pour les projets d'entreprise massifs.

L'application des quotas est active tant dans IndexedDB du navigateur (`BrowserIndexedDbFileSystem`) que dans le stockage de bureau natif (`TauriIpcFileSystem`). Tenter d'écrire au-delà du quota déclenche une exception propre `[StorageQuota]` sans faire planter l'environnement d'exécution.

---

## Répertoire dédié aux données générées (`.axiom/data/`)

Axiom isole toutes les sorties générées dans un sous-dossier dédié de l'espace de travail :
- Fichiers Value Change Dump (`.vcd`)
- Fichiers Switching Activity Interchange Format (`.saif`)
- Rapports d'analyse temporelle statique (`timing_report.txt`)
- Netlists Verilog structurelles mappées (`synth_netlist.v`)
- Captures de paquets de protocole (`.pcap`)

### Sous-système de purge des données en 1 clic
La **boîte de dialogue de sécurité du projet** fournit un bouton en 1 clic **Purger les données générées**. Cette opération efface l'intégralité du contenu de `.axiom/data/`, réinitialisant instantanément l'utilisation du stockage aux seuls fichiers sources bruts sans modifier ni supprimer aucun fichier Verilog, SystemVerilog, VHDL ou XDC.
