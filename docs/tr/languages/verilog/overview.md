# Verilog HDL (IEEE 1364) Desteğine Genel Bakış

Axiom EDA; IEEE 1364-1995, IEEE 1364-2001 ve IEEE 1364-2005 Verilog Donanım Tanımlama Dili standartları için kapsamlı, yerel derleme ve benzetim desteği sunar.

Eski çok aşamalı C++ dönüştürmelerine veya disk yoğun anlık görüntü oluşturmaya güvenmek yerine Axiom, Verilog kodunu doğrudan bellek içi bir Ara Temsile (BIR) çevirir; bu temsil In-RAM Cranelift JIT derlemesi ile 3 milisaniyenin altında yerel makine koduna (x86_64, AArch64) derlenir veya WebAssembly aracılığıyla tarayıcılarda istemci tarafında çalıştırılır.

---

## Verilog Derleme ve Simülasyon Boru Hattı

```
+-------------------------------------------------------------------------------+
| Axiom In-RAM HDL Processing Pipeline                                          |
+-------------------------------------------------------------------------------+
| Source Code (.v)                                                              |
|   |                                                                           |
|   v [Lexer & Tokenizer] (crates/syntax/src/lexer.rs)                          |
| IEEE 1364 Token Stream (Keywords, Identifiers, Sized Numbers, Directives)     |
|   |                                                                           |
|   v [Recursive Descent Parser] (crates/syntax/src/parser.rs)                  |
| Abstract Syntax Tree (AST) (Modules, Ports, Declarations, Processes, Assigns) |
|   |                                                                           |
|   v [Hardware Elaborator] (crates/ir/src/elaborator.rs)                       |
| Bound Intermediate Representation (BIR Netlist, Stratified Event Graph)       |
|   |                                                                           |
|   +---------------------------------------+-----------------------------------+
|   | (Desktop Native)                      | (In-Browser WebAssembly)          |
|   v                                       v                                   |
| [Cranelift JIT Backend]                   | [WASM Execution Engine]           |
| Machine Code in RAM (x86_64 / AArch64)    | Web Worker Sandbox (32-bit WASM)  |
|   |                                       |                                   |
|   +-------------------+-------------------+                                   |
|                       v                                                       |
|       [Stratified Event Scheduler] (crates/sim/src/engine.rs)                 |
|       Active -> Inactive -> NBA -> Monitor -> Future Events                   |
+-------------------------------------------------------------------------------+
```

### 1. RAM İçi Sözcüksel ve Sözdizimsel Analiz
Yüksek hızlı sözcüksel analizci ve özyinelemeli iniş ayrıştırıcısı, tüm IEEE 1364 sözcüksel kurallarını, boyutlandırılmış sayı değişmezlerini, derleyici yönergelerini (`\`include\`, `\`define\`, `\`ifdef\`) ve makro genişletmelerini milisaniyenin altında yürütme süreleriyle işler.

### 2. Netlist Açımlaması
Ayrıntılandırıcı (elaborator), modül hiyerarşilerini açar, parametre geçersiz kılmalarını (`#(.WIDTH(8))`) çözer, sürekli atamaları bağlar, kapı ilkellerini birbirine bağlar, sonlu durum makinelerini çıkarır ve katmanlı bir olay zamanlama grafiği oluşturur.

### 3. Çift Çalışma Zamanlı Yürütme
- **Masaüstü Yerel JIT**: Boole ifadelerini, çoklayıcıları ve aritmetik işleçleri doğrudan yerel makine yönergelerine indirgeyerek saniyede 780.000 olayı aşan benzetim verimi sağlar.
- **WebAssembly Yalıtım Alanı**: SharedArrayBuffer telemetrisi ile yalıtılmış bir arka plan Web Worker içinde çalışarak sıfır sunucu bağımlılığıyla %100 istemci tarafı benzetim sunar.

---

## Standart Uyumluluk Matrisi

| IEEE Standardı | Özellik Alanı | Axiom Destek Durumu |
| :--- | :--- | :--- |
| **IEEE 1364-1995** | Yapısal geçit primitifleri (`and`, `or`, `not`, `xor`, `buf`) | Tam Destekleniyor |
| **IEEE 1364-1995** | Non-ANSI port başlıkları (`module foo (a, b); input a;`) | Tam Destekleniyor |
| **IEEE 1364-2001** | ANSI port listesi başlıkları (`module foo (input wire a, output reg b);`) | Tam Destekleniyor |
| **IEEE 1364-2001** | İndeksli parça seçme işleçleri (`[base +: width]`, `[base -: width]`) | Tam Destekleniyor |
| **IEEE 1364-2001** | Çok boyutlu bellek dizileri (`reg [31:0] mem [0:1023]`) | Tam Destekleniyor |
| **IEEE 1364-2001** | Birleşik bildirim ve sürekli atama (`wire [7:0] w = in;`) | Tam Destekleniyor |
| **IEEE 1364-2005** | Yordamsal döngü yapıları (`for`, `while`, `repeat`, `forever`) | Tam Destekleniyor |
| **IEEE 1364-2005** | Sistem görevleri (`$display`, `$finish`, `$time`, `$random`, `$clog2`) | Tam Destekleniyor |
| **IEEE 1364-2005** | Bellek dosyası yükleme (`$readmemb`, `$readmemh`) | Tam Destekleniyor |
