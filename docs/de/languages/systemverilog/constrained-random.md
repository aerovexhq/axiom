# Eingeschränkte Zufallsverifikation

Axiom EDA unterstützt die eingeschränkte Zufallstestgenerierung (`crates/syntax/src/stimulus.rs`), wodurch Verifikationsingenieure zulässige Eingangsparameterräume, Werteverteilungen und Constraints definieren können, um schwer auffindbare Corner-Case-Fehler aufzudecken.

---

## Zufallsvariablen (`rand`, `randc`)

- `rand`: Generiert gleichverteilte pseudozufällige Ganzzahlen.
- `randc`: Zyklische Zufallsgenerierung (garantiert, dass jede Permutation im Bereich abgetastet wird, bevor sie sich wiederholt).

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

## Constraint-Blöcke & Löser

Der Engine-interne Constraint-Löser von Axiom wertet lineare arithmetische Ungleichungen und Mengenmitgliedschaften aus:
- **Mengenmitgliedschaft (`inside`)**: Beschränkt Werte auf Bereiche (`val inside {[10:50], [100:200]};`).
- **Implikations-Constraints (`->`)**: Bedingte Constraints (`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`).
- **Vorab-Lösung (`solve a before b`)**: Steuert die Abtastprioritätsreihenfolge bei Verbundwahrscheinlichkeitsverteilungen.

---

## Automatisierte Testbench-Generierung

In Axiom Studio können Ingenieure den **Visuellen Stimulus-Editor** (`StimulusGeneratorModal.tsx`) verwenden, um Seed-wiederholbare eingeschränkte Zufallstestbenches (`tb_<top>.v`) mit 1-Klick-HDL-Export zu generieren.
