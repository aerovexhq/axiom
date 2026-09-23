# Tareas y funciones en Verilog

Las tareas y funciones encapsulan sentencias algorítmicas reutilizables en Verilog. Mejoran la modularidad del código y reducen la lógica procedimental repetitiva en diseños y bancos de pruebas.

---

## Funciones (`function`)

Una función calcula un valor de retorno a partir de una o más entradas. En Verilog sintetizable, las funciones modelan lógica puramente combinacional:
- Se ejecuta en tiempo cero de simulación (no puede contener retardos `#` ni controles de eventos `@`).
- Debe tener al menos una entrada.
- No puede contener asignaciones no bloqueantes (`<=`).
- Devuelve un único valor escalar o vectorial asignado al nombre de la función.

```verilog
module parity_checker (
    input  wire [7:0] data_byte,
    output wire       parity_bit
);
    // User-defined function calculating odd parity
    function calc_parity;
        input [7:0] val;
        integer i;
        begin
            calc_parity = 1'b0;
            for (i = 0; i < 8; i = i + 1) begin
                calc_parity = calc_parity ^ val[i];
            end
        end
    endfunction

    // Continuous assignment calling function
    assign parity_bit = calc_parity(data_byte);

endmodule
```

---

## Tareas (`task`)

Una tarea es más general que una función. Puede aceptar entradas, devolver múltiples salidas mediante argumentos `output` y contener sentencias de retardo temporal (`#`, `@`):
- Opera procedimentalmente dentro de bloques `initial` o `always`.
- Puede controlar el tiempo de simulación, lo que hace que las tareas sean ideales para modelos funcionales de bus (BFM) en bancos de pruebas.

```verilog
module tb_memory;
    reg clk;
    reg we;
    reg [7:0] addr;
    reg [15:0] wdata;
    wire [15:0] rdata;

    // Bus Functional Task modeling an SRAM write bus cycle
    task sram_write;
        input [7:0]  target_addr;
        input [15:0] write_val;
        begin
            @(posedge clk);
            addr  <= target_addr;
            wdata <= write_val;
            we    <= 1'b1;
            @(posedge clk);
            we    <= 1'b0;
        end
    endtask

    initial begin
        clk = 0;
        we  = 0;
        #20;
        // Invoke task with arguments
        sram_write(8'h04, 16'hDEAD);
        sram_write(8'h08, 16'hBEEF);
        #50 $finish;
    end

    always #5 clk = ~clk;
endmodule
```

---

## Tareas y funciones automáticas (reentrantes)

De forma predeterminada en IEEE 1364-1995, las variables de tarea son estáticas. En IEEE 1364-2001, declarar `function automatic` o `task automatic` asigna variables locales dinámicamente en una pila, permitiendo algoritmos recursivos:

```verilog
function automatic [31:0] factorial;
    input [31:0] n;
    begin
        if (n <= 1)
            factorial = 1;
        else
            factorial = n * factorial(n - 1);
    end
endfunction
```
