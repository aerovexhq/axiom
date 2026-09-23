# CLI-Referenzhandbuch

Axiom enthält einen schnellen, eigenständigen Befehlszeilen-Treiber für CI/CD-Pipelines, Headless-Tests und Benchmark-Regressionsläufe.

---

## Globale Verwendung

```bash
axiom <SUBCOMMAND> [OPTIONS]
```

### Globale Flags
- `-h, --help`: Zeigt Hilfe- und Verwendungsinformationen an.
- `-v, --version`: Zeigt die aktuelle Version von Axiom EDA an.

---

## Unterbefehle

### 1. `compile`
Führt lexikalische In-Memory-Analyse, Pratt-Parsing, hierarchische Netzlisten-Elaborierung und Cranelift-JIT-Kompilierung ohne Festplattenserialisierung durch.

```bash
axiom compile <FILE> -t <TOP>
```

#### Argumente
- `<FILE>`: Pfad zur Verilog- oder SystemVerilog-HDL-Datei (`.v` oder `.sv`).
- `-t, --top <TOP>`: Bezeichner des zu elaborierenden Top-Level-Moduls.

#### Beispiel
```bash
axiom compile tests/fixtures/alu.v -t alu
```

---

### 2. `run`
Kompiliert das angegebene HDL-Design und simuliert es für eine festgelegte Anzahl von Taktschritten mit optionaler Echtzeit-VCD- und SAIF-Ausgabegenerierung.

```bash
axiom run <FILE> -t <TOP> [OPTIONS]
```

#### Optionen
- `-t, --top <TOP>`: Name des Top-Level-Moduls (erforderlich).
- `--ticks <N>`: Anzahl der zu simulierenden Taktschritte (Standard: 100).
- `--vcd <FILE>`: Dateipfad zum Speichern von IEEE 1364 Value Change Dump (VCD)-Signalverläufen.
- `--saif <FILE>`: Dateipfad zum Speichern von SAIF 2.0-Schaltaktivitätsdaten.

#### Beispiel
```bash
axiom run tests/fixtures/counter.v -t counter --ticks 500 --vcd sim.vcd --saif activity.saif
```

---

### 3. `benchmark`
Führt statistische Mikro-Benchmarks durch, die die End-to-End-JIT-Kompilierungszeit und den reinen Simulations-Ereignisdurchsatz messen.

```bash
axiom benchmark <FILE> -t <TOP> [OPTIONS]
```

#### Optionen
- `-t, --top <TOP>`: Name des Top-Level-Moduls (erforderlich).
- `--cycles <N>`: Anzahl der simulierten Taktzyklen (Standard: 5000).

#### Beispiel
```bash
axiom benchmark tests/fixtures/fifo.v -t fifo_4deep --cycles 10000
```
