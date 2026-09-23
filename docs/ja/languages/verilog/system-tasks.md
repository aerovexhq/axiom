# IEEE 1364 システムタスク＆関数

Verilogは、ドル記号（`$`）が前置された標準の組み込みシステムタスクおよび関数を提供します。Axiom EDAは外部のC/C++ PLIやVPIライブラリを必要とせず、これらのルーチンをメモリ内でネイティブにインターセプトして実行します。

---

## 表示＆文字列フォーマットタスク

### 1. `$display` および `$write`
Axiomの対話型**コンソール＆REPL**ドックにフォーマット済みテキストを直接出力します。`$display` は自動改行文字を追加しますが、`$write` は追加しません。

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### サポートされるフォーマット指定子
- `%d` / `%0d`: 10進整数 (パディングなし)
- `%h` / `%0h`: 16進数値
- `%b`: 2進数ベクター
- `%o`: 8進数値
- `%c`: ASCII文字
- `%s`: 文字列
- `%t`: フォーマット済みシミュレーション時刻

### 2. `$monitor` および `$strobe`
- `$monitor`: 信号引数を監視し、監視対象の信号の値が変化するたびにメッセージを自動出力します。
- `$strobe`: 現在の時間ステップの最後にあるMonitor領域までメッセージ出力を遅延させ、すべてのNBA代入が整定したことを保証します。

---

## シミュレーション制御タスク

### 1. `$finish`
シミュレーション実行を終了し、自律的なクロック進行を停止し、コンソールに最終実行指標を表示します。
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop`
シミュレーションを一時停止し、シミュレーションリボンを**一時停止中**状態に遷移させ、検査のためにすべての信号トレースとレジスタ状態を保持します。

### 3. `$time` および `$realtime`
- `$time`: アクティブな `` `timescale `` ディレクティブに基づいて、現在のシミュレーション時刻を64ビット整数として返します。
- `$realtime`: 現在のシミュレーション時刻を実数浮動小数点数として返します。

---

## 数学＆ユーティリティ関数

### 1. `$clog2` (底2の切り上げ対数)
$\lceil \log_2(N) \rceil$ を計算します。メモリの深さからアドレスバス幅を算出する際に不可欠です:
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random`
符号付き32ビットの疑似乱数整数を生成します。ランダム化されたテストベクターを生成するためにマスクして使用されることがよくあります:
```verilog
test_byte = $random % 256;
```

---

## 波形ダンプタスク

AxiomはVCDシステムコールをネイティブにインターセプトします:
- `$dumpfile("waveform.vcd");`: 出力波形ファイル名を指定します。
- `$dumpvars(0, top_tb);`: 設計階層全体のすべての信号値変化をAxiomのインメモリトレースバッファにダンプし、IEEE 1364 4値論理 / Value Change Dump (VCD) ファイルとしてダウンロードします。

---

## メモリファイル初期化 (`$readmemb`, `$readmemh`)

テキストファイルからメモリアレイの内容を直接ロードします:
- `$readmemb("rom.bin", memory_array);`: 2進数データ（`10101100`）をロードします。
- `$readmemh("rom.hex", memory_array);`: 16進数データ（`AF 04 C2`）をロードします。

Axiom Studioでは、メモリ初期化ファイルはホストファイルシステムのサンドボックス境界を侵害することなく、プロジェクトファイルセット内で安全に読み取られます。
