# Cinta de comandos de simulación y panel unificado

El sistema de control de simulación de Axiom combina un motor de ejecución de alta velocidad con una cinta de comandos intuitiva y un panel inferior unificado (`BottomConsole.tsx`, `UnifiedBottomDock.tsx`). Proporciona control inmediato sobre el tiempo físico de simulación y ciclos delta de tiempo cero (ciclo δ) discretos.

---

## Cinta de comandos de simulación en la cabecera

La barra de cabecera superior muestra la telemetría y los controles de simulación:

```
+-------------------------------------------------------------------------------+
| [ Run ] [ Pause ] | [ +1 ns ] [ +100 ps ] [ Step Delta ] | [ Reset (t=0) ]    |
| Time: 125,400 ps (125.4 ns) | Delta: 0 | Core: 0.988 V | Power: 34.2 mW       |
+-------------------------------------------------------------------------------+
```

### Acciones de control
- **Ejecutar (`Espacio` / `Ctrl + Enter`)**: Inicia la señal de reloj autónoma continua en el Web Worker en segundo plano o en el motor JIT de Cranelift a alta frecuencia.
- **Pausar (`Espacio`)**: Suspende la ejecución de la simulación al instante, congelando todas las trazas de señales y estados de registros para su inspección.
- **+1 ns (`F10`)**: Avanza el tiempo físico de simulación exactamente 1,000 picosegundos.
- **+100 ps (`Shift + F10`)**: Avanza el tiempo físico de simulación exactamente 100 picosegundos para análisis de temporización fino.
- **Paso Delta (`F11`)**: Ciclo delta de tiempo cero (ciclo δ) discreto ($\delta \to \delta + 1$) sin incrementar el tiempo físico de simulación, exponiendo condiciones de carrera combinacionales y transiciones intermedias de puertas.
- **Reiniciar (`Ctrl + R`)**: Rebobina el tiempo de simulación a $t=0$, restablece los vectores de señales a los estados iniciales y mantiene el diseño compilado para reanudar la ejecución de inmediato sin reelaboración.

---

## Pestañas del panel inferior unificado

El panel plegable organiza herramientas de ingeniería secundarias esenciales:

### 1. Consola y REPL
- Muestra pasadas del compilador, métricas de elaboración de AST e instancias de módulos activas.
- Transmite en tiempo real la salida de `$display`, `$write` y `$monitor` desde la simulación de Verilog.
- Proporciona una consola de comandos interactiva para evaluar expresiones de señales o consultar valores de redes.

### 2. Problemas y linter
- Enumera advertencias de análisis estático activas y errores de sintaxis.
- Muestra ID de regla (`AXIOM_W001`, etc.), insignias de gravedad y nombres de archivos fuente.
- Hacer clic en cualquier tarjeta de problema desplaza instantáneamente el editor Monaco a la línea infractora exacta.

### 3. Radar de telemetría
- Muestra medidores analógicos en tiempo real para tensión de núcleo, caída inductiva, corriente de alimentación y disipación de potencia dinámica.

### 4. Panel de formas de onda
- Muestra una vista previa auxiliar de forma de onda mientras el panel visualizador principal está enfocado en esquemáticos, laboratorio virtual o radar de temporización.
