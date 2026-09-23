# Monaco XDC言語サーバー＆検証

Axiom EDAは、Xilinx設計制約のための専用言語サーバープロトコル（LSP）およびシンタックスハイライターを備えています（`crates/lsp/src/xdc.rs`）。

---

## リアルタイムXDC構文検証

Monaco XDC言語サービスは、エディタ内の `.xdc` ファイル内で直接動作します:
- **Tclコマンド検証**: `set_property`、`create_clock`、`create_generated_clock`、`set_input_delay`、`set_output_delay`、`set_false_path`、`set_clock_groups`、`set_multicycle_path` を認識します。
- **コメント処理**: `#` で始まる行コメントを正確に解析し、コメントアウトされたピン設定に対する誤った構文警告を防ぎます。
- **ポートクエリ検証**: `[get_ports <name>]` 内で参照されているポートがアクティブな設計トップモジュールに存在することを検証します。

---

## 高度な自動補全

`.xdc` ファイル内で入力すると、文脈に応じた自動補全スニペットがトリガーされます:
- **パッケージピンバインド**: `set_property PACKAGE_PIN <PIN> [get_ports <PORT>]`
- **入出力標準割り当て**: `set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **プライマリクロック**: `create_clock -period 10.000 -name <NAME> [get_ports <PORT>]`
- **フォールスパス**: `set_false_path -from [get_ports <PORT>]`
