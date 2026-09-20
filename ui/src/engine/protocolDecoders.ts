// Axiom Hardware Protocol Decoder Subsystem
// Decodes physical pin transitions into structured packet streams (UART, SPI, I2C, AXI)

export type ProtocolKind = "uart" | "spi" | "i2c" | "axi_stream" | "axi4_lite";

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

export interface ProtocolDecodeRequest {
  protocol: ProtocolKind;
  uart_config?: UartConfig;
  spi_config?: SpiConfig;
  i2c_config?: I2cConfig;
  axi_config?: AxiConfig;
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
      { role: "tlast", label: "TLAST", required: false, hint: "Packet boundary boundary delimiter" }
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
