# Resumen del espacio de trabajo de Axiom Studio

Axiom Studio es una interfaz de automatización de diseño electrónico (EDA) multiplataforma y de grado aeroespacial diseñada de forma nativa en Rust y React 19. Ofrece un espacio de trabajo unificado y de alto rendimiento que combina un editor de código Monaco HDL ágil con esquemas sincronizados a nivel de compuertas, formas de onda digitales, placas de pruebas de hardware táctiles, analizadores de temporización estática (STA) y floorplanning físico de silicio.

---

## Arquitectura del espacio de trabajo

Axiom Studio abandona las interfaces multiventana lentas y fragmentadas de las herramientas EDA heredadas en favor de un espacio de trabajo coherente de doble panel:

```
+-------------------------------------------------------------------------------+
| Header: Brand | File Sets | Simulation Ribbon (Run, Step, Reset) | PDN Gauges |
+---------------------------------------+---------------------------------------+
| Left Pane (Monaco HDL Editor)         | Right Pane (Dynamic Visualizers)      |
|                                       | - Schematic DAG Visualizer            |
| - Verilog / SystemVerilog / VHDL      | - Virtual Lab & Basys 3 FPGA Bay      |
| - In-RAM LSP Real-Time Linter         | - Waveforms & Logic Analyzer          |
| - Monarch Tokenizer & Autocomplete    | - Timing Radar & Static Timing        |
| - AST Hover Cards & Breadcrumbs       | - Technology Mapping Studio           |
|                                       | - Floorplanning & Silicon Die         |
|                                       | - Formal Verification (BMC)           |
|                                       | - Protocol Analyzer & Dissector       |
|                                       | - Microarchitecture & Multi-Die       |
+---------------------------------------+---------------------------------------+
| Unified Bottom Dock: Console & REPL | Problems & Linter | Telemetry Radar     |
+-------------------------------------------------------------------------------+
```

### 1. Cabecera y cinta de comandos de simulación
La cabecera superior de navegación aloja etiquetas de identidad del proyecto, el selector de conjuntos de archivos de Vivado y la cinta de ejecución de simulación. Permite compilación instantánea, ejecución, pausa, avance discreto de ciclos delta (ciclo delta de tiempo cero (ciclo δ)) y rebobinado del tiempo de simulación. Los medidores de telemetría de la red de distribución de energía (caída de tensión inductiva en PDN (IR + L di/dt)) en tiempo real informan sobre potencia dinámica en milivatios ($P$), caída de tensión inductiva ($V_{\text{sag}}$) y corriente de alimentación total ($I$).

### 2. Panel izquierdo: Editor de código Monaco HDL
Una instancia personalizada de Microsoft Monaco Editor configurada con el tokenizador Monarch Verilog/SystemVerilog de Axiom, tema acrílico oscuro (`axiom-dark`), información flotante (hover) del AST en tiempo real y diagnósticos de Language Server Protocol (LSP) en RAM.

### 3. Panel derecho: Bahía de visualizadores
Un lienzo de altura y ancho completo que aloja las herramientas de análisis visual de Axiom:
- **DAG esquemático**: Visualizador de netlists a nivel de compuertas IEEE en tiempo real con enrutamiento de canales ortogonales libre de colisiones.
- **Laboratorio virtual**: Placa de pruebas de hardware táctil con interruptores, LED y pantallas de 7 segmentos de la placa Digilent Basys 3 Artix-7.
- **Formas de onda**: Analizador lógico digital a más de 60 FPS con ventanas de arrastrar para medir e inspección de ciclos delta de tiempo cero (ciclo δ).
- **Radar de temporización**: Análisis de temporización estática (STA) topológico que muestra cascadas de rutas críticas e histogramas de margen de setup/hold.
- **Mapeo tecnológico**: Mapeo tecnológico a nivel de compuertas que reduce el RTL a primitivas de la FPGA de destino (LUTs, DSP48E2, RAMB36E2).
- **Floorplanning**: Estudio de floorplanning de silicio 2D que muestra la ubicación de sitios CLB, mapas de calor térmicos y líneas de vuelo de enrutamiento.
- **Verificación formal**: Comprobación de modelos acotados (BMC) y verificación de $k$-inducción para aserciones de SystemVerilog (SVA).
- **Analizador de protocolos**: Disectores serie de hardware para UART, SPI, I2C, bus CAN, USB y Ethernet.
- **Microarquitectura**: Detección automatizada de rutas de datos, inspectores de ALU, vistas de memoria de RegFile y grafos de burbujas de estados de FSM.

### 4. Divisor central redimensionable
Un divisor adaptable que permite a los ingenieros ajustar el equilibrio entre el editor y el visualizador. Axiom cuenta con anclaje dinámico del punto medio de la cámara: arrastrar el divisor recalcula continuamente el punto medio de la cámara en el espacio del lienzo, evitando la deformación esquemática o la pérdida de zoom.

### 5. Panel inferior unificado
Un panel inferior plegable que organiza herramientas de análisis secundarias en pestañas limpias:
- **Consola y REPL**: Salidas interactivas del compilador Verilog, registro de sentencias `$display` y estado de la simulación.
- **Problemas y linter**: Tarjetas de diagnóstico activas con navegación en 1 clic a la línea de advertencias de sintaxis y reglas de diseño.
- **Telemetría**: Medidores analógicos de telemetría de silicio para tensión de alimentación del núcleo, caída inductiva y corriente de conmutación.
- **Vista previa de formas de onda**: Vista compacta de formas de onda cuando se trabaja en modos esquemáticos divididos.

---

## Atajos de teclado globales

| Atajo | Acción | Descripción |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | **Guardar proyecto** | Persiste todos los archivos de diseño y metadatos en disco o IndexedDB |
| `Ctrl + Enter` / `Cmd + Enter` | **Compilar y ejecutar** | Compila el diseño activo en RAM mediante compilación JIT en RAM con Cranelift e inicia el reloj |
| `Espacio` | **Ejecutar / Pausar** | Alterna la ejecución del motor de simulación |
| `F10` | **Avanzar +1 ns** | Avanza el tiempo físico de simulación exactamente 1,000 picosegundos |
| `Shift + F10` | **Avanzar +100 ps** | Avanza el tiempo físico de simulación exactamente 100 picosegundos |
| `F11` | **Avanzar ciclo delta (\(\delta\))** | Avanza un único ciclo delta de tiempo cero (ciclo δ) discreto sin avanzar el tiempo físico |
| `Ctrl + R` / `Cmd + R` | **Reiniciar simulación** | Rebobina el reloj de simulación a \(t=0\) y restaura los vectores iniciales de señal |
| `Ctrl + Alt + F` | **Floorplan Studio** | Abre el visualizador de floorplanning físico del silicio de la FPGA |
| `Ctrl + P` / `Cmd + P` | **Abrir archivo rápidamente** | Abre la paleta de búsqueda Omnibar para saltar entre fuentes del proyecto |
| `Ctrl + \`` | **Alternar panel inferior** | Expande o pliega el panel inferior unificado |
| `Ctrl + B` / `Cmd + B` | **Alternar barra lateral** | Muestra u oculta la barra lateral de conjuntos de archivos del proyecto Vivado |
| `Escape` | **Cerrar modal / Deseleccionar** | Cierra cuadros de diálogo activos, inspectores o borra la selección de redes |

---

## Studio móvil y panel lateral adaptable

Al operar en dispositivos móviles o ventanas estrechas de navegador (ancho \(\le 768\text{px}\)), Axiom Studio se adapta automáticamente:
- Los divisores redimensionables de múltiples paneles se deshabilitan para eliminar vistas abarrotadas.
- Un cajón deslizante fuera del lienzo (`MobileDrawer.tsx`) proporciona acceso a conjuntos de archivos del proyecto, controles de simulación y selección de vistas.
- La interfaz se renderiza en modo **1 panel a la vez**, asignando el 100% del ancho y alto de la pantalla a la vista activa.
- Una barra inferior móvil práctica (`MobileBottomBar.tsx`) proporciona 5 pestañas de navegación principales: **Código**, **Esquema**, **Laboratorio**, **Ondas** y **Consola**, complementada con insignias de problemas en vivo.
