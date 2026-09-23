# インメモリCranelift JITコンパイル

従来のハードウェアシミュレータ（Verilator、Synopsys VCS、Vivado xsimなど）は、多段階のファイル生成に大きく依存しています:
1. HDLソースファイルの字句解析・構文解析による中間ASTの生成。
2. 巨大なC++またはCソースファイル（しばしば数ギガバイト規模）の出力。
3. 共有オブジェクトファイルをコンパイルおよびリンクするための外部ホストコンパイラ（GCC / Clang）の呼び出し。
4. シミュレーションを開始するための共有ライブラリのメモリへの再ロード。

このアプローチは、設計イテレーションのたびに**数十秒から数分の無駄なコンパイル時間**を生み出します。

---

## Axiom ゼロディスクJITパイプライン

Axiomは、ディスクへの中間ダンプと外部ツールチェーンを完全にバイパスします:

```
Verilog / SystemVerilog Source
              |
              v
     Streaming Lexer & Pratt Parser
              | (In-Memory AST)
              v
     Hierarchical Elaborator (BIR)
              | (Dataflow Netlist Graph)
              v
  Cranelift JIT Code Generator
              | (Machine Instructions)
              v
Native Machine Code in RAM (x86_64 / AArch64)
              |
              +--> Directly mutates SimStateArena in O(1)
```

1. **Cranelift関数の直接生成**:
   - 継続的代入（例: `assign c = a + b`）および組み合わせ論理ブロックは、直接Cranelift中間表現（CLIF）に低レベル化されます。
   - 算術、ビット単位、シフト、リダクション演算子は、ベクトル化されたホストマシン命令にコンパイルされます。
2. **ネイティブメモリポインタ実行**:
   - コンパイルされた関数は、`SimStateArena` メモリバッファ（`values: *mut u64, masks: *mut u64`）への直接ポインタを受け取ります。
   - ビットレベルの演算は、単一サイクルのCPU命令（`and`、`or`、`xor`、`add`、`sub`）で実行されます。
3. **変化検出フラグ**:
   - コンパイルされた関数は、出力先ネットが状態遷移したかどうかを示すブール整数を返し、最適な下流感度スケジューリングを可能にします。
