# Servidor de lenguaje VHDL y reglas de linter

Axiom EDA incorpora un servidor de lenguaje VHDL dedicado (`crates/lsp/src/vhdl.rs`) que proporciona verificación sintáctica, auditoría de coherencia de tipos y comprobación de reglas de diseño directamente en el editor Monaco.

---

## Reglas de diagnóstico para VHDL

| ID de regla | Severidad | Descripción | Corrección |
| :--- | :--- | :--- | :--- |
| `VHDL_W001` | Advertencia | **Lista de sensibilidad incompleta**: Falta una señal leída dentro de un proceso combinacional en la lista de sensibilidad. | Agregue la señal faltante a `process(...)` o use `process(all)` (VHDL-2008). |
| `VHDL_W002` | Advertencia | **Latch inferido**: Las ramas `if-then-else` o `case-when` incompletas en un proceso combinacional infieren un latch transparente no deseado. | Cubra todas las ramas o asigne un valor predeterminado antes de las comprobaciones condicionales. |
| `VHDL_E001` | Error | **Discrepancia de tipos**: Intento de asignar `std_logic_vector` directamente a `unsigned` o `integer` sin conversión. | Use `to_integer()`, `unsigned()` o `std_logic_vector()` de forma explícita. |
| `VHDL_W003` | Advertencia | **Señal no utilizada**: Una señal declarada en la arquitectura nunca se asigna ni se lee. | Elimine la declaración de señal inerte. |
| `VHDL_E002` | Error | **Contención de múltiples controladores**: Múltiples asignaciones concurrentes excitan la misma señal resuelta. | Utilice una única asignación multiplexada. |
