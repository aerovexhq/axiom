# Télémétrie silicium et radar d'énergie

Axiom EDA est le pionnier de la télémétrie silicium basée sur la physique (`crates/telemetry`). Plutôt que de traiter les portes numériques comme des abstractions mathématiques, Axiom modélise les paramètres physiques des semi-conducteurs lors de la commutation CMOS : dissipation d'énergie dynamique, charge capacitive, courants de fuite et chute de tension inductive du PDN (IR + L di/dt).

---

## Formulation de puissance basée sur la physique

Axiom calcule la dissipation d'énergie au niveau des transitions selon les premiers principes de la physique :

### 1. Puissance de commutation dynamique
$$P_{\text{dynamic}} = \frac{1}{2} \cdot C_{\text{load}} \cdot V_{\text{dd}}^2 \cdot f \cdot \alpha$$
Où :
- $C_{\text{load}}$ : Capacité globale de l'équipotentielle, calculée à partir du fan-out et de la longueur d'interconnexion.
- $V_{\text{dd}}$ : Tension d'alimentation nominale (1.0 V par défaut pour le cœur Artix-7/Kintex UltraScale+).
- $f$ : Fréquence d'horloge.
- $\alpha$ : Facteur d'activité de commutation (probabilité de transition par cycle d'horloge).

### 2. Chute de tension inductive du PDN (IR + L di/dt)
Lors des fronts d'horloge de haute activité où plusieurs registres commutent simultanément, l'appel de courant de crête ($di/dt$) induit une chute de tension à travers l'inductance du boîtier :
$$V_{\text{sag}} = I \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$
Où :
- $R_{\text{pdn}}$ : Résistance série effective du rail d'alimentation.
- $L_{\text{pdn}}$ : Inductance parasite des fils de câblage et des billes de boîtier.
- $\frac{di}{dt}$ : Taux de montée instantané du courant.

Si $V_{\text{sag}}$ chute en dessous de la tension de seuil des transistors, le temps d'établissement augmente de manière exponentielle, provoquant des aléas de temporisation transitoires.

---

## HUD de télémétrie silicium et indicateurs analogiques

L'en-tête de navigation supérieur et le dock de télémétrie dédié affichent des indicateurs analogiques synchronisés :

```
+-------------------------------------------------------------------------------+
| Silicon Telemetry Radar:                                                      |
| [ Power: 42.8 mW ]    [ Current: 42.8 mA ]   [ Voltage: 0.982 V (-18 mV Sag) ]|
+-------------------------------------------------------------------------------+
| Real-Time Power Strip-Chart (mW vs. Physical Time):                           |
| mW ^                                                                          |
| 60 |         /\                                                               |
| 40 |      /\/  \  /\                                                          |
| 20 |_____/      \/  \________________________________________________________ |
|  0 +-----+-----+-----+-----+-----+-----+-----+-----+-----+------------------> |
|    0 ns  10 ns 20 ns 30 ns 40 ns 50 ns 60 ns 70 ns 80 ns                     |
+-------------------------------------------------------------------------------+
```

### Paramètres de télémétrie surveillés
- **Puissance dynamique (mW)** : Puissance de commutation dynamique en temps réel consommée par les cellules logiques et les arbres d'horloge.
- **Courant d'alimentation (mA)** : Courant total du cœur consommé sur le rail $V_{\text{dd}}$.
- **Tension du rail de cœur (V)** : Tension nominale du rail (1.000 V) moins la chute de tension inductive instantanée ($V_{\text{sag}}$).
- **Énergie cumulée (pJ / nJ)** : Énergie électrique totale dissipée depuis le début de la simulation.

---

## Export Synopsys SAIF 2.0

Axiom exporte nativement des fichiers **Switching Activity Interchange Format (SAIF 2.0)** :
- Capture les comptages de basculement (`TC`), le temps passé à l'état haut (`T1`), à l'état bas (`T0`) et indéterminé (`TX`) pour chaque équipotentielle.
- Les fichiers `.saif` exportés peuvent être directement importés dans l'analyseur de puissance AMD Vivado (`read_saif`) pour les rapports officiels de dissipation thermique du FPGA.
