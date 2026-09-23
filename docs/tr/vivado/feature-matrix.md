# Vivado ve Axiom Özellik Matrisi

Eski AMD Vivado simülasyon ortamı ile yeni nesil Axiom EDA motoru arasında ayrıntılı bir karşılaştırma.

---

## Teknik Yetenek Karşılaştırması

| Yetenek | AMD Vivado Tasarım Paketi | Axiom EDA (Aerovex) |
| :--- | :--- | :--- |
| **Birincil Yürütme Motoru** | Diske derlenmiş `xsimk` anlık görüntüsü | Bellek içi Cranelift JIT makine kodu |
| **Tipik Derleme Gecikmesi** | 30 – 120 saniye | **1 – 3 milisaniye** |
| **Simülasyon İşleme Hızı** | 100k – 250k olay/sn | **780k+ olay/sn** |
| **Delta Döngüsü Kontrolü** | Opak (delta adımlarını daraltır) | **Çağrıcı denetimli `step_delta`** |
| **Aksaklık / Tehlike Takibi** | Gizli | **Statik ve dinamik tehlike algılama** |
| **Silikon Güç Modellemesi** | Simülasyon sonrası statik tahmin | **Gerçek zamanlı dinamik $P = \frac{1}{2} C V^2 f \alpha$** |
| **PDN Gerilim Düşümü** | Harici SPICE modellemesi gerektirir | **Dahili $IR + L \frac{di}{dt}$ düşüm modellemesi** |
| **Bellek Durumu Arenası** | Parçalanmış C++ yapıları | **Bitişik 64-bit çift vektörler** |
| **Dalga Biçimi Dışa Aktarıcıları** | Özel mülk `.wdb` + `.vcd` | **Standart IEEE 1364 `.vcd`** |
| **Güç Dışa Aktarıcıları** | SAIF üretimi | **Standart SAIF 2.0 birlikte çalışabilirliği** |
| **Arayüz Çerçevesi** | Java Swing (Ağır, bellek kısıtlı) | **Tauri v2 + React 19 (Koyu obsidian)** |
| **Web Tarayıcısı Yürütmesi** | İmkansız | **%100 İstemci Tarafı WebAssembly** |
| **Kurulum Boyutu** | 60 – 110 GB | **< 50 MB** |
| **macOS Yerel Desteği** | Hayır (Linux sanal makinesi gerektirir) | **Yerel Apple Silicon (AArch64)** |
| **Lisans Maliyeti** | Monolitik kullanıcı lisansları ($$$) | **Açık Kaynak Çekirdek (MIT Lisansı)** |
