# Ciclo de vida de proyectos y conjuntos de archivos

Axiom EDA implementa un sistema de gestión de proyectos auténtico de grado Vivado combinado con persistencia web ligera e integración con el sistema de archivos de escritorio. Los proyectos mantienen una separación estricta entre fuentes RTL de diseño, bancos de pruebas de simulación y restricciones físicas/temporales.

---

## El panel de bienvenida

Cuando se inicia sin un proyecto abierto, Axiom presenta un panel de bienvenida limpio y de grado aeroespacial:

```
+-------------------------------------------------------------------------------+
| Axiom EDA v1.0.0 — In-RAM Cranelift JIT & Silicon Telemetry Engine            |
+---------------------------------------+---------------------------------------+
| [ Create New Project ]                | [ Open Project from File ]            |
| Wizard with device selection          | Import serialized .json bundle        |
+---------------------------------------+---------------------------------------+
| Starter Engineering Blueprints (1-Click Launch):                              |
| 1. Logic Circuit (Gate-Level Booleans)| 5. SPI Master Controller              |
| 2. UART Transceiver (115200 Baud)     | 6. FSM Traffic Controller             |
| 3. Synchronous FIFO Buffer (32x8)     | 7. IUC Cerrahpasa Digital Logic Lab   |
| 4. 32-Bit Arithmetic Logic Unit (ALU) |                                       |
+-------------------------------------------------------------------------------+
| Recent Projects: [ Active Projects (3) ]  |  [ Trashed Projects (1) ]         |
+-------------------------------------------------------------------------------+
```

### Plantillas de inicio
Axiom proporciona 7 proyectos base probados en la industria:
1. **Circuito de lógica combinacional**: Sistema de lógica booleana a nivel de puertas que calcula \(F = ((\neg A \land B) \land C) \lor \neg B\) con 9 celdas de puertas (`inv1`, `inv2`, `and1`, `and2`, `or1`) y bahía táctil dedicada en el Laboratorio Virtual.
2. **Transceptor UART**: Canal completo de transmisión y recepción con 8 bits de datos, 1 bit de parada, generador de reloj por sobremuestreo y registros de estado.
3. **Búfer FIFO síncrono**: Búfer de memoria circular 32x8 de doble puntero con banderas de lleno, vacío, casi lleno y casi vacío.
4. **ALU de 32 bits**: Unidad aritmético-lógica que implementa sumas, restas, desplazamientos de barril, comparaciones y lógica booleana con signo IEEE, con detección de bandera de cero y desbordamiento.
5. **Maestro SPI**: Interfaz de periferia en serie de grado control de motores compatible con los Modos 0, 1, 2 y 3 con divisores de reloj programables.
6. **Controlador de tráfico FSM**: Máquina de estados finitos para intersección de 4 vías con secuencias de verde, amarillo y rojo, latches de solicitud peatonal y contadores de tiempo.
7. **Laboratorio de lógica digital IUC Cerrahpasa**: Proyecto de curso de la Universidad de Estambul - Cerrahpasa con `uygulama_0.v`, bancos de pruebas automatizados y restricciones Artix-7 para Basys 3.

---

## Estructura de conjuntos de archivos de Vivado

Axiom organiza los archivos del proyecto en categorías estándar de conjuntos de archivos de Vivado:

```
project_root/
|-- sources_1/           # Design Sources
|   |-- logic_circuit.v  # Primary RTL implementation [TOP]
|   `-- uart_tx.v        # Submodules
|-- sim_1/               # Simulation Sources
|   `-- tb_circuit.v     # Testbench harness
`-- constrs_1/           # Physical & Timing Constraints
    `-- timing.xdc       # XDC pinouts and clock declarations
```

### 1. Fuentes de diseño (`sources_1`)
Contiene todos los módulos de hardware sintetizables implementados en Verilog, SystemVerilog o VHDL.
- **Designación de módulo superior (`[TOP]`)**: El módulo raíz activo para síntesis, generación de esquemáticos y floorplanning físico. Puede designar cualquier módulo como superior mediante el menú de 3 puntos verticales en la tarjeta del archivo.
- **Acción Añadir fuente (`+`)**: Al hacer clic en el botón `+` en la cabecera de fuentes de diseño se abre `AddSourceModal` con la categoría `sources_1` preseleccionada.

### 2. Fuentes de simulación (`sim_1`)
Contiene bancos de pruebas (`tb_*.v`), vectores de estímulo y secuencias de verificación. Los archivos de banco de pruebas se excluyen de la síntesis física y el mapeo tecnológico para evitar advertencias erróneas de excitadores múltiples o pines sin restricciones.

### 3. Restricciones (`constrs_1`)
Contiene archivos de restricciones de diseño de Xilinx (`.xdc`) que definen asignaciones de pines del encapsulado FPGA (`PACKAGE_PIN`, `IOSTANDARD`) y objetivos de reloj para análisis de temporización estática (STA) (`create_clock`).

---

## Menú de cabecera del proyecto (`ProjectDropdown`)

La insignia desplegable de proyecto en la parte superior izquierda proporciona acceso directo a operaciones esenciales del ciclo de vida:
- **Guardar proyecto (`Ctrl + S`)**: Vuelca todos los búferes del editor a disco (Escritorio) o a IndexedDB (Web) con confirmación visual instantánea.
- **Exportar paquete de proyecto (`.json`)**: Genera un archivo JSON autónomo y portátil que empaqueta todos los conjuntos de archivos, números de referencia de FPGA de destino, módulo superior activo y opciones de seguridad.
- **Añadir fuente...**: Inicia el asistente de creación de fuentes multiformato.
- **Ajustes del proyecto y seguridad...**: Configura el modo de confianza del proyecto, cuotas de almacenamiento, aislamiento de datos y límites de seguridad de la simulación.
- **Asistente para nuevo proyecto**: Abre el asistente de creación de proyectos.
- **Cerrar proyecto**: Guarda de forma segura el estado activo y regresa al panel de bienvenida (Launchpad) sin perder ediciones no confirmadas.

---

## Ciclo de vida de eliminación a la papelera y recuperación de proyectos

Para evitar la pérdida accidental de datos, Axiom implementa un ciclo de vida de eliminación en dos etapas:
1. **Mover a la papelera**: Accesible mediante el botón de menú kebab de 3 puntos verticales en cualquier tarjeta de proyecto en el Launchpad. Los proyectos descartados guardan inmediatamente `isTrashed: true`, desaparecen de la pestaña Activos e incrementan el contador de la papelera.
2. **Acceso a proyectos eliminados**: Al hacer clic en la pestaña **Papelera** del panel de inicio se muestran todos los diseños eliminados con sus fechas de borrado.
3. **Restaurar proyecto**: Devuelve el proyecto a la pestaña Activos con todos los archivos y configuraciones intactos.
4. **Eliminación permanente**: Muestra un cuadro modal de confirmación (`ConfirmModal.tsx`). Una vez confirmado, borra permanentemente los registros del proyecto y elimina los directorios de almacenamiento asociados del sistema de archivos.
