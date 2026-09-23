# Monaco XDC Dil Sunucusu ve Doğrulama

Axiom EDA, Xilinx Tasarım Kısıtlamaları (`crates/lsp/src/xdc.rs`) için özel bir Dil Sunucusu Protokolü (LSP) ve sözdizimi vurgulayıcısı içerir.

---

## Gerçek Zamanlı XDC Sözdizimi Doğrulaması

Monaco XDC dil hizmeti doğrudan editördeki `.xdc` dosyaları içinde çalışır:
- **Tcl Komut Doğrulaması**: `set_property`, `create_clock`, `create_generated_clock`, `set_input_delay`, `set_output_delay`, `set_false_path`, `set_clock_groups`, `set_multicycle_path` komutlarını tanır.
- **Yorum İşleme**: `#` ile başlayan satır yorumlarını doğru bir şekilde ayrıştırarak yorumlanmış pin yapılandırmalarında sahte sözdizimi uyarılarını önler.
- **Port Sorgusu Doğrulaması**: `[get_ports <ad>]` içinde başvurulan portların aktif tasarım üst modülünde var olduğunu doğrular.

---

## Akıllı Otomatik Tamamlamalar

Bir `.xdc` dosyası içinde yazmak bağlamsal otomatik tamamlama kod parçacıklarını tetikler:
- **Kılıf Pini Bağlama**: `set_property PACKAGE_PIN <PIN> [get_ports <PORT>]`
- **G/Ç Standardı Atama**: `set_property IOSTANDARD LVCMOS33 [get_ports <PORT>]`
- **Birincil Saat**: `create_clock -period 10.000 -name <AD> [get_ports <PORT>]`
- **Yanlış Yol**: `set_false_path -from [get_ports <PORT>]`
