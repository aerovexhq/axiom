# Interfaces, Modports y Paquetes

SystemVerilog introduce construcciones de `interface` y `package` para encapsular protocolos de bus multihilo y definiciones compartidas, reduciendo la verbosidad de conexión de puertos hasta en un 80%.

---

## Interfaces de SystemVerilog (`interface`)

Una interfaz agrupa redes y señales relacionadas en una única conexión de puerto:

```verilog
// Definition of a 32-bit Memory Bus Interface
interface mem_bus_if (input logic clk);
    logic        req;
    logic        gnt;
    logic [31:0] addr;
    logic [31:0] wdata;
    logic [31:0] rdata;
    logic        we;

    // Modport defining Master view
    modport master (
        input  clk, gnt, rdata,
        output req, addr, wdata, we
    );

    // Modport defining Slave view
    modport slave (
        input  clk, req, addr, wdata, we,
        output gnt, rdata
    );
endinterface
```

### Instanciación de módulos utilizando interfaces
```verilog
module top_soc (input logic sys_clk);
    // Instantiate interface
    mem_bus_if bus (sys_clk);

    // Master processor core
    cpu_core u_cpu (
        .bus(bus.master)
    );

    // Slave SRAM memory
    sram_controller u_sram (
        .bus(bus.slave)
    );
endmodule
```

---

## Paquetes (`package`)

Los paquetes permiten definir parámetros, typedefs y funciones compartidos en un solo archivo e importarlos en múltiples módulos:

```verilog
package memory_pkg;
    parameter int MEM_SIZE   = 4096;
    parameter int DATA_WIDTH = 32;

    typedef logic [DATA_WIDTH-1:0] data_word_t;

    function automatic int calc_parity(input data_word_t val);
        return ^val;
    endfunction
endpackage
```

### Importación de paquetes
```verilog
module cache_controller (
    input  memory_pkg::data_word_t write_val,
    output logic                   parity_err
);
    import memory_pkg::*; // Import all symbols

    assign parity_err = calc_parity(write_val);
endmodule
```
