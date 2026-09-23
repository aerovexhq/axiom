# Katmanlı Olay Zamanlayıcı ve Delta Döngüsü Motoru

Dijital mantık simülatörleri, eşzamanlılığı ve fiziksel nedensel yayılımı modellemek için ayrık olay zamanlamasına güvenir. Axiom, ince taneli çağrıcı denetimi sağlarken **IEEE 1800 Katmanlı Olay Kuyruğu** standardını kesin bir şekilde uygular.

---

## IEEE 1800 Bölge Hiyerarşisi

Her simülasyon zaman damgası ($t$), yürütme bölgelerine ayrılmış rastgele sayıda sıfır-zamanlı delta döngüsü ($\delta$) içerir:

```
+-------------------------------------------------------------------------------+
| Active Region                                                                 |
| - Evaluate continuous assignments                                             |
| - Execute blocking statements (=)                                             |
| - Evaluate right-hand side of non-blocking assignments (NBAs)                 |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Inactive Region (#0 Delays)                                                   |
| - Process explicit #0 procedural delays                                       |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| NBA Region (Non-Blocking Assignments)                                         |
| - Apply queued non-blocking assignment updates to flip-flop registers (<=)    |
| - Net transitions trigger sensitivity for next delta cycle: δ -> δ + 1        |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Postponed Region                                                              |
| - Sample steady-state values for VCD waveform dump and SAIF activity          |
+-------------------------------------------------------------------------------+
```

---

## Ayrıntılı Çağrıcı Denetimli API

Eski araçlar sıfır-zamanlı delta döngülerini bir kara kutu olarak ele alır: `run 100ns` tüm delta döngülerini dahili olarak yürüterek geçici aksaklıkları gizler.

Axiom iki ayrıntılı adımlama temeli sunar:

### 1. `step_delta()`
Fiziksel zamanı ilerletmeden simülasyonu tam olarak **bir ayrık delta döngüsü** ($\delta \to \delta + 1$) ilerletir:
```rust
let summary = simulator.step_delta()?;
println!("Delta cycle {} settled: {}", summary.delta, summary.settled);
```

### 2. `tick(delta_time)`
Fiziksel simülasyon zamanını rastgele bir artışla ilerletir:
```rust
let tick = simulator.tick(SimTime::from_nanoseconds(10))?;
println!("Executed {} events across {} deltas", tick.events_executed, tick.delta_cycles_executed);
```

---

## Kombinasyonel Aksaklık Tehlikesi Tespiti

Delta döngüleri sırasında asimetrik yol gecikmeleri, genellikle bir hattın kararlı hale gelmeden önce birden çok kez geçiş yapmasına neden olur (ör. $0 \to 1 \to 0$ veya $1 \to 0 \to 1$). Axiom'un `GlitchDetector` bileşeni bu olayları otomatik olarak etiketler:
- **Statik-0 Tehlikesi**: 0 ile başlayıp 0 ile biten bir sinyalde geçici yüksek darbe.
- **Statik-1 Tehlikesi**: 1 ile başlayıp 1 ile biten bir sinyalde geçici düşük darbe.
- **Dinamik Tehlike**: Tek bir mantık geçişi sırasında birden fazla ara değişim.

Bu tehlikeler hem CLI'da hem de Tuval dalga biçimi görüntüleyicisinde gerçek zamanlı olarak işaretlenir.
