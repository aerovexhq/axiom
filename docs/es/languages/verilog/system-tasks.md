# Tareas y funciones del sistema IEEE 1364

Verilog proporciona tareas y funciones del sistema integradas estándar con el prefijo del signo de dólar (`$`). Axiom EDA intercepta y ejecuta de forma nativa estas rutinas en RAM sin requerir bibliotecas externas C/C++ PLI o VPI.

---

## Tareas de visualización y formateo de cadenas

### 1. `$display` y `$write`
Imprime texto formateado directamente en la consola interactiva **Consola y REPL** de Axiom. `$display` añade un carácter de nueva línea automático, mientras que `$write` no lo hace.

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### Especificadores de formato soportados
- `%d` / `%0d`: Entero decimal (sin relleno)
- `%h` / `%0h`: Valor hexadecimal
- `%b`: Vector binario
- `%o`: Valor octal
- `%c`: Carácter ASCII
- `%s`: Cadena de texto
- `%t`: Tiempo de simulación formateado

### 2. `$monitor` y `$strobe`
- `$monitor`: Supervisa los argumentos de señal e imprime automáticamente un mensaje cada vez que cambia el valor de cualquier señal supervisada.
- `$strobe`: Pospone la salida del mensaje a la región Monitor al final del paso de tiempo actual, asegurando que todas las asignaciones NBA se hayan estabilizado.

---

## Tareas de control de simulación

### 1. `$finish`
Finaliza la ejecución de la simulación, suspende el avance autónomo del reloj y muestra métricas de ejecución finales en la consola.
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop`
Pausa la simulación, pasa la cinta de simulación al estado **Pausado** y conserva todas las trazas de señal y estados de registros para su inspección.

### 3. `$time` y `$realtime`
- `$time`: Devuelve el tiempo actual de simulación como un entero de 64 bits según la directiva activa `` `timescale ``.
- `$realtime`: Devuelve el tiempo actual de simulación como un número real de coma flotante.

---

## Funciones matemáticas y de utilidad

### 1. `$clog2` (Logaritmo techo en base 2)
Calcula $\lceil \log_2(N) \rceil$. Indispensable para calcular anchos de bus de direcciones a partir de profundidades de memoria:
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random`
Genera un entero pseudoaleatorio de 32 bits con signo. A menudo se enmascara para generar vectores de prueba aleatorios:
```verilog
test_byte = $random % 256;
```

---

## Tareas de volcado de formas de onda

Axiom intercepta de forma nativa las llamadas al sistema VCD:
- `$dumpfile("waveform.vcd");`: Especifica el nombre de archivo de la forma de onda de salida.
- `$dumpvars(0, top_tb);`: Vuelca todos los cambios de valor de señales en la jerarquía de diseño en el búfer de trazas en memoria de Axiom y lo descarga como un archivo Value Change Dump (VCD) IEEE 1364.

---

## Inicialización de archivos de memoria (`$readmemb`, `$readmemh`)

Carga el contenido de matrices de memoria directamente desde archivos de texto:
- `$readmemb("rom.bin", memory_array);`: Carga datos binarios (`10101100`).
- `$readmemh("rom.hex", memory_array);`: Carga datos hexadecimales (`AF 04 C2`).

En Axiom Studio, los archivos de inicialización de memoria se leen de forma segura dentro de los conjuntos de archivos del proyecto sin violar los límites del entorno aislado (sandbox) del sistema de archivos del host.
