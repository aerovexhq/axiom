# Interfaces, modports et paquets

SystemVerilog introduit les constructions `interface` et `package` pour encapsuler les protocoles de bus multifilaires et les définitions partagées, réduisant la verbosité des connexions de ports jusqu'à 80%.

---

## Interfaces SystemVerilog (`interface`)

Une interface regroupe les équipotentielles et signaux associés en une connexion de port unique :

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

### Instanciation de module utilisant des interfaces
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

## Paquets (`package`)

Les paquets permettent de définir des paramètres, types personnalisés et fonctions partagés dans un fichier unique et de les importer à travers plusieurs modules :

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

### Importation de paquets
```verilog
module cache_controller (
    input  memory_pkg::data_word_t write_val,
    output logic                   parity_err
);
    import memory_pkg::*; // Import all symbols

    assign parity_err = calc_parity(write_val);
endmodule
```
