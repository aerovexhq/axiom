# Tipos de datos y declaraciones de SystemVerilog

SystemVerilog moderniza el modelado de hardware eliminando la confusa dicotomía entre `wire` y `reg` en Verilog clásico, a la vez que introduce tipos definidos por el usuario, estructuras y enumeraciones.

---

## El tipo universal `logic`

En Verilog clásico, los diseñadores debían elegir constantemente entre `wire` (para asignaciones continuas) y `reg` (para bloques procedimentales). SystemVerilog resuelve esto con el tipo `logic` de 4 estados:

```verilog
// 1-bit logic signal driven by continuous assignment
logic valid;
assign valid = ready & req;

// Multi-bit logic bus driven procedurally
logic [31:0] data_reg;
always_ff @(posedge clk) begin
    data_reg <= next_data;
end
```
*Nota: Una red `logic` puede tener como máximo un controlador continuo. Si se requieren buses cableados con múltiples controladores (wired-OR o wired-AND), se utiliza el estándar `wire`.*

---

## Tipos de datos de dos estados

Para simulación de alto rendimiento y modelado de bancos de pruebas donde no se necesitan estados de alta impedancia (`Z`) ni desconocidos (`X`), SystemVerilog introduce tipos de 2 estados:

| Tipo | Ancho de bits | Con o sin signo | Valores |
| :--- | :--- | :--- | :--- |
| `bit` | 1 bit | Sin signo | `0`, `1` |
| `byte` | 8 bits | Con signo | `-128` a `127` |
| `shortint` | 16 bits | Con signo | `-32,768` a `32,767` |
| `int` | 32 bits | Con signo | Entero estándar de 32 bits |
| `longint` | 64 bits | Con signo | Entero estándar de 64 bits |

Axiom compila variables de 2 estados directamente en registros de máquina de la CPU nativa, logrando velocidades máximas de ejecución.

---

## Tipos definidos por el usuario (`typedef`)

Los diseñadores pueden crear alias de tipos legibles y reutilizables:

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## Tipos enumerados (`enum`)

Las enumeraciones asignan nombres simbólicos a los estados de hardware, mejorando drásticamente la legibilidad de las máquinas de estados finitos (FSM):

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
El inspector de microarquitectura de Axiom detecta automáticamente variables de estado `enum` y dibuja burbujas de estado etiquetadas en el visualizador de FSM.

---

## Estructuras (`struct`)

Las estructuras agrupan señales relacionadas en una única estructura de datos nombrada:

```verilog
// Packed structure: contiguous bit-vector representation in hardware
typedef struct packed {
    logic [7:0]  opcode;
    logic [3:0]  reg_dest;
    logic [3:0]  reg_src1;
    logic [3:0]  reg_src2;
    logic [11:0] immediate;
} instruction_t; // Total 32 bits

instruction_t current_instr;
assign current_instr.opcode = 8'h01;
```
