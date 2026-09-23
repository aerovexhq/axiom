# Visores de microarquitectura y multi-troquel (Multi-Die)

Axiom EDA proporciona herramientas dedicadas de inspección microarquitectónica (`crates/ir/src/microarch/`, `MicroarchViewer.tsx`, `MultiDieViewer.tsx`, `PpaParetoViewer.tsx`). Estas herramientas detectan automáticamente rutas de datos de procesadores, unidades aritmético-lógicas (ALU), bancos de registros y máquinas de estados, así como encapsulados modernos de chiplets multi-troquel (Multi-Die) en 2.5D/3D.

---

## Detección automatizada de rutas de datos

El elaborador RTL inspecciona la estructura del módulo e infiere bloques microarquitectónicos estándar:

```
+-------------------------------------------------------------------------------+
| Microarchitecture Datapath Detector:                                          |
| Detected: 1 ALU (32-Bit) | 1 RegFile (32x32) | 1 FSM Controller (5 States)     |
+-------------------------------------------------------------------------------+
| ALU Inspector Modal:                                                          |
| - Opcode: 4'b0010 (ADD) | Operand A: 0x0000_0020 | Operand B: 0x0000_0014     |
| - Result: 0x0000_0034   | Zero Flag: 0           | Overflow: 0                |
+-------------------------------------------------------------------------------+
| FSM Bubble Diagram: [IDLE] --start--> [READ] --ready--> [EXEC] --done--> [IDLE]
+-------------------------------------------------------------------------------+
```

### 1. Inspector de operaciones de ALU
Detecta automáticamente bloques aritméticos gobernados por multiplexores. Muestra selecciones de códigos de operación activos (ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT) y evaluaciones de operandos de registros en vivo.

### 2. Inspector de banco de registros (RegFile)
Detecta matrices de memoria multipuerto (`reg [31:0] registers [0:31]`). Proporciona una cuadrícula interactiva de 32 filas que muestra contenidos hexadecimales en vivo de todos los registros arquitectónicos con resaltado de pulsos de escritura en tiempo real.

### 3. Visualizador de burbujas de estados de FSM (`FsmViewer.tsx`)
Extrae automáticamente vectores de estado y matrices de transición de máquinas de estados finitos (FSM):
- Representa un gráfico dirigido interactivo con burbujas de estado y flechas de transición.
- Ilumina la burbuja del estado actualmente activo durante la simulación en vivo.
- Audita la estructura de la FSM: detecta estados inalcanzables, estados trampa terminales y ramas de recuperación por defecto faltantes.

---

## Empaquetado de silicio Multi-Die 2.5D y 3D

Para arquitecturas modernas de chiplets y múltiples troqueles (como AMD UltraScale+ Stacked Silicon Interconnect):
- **Distribución del sustrato intercalador**: Visualiza interposers de silicio que conectan múltiples troqueles de lógica activos (SLR).
- **Interconexión troquel a troquel (Super Long Lines - SLL)**: Analiza el ancho de banda, la latencia de propagación y el sesgo a través de micro-bumps que conectan troqueles físicos.

---

## Explorador de compromisos de Pareto PPA

El visor PPA analiza las compensaciones del diseño a través de tres métricas de ingeniería fundamentales:
- **Potencia (mW)**: Consumo de energía total dinámico y por corrientes de fuga.
- **Rendimiento (MHz)**: Frecuencia de reloj máxima alcanzable derivada del análisis de temporización estática (STA).
- **Área (LUTs / FFs)**: Huella total de recursos de silicio.

El visualizador traza fronteras de configuración óptimas de Pareto, permitiendo a los diseñadores seleccionar el equilibrio de canalización óptimo para perfiles operativos de alto rendimiento o bajo consumo de energía.
