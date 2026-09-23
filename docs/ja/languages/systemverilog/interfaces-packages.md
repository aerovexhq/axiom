# インターフェース、モドポート＆パッケージ

SystemVerilogは、複数ワイヤのバスプロトコルと共有定義をカプセル化する `interface` および `package` 構文を導入し、ポート接続の記述量を最大80%削減します。

---

## SystemVerilog インターフェース (`interface`)

インターフェースは、関連するネットと信号を単一のポート接続に束ねます:

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

### インターフェースを使用したモジュールインスタンス化
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

## パッケージ (`package`)

パッケージを使用すると、共有パラメータ、型定義、関数を単一ファイルに定義し、複数のモジュール間でインポートできます:

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

### パッケージのインポート
```verilog
module cache_controller (
    input  memory_pkg::data_word_t write_val,
    output logic                   parity_err
);
    import memory_pkg::*; // Import all symbols

    assign parity_err = calc_parity(write_val);
endmodule
```
