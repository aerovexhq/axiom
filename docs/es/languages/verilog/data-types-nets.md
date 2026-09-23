# Tipos de datos, redes y variables en Verilog

En Verilog HDL, las conexiones físicas de hardware y los elementos de almacenamiento se clasifican en dos grupos fundamentales: **Redes** (que representan cables eléctricos físicos) y **Variables** (que representan almacenamiento procedimental de comportamiento).

---

## Tipos de datos de red

Las redes representan conexiones físicas entre elementos de hardware. No almacenan valores lógicos; su valor lo determinan continuamente sus controladores.

### 1. `wire` y `tri`
El tipo de red principal que representa pistas físicas de cobre. `wire` y `tri` son funcionalmente idénticos en la síntesis, representando líneas de interconexión estándar.

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. Fuerzas de red y contención de múltiples controladores
Si múltiples asignaciones continuas activas excitan un cable `wire` estándar simultáneamente con valores conflictivos (`1` y `0`), Axiom evalúa el conflicto como desconocido (`X`) y dispara el error de linter `AXIOM_E002_MULTI_DRIVER_NET`.

---

## Tipos de datos de variables

Las variables conservan su valor de una asignación procedimental a la siguiente.

### 1. `reg`
La variable procedimental estándar. A pesar de su nombre, un `reg` no siempre se sintetiza en un registro de biestable físico; si se asigna dentro de un bloque puramente combinacional (`always @*`), se sintetiza en lógica combinacional.

```verilog
// 1-bit register variable
reg state;

// 32-bit register vector
reg [31:0] accumulator;

// Sequential clocked assignment
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        accumulator <= 32'd0;
    else
        accumulator <= accumulator + 32'd1;
end
```

### 2. `integer` y `time`
- `integer`: Variable de 32 bits con signo comúnmente utilizada en bucles `for` e iteraciones de bancos de pruebas.
- `time`: Variable de 64 bits sin signo utilizada para registrar marcas de tiempo de simulación mediante `$time`.

---

## Vectores y selección de partes indexadas

Los vectores representan buses multibit declarados con rangos `[MSB:LSB]`:

```verilog
wire [15:0] packet;

// Static slice part-select
wire [7:0] lower_byte = packet[7:0];
wire [7:0] upper_byte = packet[15:8];

// IEEE 1364-2001 Variable Indexed Part-Select (+: and -:)
// Syntax: [base_expr +: width]  (starts at base, selects width bits upward)
// Syntax: [base_expr -: width]  (starts at base, selects width bits downward)
wire [7:0] byte_0 = packet[0 +: 8];   // Selects packet[7:0]
wire [7:0] byte_1 = packet[8 +: 8];   // Selects packet[15:8]
wire [3:0] nibble = packet[7 -: 4];   // Selects packet[7:4]
```

---

## Matrices de memoria desempaquetadas

Axiom admite matrices desempaquetadas multidimensionales para modelar bancos de registros, tablas de búsqueda y bloques de memoria SRAM:

```verilog
// Array of 1024 registers, each 32 bits wide (4 KB RAM block)
reg [31:0] memory_array [0:1023];

// Synchronous memory write
always @(posedge clk) begin
    if (write_enable)
        memory_array[addr] <= write_data;
end

// Continuous read
assign read_data = memory_array[addr];
```

El motor de síntesis de Axiom detecta automáticamente memorias síncronas desempaquetadas y las infiere en memorias Block RAM de hardware Xilinx `RAMB18E2` o `RAMB36E2`.

---

## Literales numéricos con tamaño

Los números en Verilog se pueden especificar como decimales sin tamaño o constantes con tamaño y prefijos de base explícitos:

$$\text{Format: } <\text{size}>'<\text{base}><\text{value}>$$

| Literal | Ancho de bits | Base | Valor |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | Binario | `0xAC` |
| `8'hFF` | 8 | Hexadecimal | `255` |
| `16'd1024` | 16 | Decimal | `1024` |
| `4'o17` | 4 | Octal | `15` |
| `'d50` | Sin tamaño explícito (32) | Decimal | `50` |
| `1'b1` | 1 | Binario | Alto lógico |
