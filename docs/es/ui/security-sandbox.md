# Confianza del proyecto y aislamiento en sandbox del espacio de trabajo

Axiom EDA está diseñado para el desarrollo seguro de hardware digital. Debido a que los archivos de descripción de hardware y los modelos de simulación pueden ejecutar bucles procedimentales complejos o importar contenidos de memoria externos, Axiom implementa un **sistema de permisos de confianza de proyectos**, una **protección de entorno aislado (sandbox) en el sistema de archivos del host** y **cuotas de almacenamiento configurables** de grado aeroespacial.

---

## Sistema de permisos de confianza del proyecto

Al abrir o importar un paquete de proyecto externo (`.json`) de una fuente o colega no confiable, Axiom protege la máquina host abriendo el proyecto en **Modo restringido** de forma predeterminada.

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### Matriz de modo restringido frente a confiable

| Característica | Modo restringido | Modo confiable |
| :--- | :--- | :--- |
| **Ejecución de simulación** | Permitido (límites estrictos de bucle) | Permitido (rendimiento completo) |
| **Máximo de ciclos delta (\(\delta\))** | 50,000 ciclos / paso | 100,000 ciclos / paso (configurable) |
| **Límite de asignación de memoria** | 64 KWords (256 KB) | 16 MWords (64 MB) |
| **Exportación al sistema de archivos del host** | Bloqueado | Permitido |
| **Aislamiento del directorio de datos** | Estrictamente aplicado (`.axiom/data/`) | Aplicado de forma predeterminada |
| **Indicador de cabecera** | Alerta de escudo `[ Modo restringido ]` | Insignia sutil de proyecto |

Los ingenieros pueden modificar el estado de confianza en cualquier momento haciendo clic en la insignia `[ Modo restringido ]` en el encabezado o mediante **Ajustes del proyecto y seguridad...** en el menú del proyecto.

---

## Protección de entorno aislado (sandbox) en el sistema de archivos del host

Para instalaciones de escritorio nativas (Tauri v2), Axiom impone contención de rutas a nivel de núcleo en el backend de Rust (`crates/desktop/src/lib.rs`) a través de `validate_sandboxed_path`:

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### Protecciones de aislamiento en entorno aislado (sandbox)
1. **Normalización de rutas multiplataforma**: Convierte automáticamente barras invertidas de Windows (`\`) y barras diagonales de Unix (`/`), eliminando prefijos textuales (`\\?\`).
2. **Bloqueo de salto de directorios**: Prohíbe estrictamente secuencias de salto al directorio superior `..` tanto en la cadena de entrada como en la ruta canónica resuelta.
3. **Lista de bloqueo de directorios sensibles del sistema**: Prohíbe leer o escribir en directorios críticos del sistema operativo:
   - Linux/macOS: `/etc`, `/proc`, `/sys`, `/boot`, `/root`, `/bin`, `/sbin`, `/usr`
   - Windows: `C:\Windows`, `C:\System32`, `C:\Program Files`
4. **Cuarentena del almacén de credenciales**: Bloquea todas las operaciones que acceden a claves privadas, credenciales y almacenes de autenticación:
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Cobertura de comandos IPC de Tauri**: Cada invocación IPC del sistema de archivos (`fs_read_file`, `fs_write_file`, `fs_remove_file`, `fs_list_dir`, `fs_create_dir`, `fs_exists`) está protegida por `validate_sandboxed_path`. Las solicitudes de rutas no autorizadas devuelven inmediatamente un error `[SandboxViolation]`.

---

## Cuotas de almacenamiento configurables

Para evitar que archivos descontrolados de trazas de simulación (`.vcd`, `.saif`) o bucles sintéticos agoten el espacio en disco del host, Axiom impone cuotas de almacenamiento a nivel de bytes:

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### Opciones de cuota de almacenamiento
- **10 MB**: Huella mínima para prácticas ligeras a nivel de compuertas.
- **25 MB**: Adecuado para FSM estándar y diseños de procesadores pequeños.
- **50 MB (Por defecto)**: Cuota estándar de ingeniería que admite miles de ciclos de simulación y trazas de formas de onda.
- **100 MB / 250 MB / 500 MB**: Límites ampliados para ejecuciones de verificación profunda, formas de onda VCD de varios megabytes y netlists posteriores a la síntesis.
- **Ilimitado**: Asignación sin límites para proyectos empresariales masivos.

La aplicación de cuotas está activa tanto en el almacenamiento IndexedDB del navegador (`BrowserIndexedDbFileSystem`) como en el almacenamiento de escritorio nativo (`TauriIpcFileSystem`). Intentar escribir más allá de la cuota genera una excepción limpia `[StorageQuota]` sin bloquear el entorno de ejecución.

---

## Directorio dedicado de datos generados (`.axiom/data/`)

Axiom aísla todas las salidas generadas en una subcarpeta dedicada del espacio de trabajo:
- Value Change Dumps (`.vcd`)
- Archivos de formato de intercambio de actividad de conmutación (`.saif`)
- Informes de temporización estática (`timing_report.txt`)
- Netlists estructurales de Verilog mapeadas (`synth_netlist.v`)
- Capturas de paquetes de protocolo (`.pcap`)

### Subsistema de purga de datos en 1 clic
El **Modal de seguridad del proyecto** proporciona un botón de 1 clic **Purgar datos generados**. Esta operación borra todo el contenido de `.axiom/data/`, restableciendo instantáneamente el uso de almacenamiento a los archivos fuente originales sin modificar ni eliminar ningún archivo Verilog, SystemVerilog, VHDL o XDC.
