# Reglas de diagnóstico y linter estático de Axiom

Axiom EDA incorpora un linter de análisis estático en RAM en tiempo real (`crates/lsp/src/linter.rs`). El linter analiza árboles de sintaxis abstracta y conectividad de netlists para detectar riesgos de síntesis, condiciones de carrera de simulación y errores eléctricos mientras se escribe el código.

---

## Catálogo de reglas de diagnóstico

```
+-------------------------------------------------------------------------------+
| Axiom Static Linter Dashboard (Problems Dock)                                 |
| 0 Errors | 2 Warnings | 1 Informational | Real-Time Latency: 1.8 ms           |
+-------------------------------------------------------------------------------+
| [AXIOM_W001] Line 42: Blocking assignment (=) inside clocked sequential block |
| [AXIOM_W007] Line 88: Case statement missing default branch                   |
+-------------------------------------------------------------------------------+
```

### 1. `AXIOM_W001`: Asignación bloqueante en proceso secuencial
- **Severidad**: Advertencia
- **Infracción**: Uso de `=` en lugar de `<=` dentro de un proceso disparado por flanco (`always @(posedge clk)`).
- **Riesgo**: Introduce condiciones de carrera dependientes del simulador donde los valores de los registros pueden leerse antes o después de actualizarse según el orden de ejecución de los hilos.
- **Solución**: Reemplace `=` por `<=`.

### 2. `AXIOM_W002`: Asignación no bloqueante en proceso combinacional
- **Severidad**: Advertencia
- **Infracción**: Uso de `<=` dentro de un proceso sensible por nivel (`always @*` o `always @(a or b)`).
- **Riesgo**: Causa sobrecarga innecesaria de ciclos delta de simulación y posibles discrepancias de síntesis.
- **Corrección**: Reemplace `<=` por `=`.

### 3. `AXIOM_W003`: Red sin controlador
- **Severidad**: Advertencia
- **Infracción**: Un cable o red declarado no tiene ningún controlador continuo (`assign`), salida de compuerta o conexión de puerto de submódulo.
- **Riesgo**: La red permanece permanentemente flotante en alta impedancia (`Z`) o desconocido (`X`).
- **Corrección**: Agregue un controlador o elimine la declaración de red no utilizada.

### 4. `AXIOM_W004`: Señal no utilizada
- **Severidad**: Advertencia
- **Infracción**: Un registro o red declarado se escribe o define pero nunca se lee en ningún cono de lógica posterior.
- **Riesgo**: Área de silicio muerta e inferencia innecesaria de compuertas.
- **Corrección**: Elimine la señal no utilizada o conéctela al consumidor de destino.

### 5. `AXIOM_E002`: Contención de múltiples controladores en red
- **Severidad**: Error
- **Infracción**: Múltiples asignaciones continuas o controladores simultáneos excitan el mismo cable (`wire`).
- **Riesgo**: Cortocircuito eléctrico en el silicio físico; evaluado como contención desconocida (`X`) en simulación.
- **Corrección**: Inserte un multiplexor o asegúrese de que un único controlador gobierne la red.

### 6. `AXIOM_W006`: Latch transparente inferido
- **Severidad**: Advertencia
- **Infracción**: Un proceso combinacional deja una variable de destino sin asignar a lo largo de una o más rutas de ejecución condicional.
- **Riesgo**: Las herramientas de síntesis infieren un latch asíncrono sensible al nivel, introduciendo graves problemas de cierre de temporización y sensibilidad a fallos de reloj.
- **Corrección**: Asegúrese de que todas las variables estén asignadas en cada rama `if-else`, o asigne un valor predeterminado al inicio del bloque `always @*`.

### 7. `AXIOM_W007`: Falta el caso por defecto en case
- **Severidad**: Advertencia
- **Infracción**: Una sentencia `case` omite la rama `default:`.
- **Riesgo**: Las combinaciones de entrada no cubiertas provocan la inferencia de latches o congelan las máquinas de estados.
- **Corrección**: Agregue `default: <safe_state>;`.

### 8. `AXIOM_W008`: Discrepancia de ancho de bits
- **Severidad**: Advertencia
- **Infracción**: El ancho de bits de la red izquierda no coincide con el ancho de bits de la expresión derecha.
- **Riesgo**: Truncamiento silencioso del MSB o extensión involuntaria de ceros/signo.
- **Corrección**: Alinee los anchos de bits explícitamente o use selección de partes.
