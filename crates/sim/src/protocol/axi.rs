use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{AxiConfig, DecodedTransaction, ProtocolKind, TransactionStatus};

/// Decodes AXI-Stream and AXI4-Lite transaction handshakes.
pub struct AxiDecoder {
    config: AxiConfig,
}

impl AxiDecoder {
    pub fn new(config: AxiConfig) -> Self {
        Self { config }
    }

    /// Decodes AXI-Stream bus signals (aclk, tvalid, tready, tdata, tlast) into packet streams.
    pub fn decode_stream(
        &self,
        aclk: &[(u64, Logic4)],
        tvalid: &[(u64, Logic4)],
        tready: &[(u64, Logic4)],
        tdata: &[(u64, u64)], // time, numeric bus value
        tlast: &[(u64, Logic4)],
    ) -> Vec<DecodedTransaction> {
        if aclk.is_empty() || tvalid.is_empty() || tready.is_empty() {
            return Vec::new();
        }

        let sample_logic = |series: &[(u64, Logic4)], time_ps: u64| -> Logic4 {
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

        let sample_data = |series: &[(u64, u64)], time_ps: u64| -> u64 {
            if series.is_empty() {
                return 0;
            }
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

        let mut transactions = Vec::new();
        let mut current_packet_start: Option<u64> = None;
        let mut packet_bytes: Vec<u8> = Vec::new();
        let mut beat_count = 0;
        let mut total_wait_cycles = 0;
        let mut tx_id = 1;

        for i in 1..aclk.len() {
            let (t_clk, clk_val) = aclk[i];
            let prev_clk_val = aclk[i - 1].1;

            if prev_clk_val != Logic4::Zero || clk_val != Logic4::One {
                continue; // Rising clock edge only
            }

            let valid = sample_logic(tvalid, t_clk) == Logic4::One;
            let ready = sample_logic(tready, t_clk) == Logic4::One;
            let last = if !tlast.is_empty() {
                sample_logic(tlast, t_clk) == Logic4::One
            } else {
                false
            };

            if valid && !ready {
                total_wait_cycles += 1;
            }

            // Handshake transfer!
            if valid && ready {
                if current_packet_start.is_none() {
                    current_packet_start = Some(t_clk);
                }

                let data_word = sample_data(tdata, t_clk);
                for byte_idx in 0..self.config.data_width_bytes {
                    packet_bytes.push(((data_word >> (byte_idx * 8)) & 0xFF) as u8);
                }
                beat_count += 1;

                if last || self.config.is_lite {
                    let start_t = current_packet_start.unwrap_or(t_clk);
                    let mut fields = HashMap::new();
                    fields.insert("beats".to_string(), format!("{}", beat_count));
                    fields.insert("bytes".to_string(), format!("{}", packet_bytes.len()));
                    fields.insert("wait_cycles".to_string(), format!("{}", total_wait_cycles));

                    let hex_preview = packet_bytes
                        .iter()
                        .take(8)
                        .map(|b| format!("{:02X}", b))
                        .collect::<Vec<_>>()
                        .join(" ");

                    let summary = format!(
                        "AXIS Packet ({} beats, {} bytes, Wait: {}c): [{}]",
                        beat_count,
                        packet_bytes.len(),
                        total_wait_cycles,
                        hex_preview
                    );

                    transactions.push(DecodedTransaction {
                        id: tx_id,
                        protocol: ProtocolKind::AxiStream,
                        start_time_ps: start_t,
                        end_time_ps: t_clk,
                        summary,
                        data_payload: packet_bytes.clone(),
                        status: TransactionStatus::Ok,
                        fields,
                    });
                    tx_id += 1;

                    current_packet_start = None;
                    packet_bytes.clear();
                    beat_count = 0;
                    total_wait_cycles = 0;
                }
            }
        }

        transactions
    }
}
