# Arquitectura de escritorio y web

Axiom presenta una arquitectura unificada de doble destino: una aplicación de escritorio nativa ligera y un panel de ingeniería en WebAssembly sin instalación, 100% en el navegador.

---

## Resumen de doble destino

```
                        Axiom Core Architecture
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        Native Desktop Target                WebAssembly Target
        - Tauri v2 (Rust IPC)               - wasm32-unknown-unknown
        - Linux, macOS, Windows             - 100% Client-Side In-Browser
        - Direct Cranelift JIT in RAM       - Portable Evaluator in WebWorker
        - Sub-50 MB Binary                  - Zero Backend Server Dependencies
```

---

## Interfaz de usuario moderna con tema oscuro estilo obsidiana

El frontend de ingeniería está desarrollado con **React 19**, **TypeScript 5.7**, **PostCSS** y **Vite 6**, ofreciendo un espacio de trabajo oscuro inspirado en Obsidian y Linear:

1. **Cabecera de control de simulación**:
   - Controles de avance discreto: `Run Free`, `Pause`, `+1 ns`, `+100 ps` y `Paso δ` (ciclo delta de tiempo cero (ciclo δ)).
   - Indicadores de telemetría en vivo: Marca de tiempo de simulación ($ps / ns$), Ciclo delta activo ($\delta$), Corriente transitoria pico ($mA$) y Caída máxima de tensión ($mV$).
2. **Explorador de jerarquía de netlists elaboradas**:
   - Vista en árbol recursiva de ámbitos elaborados, instancias de módulos, registros, cables y procesos procedimentales.
   - Selector integrado de bancos de prueba (ALU, contador con fallos, núcleo jerárquico).
3. **Visor de formas de onda Canvas 2D de alto rendimiento**:
   - Renderizado de lógica digital virtualizado a más de 60 FPS.
   - Colores diferenciados para lógica de 4 estados: 0 (pizarra), 1 (esmeralda), X (rosa), Z (ámbar).
   - Envolventes de transición en diamante para buses multibit con valores hexadecimales centrados.
   - **Lupa de fallos delta**: Resalta riesgos transitorios de tiempo cero con banderas indicadoras de fallos.
4. **Gráficos de telemetría de silicio basada en física**:
   - Curva de corriente transitoria analógica ($I(t)$) con relleno de degradado cian.
   - Caída de tensión inductiva en el riel de alimentación ($V_{sag} = IR + L \frac{di}{dt}$).
   - Tarjetas de resumen dinámico: Potencia media ($mW$), Corriente pico ($mA$), Caída máxima ($mV$) y Energía total disipada ($nJ$).
5. **Consola del núcleo de simulación y exportadores**:
   - Flujo de registro de eventos en tiempo real.
   - Descargas en un clic para archivos IEEE 1364 `.vcd` y Synopsys `.saif`.
