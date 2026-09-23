# Vérification aléatoire sous contraintes

Axiom EDA prend en charge la génération de tests aléatoires sous contraintes (`crates/syntax/src/stimulus.rs`), permettant aux ingénieurs de vérification de définir des espaces de paramètres d'entrée licites, des distributions de valeurs et des contraintes pour débusquer les cas limites obscurs.

---

## Variables aléatoires (`rand`, `randc`)

- `rand` : Génère des entiers pseudo-aléatoires uniformément distribués.
- `randc` : Génération aléatoire cyclique (garantit que chaque permutation de la plage est échantillonnée avant de se répéter).

```verilog
class ethernet_packet;
    rand  bit [15:0] length;
    rand  bit [7:0]  payload[];
    randc bit [3:0]  priority_id;

    // Constraint block defining legal packet size
    constraint c_length {
        length inside {[64:1518]}; // Standard Ethernet frame size
    }

    // Weighted distribution constraint
    constraint c_priority {
        priority_id dist {
            0       := 50,  // 50% probability for background priority
            [1:3]   := 30,  // 30% divided across normal priority
            [4:7]   := 20   // 20% for high priority
        };
    }
endclass
```

---

## Blocs de contraintes et résolution

Le solveur de contraintes intégré à Axiom évalue les inégalités arithmétiques linéaires et l'appartenance à des ensembles :
- **Appartenance à un ensemble (`inside`)** : Restreint les valeurs à des plages (`val inside {[10:50], [100:200]};`).
- **Contraintes d'implication (`->`)** : Contraintes conditionnelles (`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`).
- **Résoudre avant (`solve a before b`)** : Contrôle l'ordre de priorité d'échantillonnage dans les distributions de probabilités conjointes.

---

## Génération automatisée de bancs de test

Dans Axiom Studio, les ingénieurs peuvent utiliser l'**Éditeur visuel de stimuli** (`StimulusGeneratorModal.tsx`) pour générer des bancs de test aléatoires sous contraintes répétables par graine (`tb_<top>.v`) avec export HDL en 1 clic.
