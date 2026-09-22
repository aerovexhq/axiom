# Protocol Analyzer & Serial Packet Inspector

Axiom EDA features a built-in hardware serial protocol analyzer and frame dissector (`crates/sim/src/protocol/`, `ProtocolAnalyzer.tsx`). It monitors digital signal transitions, extracts framing, validates checksums, and decodes packet payloads for standard communication buses directly in RAM.

---

## Supported Hardware Protocol Decoders

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
- Configurable baud rates (9600 to 921600 Baud).
- Data bits: 5, 6, 7, 8, 9.
- Parity checking: None, Even, Odd, Mark, Space.
- Stop bits: 1, 1.5, 2. Detects framing errors and break conditions.

### 2. SPI (Serial Peripheral Interface)
- Full-duplex MOSI and MISO simultaneous decoding.
- Supports all 4 SPI clocking modes: Mode 0 ($CPOL=0, CPHA=0$), Mode 1 ($CPOL=0, CPHA=1$), Mode 2 ($CPOL=1, CPHA=0$), Mode 3 ($CPOL=1, CPHA=1$).
- Active-low or active-high Chip Select (`CS_N`) qualification.

### 3. I2C (Inter-Integrated Circuit)
- 7-bit and 10-bit slave addressing.
- Detects START, Repeated START, and STOP bus conditions.
- Validates slave ACK/NACK bits and transfer direction (Read/Write).

### 4. CAN Bus 2.0A / 2.0B
- Automotive-grade controller area network frame dissection.
- Bit-stuffing detection and automatic de-stuffing.
- 11-bit standard and 29-bit extended identifier extraction.
- Data Length Code (DLC) and CRC-15 polynomial checksum verification.

### 5. USB 1.1 / 2.0
- Low-Speed (1.5 Mbps) and Full-Speed (12 Mbps) NRZI line state tracking.
- Bit-unstuffing recovery.
- Packet Identifier (PID) decoding: Token (OUT, IN, SOF, SETUP), Data (DATA0, DATA1), Handshake (ACK, NAK, STALL).
- CRC-5 (tokens) and CRC-16 (data packets) validation.

### 6. Ethernet MII / RMII
- 10/100 Mbps Media Independent Interface dissector.
- Frame decomposition: Preamble (`0x55`), Start Frame Delimiter (`0xD5`), Destination MAC, Source MAC, EtherType.
- IPv4 header, ARP, and UDP payload decoding.
- Frame Check Sequence (FCS) CRC-32 verification.

---

## Packet Inspector HUD

- **Transaction Stream Table**: Displays sequential packet transfers with timestamps, channel identifiers, and validation status badges.
- **Payload Hex/ASCII Viewer**: Inspect binary payloads in formatted hexadecimal or clean ASCII character representations.
- **Error Flagging**: Corrupted packets (checksum failure, framing error, parity violation) are highlighted with red warning badges.
