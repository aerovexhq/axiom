# Editor de código Monaco HDL y servidor de lenguaje

El editor de código HDL de Axiom integra Monaco Editor de Microsoft con un demonio de protocolo de servidor de lenguajes (LSP) en RAM para Verilog, SystemVerilog y VHDL (`crates/lsp`). Combina resaltado de sintaxis, comprobación estática de reglas de diseño en tiempo real, información sobre herramientas al posar el cursor sobre el AST y fragmentos de autocompletado en un IDE de grado aeroespacial.

---

## El tokenizador Monarch HDL

Axiom incluye un tokenizador Monarch personalizado diseñado específicamente para IEEE 1364 Verilog, IEEE 1800 SystemVerilog e IEEE 1076 VHDL.

### Estilo visual (`axiom-dark`)
El editor tiene el estilo de la paleta oscura de Axiom:
- **Palabras clave** (`module`, `always_ff`, `assign`, `wire`, `reg`): Cian de alto contraste (`#00f0ff`)
- **Tareas del sistema y funciones** (`$display`, `$finish`, `$time`, `$clog2`): Violeta (`#a855f7`)
- **Cadenas**: Ámbar (`#fbbf24`)
- **Números y literales con tamaño** (`8'hFF`, `1'b0`, `32'd100`): Verde esmeralda (`#34d399`)
- **Comentarios** (`//`, `/* ... */`): Pizarra apagado (`#64748b`)
- **Identificadores y nombres de señales**: Blanco suave (`#f1f5f9`)

---

## Linter estático en RAM en tiempo real

A diferencia de las herramientas heredadas que requieren secuencias de compilación de varios minutos para señalar errores sintácticos o riesgos de diseño, el linter de Axiom opera continuamente en RAM con una ventana de estabilización de 250 ms.

### Reglas de diseño estático integradas

| ID de regla | Severidad | Name | Descripción y peligro prevenido |
| :--- | :--- | :--- | :--- |
| `AXIOM_W001` | Advertencia | **Asignación bloqueante en secuencial** | El uso de asignaciones bloqueantes (`=`) dentro de bloques temporizados (`always @(posedge clk)`) introduce condiciones de carrera entre simulación y síntesis. |
| `AXIOM_W002` | Advertencia | **Asignación no bloqueante en combinacional** | El uso de asignaciones no bloqueantes (`<=`) en bloques combinacionales (`always @*`) crea peligros de carrera multidelta y discrepancias de síntesis. |
| `AXIOM_W003` | Advertencia | **Red sin controlador** | Un hilo o red declarada no tiene conectado ningún excitador continuo (`assign`), salida de primitiva ni excitador de submódulo. |
| `AXIOM_W004` | Advertencia | **Señal no utilizada** | Un registro o red declarada se escribe o define pero nunca se lee en ningún cono de lógica posterior. |
| `AXIOM_E002` | Error | **Contención de múltiples controladores** | Múltiples asignaciones continuas o excitadores simultáneos excitan la misma red, causando cortocircuitos eléctricos y contención `X`. |
| `AXIOM_W006` | Advertencia | **Latch transparente inferido** | Ramas condicionales incompletas (`if` sin `else`, o `case` sin todas las opciones) infieren latches transparentes no intencionados. |
| `AXIOM_W007` | Advertencia | **Falta el caso por defecto en case** | Una sentencia `case` no incluye rama `default:`, arriesgando bloqueo de estado en vectores no cubiertos. |
| `AXIOM_W008` | Advertencia | **Discrepancia de ancho de bits** | El ancho de asignación de red o puerto difiere entre las expresiones izquierda y derecha, lo que provoca truncamiento silencioso de bits. |

Líneas onduladas aparecen directamente debajo de los elementos infractores en el editor. Al hacer clic en cualquier tarjeta de error en el panel **Problemas y Linter**, el cursor del editor salta de inmediato a la línea y columna exactas.

---

## Tarjetas flotantes (hover) del AST

Posar el cursor del ratón sobre cualquier identificador en el editor abre una información sobre herramientas interactiva con metadatos del AST:
- **Declaración de señal**: Muestra el tipo de conexión (`wire`, `reg`, `logic`), rango de bits (`[31:0]`) y signo.
- **Ubicación del excitador**: Muestra el número exacto de línea donde la señal se asigna o excita.
- **Documentación de primitivas Xilinx**: Al posar el cursor sobre primitivas de hardware (`LUT6_2`, `DSP48E2`, `RAMB36E2`, `BUFG`, `CARRY8`) se muestra la documentación completa de terminales, parámetros de tablas de verdad y descripciones funcionales.

---

## Autocompletado inteligente

El servidor de lenguaje (LSP) de Axiom ofrece autocompletados instantáneos:
- **Palabras clave IEEE 1364/1800**: Generación automática de plantillas para `module`, `always_ff`, `always_comb`, `case` y `generate`.
- **Tareas del sistema**: Plantillas de argumentos formateados para `$display`, `$monitor`, `$finish` y `$dumpvars`.
- **Señales en el ámbito**: Sugiere redes, registros y parámetros declarados dentro de la jerarquía del módulo activo.
- **Primitivas Xilinx Serie 7 / UltraScale+**: Plantillas completas de instanciación con mapeo de puertos para celdas de hardware.

---

## Ergonomía del editor y persistencia

- **Gestión de archivos con múltiples pestañas**: Abra múltiples fuentes de diseño simultáneamente. Las pestañas activas persisten tras recargar el navegador.
- **Navegación por migas de pan (Breadcrumbs)**: La barra de ruta sobre el editor muestra el proyecto actual, conjunto de archivos, archivo activo y módulo principal.
- **Persistencia de la posición del visor**: La posición de desplazamiento del editor Monaco (línea vertical y desplazamiento horizontal) se almacena en caché por archivo en `localStorage`, de modo que al regresar a un archivo se restaura la vista exacta.
