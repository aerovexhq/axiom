# Matrice de comparaison Vivado vs Axiom

Une comparaison détaillée entre l'environnement de simulation hérité AMD Vivado et le moteur Axiom EDA de nouvelle génération.

---

## Comparaison des capacités techniques

| Capacité | AMD Vivado Design Suite | Axiom EDA (Aerovex) |
| :--- | :--- | :--- |
| **Moteur d'exécution principal** | Instantané `xsimk` compilé sur disque | Code machine JIT Cranelift en RAM |
| **Latence typique de compilation** | 30 à 120 secondes | **1 à 3 millisecondes** |
| **Débit de simulation** | 100k à 250k événements/s | **780k+ événements/s** |
| **Contrôle des cycles delta** | Opaque (écrase les étapes delta) | **`step_delta` contrôlé par l'appelant** |
| **Suivi des glitchs / aléas** | Masqué | **Détection des aléas statiques et dynamiques** |
| **Modélisation de la puissance sur silicium** | Estimation statique post-simulation | **$P = \frac{1}{2} C V^2 f \alpha$ dynamique en temps réel** |
| **Chute de tension du PDN** | Nécessite une modélisation SPICE externe | **Modélisation intégrée de la chute $IR + L \frac{di}{dt}$** |
| **Arène d'état en mémoire** | Structures C++ fragmentées | **Vecteurs doubles contigus sur 64 bits** |
| **Exportateurs de formes d'onde** | Propriétaire `.wdb` + `.vcd` | **`.vcd` standard IEEE 1364** |
| **Exportateurs de puissance** | Génération SAIF | **Interopérabilité standard SAIF 2.0** |
| **Framework d'interface graphique** | Java Swing (lourd, lié à la mémoire) | **Tauri v2 + React 19 (Obsidian sombre)** |
| **Exécution dans le navigateur web** | Impossible | **WebAssembly 100% côté client** |
| **Empreinte d'installation** | 60 à 110 Go | **< 50 Mo** |
| **Support natif macOS** | Non (nécessite une VM Linux) | **Apple Silicon natif (AArch64)** |
| **Coût de licence** | Licences par poste monolithiques ($$$) | **Noyau open source (Licence MIT)** |
