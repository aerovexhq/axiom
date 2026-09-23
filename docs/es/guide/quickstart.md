# Inicio rápido e instalación

Comience a trabajar con **Axiom EDA** en menos de 60 segundos.

---

## 1. Instalación en una sola línea

Axiom proporciona binarios independientes ligeros y autocontenidos (<50 MB) sin requerimientos de cadenas de herramientas externas.

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

El instalador detecta automáticamente su sistema operativo y arquitectura (`x86_64` o `aarch64` / Apple Silicon), instala el binario `axiom` en `~/.axiom/bin` (o `%USERPROFILE%\.axiom\bin`) y configura su variable `$PATH`.

---

## 2. Versiones de lanzamiento y opciones personalizadas

Puede especificar una versión de lanzamiento personalizada o cambiar la ruta de destino.

### Seleccionar una versión específica

::: code-group

```bash [Linux & macOS (Env Var)]
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```bash [Linux & macOS (Flag)]
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --version v1.0.0
```

```powershell [Windows (Env Var)]
$env:AXIOM_VERSION="v1.0.0"; irm https://axiom.aerovex.net/install.ps1 | iex
```

```powershell [Windows (Parameter)]
& ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v1.0.0
```

:::

### Directorio de instalación personalizado

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. Script dedicado de compilación desde el código fuente

Si prefiere compilar desde el código fuente o modificar el motor, Axiom incluye un controlador de compilación automatizado en `scripts/`:

### Linux y macOS (`scripts/build_from_source.sh`)

Clone el repositorio y ejecute el controlador automatizado:

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**Opciones del script de compilación:**

- `--cli-only`: Omite Node/UI y compila solo la CLI headless en Rust:
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>`: Instala en un directorio de sistema o de usuario personalizado:
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug`: Compilación de depuración rápida y sin optimizar:
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

En PowerShell:
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. Compilación manual con Cargo

También puede invocar a Cargo directamente:

```bash
cargo build --release --bin axiom
```

El binario resultante se ubicará en `target/release/axiom`.

Verifique su instalación:
```bash
axiom --version
```

Salida:
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. Compile su primer diseño HDL

Axiom incluye bancos de prueba de hardware verificados estándar en `tests/fixtures/`. Compile una ALU de 32 bits directamente en código máquina nativo en RAM:

```bash
axiom compile tests/fixtures/alu.v -t alu
```

Salida:
```text
============================================================
 Axiom HDL In-RAM Compiler: tests/fixtures/alu.v
 Top-Level Target: alu
============================================================
  [1/3] Lexing & Parsing in 172.70µs
  [2/3] Elaboration: 6 nets, 1 processes, 1 continuous assigns in 218.86µs
  [3/3] In-RAM Cranelift JIT Compilation in 2.41ms
------------------------------------------------------------
 Compilation successful! Total latency: 2.81ms
 In-RAM Arena Footprint: 6 64-bit words (48 bytes)
============================================================
```

---

## 6. Ejecute simulación por lotes con exportación de formas de onda y SAIF

Ejecute 100 ciclos de reloj, exportando formas de onda estándar IEEE 1364 VCD y archivos de actividad de conmutación Synopsys SAIF 2.0:

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

Salida:
```text
============================================================
 Axiom In-RAM Batch Simulator: tests/fixtures/counter.v
 Target: counter | Steps: 100 ticks
============================================================
 Simulation completed in 410.15µs
 Final SimTime: 50000 ps (50.000 ns) | Total Deltas: 0
 Glitches Detected: 0
 Exported IEEE 1364 VCD to: waveforms.vcd
 Exported SAIF 2.0 to: power.saif
============================================================
```

---

## 7. Ejecute pruebas de rendimiento de alta resolución

Evalúe el rendimiento del núcleo de simulación y mida el flujo de eventos:

```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 8. Inicie Desktop Studio moderno y la interfaz web

### Aplicación de escritorio nativa independiente
Inicie la ventana de escritorio nativa directamente (impulsada por Tauri v2 sin necesidad de puertos locales y con JIT Cranelift directo en RAM):
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### Studio WebAssembly en el navegador
Abra el estudio en vivo sin instalación desplegado en **[https://axiom.aerovex.net/studio/](https://axiom.aerovex.net/studio/)**.

### Servidor local de desarrollo de interfaz de usuario
```bash
cd ui
npm install
npm run dev
```

Capacidades clave:
- **Barra unificada de búsqueda (`Ctrl+K`)**: Búsqueda difusa instantánea en señales, jerarquía de netlist, acciones y documentación.
- **Visor de formas de onda de alta densidad**: Desglose de buses con múltiples bases, cursores duales ($\Delta t$) y panel de riesgos de ciclo delta de tiempo cero (ciclo δ).
- **DAG esquemático acelerado por GPU**: Motor Canvas 2D a más de 60 FPS con recortadores de conos de lógica crítica en un clic (`F` / `O`).
- **Rack de instrumentos virtuales**: Banco de interruptores DIP de 8 bits, botones táctiles, selector hexadecimal rotatorio, pantallas de 7 segmentos y generador de patrones de prueba.
- **Radar de temporización y mapa de energía de silicio**: Cascada de rutas críticas de análisis de temporización estática (STA) y descomposición de potencia dinámica ($P = \frac{1}{2} C V^2 f \alpha$).
- **Consola de scripts integrada**: REPL de simulación directo en RAM (`run`, `step delta`, `force`, `get`).
