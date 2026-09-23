# プロジェクト信頼＆ワークスペースサンドボックス分離

Axiom EDAは、安全なデジタルハードウェア設計のために設計されています。ハードウェア記述ファイルやシミュレーションモデルは複雑なプロシージャルループを実行したり外部メモリ内容をインポートしたりする可能性があるため、Axiomは航空宇宙グレードの**プロジェクト信頼権限システム**、**ネイティブホストファイルシステムサンドボックスガード**、**設定可能なストレージクォータ**を実装しています。

---

## プロジェクト信頼権限システム

信頼できないソースや同僚から外部プロジェクトバンドル（`.json`）を開いたりインポートしたりする場合、Axiomはデフォルトで**制限モード**で開くことによりホストマシンを保護します。

```
+-------------------------------------------------------------------------------+
| Modal: Do you trust this project? (imported_uart_core.json)                   |
| Target Device: Artix-7 XC7A35T | Files: 6 | Size: 1.2 MB                      |
+---------------------------------------+---------------------------------------+
| Restricted Mode (Default)             | Trusted Mode                          |
| - Host FileSystem Containment Enabled | - Full Workspace FS Access            |
| - Max Delta Cycles: 50,000 / step     | - Max Delta Cycles: 100,000 / step    |
| - External FS Export Blocked          | - External FS Export Allowed          |
| - Isolated .axiom/data/ Quarantine    | - Storage Quota: Configurable         |
+---------------------------------------+---------------------------------------+
| [ Open in Restricted Mode ]           | [ Trust Project & Enable All Features]|
+-------------------------------------------------------------------------------+
```

### 制限モード vs. 信頼モード マトリックス

| 機能 | 制限モード | 信頼モード |
| :--- | :--- | :--- |
| **シミュレーション実行** | 許可（厳格なループ制限付き） | 許可（フルパフォーマンス） |
| **最大デルタサイクル (\(\delta\))** | 50,000 サイクル / ステップ | 100,000 サイクル / ステップ（設定可能） |
| **メモリ割り当て上限** | 64 KWords (256 KB) | 16 MWords (64 MB) |
| **ホストファイルシステムエクスポート** | ブロック | 許可 |
| **データディレクトリ分離** | 厳格に強制 (`.axiom/data/`) | デフォルトで強制 |
| **ヘッダー表示** | `[ Restricted Mode ]` シールド警告 | 目立たないプロジェクトバッジ |

エンジニアは、ヘッダー内の `[ Restricted Mode ]` バッジをクリックするか、プロジェクトメニューの**プロジェクト設定＆セキュリティ...**からいつでも信頼ステータスを変更できます。

---

## ネイティブホストファイルシステムサンドボックスガード

ネイティブデスクトップインストール（Tauri v2）の場合、Axiomは `validate_sandboxed_path` を介してRustバックエンド（`crates/desktop/src/lib.rs`）でカーネルグレードのパス封じ込めを強制します:

```rust
// Canonical path validation in crates/desktop/src/lib.rs
pub fn validate_sandboxed_path(path_str: &str, project_root: Option<&str>) -> Result<PathBuf, String>
```

### サンドボックス保護機能
1. **クロスプラットフォームパス正規化**: Windowsのバックスラッシュ（`\`）とUnixのスラッシュ（`/`）を自動変換し、逐語的プレフィックス（`\\?\`）を除去します。
2. **パストラバーサルのブロック**: 未加工の入力文字列と解決された正規パスの両方において、親ディレクトリトラバーサルシーケンス `..` を厳格に禁止します。
3. **機密システムディレクトリのブラックリスト**: OSの重要なディレクトリへの読み書きを禁止します:
   - Linux/macOS: `/etc`, `/proc`, `/sys`, `/boot`, `/root`, `/bin`, `/sbin`, `/usr`
   - Windows: `C:\Windows`, `C:\System32`, `C:\Program Files`
4. **認証情報ストアの隔離**: 秘密鍵、認証情報、認証ストアにアクセスするすべての操作をブロックします:
   - `~/.ssh`
   - `~/.gnupg`
   - `~/.aws`
   - `~/.config/gcloud`
5. **Tauri IPCコマンドの完全保護**: すべてのファイルシステムIPC呼び出し（`fs_read_file`, `fs_write_file`, `fs_remove_file`, `fs_list_dir`, `fs_create_dir`, `fs_exists`）は `validate_sandboxed_path` によってガードされます。未認可のパスリクエストは即座に `[SandboxViolation]` エラーを返します。

---

## 設定可能なストレージクォータ

制御不能なシミュレーション波形トレースファイル（`.vcd`, `.saif`）や無限ループによるホストディスク容量の枯渇を防ぐため、Axiomはバイト単位のストレージクォータを適用します:

```
+-------------------------------------------------------------------------------+
| Project Storage Settings:                                                     |
| Storage Quota: [ 50 MB (Default) v ] (Options: 10M, 25M, 50M, 100M, 250M, inf) |
|                                                                               |
| Current Usage: [===================               ] 18.4 MB / 50.0 MB (36.8%) |
| - Design Sources:   1.2 MB                                                    |
| - Generated Data:  17.2 MB (.axiom/data/)                                     |
|                                                                               |
| [ Purge Generated Data (17.2 MB) ]    [ Save Security Settings ]              |
+-------------------------------------------------------------------------------+
```

### ストレージクォータオプション
- **10 MB**: 初歩的なゲートレベルの授業向け最小フットプリント。
- **25 MB**: 標準的なFSMや小型プロセッサ設計に最適。
- **50 MB (デフォルト)**: 数千シミュレーションサイクルと波形トレースに対応する標準エンジニアリングクォータ。
- **100 MB / 250 MB / 500 MB**: 詳細検証実行、メガバイト規模の4値論理 / Value Change Dump (VCD) 波形、論理合成後ネットリスト向けの拡張制限。
- **無制限**: 大規模エンタープライズプロジェクト向けの無制限割り当て。

クォータの強制は、ブラウザIndexedDB（`BrowserIndexedDbFileSystem`）とネイティブデスクトップストレージ（`TauriIpcFileSystem`）の両方で機能します。クォータを超えて書き込もうとすると、ランタイムをクラッシュさせることなくクリーンな `[StorageQuota]` 例外がトリガーされます。

---

## 専用生成データディレクトリ (`.axiom/data/`)

Axiomは、生成されたすべての出力を専用のワークスペースサブフォルダに隔離します:
- 4値論理 / Value Change Dump (VCD) (`.vcd`)
- スイッチングアクティビティ交換フォーマットファイル (`.saif`)
- 静的タイミング解析 (STA) レポート (`timing_report.txt`)
- マッピング済み構造Verilogネットリスト (`synth_netlist.v`)
- プロトコルパケットキャプチャ (`.pcap`)

### ワンクリックデータ消去サブシステム
**プロジェクトセキュリティモーダル**には、ワンクリックの**生成データの消去**ボタンが用意されています。この操作により `.axiom/data/` の内容全体が消去され、Verilog、SystemVerilog、VHDL、XDCファイルを変更または削除することなく、ストレージ使用量をソースファイルのみの状態に瞬時にリセットします。
