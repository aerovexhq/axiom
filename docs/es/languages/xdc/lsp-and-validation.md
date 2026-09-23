# Servidor de lenguaje Monaco XDC y validación

Axiom EDA cuenta con un servidor de lenguaje (LSP) dedicado y resaltador de sintaxis para restricciones de diseño Xilinx (`crates/lsp/src/xdc.rs`).

---

## Verificación de sintaxis XDC en tiempo real

El servicio de lenguaje Monaco XDC opera directamente dentro de archivos `.xdc` en el editor:
- **Validación de comandos Tcl**: Reconoce `set_property`, `create_clock`, `create_generated_clock`, `set_input_delay`, `set_output_delay`, `set_false_path`, `set_clock_groups`, `set_multicycle_path`.
- **Gestión de comentarios**: Analiza con precisión los comentarios de línea que comienzan con `#`, evitando advertencias de sintaxis falsas en configuraciones de pines comentadas.
- **Validación de consulta de puertos**: Verifica que los puertos referenciados dentro de `[get_ports <name>]` existan en el módulo principal del diseño activo.

---

## Autocompletados inteligentes

Escribir dentro de un archivo `.xdc` activa fragmentos de autocompletado contextual:
- **Vinculación de pin de encapsulado**: `set_property PACKAGE_PIN <PIN> [get_ports <PORT>]`
- **Asignación de estándar de E/S**: `set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **Reloj principal**: `create_clock -period 10.000 -name <NAME> [get_ports <PORT>]`
- **Ruta falsa**: `set_false_path -from [get_ports <PORT>]`
