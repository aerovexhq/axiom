use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{DecodedTransaction, ProtocolKind, TransactionStatus, UsbConfig, UsbSpeed};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UsbLineState {
    J,
    K,
    SE0,
    SE1,
}

/// Bit-accurate USB 1.1 / 2.0 Low-Speed & Full-Speed packet decoder.
pub struct UsbDecoder {
    config: UsbConfig,
}

impl UsbDecoder {
    pub fn new(config: UsbConfig) -> Self {
        Self { config }
    }

    /// Computes USB 5-bit CRC over token bits (LSB-first).
    /// Polynomial: x^5 + x^2 + 1 (0x05), initial 0x1F, inverted final.
    pub fn compute_crc5(bits: &[u8]) -> u8 {
        let mut crc: u8 = 0x1F;
        for &bit in bits {
            let inv_bit = bit ^ ((crc >> 4) & 1);
            crc = ((crc << 1) & 0x1F) ^ (if inv_bit != 0 { 0x05 } else { 0 });
        }
        crc ^ 0x1F
    }

    /// Computes USB 16-bit CRC over data bytes.
    /// Polynomial: x^16 + x^15 + x^2 + 1 (0x8005), initial 0xFFFF, inverted final.
    pub fn compute_crc16(bytes: &[u8]) -> u16 {
        let mut crc: u16 = 0xFFFF;
        for &b in bytes {
            for bit_idx in 0..8 {
                let bit = (b >> bit_idx) & 1;
                let inv_bit = bit ^ ((crc & 1) as u8);
                crc = (crc >> 1) ^ (if inv_bit != 0 { 0xA001 } else { 0 });
            }
        }
        crc ^ 0xFFFF
    }

    pub fn decode(&self, dp: &[(u64, Logic4)], dm: &[(u64, Logic4)]) -> Vec<DecodedTransaction> {
        if dp.is_empty() && dm.is_empty() {
            return Vec::new();
        }

        let bit_period_ps = match self.config.speed {
            UsbSpeed::LowSpeed => 666_667u64,  // 1.5 Mbps
            UsbSpeed::FullSpeed => 83_333u64,  // 12 Mbps
        };

        let sample_dp_at = |t_ps: u64| -> Logic4 {
            if dp.is_empty() {
                return Logic4::Zero;
            }
            let mut val = dp[0].1;
            for (t, v) in dp {
                if *t <= t_ps {
                    val = *v;
                } else {
                    break;
                }
            }
            val
        };

        let sample_dm_at = |t_ps: u64| -> Logic4 {
            if dm.is_empty() {
                return Logic4::Zero;
            }
            let mut val = dm[0].1;
            for (t, v) in dm {
                if *t <= t_ps {
                    val = *v;
                } else {
                    break;
                }
            }
            val
        };

        let get_line_state = |t_ps: u64| -> UsbLineState {
            let p = sample_dp_at(t_ps);
            let m = sample_dm_at(t_ps);

            match (p, m) {
                (Logic4::Zero, Logic4::Zero) => UsbLineState::SE0,
                (Logic4::One, Logic4::One) => UsbLineState::SE1,
                (Logic4::One, Logic4::Zero) => match self.config.speed {
                    UsbSpeed::FullSpeed => UsbLineState::J,
                    UsbSpeed::LowSpeed => UsbLineState::K,
                },
                (Logic4::Zero, Logic4::One) => match self.config.speed {
                    UsbSpeed::FullSpeed => UsbLineState::K,
                    UsbSpeed::LowSpeed => UsbLineState::J,
                },
                _ => UsbLineState::J,
            }
        };

        let mut transactions = Vec::new();
        let mut tx_id: u64 = 1;

        // Find packet starts by tracking transitions from idle (J) to K
        let max_time = dp.last().map(|x| x.0).unwrap_or(0).max(dm.last().map(|x| x.0).unwrap_or(0));
        let mut t: u64 = 0;

        while t + bit_period_ps <= max_time {
            let state_now = get_line_state(t);
            let state_next = get_line_state(t + bit_period_ps / 2);

            // Start of Packet (SOP): line leaves J and enters K
            if state_now == UsbLineState::J && state_next == UsbLineState::K {
                let start_time_ps = t;
                let mut current_bit_time = t + bit_period_ps / 2;
                let mut last_state = UsbLineState::K;

                let mut raw_bits = Vec::new();
                let mut un_stuffed_bits = Vec::new();
                let mut ones_count = 0usize;
                let mut bit_stuff_error = false;
                let mut reached_eop = false;

                // Decode NRZI & bit-unstuffing until SE0 (EOP)
                while current_bit_time <= max_time + bit_period_ps * 4 {
                    let st = get_line_state(current_bit_time);

                    if st == UsbLineState::SE0 {
                        // Check if this is the start of EOP (SE0 for ~2 bit times)
                        let st2 = get_line_state(current_bit_time + bit_period_ps);
                        if st2 == UsbLineState::SE0 {
                            reached_eop = true;
                            current_bit_time += bit_period_ps * 2;
                            break;
                        }
                    }

                    // NRZI decoding: transition = 0, same = 1
                    let bit = if st != last_state { 0u8 } else { 1u8 };
                    last_state = st;
                    raw_bits.push(bit);

                    if bit == 1 {
                        ones_count += 1;
                        un_stuffed_bits.push(1);
                        if ones_count > 6 {
                            bit_stuff_error = true;
                            break;
                        }
                    } else {
                        if ones_count == 6 {
                            // Bit stuffing: this '0' is discarded
                            ones_count = 0;
                        } else {
                            ones_count = 0;
                            un_stuffed_bits.push(0);
                        }
                    }

                    current_bit_time += bit_period_ps;
                }

                if reached_eop || un_stuffed_bits.len() >= 16 {
                    let end_time_ps = current_bit_time;

                    // Parse packets from un-stuffed bits:
                    // First 8 bits: SYNC (must be 00000001, LSB-first = 0x80)
                    // Next 8 bits: PID (PID[3:0], ~PID[3:0])
                    if un_stuffed_bits.len() >= 16 {
                        let mut sync_byte = 0u8;
                        for i in 0..8 {
                            sync_byte |= un_stuffed_bits[i] << i;
                        }

                        let mut pid_byte = 0u8;
                        for i in 0..8 {
                            pid_byte |= un_stuffed_bits[8 + i] << i;
                        }

                        let pid_low = pid_byte & 0x0F;
                        let pid_high = (!pid_byte >> 4) & 0x0F;
                        let pid_valid = pid_low == pid_high;

                        let pid_name = match pid_byte {
                            0xE1 => "OUT",
                            0x69 => "IN",
                            0xA5 => "SOF",
                            0x2D => "SETUP",
                            0xC3 => "DATA0",
                            0x4B => "DATA1",
                            0x87 => "DATA2",
                            0x0F => "MDATA",
                            0xD2 => "ACK",
                            0x5A => "NAK",
                            0x1E => "STALL",
                            0x96 => "NYET",
                            0x3C => "PRE",
                            _ => "UNKNOWN_PID",
                        };

                        let mut fields = HashMap::new();
                        fields.insert("pid".to_string(), format!("0x{:02X}", pid_byte));
                        fields.insert("pid_name".to_string(), pid_name.to_string());
                        fields.insert("sync".to_string(), format!("0x{:02X}", sync_byte));
                        fields.insert("speed".to_string(), match self.config.speed {
                            UsbSpeed::LowSpeed => "Low-Speed (1.5M)".to_string(),
                            UsbSpeed::FullSpeed => "Full-Speed (12M)".to_string(),
                        });

                        let mut status = if !pid_valid {
                            TransactionStatus::Error(format!("USB Invalid PID check: 0x{:02X}", pid_byte))
                        } else if bit_stuff_error {
                            TransactionStatus::Error("USB Bit Stuffing Error (>6 consecutive 1s)".to_string())
                        } else {
                            TransactionStatus::Ok
                        };

                        let mut data_payload = Vec::new();
                        let summary: String;

                        match pid_name {
                            "OUT" | "IN" | "SETUP" => {
                                // Token packet: 7-bit ADDR, 4-bit ENDP, 5-bit CRC-5
                                if un_stuffed_bits.len() >= 32 {
                                    let mut addr: u8 = 0;
                                    for i in 0..7 {
                                        addr |= un_stuffed_bits[16 + i] << i;
                                    }
                                    let mut endp: u8 = 0;
                                    for i in 0..4 {
                                        endp |= un_stuffed_bits[23 + i] << i;
                                    }
                                    let mut crc5_recv: u8 = 0;
                                    for i in 0..5 {
                                        crc5_recv |= un_stuffed_bits[27 + i] << i;
                                    }

                                    let crc5_calc = Self::compute_crc5(&un_stuffed_bits[16..27]);
                                    if crc5_calc != crc5_recv && self.config.check_crc {
                                        status = TransactionStatus::Error(format!(
                                            "USB CRC-5 Error: calc 0x{:02X}, got 0x{:02X}",
                                            crc5_calc, crc5_recv
                                        ));
                                    }

                                    fields.insert("addr".to_string(), format!("{}", addr));
                                    fields.insert("endp".to_string(), format!("{}", endp));
                                    fields.insert("crc5_calc".to_string(), format!("0x{:02X}", crc5_calc));
                                    fields.insert("crc5_recv".to_string(), format!("0x{:02X}", crc5_recv));

                                    summary = format!(
                                        "USB {} Token [Addr: {}, Endp: {}] CRC5: 0x{:02X}",
                                        pid_name, addr, endp, crc5_recv
                                    );
                                } else {
                                    summary = format!("USB {} Token (Truncated)", pid_name);
                                }
                            }
                            "SOF" => {
                                // Frame Number: 11 bits, CRC-5: 5 bits
                                if un_stuffed_bits.len() >= 32 {
                                    let mut frame_no: u16 = 0;
                                    for i in 0..11 {
                                        frame_no |= (un_stuffed_bits[16 + i] as u16) << i;
                                    }
                                    let mut crc5_recv: u8 = 0;
                                    for i in 0..5 {
                                        crc5_recv |= un_stuffed_bits[27 + i] << i;
                                    }
                                    fields.insert("frame_number".to_string(), format!("{}", frame_no));
                                    fields.insert("crc5_recv".to_string(), format!("0x{:02X}", crc5_recv));
                                    summary = format!("USB SOF [Frame #{}]", frame_no);
                                } else {
                                    summary = "USB SOF (Truncated)".to_string();
                                }
                            }
                            "DATA0" | "DATA1" | "DATA2" | "MDATA" => {
                                // Data Packet: Data bytes + 16-bit CRC-16
                                let total_bits = un_stuffed_bits.len().saturating_sub(16);
                                let total_bytes = total_bits / 8;

                                if total_bytes >= 2 {
                                    let payload_len = total_bytes - 2;
                                    for byte_idx in 0..payload_len {
                                        let mut b = 0u8;
                                        let base = 16 + byte_idx * 8;
                                        for bit_idx in 0..8 {
                                            b |= un_stuffed_bits[base + bit_idx] << bit_idx;
                                        }
                                        data_payload.push(b);
                                    }

                                    // Extract received CRC-16 (little-endian: low byte then high byte)
                                    let crc_base = 16 + payload_len * 8;
                                    let mut crc16_low = 0u8;
                                    let mut crc16_high = 0u8;
                                    for i in 0..8 {
                                        crc16_low |= un_stuffed_bits[crc_base + i] << i;
                                        crc16_high |= un_stuffed_bits[crc_base + 8 + i] << i;
                                    }
                                    let crc16_recv = ((crc16_high as u16) << 8) | (crc16_low as u16);
                                    let crc16_calc = Self::compute_crc16(&data_payload);

                                    if crc16_calc != crc16_recv && self.config.check_crc {
                                        status = TransactionStatus::Error(format!(
                                            "USB CRC-16 Error: calc 0x{:04X}, got 0x{:04X}",
                                            crc16_calc, crc16_recv
                                        ));
                                    }

                                    fields.insert("crc16_calc".to_string(), format!("0x{:04X}", crc16_calc));
                                    fields.insert("crc16_recv".to_string(), format!("0x{:04X}", crc16_recv));
                                    fields.insert("bytes".to_string(), format!("{}", payload_len));

                                    let hex_preview = data_payload
                                        .iter()
                                        .take(8)
                                        .map(|b| format!("{:02X}", b))
                                        .collect::<Vec<_>>()
                                        .join(" ");

                                    summary = format!(
                                        "USB {} ({} B) [{}] CRC16: 0x{:04X}",
                                        pid_name, payload_len, hex_preview, crc16_recv
                                    );
                                } else {
                                    summary = format!("USB {} (Empty)", pid_name);
                                }
                            }
                            "ACK" | "NAK" | "STALL" | "NYET" => {
                                summary = format!("USB {} Handshake", pid_name);
                            }
                            _ => {
                                summary = format!("USB Packet [PID: 0x{:02X}]", pid_byte);
                            }
                        }

                        transactions.push(DecodedTransaction {
                            id: tx_id,
                            protocol: ProtocolKind::Usb,
                            start_time_ps,
                            end_time_ps,
                            summary,
                            data_payload,
                            status,
                            fields,
                        });

                        tx_id += 1;
                        t = end_time_ps + bit_period_ps;
                        continue;
                    }
                }
            }
            t += bit_period_ps / 2;
        }

        transactions
    }
}
