---
layout: home
hero:
  name: Axiom EDA
  text: Motor HDL de alto rendimiento y telemetría de silicio
  tagline: Compilación JIT en RAM con Cranelift ultrarrápida, paso a paso manual de
    ciclos delta y telemetría de silicio basada en física. Desarrollado en Rust bajo
    Aerovex.
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
  - theme: brand
    text: Iniciar Web Studio
    link: /studio/
    target: _blank
  - theme: alt
    text: Descargar aplicación de escritorio
    link: '#download-desktop-studio-msi-deb-dmg'
  - theme: alt
    text: Inicio rápido e instalación
    link: /es/guide/quickstart
  - theme: alt
    text: Ver en GitHub
    link: https://github.com/aerovexsim/axiom
features:
- title: JIT Cranelift en RAM
  details: Compila diseños Verilog y SystemVerilog directamente en código máquina
    nativo (x86_64, AArch64) en RAM en milisegundos, evitando minutos de sobrecarga
    en disco de C++ y snapshots.
- title: Paso a paso granular de ciclos delta
  details: API de tick manual controlada por el llamador que expone ciclos delta de
    tiempo cero (ciclo δ) discretos (step_delta), revelando condiciones de carrera
    combinacionales y fallos transitorios ocultos por simuladores heredados.
- title: Telemetría de silicio basada en física
  details: Modelado de potencia dinámica desde primeros principios (0.5 * C * V^2
    * f * α) junto con caída de tensión inductiva en PDN (IR + L di/dt), transmitiendo
    telemetría analógica sincronizada en vivo junto con trazas digitales.
- title: Escritorio y web multiplataforma
  details: Aplicación de escritorio ligera (<50 MB) desarrollada con Tauri v2, React
    19 y Vite, compilando de forma nativa a WebAssembly para simulación 100% en el
    cliente en el navegador.
- title: Formas de onda de alta densidad en Canvas
  details: Visor de formas de onda digitales virtualizado a más de 60 FPS con soporte
    para envolventes de transición de buses multibit, inspección de cursores de tiempo
    y lupas de fallos delta.
- title: Interoperabilidad 100% con Vivado
  details: Exporta formas de onda de Lógica de 4 estados / Value Change Dump (VCD)
    IEEE 1364 (.vcd) y archivos de actividad de conmutación Synopsys SAIF 2.0 consumibles
    directamente por read_saif de Vivado.
---


## Descargar Desktop Studio (.msi, .deb, .dmg)

Descargue paquetes de escritorio nativos y de alto rendimiento con compilación JIT en RAM con Cranelift directa y sin limitaciones del entorno de pruebas del navegador. Las versiones se obtienen automáticamente de GitHub:

<ReleaseDownloader />

::: tip Versiones de GitHub y verificación SHA256
Todos los activos de las versiones, sumas de verificación SHA256 y notas de la versión están disponibles en la [página de versiones de Axiom en GitHub](https://github.com/aerovexsim/axiom/releases).
:::

## Instalación en una sola línea

Instale el binario independiente de Axiom EDA en segundos sin el sobrepeso de instaladores de más de 100 GB:

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip Selección de versión y compilación desde código fuente
Para instalar una versión específica:
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

O compile directamente desde el código fuente usando cargo:
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## Puntos destacados de rendimiento: Axiom frente a AMD Vivado

| Métrica | Axiom EDA (Aerovex) | AMD Vivado Design Suite | Ventaja |
| :--- | :--- | :--- | :--- |
| **Tiempo total de compilación** | **2.81 ms** (JIT en RAM) | 30.0 – 60.0 s (snapshot de `xelab`) | **>10,000× más rápido** |
| **Rendimiento de eventos de simulación** | **780,840 eventos/s** | ~100,000 – 250,000 eventos/s | **3–7× más rápido** |
| **Introspección delta de tiempo cero** | Paso a paso $\delta$ explícito e indicadores de fallos | Colapso de tiempo cero como caja negra | **Visibilidad completa de condiciones de carrera** |
| **Telemetría de energía dinámica** | Tiempo real $P = \frac{1}{2} C V^2 f \alpha$ | Informe estático posterior a la simulación | **Formas de onda sincronizadas en vivo** |
| **Huella de instalación** | Binario autocontenido de **<50 MB** | Instalación monolítica de **100+ GB** | **>2,000× más ligero** |
| **Compatibilidad de plataformas** | Linux, macOS (Apple Silicon), Windows, Web | Solo Linux y Windows | **Portabilidad universal** |
