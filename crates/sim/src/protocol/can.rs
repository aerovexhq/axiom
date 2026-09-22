use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{CanConfig, DecodedTransaction, ProtocolKind, TransactionStatus};

/// High-speed bit-accurate CAN Bus 2.0A / 2.0B frame decoder.
pub struct CanDecoder {
    config: CanConfig,
}

impl CanDecoder {
    pub fn new(config: CanConfig) -> Self {
        Self { config }
    }

    /// Computes the standard 15-bit CAN CRC over un-stuffed bits.
    /// Polynomial: x^15 + x^14 + x^10 + x^8 + x^7 + x^4 + x^3 + 1 (0x4599)
    pub fn compute_crc15(bits: &[u8]) -> u16 {
        let mut crc: u16 = 0;
        for &bit in bits {
            let nxt = (bit as u16) ^ ((crc >> 14) & 1);
            crc = (crc << 1) & 0x7FFF;
            if nxt != 0 {
                crc ^= 0x4599;
            }
        }
        crc & 0x7FFF
    }

    /// Decodes a transition trace into structured CAN 2.0A/2.0B transactions.
    /// `transitions`: slice of (time_ps, logic_level) in chronological order.
    pub fn decode(&self, transitions: &[(u64, Logic4)]) -> Vec<DecodedTransaction> {
        if transitions.is_empty() {
            return Vec::new();
        }

        let baud = self.config.baud_rate.max(10_000);
        let bit_period_ps = 1_000_000_000_000u64 / baud;
        let sample_offset_ps = (bit_period_ps * (self.config.sample_point_percent.clamp(50, 95) as u64)) / 100;

        let mut transactions = Vec::new();
        let mut tx_id: u64 = 1;
        let mut i = 0;

        let sample_at = |time_ps: u64| -> Logic4 {
            let mut val = transitions[0].1;
            for (t, v) in transitions {
                if *t <= time_ps {
                    val = *v;
                } else {
                    break;
                }
            }
            val
        };

        while i < transitions.len() {
            let (t_edge, val) = transitions[i];

            // Look for Start of Frame (SOF): Falling edge from Recessive (1) to Dominant (0)
            if val == Logic4::Zero {
                let prev_val = if i > 0 { transitions[i - 1].1 } else { Logic4::One };
                if prev_val == Logic4::One {
                    let start_time_ps = t_edge;

                    // Verify SOF bit at nominal sample point
                    let sof_sample = sample_at(start_time_ps + sample_offset_ps);
                    if sof_sample == Logic4::Zero {
                        let mut current_bit_time = start_time_ps;
                        let mut raw_bits = Vec::new();
                        let mut un_stuffed_bits = Vec::new();
                        let mut stuff_count = 0usize;
                        let mut same_count = 0usize;
                        let mut prev_bit = 2u8;
                        let mut stuffing_error = false;

                        // Sample bits with bit-destuffing
                        // Max CAN frame length is roughly 135-160 raw bits with maximum stuffing
                        let mut bit_idx = 0usize;
                        let mut in_stuffed_region = true;

                        while bit_idx < 180 {
                            let sample_time = current_bit_time + sample_offset_ps;
                            let bit_val = match sample_at(sample_time) {
                                Logic4::Zero => 0u8,
                                _ => 1u8,
                            };
                            raw_bits.push(bit_val);

                            if in_stuffed_region {
                                if bit_val == prev_bit {
                                    same_count += 1;
                                    if same_count > 5 {
                                        stuffing_error = true;
                                        break;
                                    }
                                } else {
                                    if same_count == 5 {
                                        // This is a valid stuff bit! Skip adding to un-stuffed stream
                                        stuff_count += 1;
                                        same_count = 1;
                                        prev_bit = bit_val;
                                        current_bit_time += bit_period_ps;
                                        bit_idx += 1;
                                        continue;
                                    }
                                    same_count = 1;
                                    prev_bit = bit_val;
                                }
                            }

                            un_stuffed_bits.push(bit_val);

                            // We need enough un-stuffed bits to determine if this is Standard or Extended:
                            // SOF (1) + Base ID (11) + RTR (1) + IDE (1) = 14 bits
                            if un_stuffed_bits.len() >= 14 {
                                let ide = un_stuffed_bits[13];
                                let needed_un_stuffed = if ide == 0 {
                                    // Standard: SOF(1) + ID(11) + RTR(1) + IDE(1) + r0(1) + DLC(4)
                                    // + Data(DLC*8) + CRC(15)
                                    if un_stuffed_bits.len() >= 19 {
                                        let dlc = ((un_stuffed_bits[15] as usize) << 3)
                                            | ((un_stuffed_bits[16] as usize) << 2)
                                            | ((un_stuffed_bits[17] as usize) << 1)
                                            | (un_stuffed_bits[18] as usize);
                                        let data_bytes = dlc.min(8);
                                        19 + data_bytes * 8 + 15
                                    } else {
                                        1000
                                    }
                                } else {
                                    // Extended: SOF(1) + BaseID(11) + SRR(1) + IDE(1) + ExtID(18)
                                    // + RTR(1) + r1(1) + r0(1) + DLC(4) + Data(DLC*8) + CRC(15)
                                    if un_stuffed_bits.len() >= 39 {
                                        let dlc = ((un_stuffed_bits[35] as usize) << 3)
                                            | ((un_stuffed_bits[36] as usize) << 2)
                                            | ((un_stuffed_bits[37] as usize) << 1)
                                            | (un_stuffed_bits[38] as usize);
                                        let data_bytes = dlc.min(8);
                                        39 + data_bytes * 8 + 15
                                    } else {
                                        1000 // Keep sampling
                                    }
                                };

                                if un_stuffed_bits.len() >= needed_un_stuffed {
                                    // End of stuffed region reached after CRC!
                                    in_stuffed_region = false;

                                    // Sample CRC Delimiter (1), ACK Slot (1), ACK Delimiter (1), EOF (7)
                                    // Total 10 un-stuffed trailing bits
                                    if un_stuffed_bits.len() >= needed_un_stuffed + 10 {
                                        break;
                                    }
                                }
                            }

                            current_bit_time += bit_period_ps;
                            bit_idx += 1;
                        }

                        // Validate un-stuffed bitstream
                        if un_stuffed_bits.len() >= 19 {
                            let ide = un_stuffed_bits[13];
                            let is_extended = ide == 1;

                            let (id, rtr, dlc, data_start, crc_start) = if !is_extended {
                                let mut id: u32 = 0;
                                for b in &un_stuffed_bits[1..12] {
                                    id = (id << 1) | (*b as u32);
                                }
                                let rtr = un_stuffed_bits[12];
                                let dlc = ((un_stuffed_bits[15] as usize) << 3)
                                    | ((un_stuffed_bits[16] as usize) << 2)
                                    | ((un_stuffed_bits[17] as usize) << 1)
                                    | (un_stuffed_bits[18] as usize);
                                let dlc_clamped = dlc.min(8);
                                (id, rtr, dlc_clamped, 19, 19 + dlc_clamped * 8)
                            } else if un_stuffed_bits.len() >= 39 {
                                let mut base_id: u32 = 0;
                                for b in &un_stuffed_bits[1..12] {
                                    base_id = (base_id << 1) | (*b as u32);
                                }
                                let mut ext_id: u32 = 0;
                                for b in &un_stuffed_bits[14..32] {
                                    ext_id = (ext_id << 1) | (*b as u32);
                                }
                                let full_id = (base_id << 18) | ext_id;
                                let rtr = un_stuffed_bits[32];
                                let dlc = ((un_stuffed_bits[35] as usize) << 3)
                                    | ((un_stuffed_bits[36] as usize) << 2)
                                    | ((un_stuffed_bits[37] as usize) << 1)
                                    | (un_stuffed_bits[38] as usize);
                                let dlc_clamped = dlc.min(8);
                                (full_id, rtr, dlc_clamped, 39, 39 + dlc_clamped * 8)
                            } else {
                                i += 1;
                                continue;
                            };

                            // Check that we have enough bits for data and CRC
                            if un_stuffed_bits.len() >= crc_start + 15 {
                                let mut data_payload = Vec::with_capacity(dlc);
                                for byte_idx in 0..dlc {
                                    let mut byte_val = 0u8;
                                    let b_start = data_start + byte_idx * 8;
                                    for bit_offset in 0..8 {
                                        byte_val = (byte_val << 1) | un_stuffed_bits[b_start + bit_offset];
                                    }
                                    data_payload.push(byte_val);
                                }

                                // Extract received CRC
                                let mut crc_recv: u16 = 0;
                                for b in &un_stuffed_bits[crc_start..crc_start + 15] {
                                    crc_recv = (crc_recv << 1) | (*b as u16);
                                }

                                // Compute expected CRC over bits from SOF up to end of data
                                let crc_calc = Self::compute_crc15(&un_stuffed_bits[0..crc_start]);

                                // Check ACK slot if available
                                let ack_idx = crc_start + 16;
                                let ack_slot = if un_stuffed_bits.len() > ack_idx {
                                    un_stuffed_bits[ack_idx]
                                } else {
                                    0
                                };

                                let end_time_ps = current_bit_time;

                                let mut status = TransactionStatus::Ok;
                                if stuffing_error {
                                    status = TransactionStatus::Error("CAN Bit Stuffing Error (violation)".to_string());
                                } else if crc_calc != crc_recv {
                                    status = TransactionStatus::Error(format!(
                                        "CAN CRC-15 Mismatch: calc 0x{:04X}, received 0x{:04X}",
                                        crc_calc, crc_recv
                                    ));
                                } else if ack_slot == 1 {
                                    status = TransactionStatus::Warning("CAN Frame NACK (no dominant ACK response)".to_string());
                                }

                                let is_remote = rtr == 1;
                                let frame_type_str = if is_extended { "Extended 29-bit" } else { "Standard 11-bit" };
                                let ack_str = if ack_slot == 0 { "ACK" } else { "NACK" };
                                let rtr_str = if is_remote { "REMOTE" } else { "DATA" };

                                let hex_payload = data_payload
                                    .iter()
                                    .map(|b| format!("{:02X}", b))
                                    .collect::<Vec<_>>()
                                    .join(" ");

                                let summary = if is_remote {
                                    format!(
                                        "CAN ID: 0x{:X} ({}) {} DLC: {} [{}]",
                                        id, frame_type_str, rtr_str, dlc, ack_str
                                    )
                                } else {
                                    format!(
                                        "CAN ID: 0x{:X} ({}) DLC: {} [{}] [{}]",
                                        id, frame_type_str, dlc, hex_payload, ack_str
                                    )
                                };

                                let mut fields = HashMap::new();
                                fields.insert("id".to_string(), format!("{}", id));
                                fields.insert("id_hex".to_string(), format!("0x{:X}", id));
                                fields.insert("frame_type".to_string(), frame_type_str.to_string());
                                fields.insert("rtr".to_string(), rtr_str.to_string());
                                fields.insert("dlc".to_string(), format!("{}", dlc));
                                fields.insert("crc_calc".to_string(), format!("0x{:04X}", crc_calc));
                                fields.insert("crc_recv".to_string(), format!("0x{:04X}", crc_recv));
                                fields.insert("ack".to_string(), ack_str.to_string());
                                fields.insert("stuff_bits".to_string(), format!("{}", stuff_count));

                                transactions.push(DecodedTransaction {
                                    id: tx_id,
                                    protocol: ProtocolKind::Can,
                                    start_time_ps,
                                    end_time_ps,
                                    summary,
                                    data_payload,
                                    status,
                                    fields,
                                });

                                tx_id += 1;

                                // Fast-forward past this frame
                                while i < transitions.len() && transitions[i].0 <= end_time_ps {
                                    i += 1;
                                }
                                continue;
                            }
                        }
                    }
                }
            }
            i += 1;
        }

        transactions
    }
}
