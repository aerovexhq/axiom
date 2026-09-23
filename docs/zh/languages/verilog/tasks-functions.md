# 任务 (Tasks) 与函数 (Functions)

任务与函数在 Verilog 中用于封装可复用的算法语句。它们大幅提升代码模块化程度，消除硬件设计与测试平台中的重复过程逻辑。

---

## 函数 (`function`)

函数根据一个或多个输入参数计算单一返回值。在可综合 Verilog 中，函数专门用于建模纯组合逻辑：
- 在零仿真时间内执行完毕（严禁包含 `#` 延迟或 `@` 事件触发等待）。
- 必须拥有至少一个输入参数。
- 内部严禁包含非阻塞赋值语句 (`<=`)。
- 通过向函数名自身赋值来返回单一标量或向量结果。

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

## 任务 (`task`)

任务比函数更为通用。它可以接收输入参数，通过 `output` 端口返回多个结果，并且允许包含时序延迟控制语句（`#`, `@`）：
- 在 `initial` 或 `always` 过程块中通过过程调用执行。
- 能够自主控制仿真物理时间的前进，是编写测试平台总线功能模型 (BFM) 的理想机制。

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

## 自动重入任务与函数 (`automatic`)

在 IEEE 1364-1995 中，任务与函数内部变量默认均为静态全局分配。在 IEEE 1364-2001 中，显式声明 `function automatic` 或 `task automatic` 会在每次调用时在堆栈上动态分配局部变量，从而支持递归算法与安全重入：

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
