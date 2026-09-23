# クイックスタート＆インストール

60秒未満で **Axiom EDA** を起動して実行できます。

---

## 1. ワンライナーインストール

Axiomは、外部ツールチェーンを一切必要としない、軽量で自己完結型のスタンドアロンバイナリ（50MB未満）を提供します。

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

インストーラはOSとアーキテクチャ（`x86_64` または `aarch64` / Apple Silicon）を自動検出し、`axiom` バイナリを `~/.axiom/bin`（または `%USERPROFILE%\.axiom\bin`）にインストールして `$PATH` を設定します。

---

## 2. リリースバージョン管理＆カスタムフラグ

特定のリリースバージョンを指定したり、インストール先パスを上書きしたりできます。

### 特定バージョンをターゲットにする

::: code-group

```bash [Linux & macOS (Env Var)]
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```bash [Linux & macOS (Flag)]
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --version v1.0.0
```

```powershell [Windows (Env Var)]
$env:AXIOM_VERSION="v1.0.0"; irm https://axiom.aerovex.net/install.ps1 | iex
```

```powershell [Windows (Parameter)]
& ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v1.0.0
```

:::

### カスタムインストールディレクトリ

```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --dir /opt/axiom
```

---

## 3. 専用のソースビルドスクリプト

ソースからコンパイルする場合やエンジンを修正する場合は、`scripts/` に自動ビルドドライバが含まれています:

### Linux＆macOS (`scripts/build_from_source.sh`)

リポジトリをクローンして自動ドライバを実行します:

```bash
git clone https://github.com/aerovexsim/axiom.git
cd axiom
./scripts/build_from_source.sh
```

**ビルドスクリプトオプション:**

- `--cli-only`: Node/UIをスキップし、ヘッドレスなRust CLIのみをビルドします:
  ```bash
  ./scripts/build_from_source.sh --cli-only
  ```
- `--prefix <DIR>`: カスタムのシステムまたはユーザーディレクトリにインストールします:
  ```bash
  ./scripts/build_from_source.sh --prefix /usr/local
  ```
- `--debug`: 高速な最適化なしデバッグコンパイルを行います:
  ```bash
  ./scripts/build_from_source.sh --debug
  ```

### Windows (`scripts/build_from_source.ps1`)

PowerShellでの実行:
```powershell
.\scripts\build_from_source.ps1 -CliOnly
```

---

## 4. 手動Cargoコンパイル

Cargoを直接呼び出すことも可能です:

```bash
cargo build --release --bin axiom
```

出力バイナリは `target/release/axiom` に配置されます。

インストールを確認します:
```bash
axiom --version
```

出力:
```text
axiom 1.0.0 (in-ram cranelift jit engine)
```

---

## 5. 初めてのHDL設計をコンパイルする

Axiomには `tests/fixtures/` に標準的な検証済みハードウェアフィクスチャが含まれています。32ビットALUをメモリ内のネイティブ機械語に直接コンパイルします:

```bash
axiom compile tests/fixtures/alu.v -t alu
```

出力:
```text
============================================================
 Axiom HDL In-RAM Compiler: tests/fixtures/alu.v
 Top-Level Target: alu
============================================================
  [1/3] Lexing & Parsing in 172.70µs
  [2/3] Elaboration: 6 nets, 1 processes, 1 continuous assigns in 218.86µs
  [3/3] In-RAM Cranelift JIT Compilation in 2.41ms
------------------------------------------------------------
 Compilation successful! Total latency: 2.81ms
 In-RAM Arena Footprint: 6 64-bit words (48 bytes)
============================================================
```

---

## 6. 波形＆SAIF出力付きバッチシミュレーションの実行

100クロックティックを実行し、標準のIEEE 1364 4値論理 / Value Change Dump (VCD) 波形とSynopsys SAIF 2.0スイッチングアクティビティファイルを出力します:

```bash
axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd waveforms.vcd --saif power.saif
```

出力:
```text
============================================================
 Axiom In-RAM Batch Simulator: tests/fixtures/counter.v
 Target: counter | Steps: 100 ticks
============================================================
 Simulation completed in 410.15µs
 Final SimTime: 50000 ps (50.000 ns) | Total Deltas: 0
 Glitches Detected: 0
 Exported IEEE 1364 VCD to: waveforms.vcd
 Exported SAIF 2.0 to: power.saif
============================================================
```

---

## 7. 高精度ベンチマークの実行

シミュレーションカーネルにストレステストを実施し、イベントスループットを測定します:

```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 5000
```

```text
 [Benchmark 1] Average End-to-End JIT Compile Latency:
   >> 2.811ms (In-RAM Lex + Parse + Elaborate + Cranelift JIT)
 [Benchmark 2] In-RAM Simulation Throughput:
   >> Throughput: 156,168 cycles/sec (0.16 MHz simulated clock rate)
   >> Event Rate: 780,840 events/sec
```

---

## 8. モダンなデスクトップStudio＆Web UIの起動

### スタンドアロンネイティブデスクトップアプリ
ネイティブデスクトップウィンドウを直接起動します（Tauri v2によるポートホスティング不要の設計と、メモリ内直接Cranelift JITを搭載）:
```bash
axiom-desktop
# or via CLI launcher:
axiom gui
```

### ブラウザ内WebAssembly Studio
インストール不要で利用可能なStudio（**[https://axiom.aerovex.net/studio/](https://axiom.aerovex.net/studio/)**）を開きます。

### ローカルUI開発サーバー
```bash
cd ui
npm install
npm run dev
```

主な機能:
- **統合オムニバー (`Ctrl+K`)**: 信号、ネットリスト階層、アクション、ドキュメントにわたる即座のあいまい検索。
- **高密度波形ビューア**: マルチ基数バス展開、デュアルカーソル（$\Delta t$）、ゼロ時間デルタサイクル (δサイクル) ハザードドロワー。
- **GPUアクセラレーション回路図DAG**: ワンクリックでクリティカルロジックコーンを抽出できる（`F` / `O`）60+ FPS Canvas 2Dエンジン。
- **バーチャル計測器ラック**: 8ビットDIPスイッチバンク、タクタイルボタン、ロータリー16進ダイヤル、7セグメントディスプレイ、テストパターンジェネレータ。
- **タイミングレーダー＆シリコンエネルギーマップ**: 静的タイミング解析 (STA) クリティカルパスウォーターフォールと動的電力分解（$P = \frac{1}{2} C V^2 f \alpha$）。
- **組み込みスクリプティングシェル**: メモリ内直接シミュレーションREPL（`run`、`step delta`、`force`、`get`）。
