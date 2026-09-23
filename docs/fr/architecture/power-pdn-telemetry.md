# Télémétrie silicium physique et modélisation du PDN

Contrairement aux simulateurs traditionnels qui reposent exclusivement sur des calculs statiques post-simulation dans des feuilles de calcul, Axiom intègre les équations physiques de puissance en temps réel directement dans la boucle de simulation.

---

## Dissipation de puissance dynamique

La dissipation de puissance dynamique est régie par la charge et la décharge des charges capacitives physiques lors des transitions de signal :

$$P_{\text{dynamic}} = \frac{1}{2} C_{\text{lumped}} V_{\text{rail}}^2 f \alpha$$

Où :
- $C_{\text{lumped}}$ : Capacité physique totale de l'équipotentielle (broche pilote + routage d'interconnexion + broches réceptrices de sortance).
- $V_{\text{rail}}$ : Rail de tension d'alimentation du domaine de puissance du pilote (ex. 1,20 V Cœur).
- $f$ : Fréquence d'horloge.
- $\alpha$ : Facteur d'activité de commutation (taux de basculement de distance de Hamming).

---

## Accumulation d'énergie par événement

À chaque transition d'état de l'équipotentielle $i$ :
$$\Delta E_i = \frac{1}{2} C_i V_{\text{rail}}^2 \times \text{bit\_flips}$$

Le `TelemetryCollector` d'Axiom accumule l'énergie dissipée par instance hiérarchique de module en temps réel, suivant la dissipation instantanée de puissance en milliwatts ($mW$) et l'énergie cumulée en microjoules ($\mu J$).

---

## Chute de tension inductive du PDN (IR + L di/dt)

Le bruit de commutation simultanée (SSN) survient lorsque plusieurs registres ou lignes de bus basculent sur le même front d'horloge, tirant de forts courants transitoires du rail d'alimentation sur puce.

Axiom modélise l'impédance du réseau de distribution d'alimentation ($R + L \frac{di}{dt}$) :

$$V_{\text{sag}}(t) = I(t) \cdot R_{\text{pdn}} + L_{\text{pdn}} \cdot \frac{di}{dt}$$

$$V_{\text{effective}}(t) = V_{\text{nominal}} - V_{\text{sag}}(t)$$

Lorsque les signaux de bus basculent simultanément, Axiom capture :
- Pics de courant transitoire instantanés ($mA$).
- Chute de tension du rail d'alimentation ($mV$) sous les niveaux nominaux.
- Corrélation directe entre les fronts d'horloge et le rebond de l'alimentation électrique.
