# 接口 (Interface)、Modport 与包机制

SystemVerilog 引入了 `interface` 与 `package` 语法构造来封装多线总线通信协议与共享公共定义，将顶层模块端口连线的代码冗余度降低高达 80%。

---

## SystemVerilog 接口 (`interface`)

接口将一组相互关联的网线与信号绑定为一个统一的复合端口连接：

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

### 使用接口进行模块例化
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

## 公共程序包 (`package`)

程序包允许将通用的参数常量、类型定义与辅助函数集中声明在单一文件中，并在多个设计模块间灵活导入复用：

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

### 导入程序包
```verilog
module cache_controller (
    input  memory_pkg::data_word_t write_val,
    output logic                   parity_err
);
    import memory_pkg::*; // Import all symbols

    assign parity_err = calc_parity(write_val);
endmodule
```
