# SystemVerilog (IEEE 1800) Desteğine Genel Bakış

Axiom EDA, **IEEE 1800 SystemVerilog** dil standardı için yerel sentez, simülasyon ve biçimsel doğrulama desteği sunar. SystemVerilog, klasik Verilog'u modern donanım tasarım yapıları (`logic`, `always_ff`, `always_comb`, `interface`, `package`) ve SystemVerilog Ösavları (SVA) ile kısıtlı rastgele uyarıcı dahil olmak üzere doğrulama yetenekleriyle genişletir.

---

## Axiom'da SystemVerilog Paradigması

```
+-------------------------------------------------------------------------------+
| SystemVerilog Design & Verification Unified Engine                            |
+---------------------------------------+---------------------------------------+
| Hardware Design Enhancements          | Verification & Formal Proofs          |
|---------------------------------------+---------------------------------------|
| - Universal 'logic' data type         | - Immediate & Concurrent Assertions   |
| - Strict 'always_comb' / 'always_ff'  | - Temporal Sequences (##n, |->, |=>)   |
| - Typedefs, Structs & Enums           | - In-Engine Bounded Model Checker     |
| - Interfaces & Modports               | - Constrained Random Stimulus (rand)  |
| - Parameterized Packages              | - Automated Testbench Generators      |
+---------------------------------------+---------------------------------------+
| Unified Cranelift JIT & WebAssembly In-RAM Simulation Kernel                  |
+-------------------------------------------------------------------------------+
```

### Axiom'daki Temel Mimari Avantajlar
1. **Sıfır Ek Yüklü Açımlama**: SystemVerilog arayüzlerini, modportlarını ve paketlerini ara sarmalayıcı dosyalar oluşturmadan doğrudan düz BIR netlistlerine açımlar.
2. **Açık Niyet Doğrulaması**: `always_comb` ve `always_ff` bloklarında katı sentez kurallarını uygulayarak, mandal çıkarımını ve yarış tehlikelerini ayrıştırma aşamasında yakalar.
3. **Biçimsel Özellik Motoru**: SVA zamansal özelliklerini doğrudan Axiom'un motor içi Sınırlı Model Denetleyicisi tarafından doğrulanan Boole durum geçiş ilişkilerine yerel olarak derler.
