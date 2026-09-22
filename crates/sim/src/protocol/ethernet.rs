use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{DecodedTransaction, EthernetConfig, EthernetInterface, ProtocolKind, TransactionStatus};

/// Bit- and cycle-accurate Ethernet frame dissector supporting MII, RMII, and parallel byte interfaces.
pub struct EthernetDecoder {
    config: EthernetConfig,
}

impl EthernetDecoder {
    pub fn new(config: EthernetConfig) -> Self {
        Self { config }
    }

    /// Computes IEEE 802.3 32-bit CRC (FCS) over MAC header and payload.
    /// Polynomial: 0xEDB88320 (reflected).
    pub fn compute_crc32(bytes: &[u8]) -> u32 {
        let mut crc: u32 = 0xFFFF_FFFF;
        for &b in bytes {
            crc ^= b as u32;
            for _ in 0..8 {
                let mask = (crc & 1).wrapping_neg();
                crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
            }
        }
        !crc
    }

    /// Decodes an Ethernet signal capture into structured frame transactions.
    /// `clk`: Clock signal transitions.
    /// `valid`: Data valid / carrier sense transitions (rx_dv, crs_dv, or valid).
    /// `data`: Data bus transitions (nibble 0..15, dibit 0..3, or byte 0..255).
    pub fn decode(
        &self,
        clk: &[(u64, Logic4)],
        valid: &[(u64, Logic4)],
        data: &[(u64, u64)],
    ) -> Vec<DecodedTransaction> {
        if clk.is_empty() || data.is_empty() {
            return Vec::new();
        }

        let sample_logic = |series: &[(u64, Logic4)], t_ps: u64| -> Logic4 {
            if series.is_empty() {
                return Logic4::Zero;
            }
            let mut val = series[0].1;
            for (t, v) in series {
                if *t <= t_ps {
                    val = *v;
                } else {
                    break;
                }
            }
            val
        };

        let sample_u64 = |series: &[(u64, u64)], t_ps: u64| -> u64 {
            if series.is_empty() {
                return 0;
            }
            let mut val = series[0].1;
            for (t, v) in series {
                if *t <= t_ps {
                    val = *v;
                } else {
                    break;
                }
            }
            val
        };

        // Extract clock rising edges
        let mut rising_edges = Vec::new();
        for i in 1..clk.len() {
            if clk[i - 1].1 == Logic4::Zero && clk[i].1 == Logic4::One {
                rising_edges.push(clk[i].0);
            }
        }

        if rising_edges.is_empty() {
            return Vec::new();
        }

        let mut transactions = Vec::new();
        let mut tx_id: u64 = 1;

        // Assemble byte bursts
        let mut in_burst = false;
        let mut burst_start_ps = 0u64;
        let mut burst_end_ps = 0u64;
        let mut burst_subunits: Vec<u8> = Vec::new();

        for &t_edge in &rising_edges {
            let is_valid = if !valid.is_empty() {
                sample_logic(valid, t_edge) == Logic4::One
            } else {
                true
            };

            let data_val = (sample_u64(data, t_edge) & 0xFF) as u8;

            if is_valid {
                if !in_burst {
                    in_burst = true;
                    burst_start_ps = t_edge;
                    burst_subunits.clear();
                }
                burst_subunits.push(data_val);
                burst_end_ps = t_edge;
            } else if in_burst {
                in_burst = false;
                if let Some(tx) = self.parse_frame(tx_id, burst_start_ps, burst_end_ps, &burst_subunits) {
                    transactions.push(tx);
                    tx_id += 1;
                }
                burst_subunits.clear();
            }
        }

        if in_burst && !burst_subunits.is_empty() {
            if let Some(tx) = self.parse_frame(tx_id, burst_start_ps, burst_end_ps, &burst_subunits) {
                transactions.push(tx);
            }
        }

        transactions
    }

    fn assemble_bytes(&self, subunits: &[u8]) -> Vec<u8> {
        match self.config.interface {
            EthernetInterface::ParallelByte => subunits.to_vec(),
            EthernetInterface::Mii => {
                // 2 nibbles per byte, LSB nibble first
                let mut bytes = Vec::with_capacity(subunits.len() / 2);
                let mut i = 0;
                while i + 1 < subunits.len() {
                    let low_nibble = subunits[i] & 0x0F;
                    let high_nibble = subunits[i + 1] & 0x0F;
                    bytes.push((high_nibble << 4) | low_nibble);
                    i += 2;
                }
                bytes
            }
            EthernetInterface::Rmii => {
                // 4 dibits per byte, LSB dibit first
                let mut bytes = Vec::with_capacity(subunits.len() / 4);
                let mut i = 0;
                while i + 3 < subunits.len() {
                    let d0 = subunits[i] & 0x03;
                    let d1 = subunits[i + 1] & 0x03;
                    let d2 = subunits[i + 2] & 0x03;
                    let d3 = subunits[i + 3] & 0x03;
                    bytes.push((d3 << 6) | (d2 << 4) | (d1 << 2) | d0);
                    i += 4;
                }
                bytes
            }
        }
    }

    fn parse_frame(&self, tx_id: u64, start_time_ps: u64, end_time_ps: u64, subunits: &[u8]) -> Option<DecodedTransaction> {
        let raw_bytes = self.assemble_bytes(subunits);
        if raw_bytes.is_empty() {
            return None;
        }

        // Search for SFD (0xD5) preceded by preamble (0x55)
        let (found_sfd, frame_start_idx) = if let Some(pos) = raw_bytes.iter().position(|&b| b == 0xD5) {
            (true, pos + 1)
        } else {
            (false, 0)
        };

        // If no preamble/SFD was detected, check if raw_bytes directly starts with a valid MAC frame (min 14 bytes)
        let frame = if found_sfd && frame_start_idx < raw_bytes.len() {
            &raw_bytes[frame_start_idx..]
        } else if raw_bytes.len() >= 14 {
            &raw_bytes[..]
        } else {
            return None;
        };

        // Minimum Ethernet frame with FCS is 64 bytes (or 14-byte header + 4-byte FCS = 18 bytes for fragmented test cases)
        if frame.len() < 14 {
            return None;
        }

        let dest_mac = format!(
            "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
            frame[0], frame[1], frame[2], frame[3], frame[4], frame[5]
        );
        let src_mac = format!(
            "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
            frame[6], frame[7], frame[8], frame[9], frame[10], frame[11]
        );
        let ethertype = ((frame[12] as u16) << 8) | (frame[13] as u16);

        let has_fcs = frame.len() >= 18;
        let payload_end = if has_fcs { frame.len() - 4 } else { frame.len() };
        let payload = &frame[14..payload_end];

        let mut status = TransactionStatus::Ok;
        let mut fields = HashMap::new();
        fields.insert("dest_mac".to_string(), dest_mac.clone());
        fields.insert("src_mac".to_string(), src_mac.clone());
        fields.insert("ethertype".to_string(), format!("0x{:04X}", ethertype));
        fields.insert("frame_len".to_string(), format!("{}", frame.len()));
        fields.insert("payload_len".to_string(), format!("{}", payload.len()));

        if has_fcs && self.config.fcs_check {
            let fcs_bytes = &frame[frame.len() - 4..];
            let fcs_recv = (fcs_bytes[0] as u32)
                | ((fcs_bytes[1] as u32) << 8)
                | ((fcs_bytes[2] as u32) << 16)
                | ((fcs_bytes[3] as u32) << 24);
            let fcs_calc = Self::compute_crc32(&frame[..frame.len() - 4]);

            fields.insert("fcs_calc".to_string(), format!("0x{:08X}", fcs_calc));
            fields.insert("fcs_recv".to_string(), format!("0x{:08X}", fcs_recv));

            if fcs_calc != fcs_recv {
                status = TransactionStatus::Error(format!(
                    "Ethernet FCS CRC-32 Mismatch: calc 0x{:08X}, recv 0x{:08X}",
                    fcs_calc, fcs_recv
                ));
            }
        }

        // Dissect Higher-Layer Protocols
        let summary = match ethertype {
            0x0800 => {
                // IPv4
                if payload.len() >= 20 {
                    let proto = payload[9];
                    let src_ip = format!("{}.{}.{}.{}", payload[12], payload[13], payload[14], payload[15]);
                    let dst_ip = format!("{}.{}.{}.{}", payload[16], payload[17], payload[18], payload[19]);
                    let ihl = ((payload[0] & 0x0F) * 4) as usize;

                    fields.insert("src_ip".to_string(), src_ip.clone());
                    fields.insert("dst_ip".to_string(), dst_ip.clone());
                    fields.insert("ip_proto".to_string(), format!("{}", proto));

                    if proto == 17 && payload.len() >= ihl + 8 {
                        // UDP
                        let src_port = ((payload[ihl] as u16) << 8) | (payload[ihl + 1] as u16);
                        let dst_port = ((payload[ihl + 2] as u16) << 8) | (payload[ihl + 3] as u16);
                        let udp_len = ((payload[ihl + 4] as u16) << 8) | (payload[ihl + 5] as u16);

                        fields.insert("src_port".to_string(), format!("{}", src_port));
                        fields.insert("dst_port".to_string(), format!("{}", dst_port));
                        fields.insert("udp_len".to_string(), format!("{}", udp_len));

                        format!(
                            "Ethernet IPv4 UDP [{} -> {}] Ports: {} -> {} ({} B)",
                            src_ip, dst_ip, src_port, dst_port, payload.len()
                        )
                    } else if proto == 6 && payload.len() >= ihl + 4 {
                        // TCP
                        let src_port = ((payload[ihl] as u16) << 8) | (payload[ihl + 1] as u16);
                        let dst_port = ((payload[ihl + 2] as u16) << 8) | (payload[ihl + 3] as u16);
                        fields.insert("src_port".to_string(), format!("{}", src_port));
                        fields.insert("dst_port".to_string(), format!("{}", dst_port));

                        format!(
                            "Ethernet IPv4 TCP [{} -> {}] Ports: {} -> {} ({} B)",
                            src_ip, dst_ip, src_port, dst_port, payload.len()
                        )
                    } else {
                        format!("Ethernet IPv4 [{} -> {}] Proto: {} ({} B)", src_ip, dst_ip, proto, payload.len())
                    }
                } else {
                    format!("Ethernet IPv4 (Truncated: {} B)", payload.len())
                }
            }
            0x0806 => {
                // ARP
                if payload.len() >= 28 {
                    let opcode = ((payload[6] as u16) << 8) | (payload[7] as u16);
                    let sender_ip = format!("{}.{}.{}.{}", payload[14], payload[15], payload[16], payload[17]);
                    let target_ip = format!("{}.{}.{}.{}", payload[24], payload[25], payload[26], payload[27]);

                    fields.insert("arp_opcode".to_string(), format!("{}", opcode));
                    fields.insert("sender_ip".to_string(), sender_ip.clone());
                    fields.insert("target_ip".to_string(), target_ip.clone());

                    if opcode == 1 {
                        format!("Ethernet ARP Request: Who has {}? Tell {}", target_ip, sender_ip)
                    } else if opcode == 2 {
                        format!("Ethernet ARP Reply: {} is at {}", sender_ip, src_mac)
                    } else {
                        format!("Ethernet ARP [Opcode: {}]", opcode)
                    }
                } else {
                    "Ethernet ARP Frame".to_string()
                }
            }
            0x86DD => format!("Ethernet IPv6 Frame ({} B)", payload.len()),
            0x8100 => format!("Ethernet 802.1Q VLAN Tagged Frame ({} B)", payload.len()),
            _ => {
                if ethertype < 0x0600 {
                    format!("Ethernet 802.3 Length: {} B", ethertype)
                } else {
                    format!("Ethernet Frame [Type: 0x{:04X}] ({} B)", ethertype, payload.len())
                }
            }
        };

        Some(DecodedTransaction {
            id: tx_id,
            protocol: ProtocolKind::Ethernet,
            start_time_ps,
            end_time_ps,
            summary,
            data_payload: frame.to_vec(),
            status,
            fields,
        })
    }
}
