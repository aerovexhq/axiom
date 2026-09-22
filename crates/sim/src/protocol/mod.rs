pub mod axi;
pub mod can;
pub mod ethernet;
pub mod i2c;
pub mod spi;
pub mod types;
pub mod uart;
pub mod usb;

pub use axi::AxiDecoder;
pub use can::CanDecoder;
pub use ethernet::EthernetDecoder;
pub use i2c::I2cDecoder;
pub use spi::SpiDecoder;
pub use types::*;
pub use uart::UartDecoder;
pub use usb::UsbDecoder;

use axiom_core::Logic4;

/// Unified protocol decode runner parsing traces according to a decode request.
pub fn decode_protocol_request(req: &ProtocolDecodeRequest) -> Vec<DecodedTransaction> {
    let parse_logic4 = |val: &str| -> Logic4 {
        let v = val.trim();
        if v == "1" || v.ends_with("'b1") || v == "0x1" {
            Logic4::One
        } else if v == "0" || v.ends_with("'b0") || v == "0x0" {
            Logic4::Zero
        } else if v.eq_ignore_ascii_case("z") {
            Logic4::Z
        } else {
            Logic4::Zero
        }
    };

    let parse_u64 = |val: &str| -> u64 {
        let v = val.trim();
        if let Some(rest) = v.strip_prefix("0x").or_else(|| v.strip_prefix("0X")) {
            u64::from_str_radix(rest, 16).unwrap_or(0)
        } else if let Some(rest) = v.strip_prefix("0b").or_else(|| v.strip_prefix("0B")) {
            u64::from_str_radix(rest, 2).unwrap_or(0)
        } else if let Some((_, rest)) = v.split_once("'h") {
            u64::from_str_radix(rest, 16).unwrap_or(0)
        } else if let Some((_, rest)) = v.split_once("'b") {
            u64::from_str_radix(rest, 2).unwrap_or(0)
        } else if let Some((_, rest)) = v.split_once("'d") {
            rest.parse::<u64>().unwrap_or(0)
        } else {
            v.parse::<u64>().unwrap_or(0)
        }
    };

    let get_series_logic = |pin_role: &str| -> Vec<(u64, Logic4)> {
        let sig_name = req.pin_map.get(pin_role).map(|s| s.as_str()).unwrap_or(pin_role);
        if let Some(samples) = req.signals.get(sig_name) {
            samples.iter().map(|(t, v)| (*t, parse_logic4(v))).collect()
        } else {
            Vec::new()
        }
    };

    let get_series_u64 = |pin_role: &str| -> Vec<(u64, u64)> {
        let sig_name = req.pin_map.get(pin_role).map(|s| s.as_str()).unwrap_or(pin_role);
        if let Some(samples) = req.signals.get(sig_name) {
            samples.iter().map(|(t, v)| (*t, parse_u64(v))).collect()
        } else {
            Vec::new()
        }
    };

    match req.protocol {
        ProtocolKind::Uart => {
            let config = req.uart_config.clone().unwrap_or_default();
            let decoder = UartDecoder::new(config);
            let mut trans = get_series_logic("tx");
            if trans.is_empty() {
                trans = get_series_logic("rx");
            }
            if trans.is_empty() {
                trans = get_series_logic("data");
            }
            decoder.decode(&trans)
        }
        ProtocolKind::Spi => {
            let config = req.spi_config.clone().unwrap_or_default();
            let decoder = SpiDecoder::new(config);
            let sclk = get_series_logic("sclk");
            let mosi = get_series_logic("mosi");
            let miso = get_series_logic("miso");
            let mut cs_n = get_series_logic("cs_n");
            if cs_n.is_empty() {
                if let Some(&(first_t, _)) = sclk.first() {
                    let last_t = sclk.last().map(|(t, _)| *t).unwrap_or(first_t + 100_000);
                    cs_n.push((first_t.saturating_sub(1000), Logic4::Zero));
                    cs_n.push((last_t + 1000, Logic4::One));
                }
            }
            decoder.decode(&sclk, &mosi, &miso, &cs_n)
        }
        ProtocolKind::I2c => {
            let config = req.i2c_config.clone().unwrap_or_default();
            let decoder = I2cDecoder::new(config);
            let scl = get_series_logic("scl");
            let sda = get_series_logic("sda");
            decoder.decode(&scl, &sda)
        }
        ProtocolKind::AxiStream | ProtocolKind::Axi4Lite => {
            let config = req.axi_config.clone().unwrap_or_default();
            let decoder = AxiDecoder::new(config);
            let aclk = get_series_logic("aclk");
            let tvalid = get_series_logic("tvalid");
            let tready = get_series_logic("tready");
            let tdata = get_series_u64("tdata");
            let tlast = get_series_logic("tlast");
            decoder.decode_stream(&aclk, &tvalid, &tready, &tdata, &tlast)
        }
        ProtocolKind::Can => {
            let config = req.can_config.clone().unwrap_or_default();
            let decoder = CanDecoder::new(config);
            let mut trans = get_series_logic("can_rx");
            if trans.is_empty() {
                trans = get_series_logic("rx");
            }
            if trans.is_empty() {
                trans = get_series_logic("can_tx");
            }
            if trans.is_empty() {
                trans = get_series_logic("tx");
            }
            if trans.is_empty() {
                trans = get_series_logic("data");
            }
            decoder.decode(&trans)
        }
        ProtocolKind::Usb => {
            let config = req.usb_config.clone().unwrap_or_default();
            let decoder = UsbDecoder::new(config);
            let mut dp = get_series_logic("dp");
            if dp.is_empty() {
                dp = get_series_logic("usb_dp");
            }
            if dp.is_empty() {
                dp = get_series_logic("d_plus");
            }
            let mut dm = get_series_logic("dm");
            if dm.is_empty() {
                dm = get_series_logic("usb_dm");
            }
            if dm.is_empty() {
                dm = get_series_logic("d_minus");
            }
            decoder.decode(&dp, &dm)
        }
        ProtocolKind::Ethernet => {
            let config = req.ethernet_config.clone().unwrap_or_default();
            let decoder = EthernetDecoder::new(config);
            let mut clk = get_series_logic("rx_clk");
            if clk.is_empty() {
                clk = get_series_logic("clk");
            }
            if clk.is_empty() {
                clk = get_series_logic("ref_clk");
            }
            if clk.is_empty() {
                clk = get_series_logic("eth_clk");
            }
            let mut valid = get_series_logic("rx_dv");
            if valid.is_empty() {
                valid = get_series_logic("crs_dv");
            }
            if valid.is_empty() {
                valid = get_series_logic("valid");
            }
            let mut data = get_series_u64("rxd");
            if data.is_empty() {
                data = get_series_u64("data");
            }
            if data.is_empty() {
                data = get_series_u64("eth_rxd");
            }
            decoder.decode(&clk, &valid, &data)
        }
    }
}

#[cfg(test)]
mod tests;

