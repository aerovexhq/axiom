# Rack de laboratorio virtual y emulación de placas

El rack del laboratorio virtual de Axiom une la simulación HDL con las pruebas de hardware físico. Proporciona una emulación auténtica de placa de pruebas digital, lo que permite a estudiantes e ingenieros de FPGA interactuar con sus diseños utilizando interruptores táctiles, botones pulsadores, LED y pantallas de 7 segmentos en tiempo real.

---

## Bahía de placa FPGA Digilent Basys 3

La bahía para FPGA Basys 3 proporciona un gemelo digital preciso de la popular placa de desarrollo Artix-7 de Digilent:

```
+-------------------------------------------------------------------------------+
| Axiom Basys 3 Artix-7 Hardware Emulation Bay                                  |
+-------------------------------------------------------------------------------+
| [SSEG Display:  1 0 4 2 ]       [BTNU]                 [LD15 .. LD0]          |
| Anode: AN3..AN0 Active        [BTNL] [BTNC] [BTNR]     * * * * * * * *        |
| Segments: CA..CG, DP            [BTND]                 O O O O O O O O        |
|                                                                               |
| Tactile Slide Switches:                                                       |
| [SW15] [SW14] [SW13] [SW12] [SW11] [SW10] [SW9] [SW8] ... [SW1] [SW0]         |
|  [ON]   [OFF]  [OFF]  [ON]   [ON]   [OFF]  [OFF] [ON]       [OFF] [ON]        |
+-------------------------------------------------------------------------------+
```

### 1. 16 interruptores deslizantes táctiles (`SW0`..`SW15`)
- Mapeados directamente a puertos de entrada mediante restricciones físicas XDC (`PACKAGE_PIN V17`, etc.).
- Hacer clic de forma interactiva cambia la posición del interruptor con efectos de sonido realistas y persistencia de estado.
- Palancas visuales de alternancia de alto contraste con puntos indicadores verdes.

### 2. 16 LED de montaje superficial (`LD0`..`LD15`)
- Mapeados a puertos de salida mediante restricciones XDC (`PACKAGE_PIN U16`, etc.).
- Renderizado realista con brillo esmeralda que indica estados lógicos altos activos (`1`).

### 3. 5 botones pulsadores momentáneos (`BTNC`, `BTNU`, `BTNL`, `BTNR`, `BTND`)
- Configuración en cruz direccional para botones Centro, Arriba, Izquierda, Derecha y Abajo.
- Al presionar se mantiene en alto lógico (`1`); al soltar regresa a bajo lógico (`0`). Perfecto para pulsos de reinicio manual o avance paso a paso del reloj.

### 4. Pantalla de 7 segmentos multiplexada de 4 dígitos (`SSEG`)
- Implementa escaneo dinámico auténtico cátodo-ánodo.
- Renderiza con precisión los segmentos (`CA` a `CG`) y el punto decimal (`DP`) controlados por líneas de selección de ánodo activas en bajo (`AN0` a `AN3`).

---

## Bahía de lógica combinacional

Diseñada para lógica digital introductoria y verificación de tablas de verdad, la bahía de lógica combinacional proporciona una interfaz táctil dedicada:
- **Entradas interactivas**: Tres interruptores basculantes destacados (`A`, `B`, `C`).
- **Sondas de compuertas**: Pines de evaluación de señales en tiempo real para redes intermedias (`w1`, `w2`, `w3`, `w4`).
- **LED de salida**: Diodo indicador destacado que muestra la salida del circuito `F`.
- **HUD de tabla de verdad de 8 filas sincronizado**: Muestra todas las $2^3 = 8$ combinaciones de entrada ($000$ a $111$). La fila activa se ilumina dinámicamente según los estados actuales de los interruptores, proporcionando confirmación visual inmediata de la corrección booleana.

---

## Calificador automático de laboratorio (`LabGraderModal`)

Diseñado en colaboración con cursos universitarios de diseño digital (incluida la Universidad de Estambul - Cerrahpasa):
- **Verificación automatizada**: Ejecuta automáticamente la matriz de banco de pruebas contra las implementaciones RTL de los estudiantes (`uygulama_0.v`).
- **Tarjetas de calificación ejecutiva**: Calcula puntuaciones porcentuales, precisión de temporización y cobertura funcional.
- **Matriz de vectores de prueba**: Detalla las salidas de señal esperadas frente a las reales en cada paso de simulación.
- **Exportación de informe en Markdown**: Generación en 1 clic de informes formateados de entrega de laboratorio para profesores.
