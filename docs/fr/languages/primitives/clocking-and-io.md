# Tampons d'horloge et primitives d'E/S

Les primitives d'horloge et d'E/S contrôlent les réseaux de distribution d'horloge globaux et l'interfaçage électrique avec les broches externes.

---

## Tampons d'horloge globaux (`BUFG`, `BUFGCE`)

Les tampons d'horloge globaux pilotent des épines dorsales de distribution d'horloge dédiées à forte sortance et faible gigue couvrant l'ensemble de la puce FPGA :

### 1. `BUFG`
Tampon d'horloge global simple connectant une broche d'oscillateur ou une sortie PLL au réseau d'horloge global :
```verilog
BUFG u_bufg (
    .O (sys_clk_global),
    .I (sys_clk_pin)
);
```

### 2. `BUFGCE` (Tampon avec validation d'horloge)
Tampon d'horloge commandé sans glitch. Désactiver `CE` bloque la sortie d'horloge à l'état bas sans générer d'impulsions parasites dangereuses :
```verilog
BUFGCE u_bufgce (
    .O  (gated_clk),
    .I  (sys_clk),
    .CE (clock_enable)
);
```

---

## Tampons d'entrée et de sortie (`IBUF`, `OBUF`)

Les tampons d'entrée et de sortie interfacent la logique interne avec les broches physiques du boîtier :
- **`IBUF`** : Tampon d'entrée asymétrique standard (`.O(internal_wire), .I(external_pin)`).
- **`OBUF`** : Tampon de sortie asymétrique standard (`.O(external_pin), .I(internal_wire)`).
- **`OBUFT`** : Tampon de sortie trois états avec validation active à l'état bas (`.T`).
