use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{DecodedTransaction, ProtocolKind, TransactionStatus, UartConfig, UartParity};

/// Decodes raw digital transitions into UART byte transactions.
pub struct UartDecoder {
    config: UartConfig,
}

impl UartDecoder {
    pub fn new(config: UartConfig) -> Self {
        Self { config }
    }

    /// Decodes a transition trace into a list of UART transactions.
    /// `transitions`: slice of (time_ps, logic_level) in chronological order.
    pub fn decode(&self, transitions: &[(u64, Logic4)]) -> Vec<DecodedTransaction> {
        if transitions.is_empty() {
            return Vec::new();
        }

        let mut transactions = Vec::new();
        let bit_period_ps = 1_000_000_000_000u64 / self.config.baud_rate.max(300);
        let sample_signal = |time_ps: u64| -> Logic4 {
            let mut current = transitions[0].1;
            for (t, v) in transitions {
                if *t <= time_ps {
                    current = *v;
                } else {
                    break;
                }
            }
            current
        };

        let mut idx = 0;
        let mut tx_id = 1;

        while idx < transitions.len() {
            let (t_edge, val) = transitions[idx];

            // Look for Start Bit: Falling edge to 0 from an idle 1
            if val == Logic4::Zero {
                let prev_val = if idx > 0 { transitions[idx - 1].1 } else { Logic4::One };
                if prev_val == Logic4::One {
                    let start_time_ps = t_edge;

                    // Verify start bit at center: +0.5 * bit_period
                    let center_start = start_time_ps + bit_period_ps / 2;
                    if sample_signal(center_start) == Logic4::Zero {
                        // Sample data bits
                        let mut byte_val: u8 = 0;
                        let mut valid_bits = true;

                        for bit_idx in 0..self.config.data_bits {
                            let sample_time = start_time_ps + bit_period_ps + (bit_idx as u64) * bit_period_ps + bit_period_ps / 2;
                            match sample_signal(sample_time) {
                                Logic4::One => {
                                    byte_val |= 1 << bit_idx;
                                }
                                Logic4::Zero => {}
                                _ => {
                                    valid_bits = false;
                                }
                            }
                        }

                        // Parity check if enabled
                        let mut status = TransactionStatus::Ok;
                        let mut offset_bits = self.config.data_bits as u64;

                        if self.config.parity != UartParity::None {
                            let parity_time = start_time_ps + (1 + offset_bits) * bit_period_ps + bit_period_ps / 2;
                            let parity_sample = sample_signal(parity_time);
                            let ones_count = byte_val.count_ones();
                            let expected_parity = match self.config.parity {
                                UartParity::Even => !ones_count.is_multiple_of(2),
                                UartParity::Odd => ones_count.is_multiple_of(2),
                                UartParity::None => false,
                            };
                            let actual_parity = parity_sample == Logic4::One;
                            if expected_parity != actual_parity {
                                status = TransactionStatus::Warning(format!(
                                    "UART Parity Error: expected {:?}, got {:?}",
                                    expected_parity, actual_parity
                                ));
                            }
                            offset_bits += 1;
                        }

                        // Stop bit check
                        let stop_time = start_time_ps + (1 + offset_bits) * bit_period_ps + bit_period_ps / 2;
                        let stop_val = sample_signal(stop_time);
                        if stop_val != Logic4::One {
                            status = TransactionStatus::Error(format!(
                                "UART Framing Error: stop bit was {:?} (expected 1)",
                                stop_val
                            ));
                        }

                        let end_time_ps = start_time_ps + (1 + offset_bits + self.config.stop_bits as u64) * bit_period_ps;

                        let mut fields = HashMap::new();
                        fields.insert("hex".to_string(), format!("0x{:02X}", byte_val));
                        fields.insert("binary".to_string(), format!("{:08b}", byte_val));
                        fields.insert("baud".to_string(), format!("{} bps", self.config.baud_rate));

                        let char_repr = if byte_val.is_ascii_graphic() || byte_val == b' ' {
                            format!("'{}'", byte_val as char)
                        } else {
                            format!("0x{:02X}", byte_val)
                        };
                        fields.insert("char".to_string(), char_repr.clone());

                        let summary = format!("UART {} (0x{:02X})", char_repr, byte_val);

                        if valid_bits {
                            transactions.push(DecodedTransaction {
                                id: tx_id,
                                protocol: ProtocolKind::Uart,
                                start_time_ps,
                                end_time_ps,
                                summary,
                                data_payload: vec![byte_val],
                                status,
                                fields,
                            });
                            tx_id += 1;
                        }

                        // Fast-forward past this transaction
                        while idx < transitions.len() && transitions[idx].0 < end_time_ps {
                            idx += 1;
                        }
                        continue;
                    }
                }
            }
            idx += 1;
        }

        transactions
    }
}
