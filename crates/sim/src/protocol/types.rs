use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Supported hardware transaction protocols.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolKind {
    Uart,
    Spi,
    I2c,
    AxiStream,
    Axi4Lite,
    Can,
    Usb,
    Ethernet,
}

impl ProtocolKind {
    pub fn name(&self) -> &'static str {
        match self {
            Self::Uart => "UART",
            Self::Spi => "SPI",
            Self::I2c => "I2C",
            Self::AxiStream => "AXI-Stream",
            Self::Axi4Lite => "AXI4-Lite",
            Self::Can => "CAN Bus",
            Self::Usb => "USB",
            Self::Ethernet => "Ethernet",
        }
    }
}

/// Status and health of a decoded protocol transaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionStatus {
    Ok,
    Warning(String),
    Error(String),
}

/// A structured high-level transaction packet decoded from physical pin transitions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedTransaction {
    pub id: u64,
    pub protocol: ProtocolKind,
    pub start_time_ps: u64,
    pub end_time_ps: u64,
    pub summary: String,
    pub data_payload: Vec<u8>,
    pub status: TransactionStatus,
    pub fields: HashMap<String, String>,
}

/// Parity mode for UART.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UartParity {
    None,
    Even,
    Odd,
}

/// Configuration parameters for UART decoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UartConfig {
    pub baud_rate: u64,
    pub data_bits: u8,
    pub stop_bits: u8,
    pub parity: UartParity,
}

impl Default for UartConfig {
    fn default() -> Self {
        Self {
            baud_rate: 115_200,
            data_bits: 8,
            stop_bits: 1,
            parity: UartParity::None,
        }
    }
}

/// Configuration parameters for SPI decoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpiConfig {
    pub cpol: u8, // 0: Clock idle low, 1: Clock idle high
    pub cpha: u8, // 0: Sample leading edge, 1: Sample trailing edge
    pub bits_per_word: u8,
    pub msb_first: bool,
}

impl Default for SpiConfig {
    fn default() -> Self {
        Self {
            cpol: 0,
            cpha: 0,
            bits_per_word: 8,
            msb_first: true,
        }
    }
}

/// Configuration parameters for I2C decoding.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct I2cConfig {
    pub is_10bit_addressing: bool,
}

/// Configuration parameters for AXI decoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxiConfig {
    pub is_lite: bool,
    pub data_width_bytes: u8,
}

impl Default for AxiConfig {
    fn default() -> Self {
        Self {
            is_lite: false,
            data_width_bytes: 4,
        }
    }
}

/// Configuration parameters for CAN Bus decoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanConfig {
    pub baud_rate: u64,
    pub sample_point_percent: u8,
    pub is_extended_id_allowed: bool,
}

impl Default for CanConfig {
    fn default() -> Self {
        Self {
            baud_rate: 500_000,
            sample_point_percent: 75,
            is_extended_id_allowed: true,
        }
    }
}

/// USB Bus Operating Speed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsbSpeed {
    LowSpeed,  // 1.5 Mbps
    FullSpeed, // 12 Mbps
}

/// Configuration parameters for USB decoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbConfig {
    pub speed: UsbSpeed,
    pub check_crc: bool,
}

impl Default for UsbConfig {
    fn default() -> Self {
        Self {
            speed: UsbSpeed::FullSpeed,
            check_crc: true,
        }
    }
}

/// Ethernet Physical / Media Interface.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EthernetInterface {
    Mii,          // 4-bit nibbles @ 25 MHz
    Rmii,         // 2-bit dibits @ 50 MHz
    ParallelByte, // 8-bit bytes with clock and valid
}

/// Configuration parameters for Ethernet decoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthernetConfig {
    pub interface: EthernetInterface,
    pub fcs_check: bool,
}

impl Default for EthernetConfig {
    fn default() -> Self {
        Self {
            interface: EthernetInterface::Mii,
            fcs_check: true,
        }
    }
}

/// Request payload to decode digital transitions into high-level transactions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolDecodeRequest {
    pub protocol: ProtocolKind,
    pub uart_config: Option<UartConfig>,
    pub spi_config: Option<SpiConfig>,
    pub i2c_config: Option<I2cConfig>,
    pub axi_config: Option<AxiConfig>,
    pub can_config: Option<CanConfig>,
    pub usb_config: Option<UsbConfig>,
    pub ethernet_config: Option<EthernetConfig>,
    #[serde(default)]
    pub signals: HashMap<String, Vec<(u64, String)>>,
    #[serde(default)]
    pub pin_map: HashMap<String, String>,
}

