# CLIリファレンスマニュアル

Axiomには、CI/CDパイプライン、ヘッドレステスト、ベンチマーク回帰テスト向けの高速なスタンドアロンコマンドラインドライバが含まれています。

---

## グローバルな使用法

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### グローバルフラグ
- `-h, --help`: ヘルプおよび使用法情報を表示します。
- `-v, --version`: Axiom EDAの現在バージョンを表示します。

---

## サブコマンド

### 1. `compile`
ディスクシリアライズを伴わずに、メモリ内字句解析、Pratt構文解析、階層的ネットリストエラボレーション、およびCranelift JITコンパイルを実行します。

```bash
axiom compile <FILE> -t <TOP>
```

#### 引数
- `<FILE>`: VerilogまたはSystemVerilog HDLファイルへのパス（`.v` または `.sv`）。
- `-t, --top <TOP>`: エラボレートする最上位モジュールの識別子。

#### 例
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run`
指定されたHDL設計をコンパイルし、指定されたクロックティック数シミュレーションを実行します。リアルタイムVCDおよびSAIF出力の生成もオプションで可能です。

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### オプション
- `-t, --top <TOP>`: 最上位モジュール名（必須）。
- `--ticks <N>`: シミュレーションするクロックティック数（デフォルト: 100）。
- `--vcd <FILE>`: IEEE 1364 4値論理 / Value Change Dump (VCD) 波形を出力するファイルパス。
- `--saif <FILE>`: SAIF 2.0スイッチングアクティビティデータを出力するファイルパス。

#### 例
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark`
エンドツーエンドのJITコンパイル所要時間および生シミュレーションイベントスループットを測定する統計的マイクロベンチマークを実行します。

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### オプション
- `-t, --top <TOP>`: 最上位モジュール名（必須）。
- `--cycles <N>`: シミュレーションするクロックサイクル数（デフォルト: 5000）。

#### 例
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
