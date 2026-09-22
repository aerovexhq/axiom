use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{DecodedTransaction, I2cConfig, ProtocolKind, TransactionStatus};

/// Decodes two-wire I2C signals (SCL, SDA) into address and data transactions.
pub struct I2cDecoder {
    _config: I2cConfig,
}

impl I2cDecoder {
    pub fn new(config: I2cConfig) -> Self {
        Self { _config: config }
    }

    #[allow(clippy::chunks_exact_to_as_chunks)]
    pub fn decode(&self, scl: &[(u64, Logic4)], sda: &[(u64, Logic4)]) -> Vec<DecodedTransaction> {
        if scl.is_empty() || sda.is_empty() {
            return Vec::new();
        }

        let mut transactions = Vec::new();

        let sample_signal = |series: &[(u64, Logic4)], time_ps: u64| -> Logic4 {
            let mut current = series[0].1;
            for (t, v) in series {
                if *t <= time_ps {
                    current = *v;
                } else {
                    break;
                }
            }
            current
        };

        // Combine all edge events into chronological timeline
        #[derive(Debug, Clone, Copy)]
        enum I2cEdge {
            SclRise(u64),
            SclFall(u64),
            SdaRise(u64),
            SdaFall(u64),
        }

        let mut events: Vec<I2cEdge> = Vec::new();
        for i in 1..scl.len() {
            let (t, v) = scl[i];
            let prev = scl[i - 1].1;
            if prev == Logic4::Zero && v == Logic4::One {
                events.push(I2cEdge::SclRise(t));
            } else if prev == Logic4::One && v == Logic4::Zero {
                events.push(I2cEdge::SclFall(t));
            }
        }
        for i in 1..sda.len() {
            let (t, v) = sda[i];
            let prev = sda[i - 1].1;
            if prev == Logic4::Zero && v == Logic4::One {
                events.push(I2cEdge::SdaRise(t));
            } else if prev == Logic4::One && v == Logic4::Zero {
                events.push(I2cEdge::SdaFall(t));
            }
        }

        events.sort_by_key(|e| match e {
            I2cEdge::SclRise(t) | I2cEdge::SclFall(t) | I2cEdge::SdaRise(t) | I2cEdge::SdaFall(t) => *t,
        });

        let mut in_transaction = false;
        let mut tx_start_time: u64 = 0;
        let mut bits: Vec<bool> = Vec::new();
        let mut tx_id = 1;

        for evt in events {
            match evt {
                I2cEdge::SdaFall(t) => {
                    // Start Condition if SCL is High
                    if sample_signal(scl, t) == Logic4::One {
                        in_transaction = true;
                        tx_start_time = t;
                        bits.clear();
                    }
                }
                I2cEdge::SdaRise(t) => {
                    // Stop Condition if SCL is High
                    if sample_signal(scl, t) == Logic4::One && in_transaction {
                        in_transaction = false;
                        if bits.len() >= 9 {
                            let mut data_bytes = Vec::new();
                            let mut chunks = bits.chunks_exact(9);
                            let first_chunk = chunks.next().unwrap();

                            let mut addr_byte = 0u8;
                            for b in &first_chunk[0..8] {
                                addr_byte = (addr_byte << 1) | (*b as u8);
                            }
                            let slave_addr = addr_byte >> 1;
                            let is_read = (addr_byte & 1) == 1;
                            let addr_ack = !first_chunk[8]; // 0 is ACK

                            for chunk in chunks {
                                let mut b = 0u8;
                                for bit in &chunk[0..8] {
                                    b = (b << 1) | (*bit as u8);
                                }
                                data_bytes.push(b);
                            }

                            let op_str = if is_read { "RD" } else { "WR" };
                            let ack_str = if addr_ack { "ACK" } else { "NACK" };
                            let hex_data = data_bytes.iter().map(|b| format!("0x{:02X}", b)).collect::<Vec<_>>().join(" ");
                            let summary = format!(
                                "I2C {} Addr: 0x{:02X} [{}] Data: [{}]",
                                op_str, slave_addr, ack_str, hex_data
                            );

                            let mut fields = HashMap::new();
                            fields.insert("operation".to_string(), op_str.to_string());
                            fields.insert("address".to_string(), format!("0x{:02X}", slave_addr));
                            fields.insert("ack".to_string(), ack_str.to_string());
                            fields.insert("data".to_string(), format!("[{}]", hex_data));

                            let status = if addr_ack {
                                TransactionStatus::Ok
                            } else {
                                TransactionStatus::Warning("Address NACK received".to_string())
                            };

                            transactions.push(DecodedTransaction {
                                id: tx_id,
                                protocol: ProtocolKind::I2c,
                                start_time_ps: tx_start_time,
                                end_time_ps: t,
                                summary,
                                data_payload: data_bytes,
                                status,
                                fields,
                            });
                            tx_id += 1;
                        }
                        bits.clear();
                    }
                }
                I2cEdge::SclRise(t) => {
                    if in_transaction {
                        let bit = sample_signal(sda, t) == Logic4::One;
                        bits.push(bit);
                    }
                }
                I2cEdge::SclFall(_) => {}
            }
        }

        transactions
    }
}
