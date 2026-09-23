# Analizador de protocolos e inspector de paquetes serie

Axiom EDA cuenta con un analizador de protocolos serie de hardware y disector de tramas integrado (`crates/sim/src/protocol/`, `ProtocolAnalyzer.tsx`). Supervisa transiciones de señales digitales, extrae tramas, valida sumas de verificación y decodifica cargas útiles de paquetes para buses de comunicación estándar directamente en RAM.

---

## Decodificadores de protocolos de hardware soportados

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

### 1. UART (Transmisor-Receptor Asíncrono Universal)
- Velocidades de baudios configurables (9600 a 921600 Baudios).
- Bits de datos: 5, 6, 7, 8, 9.
- Comprobación de paridad: Ninguna, Par, Impar, Marca, Espacio.
- Bits de parada: 1, 1.5, 2. Detecta errores de encuadre y condiciones de interrupción.

### 2. SPI (Interfaz de Periféricos Serie)
- Decodificación simultánea dúplex completa de MOSI y MISO.
- Admite los 4 modos de reloj SPI: Modo 0 ($CPOL=0, CPHA=0$), Modo 1 ($CPOL=0, CPHA=1$), Modo 2 ($CPOL=1, CPHA=0$), Modo 3 ($CPOL=1, CPHA=1$).
- Calificación de selección de chip (`CS_N`) activa en bajo o activa en alto.

### 3. I2C (Inter-Integrated Circuit)
- Direccionamiento de esclavo de 7 bits y 10 bits.
- Detecta condiciones de bus de INICIO, INICIO repetido y PARADA.
- Valida bits ACK/NACK de esclavo y dirección de transferencia (Lectura/Escritura).

### 4. Bus CAN 2.0A / 2.0B
- Disección de tramas de red de área de controlador (CAN) de grado automotriz.
- Detección de inserción de bits (bit-stuffing) y des-inserción automática.
- Extracción de identificador estándar de 11 bits y extendido de 29 bits.
- Verificación del código de longitud de datos (DLC) y suma de comprobación polinómica CRC-15.

### 5. USB 1.1 / 2.0
- Seguimiento del estado de línea NRZI para baja velocidad (1.5 Mbps) y velocidad completa (12 Mbps).
- Recuperación de des-inserción de bits.
- Decodificación de identificador de paquete (PID): Token (OUT, IN, SOF, SETUP), Datos (DATA0, DATA1), Apretón de manos (ACK, NAK, STALL).
- Validación CRC-5 (tokens) y CRC-16 (paquetes de datos).

### 6. Ethernet MII / RMII
- Disector de interfaz independiente del medio (MII) de 10/100 Mbps.
- Descomposición de trama: Preámbulo (`0x55`), Delimitador de inicio de trama (`0xD5`), MAC de destino, MAC de origen, EtherType.
- Decodificación de encabezado IPv4, ARP y carga útil UDP.
- Verificación CRC-32 de secuencia de comprobación de trama (FCS).

---

## HUD del inspector de paquetes

- **Tabla de flujo de transacciones**: Muestra transferencias secuenciales de paquetes con marcas de tiempo, identificadores de canal e insignias de estado de validación.
- **Visor de carga útil Hex/ASCII**: Inspeccione cargas útiles binarias en representaciones hexadecimales formateadas o caracteres ASCII legibles.
- **Señalización de errores**: Paquetes corruptos (fallo de suma de comprobación, error de trama, violación de paridad) se resaltan con insignias de advertencia rojas.
