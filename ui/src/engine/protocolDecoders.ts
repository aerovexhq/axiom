// Axiom Hardware Protocol Decoder Subsystem
// Decodes physical pin transitions into structured packet streams (UART, SPI, I2C, AXI)

export type ProtocolKind = "uart" | "spi" | "i2c" | "axi_stream" | "axi4_lite" | "can" | "usb" | "ethernet";

export type TransactionStatus = "ok" | { warning: string } | { error: string };

export interface DecodedTransaction {
  id: number;
  protocol: ProtocolKind;
  start_time_ps: number;
  end_time_ps: number;
  summary: string;
  data_payload: number[];
  status: TransactionStatus;
  fields: Record<string, string>;
}

export type UartParity = "none" | "even" | "odd";

export interface UartConfig {
  baud_rate: number;
  data_bits: number;
  stop_bits: number;
  parity: UartParity;
}

export interface SpiConfig {
  cpol: number; // 0: Idle low, 1: Idle high
  cpha: number; // 0: Leading edge, 1: Trailing edge
  bits_per_word: number;
  msb_first: boolean;
}

export interface I2cConfig {
  is_10bit_addressing: boolean;
}

export interface AxiConfig {
  is_lite: boolean;
  data_width_bytes: number;
}

export interface CanConfig {
  baud_rate: number;
  sample_point_percent: number;
  is_extended_id_allowed: boolean;
}

export type UsbSpeed = "low_speed" | "full_speed";

export interface UsbConfig {
  speed: UsbSpeed;
  check_crc: boolean;
}

export type EthernetInterface = "mii" | "rmii" | "parallel_byte";

export interface EthernetConfig {
  interface: EthernetInterface;
  fcs_check: boolean;
}

export interface ProtocolDecodeRequest {
  protocol: ProtocolKind;
  uart_config?: UartConfig;
  spi_config?: SpiConfig;
  i2c_config?: I2cConfig;
  axi_config?: AxiConfig;
  can_config?: CanConfig;
  usb_config?: UsbConfig;
  ethernet_config?: EthernetConfig;
  signals: Record<string, Array<[number, string]>>;
  pin_map: Record<string, string>;
}

export const PROTOCOL_SPECS: Record<
  ProtocolKind,
  {
    name: string;
    description: string;
    roles: Array<{ role: string; label: string; required: boolean; hint: string }>;
  }
> = {
  uart: {
    name: "UART / RS-232",
    description: "Universal Asynchronous Receiver-Transmitter serial bus with baud clock recovery",
    roles: [
      { role: "tx", label: "TX (Transmit)", required: true, hint: "Serial transmit line (default idle high)" },
      { role: "rx", label: "RX (Receive)", required: false, hint: "Serial receive line" }
    ]
  },
  spi: {
    name: "SPI (Serial Peripheral Interface)",
    description: "4-wire synchronous full-duplex serial protocol with configurable CPOL/CPHA",
    roles: [
      { role: "sclk", label: "SCLK (Clock)", required: true, hint: "Serial clock signal" },
      { role: "mosi", label: "MOSI (Master Out Slave In)", required: true, hint: "Master data output line" },
      { role: "miso", label: "MISO (Master In Slave Out)", required: false, hint: "Slave data output line" },
      { role: "cs_n", label: "CS_n (Chip Select)", required: false, hint: "Active-low slave select line" }
    ]
  },
  i2c: {
    name: "I2C (Inter-Integrated Circuit)",
    description: "2-wire multi-master open-drain bus with 7-bit/10-bit address decoding and ACK/NACK",
    roles: [
      { role: "scl", label: "SCL (Serial Clock)", required: true, hint: "Open-drain clock line" },
      { role: "sda", label: "SDA (Serial Data)", required: true, hint: "Open-drain bidirectional data line" }
    ]
  },
  axi_stream: {
    name: "AXI4-Stream",
    description: "High-speed point-to-point packet streaming bus with ready/valid handshakes",
    roles: [
      { role: "aclk", label: "ACLK (Bus Clock)", required: true, hint: "Primary synchronous bus clock" },
      { role: "tvalid", label: "TVALID", required: true, hint: "Master data valid indicator" },
      { role: "tready", label: "TREADY", required: true, hint: "Slave ready indicator" },
      { role: "tdata", label: "TDATA", required: true, hint: "Numeric data transfer bus" },
      { role: "tlast", label: "TLAST", required: false, hint: "Packet boundary delimiter" }
    ]
  },
  axi4_lite: {
    name: "AXI4-Lite",
    description: "Low-throughput memory-mapped register address/data transaction bus",
    roles: [
      { role: "aclk", label: "ACLK", required: true, hint: "Bus clock" },
      { role: "tvalid", label: "AWVALID / WVALID", required: true, hint: "Write valid strobe" },
      { role: "tready", label: "AWREADY / WREADY", required: true, hint: "Write ready strobe" },
      { role: "tdata", label: "WDATA", required: true, hint: "Write data bus" },
      { role: "tlast", label: "BVALID", required: false, hint: "Write response valid" }
    ]
  },
  can: {
    name: "CAN Bus 2.0A/2.0B",
    description: "Automotive & aerospace differential serial bus with bit-stuffing and 15-bit CRC",
    roles: [
      { role: "can_rx", label: "CAN_RX", required: true, hint: "CAN controller receive input" },
      { role: "can_tx", label: "CAN_TX", required: false, hint: "CAN controller transmit output" }
    ]
  },
  usb: {
    name: "USB 1.1 / 2.0 (FS/LS)",
    description: "Universal Serial Bus with NRZI encoding, bit-unstuffing, token/data/handshake PIDs",
    roles: [
      { role: "dp", label: "D+ (DP)", required: true, hint: "USB positive differential data line" },
      { role: "dm", label: "D- (DM)", required: true, hint: "USB negative differential data line" }
    ]
  },
  ethernet: {
    name: "Fast Ethernet (MII/RMII)",
    description: "10/100M Ethernet MAC frame dissector with SFD alignment, IPv4/UDP/ARP and FCS CRC-32",
    roles: [
      { role: "rx_clk", label: "RX_CLK (Clock)", required: true, hint: "Ethernet receiver reference clock" },
      { role: "rx_dv", label: "RX_DV (Valid)", required: true, hint: "Carrier sense / data valid strobe" },
      { role: "rxd", label: "RXD (Data)", required: true, hint: "Nibble (MII), dibit (RMII), or byte data bus" }
    ]
  }
};

/**
 * Automatically detects candidate signals from a design's signal list based on pin roles.
 */
export function guessPinMap(protocol: ProtocolKind, availableSignalNames: string[]): Record<string, string> {
  const pinMap: Record<string, string> = {};
  const names = [...availableSignalNames];

  const findMatch = (regex: RegExp): string | undefined => {
    return names.find((n) => regex.test(n));
  };

  switch (protocol) {
    case "uart": {
      const tx = findMatch(/^(?:.*[\._])?tx(?:_serial|_out)?$/i) ?? findMatch(/tx/i);
      const rx = findMatch(/^(?:.*[\._])?rx(?:_serial|_in)?$/i) ?? findMatch(/rx/i);
      if (tx) pinMap["tx"] = tx;
      if (rx) pinMap["rx"] = rx;
      break;
    }
    case "spi": {
      const sclk = findMatch(/^(?:.*[\._])?(?:sck|sclk|clk_spi)$/i) ?? findMatch(/sck|sclk/i);
      const mosi = findMatch(/^(?:.*[\._])?mosi$/i) ?? findMatch(/mosi/i);
      const miso = findMatch(/^(?:.*[\._])?miso$/i) ?? findMatch(/miso/i);
      const csN = findMatch(/^(?:.*[\._])?(?:cs_n|ss_n|cs)$/i) ?? findMatch(/cs_n|ss_n/i);
      if (sclk) pinMap["sclk"] = sclk;
      if (mosi) pinMap["mosi"] = mosi;
      if (miso) pinMap["miso"] = miso;
      if (csN) pinMap["cs_n"] = csN;
      break;
    }
    case "i2c": {
      const scl = findMatch(/^(?:.*[\._])?scl$/i) ?? findMatch(/scl/i);
      const sda = findMatch(/^(?:.*[\._])?sda$/i) ?? findMatch(/sda/i);
      if (scl) pinMap["scl"] = scl;
      if (sda) pinMap["sda"] = sda;
      break;
    }
    case "axi_stream":
    case "axi4_lite": {
      const aclk = findMatch(/^(?:.*[\._])?(?:aclk|clk)$/i) ?? findMatch(/aclk|clk/i);
      const tvalid = findMatch(/^(?:.*[\._])?(?:tvalid|valid_out|valid)$/i) ?? findMatch(/valid/i);
      const tready = findMatch(/^(?:.*[\._])?(?:tready|ready_in|ready)$/i) ?? findMatch(/ready/i);
      const tdata = findMatch(/^(?:.*[\._])?(?:tdata|dout|data_out|p_out)$/i) ?? findMatch(/data/i);
      const tlast = findMatch(/^(?:.*[\._])?(?:tlast|last|done)$/i) ?? findMatch(/last/i);
      if (aclk) pinMap["aclk"] = aclk;
      if (tvalid) pinMap["tvalid"] = tvalid;
      if (tready) pinMap["tready"] = tready;
      if (tdata) pinMap["tdata"] = tdata;
      if (tlast) pinMap["tlast"] = tlast;
      break;
    }
    case "can": {
      const canRx = findMatch(/^(?:.*[\._])?can(?:_rx|_in)?$/i) ?? findMatch(/can_rx/i) ?? findMatch(/rx/i);
      const canTx = findMatch(/^(?:.*[\._])?can(?:_tx|_out)?$/i) ?? findMatch(/can_tx/i) ?? findMatch(/tx/i);
      if (canRx) pinMap["can_rx"] = canRx;
      if (canTx) pinMap["can_tx"] = canTx;
      break;
    }
    case "usb": {
      const dp = findMatch(/^(?:.*[\._])?(?:dp|usb_dp|d_plus|d_p)$/i) ?? findMatch(/dp/i);
      const dm = findMatch(/^(?:.*[\._])?(?:dm|usb_dm|d_minus|d_m)$/i) ?? findMatch(/dm/i);
      if (dp) pinMap["dp"] = dp;
      if (dm) pinMap["dm"] = dm;
      break;
    }
    case "ethernet": {
      const rxClk = findMatch(/^(?:.*[\._])?(?:rx_clk|eth_clk|mii_clk|ref_clk|clk)$/i) ?? findMatch(/clk/i);
      const rxDv = findMatch(/^(?:.*[\._])?(?:rx_dv|crs_dv|eth_rx_dv|valid)$/i) ?? findMatch(/dv|valid/i);
      const rxd = findMatch(/^(?:.*[\._])?(?:rxd|eth_rxd|mii_rxd|data)$/i) ?? findMatch(/rxd|data/i);
      if (rxClk) pinMap["rx_clk"] = rxClk;
      if (rxDv) pinMap["rx_dv"] = rxDv;
      if (rxd) pinMap["rxd"] = rxd;
      break;
    }
  }

  return pinMap;
}

/**
 * Synthesize demonstration packets for starter designs when simulating in fallback mode.
 */
export function generateSyntheticTransactions(protocol: ProtocolKind, topModule: string): DecodedTransaction[] {
  if (protocol === "uart" || topModule.includes("uart")) {
    return [
      {
        id: 1,
        protocol: "uart",
        start_time_ps: 2000,
        end_time_ps: 88816,
        summary: "Byte 0x41 ('A') [8N1]",
        data_payload: [0x41],
        status: "ok",
        fields: { baud: "115200", parity: "None", stop_bits: "1", char: "A" }
      },
      {
        id: 2,
        protocol: "uart",
        start_time_ps: 120000,
        end_time_ps: 206816,
        summary: "Byte 0x78 ('x') [8N1]",
        data_payload: [0x78],
        status: "ok",
        fields: { baud: "115200", parity: "None", stop_bits: "1", char: "x" }
      },
      {
        id: 3,
        protocol: "uart",
        start_time_ps: 240000,
        end_time_ps: 326816,
        summary: "Byte 0x69 ('i') [8N1]",
        data_payload: [0x69],
        status: "ok",
        fields: { baud: "115200", parity: "None", stop_bits: "1", char: "i" }
      },
      {
        id: 4,
        protocol: "uart",
        start_time_ps: 360000,
        end_time_ps: 446816,
        summary: "Byte 0x6F ('o') [8N1]",
        data_payload: [0x6f],
        status: "ok",
        fields: { baud: "115200", parity: "None", stop_bits: "1", char: "o" }
      },
      {
        id: 5,
        protocol: "uart",
        start_time_ps: 480000,
        end_time_ps: 566816,
        summary: "Byte 0x6D ('m') [8N1]",
        data_payload: [0x6d],
        status: "ok",
        fields: { baud: "115200", parity: "None", stop_bits: "1", char: "m" }
      }
    ];
  }

  if (protocol === "spi" || topModule.includes("spi")) {
    return [
      {
        id: 1,
        protocol: "spi",
        start_time_ps: 5000,
        end_time_ps: 85000,
        summary: "SPI Full-Duplex MOSI: [A5] | MISO: [3C]",
        data_payload: [0xa5],
        status: "ok",
        fields: { cpol: "0", cpha: "0", mosi: "0xA5", miso: "0x3C" }
      },
      {
        id: 2,
        protocol: "spi",
        start_time_ps: 110000,
        end_time_ps: 190000,
        summary: "SPI Full-Duplex MOSI: [5A] | MISO: [C3]",
        data_payload: [0x5a],
        status: "ok",
        fields: { cpol: "0", cpha: "0", mosi: "0x5A", miso: "0xC3" }
      }
    ];
  }

  if (protocol === "i2c") {
    return [
      {
        id: 1,
        protocol: "i2c",
        start_time_ps: 10000,
        end_time_ps: 120000,
        summary: "I2C Addr: 0x3C (WR) ACK | Bytes: [0x00, 0x80]",
        data_payload: [0x00, 0x80],
        status: "ok",
        fields: { address: "0x3C", direction: "WR", ack: "true" }
      }
    ];
  }

  if (protocol === "can") {
    return [
      {
        id: 1,
        protocol: "can",
        start_time_ps: 50000,
        end_time_ps: 310000,
        summary: "CAN ID: 0x123 (Standard 11-bit) DLC: 8 [11 22 33 44 55 66 77 88] [ACK]",
        data_payload: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88],
        status: "ok",
        fields: {
          id: "291",
          id_hex: "0x123",
          frame_type: "Standard 11-bit",
          rtr: "DATA",
          dlc: "8",
          crc_calc: "0x4A12",
          crc_recv: "0x4A12",
          ack: "ACK"
        }
      },
      {
        id: 2,
        protocol: "can",
        start_time_ps: 420000,
        end_time_ps: 750000,
        summary: "CAN ID: 0x18DAF110 (Extended 29-bit) DLC: 8 [02 10 01 00 00 00 00 00] [ACK]",
        data_payload: [0x02, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00],
        status: "ok",
        fields: {
          id: "416993552",
          id_hex: "0x18DAF110",
          frame_type: "Extended 29-bit",
          rtr: "DATA",
          dlc: "8",
          crc_calc: "0x2B90",
          crc_recv: "0x2B90",
          ack: "ACK"
        }
      }
    ];
  }

  if (protocol === "usb") {
    return [
      {
        id: 1,
        protocol: "usb",
        start_time_ps: 20000,
        end_time_ps: 45000,
        summary: "USB SETUP Token [Addr: 0, Endp: 0] CRC5: 0x02",
        data_payload: [],
        status: "ok",
        fields: {
          pid: "0x2D",
          pid_name: "SETUP",
          addr: "0",
          endp: "0",
          crc5_calc: "0x02",
          crc5_recv: "0x02"
        }
      },
      {
        id: 2,
        protocol: "usb",
        start_time_ps: 55000,
        end_time_ps: 180000,
        summary: "USB DATA0 (8 B) [80 06 00 01 00 00 12 00] CRC16: 0xDD25",
        data_payload: [0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00],
        status: "ok",
        fields: {
          pid: "0xC3",
          pid_name: "DATA0",
          bytes: "8",
          crc16_calc: "0xDD25",
          crc16_recv: "0xDD25"
        }
      },
      {
        id: 3,
        protocol: "usb",
        start_time_ps: 190000,
        end_time_ps: 205000,
        summary: "USB ACK Handshake",
        data_payload: [],
        status: "ok",
        fields: {
          pid: "0xD2",
          pid_name: "ACK"
        }
      }
    ];
  }

  if (protocol === "ethernet") {
    return [
      {
        id: 1,
        protocol: "ethernet",
        start_time_ps: 40000,
        end_time_ps: 320000,
        summary: "Ethernet IPv4 UDP [192.168.1.100 -> 192.168.1.1] Ports: 5000 -> 8080 (48 B)",
        data_payload: [
          0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x00, 0x50, 0x56, 0xc0, 0x00, 0x08, 0x08, 0x00,
          0x45, 0x00, 0x00, 0x2c, 0x12, 0x34, 0x00, 0x00, 0x40, 0x11, 0x00, 0x00,
          192, 168, 1, 100, 192, 168, 1, 1,
          0x13, 0x88, 0x1f, 0x90, 0x00, 0x18, 0x00, 0x00,
          0x41, 0x58, 0x49, 0x4f, 0x4d, 0x5f, 0x45, 0x44, 0x41, 0x31,
          0xde, 0xad, 0xbe, 0xef
        ],
        status: "ok",
        fields: {
          dest_mac: "00:1A:2B:3C:4D:5E",
          src_mac: "00:50:56:C0:00:08",
          ethertype: "0x0800",
          src_ip: "192.168.1.100",
          dst_ip: "192.168.1.1",
          src_port: "5000",
          dst_port: "8080",
          fcs_calc: "0xDEADBEEF",
          fcs_recv: "0xDEADBEEF"
        }
      },
      {
        id: 2,
        protocol: "ethernet",
        start_time_ps: 450000,
        end_time_ps: 680000,
        summary: "Ethernet ARP Request: Who has 192.168.1.1? Tell 192.168.1.100",
        data_payload: [
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x50, 0x56, 0xc0, 0x00, 0x08, 0x08, 0x06,
          0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, 0x01,
          0x00, 0x50, 0x56, 0xc0, 0x00, 0x08, 192, 168, 1, 100,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 192, 168, 1, 1,
          0x12, 0x34, 0x56, 0x78
        ],
        status: "ok",
        fields: {
          dest_mac: "FF:FF:FF:FF:FF:FF",
          src_mac: "00:50:56:C0:00:08",
          ethertype: "0x0806",
          arp_opcode: "1",
          sender_ip: "192.168.1.100",
          target_ip: "192.168.1.1"
        }
      }
    ];
  }

  return [
    {
      id: 1,
      protocol: "axi_stream",
      start_time_ps: 5000,
      end_time_ps: 45000,
      summary: "AXI-Stream Packet: 4 Beats, 16 Bytes (Wait: 1 cyc)",
      data_payload: [0x11, 0x22, 0x33, 0x44],
      status: "ok",
      fields: { beats: "4", bytes: "16", wait_cycles: "1" }
    }
  ];
}
