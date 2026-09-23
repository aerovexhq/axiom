# SystemVerilog データ型＆宣言

SystemVerilogは、従来のVerilogにおける `wire` と `reg` の紛らわしい二者択一を解消するとともに、ユーザー定義型、構造体、列挙型を導入してハードウェアモデリングを近代化します。

---

## 汎用 `logic` 型

従来のVerilogでは、設計者は常に `wire`（継続的代入用）と `reg`（プロシージャルブロック用）を選択する必要がありました。SystemVerilogは4値論理 `logic` 型によってこれを解決します:

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
*注意: `logic` ネットは最大1つの継続的ドライバのみを持つことができます。複数ドライバによるワイヤードORまたはワイヤードANDバスが必要な場合は、標準の `wire` を使用します。*

---

## 2値データ型

高インピーダンス（`Z`）や不定値（`X`）状態が不要な高性能シミュレーションやテストベンチモデリングのために、SystemVerilogは2値データ型を導入しています:

| 型 | ビット幅 | 符号属性 | 値の範囲 |
| :--- | :--- | :--- | :--- |
| `bit` | 1ビット | 符号なし | `0`, `1` |
| `byte` | 8ビット | 符号付き | `-128` 〜 `127` |
| `shortint` | 16ビット | 符号付き | `-32,768` 〜 `32,767` |
| `int` | 32ビット | 符号付き | 標準32ビット整数 |
| `longint` | 64ビット | 符号付き | 標準64ビット整数 |

Axiomは2値変数をネイティブCPUマシンレジスタに直接コンパイルし、最高速の実行速度を達成します。

---

## ユーザー定義型 (`typedef`)

設計者は、可読性が高く再利用可能な型エイリアスを作成できます:

```verilog
typedef logic [31:0] word_t;
typedef logic [63:0] dword_t;
typedef logic [47:0] mac_addr_t;

word_t instruction;
mac_addr_t eth_dst;
```

---

## 列挙型 (`enum`)

列挙型はハードウェア状態にシンボリックな名前を割り当て、有限状態機械（FSM）の可読性を劇的に向上させます:

```verilog
typedef enum logic [1:0] {
    STATE_IDLE  = 2'b00,
    STATE_READ  = 2'b01,
    STATE_WRITE = 2'b10,
    STATE_ERROR = 2'b11
} fsm_state_e;

fsm_state_e current_state, next_state;
```
Axiomのマイクロアーキテクチャインスペクタは、`enum` 状態変数を自動検出し、FSMビジュアライザ内にラベル付きステートバブルを描画します。

---

## 構造体 (`struct`)

構造体は、関連する信号を単一の名前付きデータ構造にまとめます:

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
