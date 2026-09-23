# 增强数据类型与声明

SystemVerilog 消除传统 Verilog 中 `wire` 与 `reg` 易引起混淆的二元划分，对硬件建模进行了全面现代化，并引入了自定义类型、结构体与枚举。

---

## 通用 `logic` 类型

在传统 Verilog 中，设计者必须频繁在 `wire`（用于持续赋值）与 `reg`（用于过程块）之间做艰难抉择。SystemVerilog 通过统一的 4态逻辑空间 `logic` 类型完美解决了这一难题：

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
*注：一个 `logic` 网线最多只能拥有一个持续驱动源。如果需要多驱动线或或线与总线，则应继续使用标准 `wire`。*

---

## 二态优化数据类型

在不需要高阻态 (`Z`) 与未知态 (`X`) 的高性能仿真测试平台建模中，SystemVerilog 引入了高效的 2 态数据类型：

| 数据类型 | 位宽 | 有符号性 | 有效值范围 |
| :--- | :--- | :--- | :--- |
| `bit` | 1 位 | 无符号 | `0`, `1` |
| `byte` | 8 位 | 有符号 | `-128` 至 `127` |
| `shortint` | 16 位 | 有符号 | `-32,768` 至 `32,767` |
| `int` | 32 位 | 有符号 | 标准 32 位整数 ($-2^{31}$ 至 $2^{31}-1$) |
| `longint` | 64 位 | 有符号 | 标准 64 位整数 ($-2^{63}$ 至 $2^{63}-1$) |

Axiom 将 2 态变量直接编译映射为宿主机 CPU 原生机器寄存器，从而获得极致的仿真执行速度。

---

## 用户自定义类型 (`typedef`)

设计者可以创建高可读性、可复用的类型别名：

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## 枚举类型 (`enum`)

枚举赋予硬件状态直观的符号化名称，显著提升有限状态机 (FSM) 的可读性与可维护性：

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
Axiom 的微架构检查器会自动识别 `enum` 状态变量，并在状态机图形可视化中呈现带有对应标签的状态泡泡图。

---

## 结构体 (`struct`)

结构体将相互关联的信号打包为单一具名数据结构：

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
