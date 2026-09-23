# Introducción y manifiesto del proyecto

## La misión de Axiom EDA

**Axiom** es una recreación y modernización multiplataforma, de alto rendimiento y desde cero del motor de procesamiento, simulación y análisis de lenguajes de descripción de hardware (HDL) de AMD Vivado, desarrollado de forma nativa en **Rust** por **Aerovex**.

Vivado es el estándar indiscutible de la industria para el desarrollo de FPGA, pero sufre de décadas de sobrepeso técnico:
- **Instalaciones de más de 100 GB** que requieren demonios de licencia complejos y configuraciones prolongadas.
- **Interfaces lentas en Java Swing** que consumen gigabytes de memoria y se congelan durante el renderizado de formas de onda.
- **Pipelines de compilación basados en archivos de múltiples etapas** (`xvlog` $\to$ base de datos de biblioteca $\to$ `xelab` $\to$ binario de snapshot $\to$ `xsim`) que tardan minutos incluso ante modificaciones triviales de HDL.
- **Falta total de soporte para plataformas modernas** como macOS (Apple Silicon M1/M2/M3/M4) o navegadores web estándar.
- **Ciclos delta de tiempo cero opacos** que ocultan condiciones de carrera combinacionales transitorias y fallos a los diseñadores digitales.

**Axiom desmantela estas limitaciones.** Ofrece un motor de simulación de hardware instantáneo, profundamente introspeccionable y de menos de 50 MB, combinado con una aplicación de escritorio y web inspirada en Obsidian.

---

## Pilares arquitectónicos fundamentales

### 1. Compilación JIT en RAM con Cranelift
Axiom elimina los volcados intermedios de archivos C++, las invocaciones externas a GCC/Clang y la serialización de snapshots. Las netlists de hardware elaboradas y los procesos procedimentales se compilan directamente en código máquina nativo en RAM mediante **Cranelift** (x86_64, AArch64) en menos de 3 milisegundos.

### 2. API de tick manual de tiempo delta y cola de eventos
A diferencia de los simuladores tradicionales que fuerzan el avance ciego del tiempo de simulación o colapsan los ciclos delta en una sola marca de tiempo, Axiom expone una API de avance controlada por el llamador e integrable:
- `engine.tick(delta_time)`: Avanza el tiempo físico en picosegundos o nanosegundos.
- `engine.step_delta()`: Avanza un único ciclo delta discreto de tiempo cero (ciclo δ: $\delta \to \delta + 1$) dentro del tiempo de simulación cero, revelando riesgos transitorios antes de que las señales se estabilicen.

### 3. Telemetría de tensión, energía y potencia basada en física
Axiom incorpora ecuaciones físicas de primeros principios en cada transición de señal:
- **Potencia dinámica**: $P_{\text{dynamic}} = \frac{1}{2} C_{\text{net}} V_{\text{dd}}^2 f \alpha$
- **Caída de tensión inductiva en PDN (IR + L di/dt)**: $V_{\text{sag}} = IR + L \frac{di}{dt}$
- Captura picos de microcorriente durante los flancos de reloj que los informes de estimación estática de Vivado pasan por alto.

### 4. Arquitectura de escritorio y web multiplataforma
Desarrollado con **Tauri v2**, **React 19**, **TypeScript** y **Vite**, Axiom se ejecuta de forma nativa como aplicación de escritorio en Linux, macOS y Windows, mientras compila perfectamente a **WebAssembly** (`wasm32-unknown-unknown`) para simulación 100% en el navegador.
