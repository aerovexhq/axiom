# Manual de referencia de la CLI

Axiom incluye un controlador de línea de comandos rápido e independiente para pipelines de CI/CD, pruebas sin interfaz gráfica (headless) y ejecuciones de regresión de rendimiento.

---

## Uso global

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### Opciones globales
- `-h, --help`: Muestra información de ayuda y uso.
- `-v, --version`: Muestra la versión actual de Axiom EDA.

---

## Subcomandos

### 1. `compile`
Realiza análisis léxico en memoria, análisis sintáctico Pratt, elaboración jerárquica de netlists y compilación JIT en RAM con Cranelift sin serialización en disco.

```bash
axiom compile <FILE> -t <TOP>
```

#### Argumentos
- `<FILE>`: Ruta al archivo HDL de Verilog o SystemVerilog (`.v` o `.sv`).
- `-t, --top <TOP>`: Identificador del módulo de nivel superior a elaborar.

#### Ejemplo
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run`
Compila el diseño HDL especificado y lo simula durante un número determinado de ciclos de reloj, con generación opcional en tiempo real de salidas en formato VCD y SAIF.

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### Opciones
- `-t, --top <TOP>`: Nombre del módulo de nivel superior (requerido).
- `--ticks <N>`: Número de ciclos de reloj a simular (por defecto: 100).
- `--vcd <FILE>`: Ruta de archivo para volcar formas de onda Value Change Dump (VCD) IEEE 1364.
- `--saif <FILE>`: Ruta de archivo para volcar datos de actividad de conmutación SAIF 2.0.

#### Ejemplo
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark`
Ejecuta micro-benchmarks estadísticos que miden el tiempo de respuesta de compilación JIT de extremo a extremo y el rendimiento de eventos de simulación puros.

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### Opciones
- `-t, --top <TOP>`: Nombre del módulo de nivel superior (requerido).
- `--cycles <N>`: Número de ciclos de reloj simulados (por defecto: 5000).

#### Ejemplo
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
