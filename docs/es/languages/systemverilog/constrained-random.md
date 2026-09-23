# Verificación aleatoria restringida

Axiom EDA admite la generación de pruebas aleatorias restringidas (`crates/syntax/src/stimulus.rs`), permitiendo a los ingenieros de verificación definir espacios legales de parámetros de entrada, distribuciones de valores y restricciones para descubrir errores oscuros en casos límite.

---

## Variables aleatorias (`rand`, `randc`)

- `rand`: Genera enteros pseudoaleatorios distribuidos uniformemente.
- `randc`: Generación aleatoria cíclica (garantiza que cada permutación en el rango se muestree antes de repetirse).

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

## Bloques de restricción y resolución

El solucionador de restricciones integrado de Axiom evalúa desigualdades aritméticas lineales y pertenencia a conjuntos:
- **Pertenencia a conjuntos (`inside`)**: Restringe valores a rangos (`val inside {[10:50], [100:200]};`).
- **Restricciones de implicación (`->`)**: Restricciones condicionales (`is_broadcast -> dst_mac == 48'hFF_FF_FF_FF_FF_FF;`).
- **Resolver antes (`solve a before b`)**: Controla el orden de prioridad de muestreo en distribuciones de probabilidad conjunta.

---

## Generación automatizada de bancos de prueba

En Axiom Studio, los ingenieros pueden utilizar el **Editor visual de estímulos** (`StimulusGeneratorModal.tsx`) para generar bancos de prueba aleatorios restringidos reproducibles mediante semilla (`tb_<top>.v`) con exportación de HDL en un solo clic.
