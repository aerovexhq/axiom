---
layout: home
hero:
  name: Axiom EDA
  text: 高性能HDLエンジン＆シリコンテレメトリ
  tagline: 超高速インメモリCranelift JITコンパイル、手動デルタサイクルステッピング、物理ベースのシリコンテレメトリ。AerovexのもとRustで開発。
  image:
    src: /logo.svg
    alt: Axiom EDA Logo
  actions:
  - theme: brand
    text: Web Studioを起動
    link: /studio/
    target: _blank
  - theme: alt
    text: デスクトップアプリをダウンロード
    link: '#download-desktop-studio-msi-deb-dmg'
  - theme: alt
    text: クイックスタート＆インストール
    link: /ja/guide/quickstart
  - theme: alt
    text: GitHubで表示
    link: https://github.com/aerovexsim/axiom
features:
- title: インメモリCranelift JIT
  details: VerilogおよびSystemVerilogの設計をメモリ内でネイティブ機械語（x86_64、AArch64）へ数ミリ秒で直接コンパイルし、数分に及ぶC++変換やディスクスナップショットのオーバーヘッドを完全に排除します。
- title: きめ細かなデルタサイクルステッピング
  details: 個別のゼロ時間デルタサイクル (δサイクル) を公開する呼び出し元制御の手動ティックAPI（step_delta）により、レガシーシミュレータで見落とされていた組み合わせ回路の競合状態やグリッチを暴き出します。
- title: 物理ベースのシリコンテレメトリ
  details: 第一原理に基づく動的電力モデリング (0.5 * C * V^2 * f * α) とインダクティブPDN電圧降下 (IR + L di/dt)
    を組み合わせ、デジタル波形と完全に同期したアナログテレメトリをリアルタイムでストリーミングします。
- title: クロスプラットフォーム対応デスクトップ＆Web
  details: Tauri v2、React 19、Viteで構築された軽量（50MB未満）なデスクトップアプリケーションであり、WebAssemblyへのネイティブコンパイルによりブラウザ内で100%クライアントサイドシミュレーションを実行可能です。
- title: 高密度Canvas波形表示
  details: マルチビットバス遷移エンベロープ、タイムカーソル検査、デルタグリッチ拡大鏡をサポートする仮想化60+ FPSデジタル波形ビューア。
- title: 100% Vivado相互運用性
  details: IEEE 1364 4値論理 / Value Change Dump (VCD) 波形およびVivado read_saifで直接読み込めるSynopsys
    SAIF 2.0スイッチングアクティビティファイルを出力します。
---


## デスクトップStudioのダウンロード (.msi, .deb, .dmg)

メモリ内直接Cranelift JITを備え、ブラウザのサンドボックス制限がないネイティブで高性能なデスクトップパッケージをダウンロードしてください。リリースはGitHubから自動的に取得されます:

<ReleaseDownloader />

::: tip GitHubリリース＆SHA256検証
すべてのリリースアセット、SHA256チェックサム、リリースノートは [Axiom GitHubリリースページ](https://github.com/aerovexsim/axiom/releases) で入手可能です。
:::

## ワンライナーインストール

100GB超の膨大なインストーラなしで、スタンドアロンのAxiom EDAバイナリを数秒でインストールできます:

::: code-group

```bash [Linux & macOS]
curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://axiom.aerovex.net/install.ps1 | iex
```

:::

::: tip バージョン選択＆ソースからのビルド
特定のリリースバージョンをインストールする場合:
```bash
AXIOM_VERSION=v1.0.0 curl -fsSL https://axiom.aerovex.net/install.sh | bash
```

またはcargoを使用してソースから直接ビルドする場合:
```bash
curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- --build
```
:::

## ベンチマークハイライト: Axiom vs. AMD Vivado

| 指標 | Axiom EDA (Aerovex) | AMD Vivado Design Suite | 優位性 |
| :--- | :--- | :--- | :--- |
| **エンドツーエンドのコンパイル所要時間** | **2.81 ms** (インメモリJIT) | 30.0 – 60.0 秒 (`xelab` スナップショット) | **10,000倍以上高速** |
| **シミュレーションイベントスループット** | **780,840 イベント/秒** | 約100,000 – 250,000 イベント/秒 | **3–7倍高速** |
| **ゼロ時間デルタの内省** | 明示的な $\delta$ ステッピング＆グリッチフラグ | ブラックボックスなゼロ時間集約 | **競合状態の完全な可視性** |
| **動的エネルギーテレメトリ** | リアルタイム $P = \frac{1}{2} C V^2 f \alpha$ | シミュレーション後の静的レポート | **ライブ同期波形** |
| **インストールサイズ** | **50MB未満** 自己完結型バイナリ | **100GB超** モノリシックインストール | **2,000倍以上軽量** |
| **プラットフォーム互換性** | Linux, macOS (Apple Silicon), Windows, Web | Linux＆Windowsのみ | **普遍的なポータビリティ** |
