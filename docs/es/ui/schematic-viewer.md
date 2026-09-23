# Visualizador esquemático interactivo de DAG de compuertas IEEE

El visualizador esquemático de Axiom EDA traduce netlists Verilog analizadas en un grafo acíclico dirigido (DAG) interactivo de alto rendimiento renderizado en un Canvas HTML5 acelerado. Proporciona visibilidad a nivel de compuertas con precisión de ciclo en conos de lógica combinacional, biestables, macros aritméticas y rutas de buses.

---

## Enrutamiento de cables libre de colisiones de grado Vivado

Los visualizadores EDA heredados a menudo generan cableados enredados y cruzados difíciles de rastrear. Axiom incorpora un avanzado algoritmo de enrutamiento por canales ortogonales:

```
+-------+                                     +-------+
| In A  |--------[ Straight Track ]---------> | In 0  |
+-------+                                     | AND1  |
                                       +----> | In 1  |
+-------+       +--------+             |      +---+---+
| In B  |------>|  INV1  |-------------+          |
+-------+       +--------+                        V
                                              [ Out F ]
```

### 1. Alineación de filas de rutas de datos en cuadrícula
Los puertos de entrada, puertas lógicas y pines de salida se dividen en capas lógicas de ruta de datos ($L_0, L_1, \dots, L_n$). Los pines conectados se alinean matemáticamente a lo largo de filas verticales idénticas ($Y_{\text{out}} = Y_{\text{in}}$), lo que permite que las conexiones principales se representen como líneas horizontales rectas con **cero giros**.

### 2. Avance de destinos en múltiples capas
Cuando una interconexión abarca múltiples capas ($dx \ge 150\text{px}$), la conexión mantiene su pista horizontal de origen y ejecuta su quiebre vertical en el canal abierto dedicado inmediatamente antes del pin de destino ($dstX - 28$).

### 3. Placas de protección de texto (Knockout Plates)
Cada etiqueta de instancia de puerta (`inv1`, `and1`, `or1`) e identificador de pin se representa sobre una placa de fondo protectora sólida (`#0c1017`). Esto evita por completo que los cables se superpongan o corten las anotaciones textuales.

### 4. Desvíos de canales conscientes de obstáculos
El motor de enrutamiento (`routeOrthogonalEdge`) mantiene dinámicamente cuadros delimitadores de separación (`KeepOutBox`) alrededor de las puertas intermedias, desviando los cables de forma limpia a través de canales verticales abiertos.

---

## Navegación del lienzo y centrado dinámico

- **Desplazamiento infinito**: Haga clic y arrastre cualquier área vacía en el lienzo para desplazarse por netlists extensas.
- **Zoom suave con rueda**: Desplace el trackpad o la rueda del ratón para ampliar o reducir continuamente entre el 10% y el 500%.
- **Anclaje dinámico del punto medio de cámara**: Al arrastrar el divisor redimensionable central, el `ResizeObserver` de Axiom bloquea matemáticamente el punto medio de la cámara en el espacio mundial al centro del panel visualizador:
  $$\Delta \text{offsetX} = \frac{\Delta W}{2}, \quad \Delta \text{offsetY} = \frac{\Delta H}{2}$$
  Esto mantiene el esquemático perfectamente centrado y estable sin compresiones horizontales ni saltos de zoom.

---

## Sondeo de señales en vivo y HUD

Posar el cursor o hacer clic en cualquier cable o puerta proporciona introspección instantánea de hardware:
- **Sondeo de conexiones (Wire Probing)**: Muestra el nombre de la red, el ancho en bits y el valor lógico en tiempo real (`0`, `1`, `X`, `Z`).
- **Tarjeta flotante con seguimiento del cursor**: Sigue el puntero con restricción de límites para mantener los detalles dentro del área visible.
- **HUD de tabla de verdad de puertas**: Al hacer clic en cualquier puerta combinacional (AND, OR, XOR, INV, MUX) se muestra una tabla de verdad flotante resaltando el vector de entrada activo y el estado de salida resultante.
- **Resaltado del cono de lógica**: Al seleccionar cualquier red se ilumina en cian neón todo su cono de entrada (fan-in) aguas arriba y destinos de salida (fan-out) aguas abajo.
