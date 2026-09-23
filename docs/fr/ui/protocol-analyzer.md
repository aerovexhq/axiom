# Analyseur de protocoles et inspecteur de paquets série

Axiom EDA intègre un analyseur de protocoles série matériels et un dissecteur de trames (`crates/sim/src/protocol/`, `ProtocolAnalyzer.tsx`). Il surveille les transitions de signaux numériques, extrait le cadrage, valide les sommes de contrôle et décode les charges utiles de paquets pour les bus de communication standard directement en RAM.

---

## Décodeurs de protocoles matériels pris en charge

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

### 1. UART (Récepteur/Transmetteur asynchrone universel)
- Débits en bauds configurables (de 9600 à 921600 bauds).
- Bits de données : 5, 6, 7, 8, 9.
- Contrôle de parité : Aucune, Paire, Impaire, Marque, Espace.
- Bits d'arrêt : 1, 1.5, 2. Détecte les erreurs de cadrage et les conditions de rupture (break).

### 2. SPI (Interface périphérique série)
- Décodage simultané en duplex intégral de MOSI et MISO.
- Prend en charge les 4 modes d'horloge SPI : Mode 0 ($CPOL=0, CPHA=0$), Mode 1 ($CPOL=0, CPHA=1$), Mode 2 ($CPOL=1, CPHA=0$), Mode 3 ($CPOL=1, CPHA=1$).
- Validation par sélection de circuit active à l'état bas ou active à l'état haut (`CS_N`).

### 3. I2C (Circuit inter-intégré)
- Adressage esclave sur 7 bits et 10 bits.
- Détecte les conditions de bus START, START répété et STOP.
- Valide les bits ACK/NACK de l'esclave et le sens du transfert (Lecture/Écriture).

### 4. Bus CAN 2.0A / 2.0B
- Dissection de trames de réseau de contrôleur automobile (CAN) de qualité automobile.
- Détection du bit-stuffing et dé-bourrage automatique.
- Extraction d'identifiants standard 11 bits et étendus 29 bits.
- Vérification du code de longueur de données (DLC) et de la somme de contrôle polynomiale CRC-15.

### 5. USB 1.1 / 2.0
- Suivi d'état de ligne NRZI en basse vitesse (1.5 Mbps) et pleine vitesse (12 Mbps).
- Récupération par dé-bourrage de bits.
- Décodage d'identifiant de paquet (PID) : Jeton (OUT, IN, SOF, SETUP), Données (DATA0, DATA1), Négociation (ACK, NAK, STALL).
- Validation CRC-5 (jetons) et CRC-16 (paquets de données).

### 6. Ethernet MII / RMII
- Dissecteur Media Independent Interface (MII) 10/100 Mbps.
- Décomposition de trame : Préambule (`0x55`), Délimiteur de début de trame (`0xD5`), MAC de destination, MAC source, EtherType.
- Décodage des en-têtes IPv4, ARP et de la charge utile UDP.
- Vérification de séquence de contrôle de trame (FCS) CRC-32.

---

## HUD d'inspection de paquets

- **Tableau du flux de transactions** : Affiche les transferts séquentiels de paquets avec horodatages, identifiants de canaux et badges d'état de validation.
- **Visualiseur de charge utile Hex/ASCII** : Inspecte les charges utiles binaires en hexadécimal formaté ou en représentations de caractères ASCII clairs.
- **Signalement d'erreurs** : Les paquets corrompus (échec de somme de contrôle, erreur de cadrage, violation de parité) sont mis en évidence par des badges d'avertissement rouges.
