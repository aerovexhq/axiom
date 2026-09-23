# Verilogデータ型、ネット＆変数

Verilog HDLでは、物理ハードウェア接続と記憶素子は2つの基本グループに分類されます: **ネット**（物理的な電気配線を表す）と **変数**（動作記述の手続き的記憶を表す）。

---

## ネットデータ型

ネットはハードウェア要素間の物理的接続を表します。論理値を記憶することはなく、その値はドライバによって継続的に決定されます。

### 1. `wire` および `tri`
物理的な銅配線を表す主要なネット型です。`wire` と `tri` は論理合成上は機能的に同一であり、標準的な配線接続を表します。

```verilog
// 1-bit scalar wire
wire clk_buffered;

// 8-bit multi-bit vector bus [MSB:LSB]
wire [7:0] data_bus;

// Continuous assignment driving a wire
assign data_bus = 8'hA5;
```

### 2. ネット強度＆複数ドライバの競合
複数のアクティブな継続的代入が競合する値（`1` と `0`）で標準の `wire` を同時に駆動した場合、Axiomはその競合を不定（`X`）と評価し、リンターエラー `AXIOM_E002_MULTI_DRIVER_NET` を発行します。

---

## 変数データ型

変数は、ある手続き的代入から次の代入までその値を保持します。

### 1. `reg`
標準的な手続き変数です。その名称にもかかわらず、`reg` は常に物理フリップフロップレジスタに合成されるわけではありません。純粋な組み合わせブロック（`always @*`）内で代入された場合は、組み合わせ論理に合成されます。

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

### 2. `integer` および `time`
- `integer`: `for` ループやテストベンチの反復で一般的に使用される符号付き32ビット変数。
- `time`: `$time` 経由でシミュレーションタイムスタンプを記録するために使用される64ビット符号なし変数。

---

## ベクター＆インデックス付きパートセレクト

ベクターは `[MSB:LSB]` の範囲で宣言されたマルチビットバスを表します:

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

## アンパックドメモリアレイ

Axiomは、レジスタファイル、ルックアップテーブル、SRAMメモリブロックをモデル化するための多次元アンパックド配列をサポートしています:

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

Axiomの合成エンジンは、アンパックド同期メモリを自動検出し、Xilinx `RAMB18E2` または `RAMB36E2` ハードウェアブロックRAMに推論します。

---

## サイズ指定数値リテラル

Verilogの数値は、サイズ未指定の10進数、または明示的な基数プレフィックスを持つサイズ指定定数として指定できます:

$$\text{フォーマット: } <\text{サイズ}>'<\text{基数}><\text{値}>$$

| リテラル | ビット幅 | 基数 | 値 |
| :--- | :--- | :--- | :--- |
| `8'b1010_1100` | 8 | 2進数 | `0xAC` |
| `8'hFF` | 8 | 16進数 | `255` |
| `16'd1024` | 16 | 10進数 | `1024` |
| `4'o17` | 4 | 8進数 | `15` |
| `'d50` | サイズ未指定 (32) | 10進数 | `50` |
| `1'b1` | 1 | 2進数 | 論理High |
