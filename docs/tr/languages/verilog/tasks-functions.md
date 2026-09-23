# Verilog Görevleri ve Fonksiyonları

Görevler ve fonksiyonlar Verilog’da yeniden kullanılabilir algoritmik ifadeleri kapsüller. Kod modülerliğini artırır ve tasarımlar ile test ortamları arasındaki tekrarlayan yordamsal mantığı azaltır.

---

## Fonksiyonlar (`function`)

Bir fonksiyon bir veya daha fazla girişten bir dönüş değeri hesaplar. Sentezlenebilir Verilog’da fonksiyonlar tamamen kombinasyonel mantığı modeller:
- Sıfır simülasyon süresinde yürütülür (`#` gecikmeleri veya `@` olay denetimleri içeremez).
- En az bir girişe sahip olmalıdır.
- Engelleyici olmayan atamalar (`<=`) içeremez.
- Fonksiyon adına atanan tek bir skalar veya vektör değeri döndürür.

```verilog
module parity_checker (
    input  wire [7:0] data_byte,
    output wire       parity_bit
);
    // User-defined function calculating odd parity
    function calc_parity;
        input [7:0] val;
        integer i;
        begin
            calc_parity = 1'b0;
            for (i = 0; i < 8; i = i + 1) begin
                calc_parity = calc_parity ^ val[i];
            end
        end
    endfunction

    // Continuous assignment calling function
    assign parity_bit = calc_parity(data_byte);

endmodule
```

---

## Görevler (`task`)

Bir görev bir fonksiyondan daha geneldir. Girişleri kabul edebilir, `output` argümanları aracılığıyla birden fazla çıkış döndürebilir ve zamansal gecikme ifadeleri (`#`, `@`) içerebilir:
- `initial` veya `always` blokları içinde yordamsal olarak çalışır.
- Simülasyon süresini denetleyebilir, bu da görevleri test ortamı veri yolu fonksiyonel modelleri (BFM) için ideal hale getirir.

```verilog
module tb_memory;
    reg clk;
    reg we;
    reg [7:0] addr;
    reg [15:0] wdata;
    wire [15:0] rdata;

    // Bus Functional Task modeling an SRAM write bus cycle
    task sram_write;
        input [7:0]  target_addr;
        input [15:0] write_val;
        begin
            @(posedge clk);
            addr  <= target_addr;
            wdata <= write_val;
            we    <= 1'b1;
            @(posedge clk);
            we    <= 1'b0;
        end
    endtask

    initial begin
        clk = 0;
        we  = 0;
        #20;
        // Invoke task with arguments
        sram_write(8'h04, 16'hDEAD);
        sram_write(8'h08, 16'hBEEF);
        #50 $finish;
    end

    always #5 clk = ~clk;
endmodule
```

---

## Otomatik (Yeniden Girişli) Görevler ve Fonksiyonlar

IEEE 1364-1995’te varsayılan olarak görev değişkenleri statiktir. IEEE 1364-2001’de `function automatic` veya `task automatic` bildirimi yerel değişkenleri bir yığında dinamik olarak ayırarak özyinelemeli algoritmalara olanak tanır:

```verilog
function automatic [31:0] factorial;
    input [31:0] n;
    begin
        if (n <= 1)
            factorial = 1;
        else
            factorial = n * factorial(n - 1);
    end
endfunction
```
