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
        signals,
        pin_map,
    };

    let txs = decode_protocol_request(&req);
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].data_payload, vec![0x41]);
}

