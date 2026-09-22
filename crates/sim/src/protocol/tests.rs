use axiom_core::Logic4;
use super::types::{AxiConfig, I2cConfig, ProtocolKind, SpiConfig, UartConfig, UartParity};
use super::{AxiDecoder, I2cDecoder, SpiDecoder, UartDecoder};

#[test]
fn test_uart_decode_ascii_a() {
    let config = UartConfig {
        baud_rate: 115_200,
        data_bits: 8,
        stop_bits: 1,
        parity: UartParity::None,
    };
    let decoder = UartDecoder::new(config);
    let bit_ps = 1_000_000_000_000u64 / 115_200;

    // Character 'A' = 0x41 = 0b01000001
    // Bits in order (LSB first): Start(0), 1, 0, 0, 0, 0, 0, 1, 0, Stop(1)
    let bits = [0, 1, 0, 0, 0, 0, 0, 1, 0, 1];
    let mut transitions = Vec::new();
    let mut t = 10_000u64;

    // Initial idle high
    transitions.push((0, Logic4::One));

    for bit in bits {
        let val = if bit == 1 { Logic4::One } else { Logic4::Zero };
        transitions.push((t, val));
        t += bit_ps;
    }
    // Trailing idle
    transitions.push((t + bit_ps, Logic4::One));

    let txs = decoder.decode(&transitions);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::Uart);
    assert_eq!(tx.data_payload, vec![0x41]);
    assert!(tx.summary.contains("'A'"));
}

#[test]
fn test_spi_mode0_full_duplex() {
    let config = SpiConfig {
        cpol: 0,
        cpha: 0,
        bits_per_word: 8,
        msb_first: true,
    };
    let decoder = SpiDecoder::new(config);

    // Clock period: 100,000 ps (100 ns)
    let half_clk = 50_000u64;
    let mut sclk = Vec::new();
    let mut mosi = Vec::new();
    let mut miso = Vec::new();
    let mut cs_n = Vec::new();

    // CS_n goes low at t=10_000 ps
    cs_n.push((0, Logic4::One));
    cs_n.push((10_000, Logic4::Zero));
    sclk.push((0, Logic4::Zero));

    // Transmit MOSI = 0xA5 (0b10100101), MISO = 0x3C (0b00111100)
    let mosi_bits = [1, 0, 1, 0, 0, 1, 0, 1];
    let miso_bits = [0, 0, 1, 1, 1, 1, 0, 0];

    let mut t = 20_000u64;
    for i in 0..8 {
        // Setup data before rising clock edge
        mosi.push((t - 5_000, if mosi_bits[i] == 1 { Logic4::One } else { Logic4::Zero }));
        miso.push((t - 5_000, if miso_bits[i] == 1 { Logic4::One } else { Logic4::Zero }));

        // Rising clock edge
        sclk.push((t, Logic4::One));
        // Falling clock edge
        sclk.push((t + half_clk, Logic4::Zero));

        t += half_clk * 2;
    }

    // CS_n goes high at end
    cs_n.push((t + 10_000, Logic4::One));

    let txs = decoder.decode(&sclk, &mosi, &miso, &cs_n);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::Spi);
    assert_eq!(tx.data_payload, vec![0xA5]);
    assert!(tx.summary.contains("MOSI: [A5]"));
    assert!(tx.summary.contains("MISO: [3C]"));
}

#[test]
fn test_i2c_write_transaction() {
    let config = I2cConfig::default();
    let decoder = I2cDecoder::new(config);

    let mut scl = Vec::new();
    let mut sda = Vec::new();

    // Initial bus idle (High)
    scl.push((0, Logic4::One));
    sda.push((0, Logic4::One));

    // Start condition: SDA falls at t=10_000 while SCL is High
    sda.push((10_000, Logic4::Zero));
    // SCL falls at t=15_000
    scl.push((15_000, Logic4::Zero));

    // Byte 1: Address 0x3C + Write (0) -> 0b01111000 + ACK(0)
    // Byte 2: Data 0xAA -> 0b10101010 + ACK(0)
    let bit_stream = [
        // Addr (0x3C) + W(0) + ACK(0)
        0, 1, 1, 1, 1, 0, 0, 0, 0,
        // Data (0xAA) + ACK(0)
        1, 0, 1, 0, 1, 0, 1, 0, 0,
    ];

    let mut t = 20_000u64;
    for b in bit_stream {
        // Set SDA while SCL is low
        sda.push((t, if b == 1 { Logic4::One } else { Logic4::Zero }));
        // SCL rise
        scl.push((t + 5_000, Logic4::One));
        // SCL fall
        scl.push((t + 10_000, Logic4::Zero));
        t += 15_000;
    }

    // Stop condition: SCL rises at t, SDA rises at t+5_000 while SCL is High
    scl.push((t, Logic4::One));
    sda.push((t - 2_000, Logic4::Zero));
    sda.push((t + 5_000, Logic4::One));

    let txs = decoder.decode(&scl, &sda);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::I2c);
    assert_eq!(tx.data_payload, vec![0xAA]);
    assert!(tx.summary.contains("Addr: 0x3C"));
    assert!(tx.summary.contains("WR"));
}

#[test]
fn test_axi_stream_packet() {
    let config = AxiConfig {
        is_lite: false,
        data_width_bytes: 4,
    };
    let decoder = AxiDecoder::new(config);

    let mut aclk = Vec::new();
    let mut tvalid = Vec::new();
    let mut tready = Vec::new();
    let mut tdata = Vec::new();
    let mut tlast = Vec::new();

    let clk_period = 10_000u64;
    let mut t = 0u64;

    // Clock stream for 6 cycles
    for _ in 0..12 {
        aclk.push((t, Logic4::Zero));
        aclk.push((t + clk_period / 2, Logic4::One));
        t += clk_period;
    }

    // Cycle 1: TVALID=1, TREADY=0 (wait state)
    tvalid.push((5_000, Logic4::One));
    tready.push((5_000, Logic4::Zero));
    tdata.push((5_000, 0x11223344));
    tlast.push((5_000, Logic4::Zero));

    // Cycle 2: TREADY=1 (beat 1 transfer!)
    tready.push((15_000, Logic4::One));

    // Cycle 3: Beat 2 with TLAST=1 (packet ends!)
    tdata.push((25_000, 0x55667788));
    tlast.push((25_000, Logic4::One));

    // Cycle 4: TVALID=0
    tvalid.push((35_000, Logic4::Zero));
    tlast.push((35_000, Logic4::Zero));

    let txs = decoder.decode_stream(&aclk, &tvalid, &tready, &tdata, &tlast);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::AxiStream);
    assert_eq!(tx.fields.get("beats").map(|s| s.as_str()), Some("2"));
    assert_eq!(tx.fields.get("bytes").map(|s| s.as_str()), Some("8"));
    assert_eq!(tx.fields.get("wait_cycles").map(|s| s.as_str()), Some("1"));
}

#[test]
fn test_unified_decode_request_uart() {
    use super::super::decode_protocol_request;
    use super::types::ProtocolDecodeRequest;
    use hashbrown::HashMap;

    let bit_ps = 1_000_000_000_000u64 / 115_200;
    let bits = [0, 1, 0, 0, 0, 0, 0, 1, 0, 1]; // 'A'
    let mut samples = Vec::new();
    let mut t = 10_000u64;
    samples.push((0, "1".to_string()));
    for bit in bits {
        samples.push((t, if bit == 1 { "1".to_string() } else { "0".to_string() }));
        t += bit_ps;
    }
    samples.push((t + bit_ps, "1".to_string()));

    let mut signals = HashMap::new();
    signals.insert("tx_serial".to_string(), samples);

    let mut pin_map = HashMap::new();
    pin_map.insert("tx".to_string(), "tx_serial".to_string());

    let req = ProtocolDecodeRequest {
        protocol: ProtocolKind::Uart,
        uart_config: Some(UartConfig::default()),
        spi_config: None,
        i2c_config: None,
        axi_config: None,
        can_config: None,
        usb_config: None,
        ethernet_config: None,
        signals,
        pin_map,
    };

    let txs = decode_protocol_request(&req);
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].data_payload, vec![0x41]);
}

#[test]
fn test_can_standard_frame_decode() {
    use super::can::CanDecoder;
    use super::types::{CanConfig, ProtocolKind, TransactionStatus};

    let config = CanConfig {
        baud_rate: 500_000,
        sample_point_percent: 75,
        is_extended_id_allowed: true,
    };
    let decoder = CanDecoder::new(config);
    let bit_ps = 1_000_000_000_000u64 / 500_000; // 2,000,000 ps = 2 us

    // Un-stuffed bitstream for Standard CAN 2.0A:
    // SOF (0)
    // ID 0x123 = 0b00100100011 (11 bits)
    // RTR = 0 (Data frame)
    // IDE = 0 (Standard)
    // r0 = 0 (Reserved)
    // DLC = 4 = 0b0100
    // Data = [0x11, 0x22, 0x33, 0x44] (32 bits)
    let mut un_stuffed: Vec<u8> = vec![0]; // SOF
    let id_bits = [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1];
    un_stuffed.extend_from_slice(&id_bits);
    un_stuffed.push(0); // RTR
    un_stuffed.push(0); // IDE
    un_stuffed.push(0); // r0
    let dlc_bits = [0, 1, 0, 0];
    un_stuffed.extend_from_slice(&dlc_bits);

    let data_bytes = [0x11u8, 0x22, 0x33, 0x44];
    for &b in &data_bytes {
        for bit_idx in (0..8).rev() {
            un_stuffed.push((b >> bit_idx) & 1);
        }
    }

    // Compute CRC15
    let crc = CanDecoder::compute_crc15(&un_stuffed);
    for bit_idx in (0..15).rev() {
        un_stuffed.push(((crc >> bit_idx) & 1) as u8);
    }

    // Apply bit-stuffing to stuffed region (SOF through CRC)
    let mut stuffed = Vec::new();
    let mut same_count = 0usize;
    let mut prev_bit = 2u8;
    for &bit in &un_stuffed {
        if bit == prev_bit {
            same_count += 1;
            if same_count == 5 {
                stuffed.push(bit);
                // Insert opposite stuff bit
                let stuff_bit = 1 - bit;
                stuffed.push(stuff_bit);
                prev_bit = stuff_bit;
                same_count = 1;
                continue;
            }
        } else {
            same_count = 1;
            prev_bit = bit;
        }
        stuffed.push(bit);
    }

    // Append un-stuffed trailer: CRC Delimiter(1), ACK Slot(0), ACK Delimiter(1), EOF(7 1s)
    stuffed.push(1); // CRC Delimiter
    stuffed.push(0); // ACK Slot (ACK)
    stuffed.push(1); // ACK Delimiter
    for _ in 0..7 {
        stuffed.push(1); // EOF
    }

    // Convert to transitions
    let mut transitions = Vec::new();
    let mut t = 10_000u64;
    transitions.push((0, Logic4::One)); // Idle recessive
    for &bit in &stuffed {
        let val = if bit == 0 { Logic4::Zero } else { Logic4::One };
        transitions.push((t, val));
        t += bit_ps;
    }
    transitions.push((t + bit_ps, Logic4::One));

    let txs = decoder.decode(&transitions);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::Can);
    assert_eq!(tx.data_payload, vec![0x11, 0x22, 0x33, 0x44]);
    assert_eq!(tx.status, TransactionStatus::Ok);
    assert_eq!(tx.fields.get("id_hex").map(|s| s.as_str()), Some("0x123"));
    assert_eq!(tx.fields.get("frame_type").map(|s| s.as_str()), Some("Standard 11-bit"));
    assert_eq!(tx.fields.get("ack").map(|s| s.as_str()), Some("ACK"));
}

#[test]
fn test_usb_setup_token_and_data_packet() {
    use super::types::{ProtocolKind, UsbConfig, UsbSpeed};
    use super::usb::UsbDecoder;

    let config = UsbConfig {
        speed: UsbSpeed::FullSpeed,
        check_crc: true,
    };
    let decoder = UsbDecoder::new(config);
    let bit_ps = 83_333u64; // 12 Mbps

    // Construct a USB SETUP token packet:
    // SYNC: 00000001 (LSB first: 8 bits)
    // PID: SETUP = 0x2D (byte 0x2D = PID 0xD, ~PID 0x2)
    // ADDR: 2 (7 bits: 0100000)
    // ENDP: 0 (4 bits: 0000)
    // CRC5: computed
    let mut token_bits = Vec::new();
    let sync = 0x80u8; // LSB-first = 00000001 -> bits [0,0,0,0,0,0,0,1]
    for i in 0..8 {
        token_bits.push((sync >> i) & 1);
    }
    let pid = 0x2Du8;
    for i in 0..8 {
        token_bits.push((pid >> i) & 1);
    }
    let mut payload_bits = Vec::new();
    let addr = 2u8;
    for i in 0..7 {
        payload_bits.push((addr >> i) & 1);
    }
    let endp = 0u8;
    for i in 0..4 {
        payload_bits.push((endp >> i) & 1);
    }
    let crc5 = UsbDecoder::compute_crc5(&payload_bits);
    for i in 0..5 {
        payload_bits.push((crc5 >> i) & 1);
    }
    token_bits.extend(payload_bits);

    // Encode into NRZI states (FullSpeed: J=idle, K=toggle on 0)
    let mut dp = Vec::new();
    let mut dm = Vec::new();
    let mut t = 10_000u64;

    // Idle J: DP=1, DM=0
    dp.push((0, Logic4::One));
    dm.push((0, Logic4::Zero));

    let mut current_state_k = false; // false = J, true = K
    let mut ones_count = 0usize;

    for bit in token_bits {
        if bit == 0 {
            current_state_k = !current_state_k;
            ones_count = 0;
        } else {
            ones_count += 1;
        }

        let (p, m) = if current_state_k {
            (Logic4::Zero, Logic4::One) // K
        } else {
            (Logic4::One, Logic4::Zero) // J
        };
        dp.push((t, p));
        dm.push((t, m));
        t += bit_ps;

        // Bit stuffing
        if ones_count == 6 {
            current_state_k = !current_state_k; // Toggle for stuffed 0
            let (sp, sm) = if current_state_k {
                (Logic4::Zero, Logic4::One)
            } else {
                (Logic4::One, Logic4::Zero)
            };
            dp.push((t, sp));
            dm.push((t, sm));
            t += bit_ps;
            ones_count = 0;
        }
    }

    // EOP: 2 bit periods SE0 (DP=0, DM=0) + 1 bit period J (DP=1, DM=0)
    dp.push((t, Logic4::Zero));
    dm.push((t, Logic4::Zero));
    t += bit_ps * 2;
    dp.push((t, Logic4::One));
    dm.push((t, Logic4::Zero));

    let txs = decoder.decode(&dp, &dm);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::Usb);
    assert_eq!(tx.fields.get("pid_name").map(|s| s.as_str()), Some("SETUP"));
    assert_eq!(tx.fields.get("addr").map(|s| s.as_str()), Some("2"));
    assert_eq!(tx.fields.get("endp").map(|s| s.as_str()), Some("0"));
}

#[test]
fn test_ethernet_mii_ipv4_udp_frame() {
    use super::ethernet::EthernetDecoder;
    use super::types::{EthernetConfig, EthernetInterface, ProtocolKind, TransactionStatus};

    let config = EthernetConfig {
        interface: EthernetInterface::Mii,
        fcs_check: true,
    };
    let decoder = EthernetDecoder::new(config);

    // Construct Ethernet frame:
    // Dest MAC: 00:1A:2B:3C:4D:5E (6 bytes)
    // Src MAC: 00:50:56:C0:00:08 (6 bytes)
    // EtherType: 0x0800 (IPv4, 2 bytes)
    // IPv4 Header (20 bytes):
    //   Ver/IHL: 0x45, DSCP/ECN: 0x00, TotalLen: 28 (0x001C)
    //   ID: 0x1234, Flags/Frag: 0x0000, TTL: 64 (0x40), Proto: 17 (0x11 UDP), Checksum: 0x0000
    //   Src IP: 192.168.1.100 [0xC0, 0xA8, 0x01, 0x64]
    //   Dst IP: 192.168.1.1 [0xC0, 0xA8, 0x01, 0x01]
    // UDP Header (8 bytes):
    //   Src Port: 5000 (0x1388), Dst Port: 8080 (0x1F90), Len: 8 (0x0008), Checksum: 0x0000
    let mut frame = Vec::new();
    let dest_mac = [0x00u8, 0x1A, 0x2B, 0x3C, 0x4D, 0x5E];
    let src_mac = [0x00u8, 0x50, 0x56, 0xC0, 0x00, 0x08];
    frame.extend_from_slice(&dest_mac);
    frame.extend_from_slice(&src_mac);
    frame.extend_from_slice(&[0x08, 0x00]); // EtherType IPv4

    // IPv4 Header (20 bytes)
    let ip_header = [
        0x45u8, 0x00, 0x00, 0x1C,
        0x12, 0x34, 0x00, 0x00,
        0x40, 0x11, 0x00, 0x00,
        192, 168, 1, 100,
        192, 168, 1, 1,
    ];
    frame.extend_from_slice(&ip_header);

    // UDP Header (8 bytes)
    let udp_header = [
        0x13u8, 0x88, 0x1F, 0x90,
        0x00, 0x08, 0x00, 0x00,
    ];
    frame.extend_from_slice(&udp_header);

    // Compute FCS CRC-32
    let fcs = EthernetDecoder::compute_crc32(&frame);
    frame.push((fcs & 0xFF) as u8);
    frame.push(((fcs >> 8) & 0xFF) as u8);
    frame.push(((fcs >> 16) & 0xFF) as u8);
    frame.push(((fcs >> 24) & 0xFF) as u8);

    // Prepend Preamble (7 x 0x55) and SFD (1 x 0xD5)
    let mut raw_stream = Vec::new();
    for _ in 0..7 {
        raw_stream.push(0x55u8);
    }
    raw_stream.push(0xD5u8);
    raw_stream.extend(frame);

    // Expand into MII 4-bit nibbles (low nibble first, then high nibble)
    let mut nibbles = Vec::new();
    for &b in &raw_stream {
        nibbles.push((b & 0x0F) as u64);
        nibbles.push(((b >> 4) & 0x0F) as u64);
    }

    // Clock: 25 MHz (40,000 ps period, 20,000 ps half-clock)
    let half_clk = 20_000u64;
    let mut clk = Vec::new();
    let mut valid = Vec::new();
    let mut data = Vec::new();

    let mut t = 10_000u64;
    clk.push((0, Logic4::Zero));
    valid.push((0, Logic4::Zero));

    // Assert valid before first nibble
    valid.push((t - 1000, Logic4::One));

    for &nibble in &nibbles {
        data.push((t - 500, nibble));
        // Rising edge
        clk.push((t, Logic4::One));
        // Falling edge
        clk.push((t + half_clk, Logic4::Zero));
        t += half_clk * 2;
    }

    valid.push((t, Logic4::Zero));

    let txs = decoder.decode(&clk, &valid, &data);
    assert_eq!(txs.len(), 1);
    let tx = &txs[0];
    assert_eq!(tx.protocol, ProtocolKind::Ethernet);
    assert_eq!(tx.status, TransactionStatus::Ok);
    assert_eq!(tx.fields.get("src_ip").map(|s| s.as_str()), Some("192.168.1.100"));
    assert_eq!(tx.fields.get("dst_ip").map(|s| s.as_str()), Some("192.168.1.1"));
    assert_eq!(tx.fields.get("src_port").map(|s| s.as_str()), Some("5000"));
    assert_eq!(tx.fields.get("dst_port").map(|s| s.as_str()), Some("8080"));
}

