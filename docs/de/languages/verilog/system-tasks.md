# IEEE 1364 System-Tasks & Funktionen

Verilog bietet standardmäßige integrierte System-Tasks und -Funktionen, denen ein Dollarzeichen (`$`) vorangestellt ist. Axiom EDA fängt diese Routinen nativ ab und führt sie im RAM aus, ohne externe C/C++-PLI- oder VPI-Bibliotheken zu benötigen.

---

## Ausgabe- & Zeichenkettenformatierungs-Tasks

### 1. `$display` und `$write`
Gibt formatierten Text direkt in Axioms interaktives Dock **Konsole & REPL** aus. `$display` hängt automatisch einen Zeilenumbruch an, `$write` hingegen nicht.

```verilog
$display("Simulation Cycle at time %0t ps: state = %0d, data = 0x%0h", $time, state, data);
```

#### Unterstützte Formatbezeichner
- `%d` / `%0d`: Dezimale Ganzzahl (ohne führende Nullen)
- `%h` / `%0h`: Hexadezimalwert
- `%b`: Binärvektor
- `%o`: Oktalwert
- `%c`: ASCII-Zeichen
- `%s`: Zeichenkette (String)
- `%t`: Formatierte Simulationszeit

### 2. `$monitor` und `$strobe`
- `$monitor`: Überwacht Signalargumente und gibt automatisch eine Meldung aus, sobald ein überwachtes Signal seinen Wert ändert.
- `$strobe`: Verzögert die Nachrichtenausgabe in die Monitor-Region ganz am Ende des aktuellen Zeitschritts, um sicherzustellen, dass sich alle NBA-Zuweisungen stabilisiert haben.

---

## Simulationssteuerungs-Tasks

### 1. `$finish`
Beendet den Simulationslauf, stoppt das autonome Takten und zeigt die abschließenden Ausführungsmetriken in der Konsole an.
```verilog
#1000 $display("Simulation completed successfully.");
$finish;
```

### 2. `$stop`
Hält die Simulation an, versetzt die Simulationsleiste in den Zustand **Angehalten** und behält alle Signalverläufe und Registerzustände zur Inspektion bei.

### 3. `$time` und `$realtime`
- `$time`: Gibt die aktuelle Simulationszeit als 64-Bit-Ganzzahl basierend auf der aktiven `` `timescale ``-Direktive zurück.
- `$realtime`: Gibt die aktuelle Simulationszeit als reelle Gleitkommazahl zurück.

---

## Mathematische & Hilfsfunktionen

### 1. `$clog2` (Aufrundender Logarithmus zur Basis 2)
Berechnet $\lceil \log_2(N) \rceil$. Unverzichtbar für die Berechnung von Adressbusbreiten aus Speichertiefen:
```verilog
parameter FIFO_DEPTH = 64;
// Automatically computes ADDR_WIDTH = 6
localparam ADDR_WIDTH = $clog2(FIFO_DEPTH);
reg [ADDR_WIDTH-1:0] wr_ptr;
```

### 2. `$random`
Generiert eine vorzeichenbehaftete 32-Bit-Pseudozufalls-Ganzzahl. Häufig maskiert zur Generierung randomisierter Testvektoren:
```verilog
test_byte = $random % 256;
```

---

## Signalverlaufs-Export-Tasks

Axiom fängt VCD-Systemaufrufe nativ ab:
- `$dumpfile("waveform.vcd");`: Gibt den Dateinamen für den ausgegebenen Signalverlauf an.
- `$dumpvars(0, top_tb);`: Schreibt alle Signalwertänderungen über die gesamte Designhierarchie in Axioms speicherinternen Trace-Puffer und lädt sie als IEEE 1364 VCD-Datei herunter.

---

## Speicherdatei-Initialisierung (`$readmemb`, `$readmemh`)

Lädt Speicher-Array-Inhalte direkt aus Textdateien:
- `$readmemb("rom.bin", memory_array);`: Lädt Binärdaten (`10101100`).
- `$readmemh("rom.hex", memory_array);`: Lädt Hexadezimaldaten (`AF 04 C2`).

In Axiom Studio werden Speicherinitialisierungsdateien sicher innerhalb der Projektdateisätze gelesen, ohne die Sandbox-Grenzen des Host-Dateisystems zu verletzen.
