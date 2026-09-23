# VHDL Dil Sunucusu ve Linter Kuralları

Axiom EDA, doğrudan Monaco düzenleyicisinde sözdizimi doğrulaması, tip tutarlılığı denetimi ve tasarım kuralı kontrolü sağlayan özel bir VHDL dil sunucusu (`crates/lsp/src/vhdl.rs`) içerir.

---

## VHDL İçin Tanılama Kuralları

| Kural Kimliği | Önem Derecesi | Açıklama | Düzeltme |
| :--- | :--- | :--- | :--- |
| `VHDL_W001` | Uyarı | **Eksik Duyarlılık Listesi**: Kombinasyonel bir süreç içinde okunan bir sinyal duyarlılık listesinde eksik. | Eksik sinyali `process(...)` listesine ekleyin veya `process(all)` kullanın (VHDL-2008). |
| `VHDL_W002` | Uyarı | **Çıkarılan Mandal**: Kombinasyonel bir süreçteki eksik `if-then-else` veya `case-when` dalları istenmeyen bir şeffaf mandal çıkarır. | Tüm dalları kapsayın veya koşullu kontrollerden önce varsayılan bir değer atayın. |
| `VHDL_E001` | Hata | **Tip Uyuşmazlığı**: Dönüştürme yapmadan `std_logic_vector` tipini doğrudan `unsigned` veya `integer` tipine atamaya çalışmak. | Açıkça `to_integer()`, `unsigned()` veya `std_logic_vector()` kullanın. |
| `VHDL_W003` | Uyarı | **Kullanılmayan Sinyal**: Bildirilen bir mimari sinyali hiçbir zaman atanmaz veya okunmaz. | Kullanılmayan sinyal bildirimini kaldırın. |
| `VHDL_E002` | Hata | **Çok Sürücülü Çatışma**: Birden çok eşzamanlı atama aynı çözümlenmiş sinyali sürer. | Tek bir çoklanmış atama kullanın. |
