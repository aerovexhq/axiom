# SystemVerilog Ösavları (SVA) & Biçimsel Doğrulama

SystemVerilog Ösavları (SVA), beklenen davranışları ve zamansal protokolleri matematiksel olarak belirtir. Axiom EDA, SVA'yı motor içi Sınırlı Model Denetleyicisi (`crates/sim/src/formal/`) ile entegre ederek, özelliklerin geçici simülasyon sırasında doğrulanmasına veya her durum için biçimsel olarak kanıtlanmasına olanak tanır.

---

## Anlık ve Eşzamanlı Ösavlar

### 1. Anlık Ösavlar
Tek bir simülasyon zaman adımında yordamsal ifadeler olarak değerlendirilir:

```verilog
always_comb begin
    // Validate that address stays within legal 4KB bounds
    assert (addr < 32'h1000)
        else $error("Address out of range: 0x%0h", addr);
end
```

### 2. Eşzamanlı Ösavlar
Döngülerin zamansal dizileri boyunca saat kenarlarında senkronize olarak örneklenir:

```verilog
// Property asserting that 'req' must be followed by 'gnt' within 1 to 3 cycles
property p_req_gnt_handshake;
    @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] gnt;
endproperty

assert property (p_req_gnt_handshake)
    else $error("Handshake violation: gnt failed to assert within 3 cycles!");
```

---

## Zamansal Diziler ve İşleçler

| İşleç | Sözdizimi | Açıklama |
| :--- | :--- | :--- |
| **Döngü Gecikmesi** | `##n` | Tam olarak $n$ saat döngüsü sonra |
| **Sınırlı Aralık** | `##[min:max]` | $min$ ile $max$ saat döngüsü arasında sonra |
| **Ardışık Tekrar** | `expr [*n]` | İfade ardışık $n$ döngü boyunca doğru kalır |
| **Örtüşen Gerektirme** | `ante \ | -> cons` | Öncül sağlanırsa, ardıl **aynı** döngüde sağlanmalıdır |
| **Örtüşmeyen Gerektirme** | `ante \ | => cons` | Öncül sağlanırsa, ardıl **bir sonraki** döngüde sağlanmalıdır |
| **Sistem Fonksiyonu** | `$rose(signal)` | 0'dan 1'e yükselen kenar geçişinde doğru olarak değerlendirilir |
| **Sistem Fonksiyonu** | `$fell(signal)` | 1'den 0'a düşen kenar geçişinde doğru olarak değerlendirilir |
| **Sistem Fonksiyonu** | `$stable(signal)` | Sinyal değeri önceki döngüden bu yana değişmemişse doğru değerlendirilir |

---

## Doğrulama Direktifleri: `assert`, `assume`, `cover`

- **`assert property`**: Tasarım mantığının özelliği asla ihlal etmediğini kanıtlar. İhlaller Axiom'un Biçimsel Stüdyosunda karşıt örnek izleri üretir.
- **`assume property`**: Biçimsel sınırlı model denetimi sırasında birincil girişleri geçerli çalışma ortamlarıyla sınırlar.
- **`cover property`**: Hedef işlevsel bir duruma ulaşılabileceğini kanıtlayarak tanık yürütme izleri üretir.
