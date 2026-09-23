# 継続的代入＆ゲートプリミティブ

継続的代入および構造ゲートプリミティブは、Verilogにおける静的な組み合わせ回路ハードウェアを表します。これらは並行して継続的に実行され、右辺の信号が変化すると常に出力ネットが即座に更新されます。

---

## 継続的代入 (`assign`)

継続的代入は `wire` ネット上に値を駆動します:

```verilog
// Explicit continuous assignment
wire [7:0] a, b;
wire [7:0] sum;
assign sum = a + b;

// Combined declaration and continuous assignment (IEEE 1364-2001)
wire [7:0] difference = a - b;
```

### 代入規則
1. **対象ネット型**: 左辺はスカラまたはベクターネット（`wire`）である必要があります。レジスタ変数（`reg`）には代入できません。
2. **動的再評価**: `a` または `b` が変化するたびに、現在のシミュレーション時間ステップ内で `sum` が即座に更新されます。
3. **暗黙のゼロ遅延**: 変更はゼロシミュレーション時間で継続的代入を通じて伝播し、すべてのネットが定常状態に達するまで中間ゼロ時間デルタサイクル (δサイクル)（$\delta$）を生成します。

---

## 組み込み構造ゲートプリミティブ

Verilogには、Axiomのエラボレータによって直接認識され、回路図DAGビジュアライザにマッピングされる組み込みゲートプリミティブが含まれています:

```verilog
// Basic Boolean Gates
// Syntax: gate_type [instance_name] (output, input1, input2, ...);
and  and1 (out_and, in_a, in_b);
or   or1  (out_or,  in_a, in_b);
xor  xor1 (out_xor, in_a, in_b);
nand nand1(out_nand, in_a, in_b);
nor  nor1 (out_nor, in_a, in_b);
xnor xnor1(out_xnor, in_a, in_b);

// Inverters and Buffers
// Syntax: not/buf [instance_name] (output, input);
not  inv1 (out_not, in_a);
buf  buf1 (out_buf, in_a);

// Tristate Buffers
// Syntax: bufif0/bufif1 [instance_name] (output, input, control);
bufif1 tri_buf (bus_line, tx_data, enable); // Enabled when enable == 1
bufif0 tri_inv (bus_line, tx_data, n_en);   // Enabled when n_en == 0
```

---

## 組み合わせ論理の例: ゲートレベル全加算器

```verilog
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire s1, c1, c2;

    // First half adder stage
    xor xor1 (s1, a, b);
    and and1 (c1, a, b);

    // Second half adder stage
    xor xor2 (sum, s1, cin);
    and and2 (c2, s1, cin);

    // Carry out calculation
    or  or1  (cout, c1, c2);

endmodule
```

Axiom Studioでこの設計を開くと、回路図ビューアにおいて衝突のない直交配線、ゼロ回転ピンアライメント、リアルタイムなネット値表示を用いて5つのゲートすべてが自動配置されます。
