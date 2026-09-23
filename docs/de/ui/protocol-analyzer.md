# Protokoll-Analysator & Serieller Paket-Inspektor

Axiom EDA verfügt über einen integrierten Hardware-Seriell-Protokoll-Analysator und Frame-Dissektor (`crates/sim/src/protocol/`, `ProtocolAnalyzer.tsx`). Er überwacht digitale Signalübergänge, extrahiert Framing, validiert Prüfsummen und dekodiert Paketnutzdaten für Standard-Kommunikationsbusse direkt im RAM.

---

## Unterstützte Hardware-Protokoll-Decoder

```
+-------------------------------------------------------------------------------+
| Protocol Analyzer: Active Decoder = UART (115200 Baud, 8N1)                   |
| Total Packets Decoded: 142 | Errors Detected: 0 | Framing: Valid              |
+-------------------------------------------------------------------------------+
| Packet Transaction Stream:                                                    |
| #   | Timestamp | Channel | Type | Payload (ASCII) | Payload (Hex) | Status   |
|-----+-----------+---------+------+-----------------+---------------+----------|
| 001 | 1.200 us  | TX      | DATA | "A"             | 0x41          | OK (ACK) |
| 002 | 1.286 us  | TX      | DATA | "X"             | 0x58          | OK (ACK) |
| 003 | 1.373 us  | TX      | DATA | "I"             | 0x49          | OK (ACK) |
| 004 | 1.460 us  | TX      | DATA | "O"             | 0x4F          | OK (ACK) |
| 005 | 1.547 us  | TX      | DATA | "M"             | 0x4D          | OK (ACK) |
+-------------------------------------------------------------------------------+
| Hex & ASCII Payload Inspector: [ 41 58 49 4F 4D ] -> "AXIOM"                  |
+-------------------------------------------------------------------------------+
```

### 1. UART (Universal Asynchronous Receiver/Transmitter)
- Konfigurierbare Baudraten (9600 bis 921600 Baud).
- Datenbits: 5, 6, 7, 8, 9.
- Paritätsprüfung: Keine, Gerade, Ungerade, Mark, Space.
- Stoppbits: 1, 1,5, 2. Erkennt Framing-Fehler und Break-Bedingungen.

### 2. SPI (Serial Peripheral Interface)
- Gleichzeitige Vollduplex-Dekodierung von MOSI und MISO.
- Unterstützt alle 4 SPI-Taktungsmodi: Modus 0 ($CPOL=0, CPHA=0$), Modus 1 ($CPOL=0, CPHA=1$), Modus 2 ($CPOL=1, CPHA=0$), Modus 3 ($CPOL=1, CPHA=1$).
- Aktiv-niedrige oder aktiv-hohe Chip-Select-(`CS_N`)-Qualifikation.

### 3. I2C (Inter-Integrated Circuit)
- 7-Bit- und 10-Bit-Slave-Adressierung.
- Erkennt START-, wiederholte START- und STOP-Busbedingungen.
- Validiert Slave-ACK/NACK-Bits und Übertragungsrichtung (Lesen/Schreiben).

### 4. CAN-Bus 2.0A / 2.0B
- Controller Area Network (CAN)-Frame-Dissektion in Automobilqualität.
- Bit-Stuffing-Erkennung und automatisches De-Stuffing.
- Extraktion von 11-Bit-Standard- und 29-Bit-Erweiterten-Identifikatoren.
- Überprüfung von Data Length Code (DLC) und CRC-15-Polynom-Prüfsumme.

### 5. USB 1.1 / 2.0
- NRZI-Leitungszustandsverfolgung für Low-Speed (1,5 Mbps) und Full-Speed (12 Mbps).
- Wiederherstellung nach Bit-Unstuffing.
- Packet Identifier (PID)-Dekodierung: Token (OUT, IN, SOF, SETUP), Data (DATA0, DATA1), Handshake (ACK, NAK, STALL).
- Validierung von CRC-5 (Tokens) und CRC-16 (Datenpakete).

### 6. Ethernet MII / RMII
- 10/100 Mbps Media Independent Interface (MII)-Dissektor.
- Frame-Zerlegung: Präambel (`0x55`), Start Frame Delimiter (`0xD5`), Ziel-MAC, Quell-MAC, EtherType.
- Dekodierung von IPv4-Headern, ARP- und UDP-Nutzdaten.
- Frame Check Sequence (FCS) CRC-32-Verifikation.

---

## Paket-Inspektor-HUD

- **Transaktionsstrom-Tabelle**: Zeigt aufeinanderfolgende Paketübertragungen mit Zeitstempeln, Kanalbezeichnern und Validierungsstatus-Badges an.
- **Nutzdaten-Hex/ASCII-Betrachter**: Untersuchen Sie binäre Nutzdaten in formatierter hexadezimaler oder sauberer ASCII-Zeichendarstellung.
- **Fehlerkennzeichnung**: Beschädigte Pakete (Prüfsummenfehler, Framing-Fehler, Paritätsverletzung) werden mit roten Warn-Badges hervorgehoben.
