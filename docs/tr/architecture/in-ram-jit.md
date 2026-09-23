# RAM İçi Cranelift JIT Derlemesi

Geleneksel donanım simülatörleri (Verilator, Synopsys VCS ve Vivado xsim gibi) büyük ölçüde çok aşamalı dosya üretimine dayanır:
1. HDL kaynak dosyalarının ara AST'lere sözcüksel ve sözdizimsel analizi.
2. Büyük C++ veya C kaynak dosyalarının (çoğunlukla gigabaytlarca boyutta) üretilmesi.
3. Paylaşılan nesne dosyalarını derlemek ve bağlamak için harici ana bilgisayar derleyicilerini (GCC / Clang) çağırma.
4. Simülasyona başlamak için paylaşılan kütüphaneleri belleğe geri yükleme.

Bu yaklaşım, her tasarım yinelemesinde **onlarca saniyeden dakikalara varan ölü derleme süresine** yol açar.

---

## Axiom Sıfır-Disk JIT Boru Hattı

Axiom ara disk dökümlerini ve harici araç zincirlerini tamamen atlar:

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

1. **Doğrudan Cranelift Fonksiyon Üretimi**:
   - Sürekli atamalar (ör. `assign c = a + b`) ve kombinasyonel bloklar doğrudan Cranelift Ara Temsiline (CLIF) indirgenir.
   - Aritmetik, bit düzeyinde, kaydırma ve indirgeme işleçleri vektörleştirilmiş yerel makine komutlarına derlenir.
2. **Yerel Bellek İşaretçisi Yürütmesi**:
   - Derlenen fonksiyon `SimStateArena` bellek arabelleğine doğrudan işaretçileri kabul eder (`values: *mut u64, masks: *mut u64`).
   - Bit düzeyindeki işlemler tek döngülü CPU komutlarıyla yürütülür (`and`, `or`, `xor`, `add`, `sub`).
3. **Değişiklik Algılama Bayrakları**:
   - Derlenen fonksiyonlar, hedef hattın bir durum geçişi geçirip geçirmediğini belirten tek bir boole tamsayısı döndürerek optimum duyarlılık zamanlaması sağlar.
