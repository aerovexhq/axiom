# Taktpuffer & E/A-Primitiven

Taktungs- und E/A-Primitiven steuern globale Taktverteilungsnetze und die externe elektrische Pin-Schnittstelle.

---

## Globale Taktpuffer (`BUFG`, `BUFGCE`)

Globale Taktpuffer treiben dedizierte Taktverteilungsleitungen mit hohem Fanout und geringem Skew über den gesamten FPGA-Die:

### 1. `BUFG`
Einfacher globaler Taktpuffer, der einen Oszillator-Pin oder PLL-Ausgang mit dem globalen Taktnetzwerk verbindet:
```verilog
BUFG u_bufg (
    .O (sys_clk_global),
    .I (sys_clk_pin)
);
```

### 2. `BUFGCE` (Taktaktivierungs-Puffer)
Glitch-freier getorster Taktpuffer. Das Deaktivieren von `CE` schaltet den Taktausgang auf Low, ohne gefährliche Runt-Impulse zu erzeugen:
```verilog
BUFGCE u_bufgce (
    .O  (gated_clk),
    .I  (sys_clk),
    .CE (clock_enable)
);
```

---

## Eingangs- & Ausgangspuffer (`IBUF`, `OBUF`)

Eingangs- und Ausgangspuffer verbinden die interne Logik mit den physischen Gehäuse-Pins:
- **`IBUF`**: Standardmäßiger unsymmetrischer Eingangspuffer (`.O(internal_wire), .I(external_pin)`).
- **`OBUF`**: Standardmäßiger unsymmetrischer Ausgangspuffer (`.O(external_pin), .I(internal_wire)`).
- **`OBUFT`**: Tri-State-Ausgangspuffer mit aktiv-niedrigem Enable (`.T`).
