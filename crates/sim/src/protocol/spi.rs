use axiom_core::Logic4;
use hashbrown::HashMap;
use super::types::{DecodedTransaction, ProtocolKind, SpiConfig, TransactionStatus};

/// Decodes SPI multi-line digital signals into formatted packets.
pub struct SpiDecoder {
    config: SpiConfig,
}

impl SpiDecoder {
    pub fn new(config: SpiConfig) -> Self {
        Self { config }
    }

    /// Decodes SCLK, MOSI, MISO, and CS_n transition streams into SPI transactions.
    pub fn decode(
        &self,
        sclk: &[(u64, Logic4)],
        mosi: &[(u64, Logic4)],
        miso: &[(u64, Logic4)],
        cs_n: &[(u64, Logic4)],
    ) -> Vec<DecodedTransaction> {
        if sclk.is_empty() {
            return Vec::new();
        }

        let mut transactions = Vec::new();
        let sample_signal = |series: &[(u64, Logic4)], time_ps: u64| -> Logic4 {
            if series.is_empty() {
                return Logic4::Zero;
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

        // Identify active clock edge based on CPOL & CPHA
        // Leading edge: rising if CPOL=0, falling if CPOL=1
        // Trailing edge: falling if CPOL=0, rising if CPOL=1
        // If CPHA=0 -> sample on leading edge
        // If CPHA=1 -> sample on trailing edge
        let sample_on_rising = match (self.config.cpol, self.config.cpha) {
            (0, 0) => true,
            (0, 1) => false,
            (1, 0) => false,
            (1, 1) => true,
            _ => true,
        };

        let mut current_tx_start: Option<u64> = None;
        let mut mosi_bytes: Vec<u8> = Vec::new();
        let mut miso_bytes: Vec<u8> = Vec::new();
        let mut current_mosi_word: u32 = 0;
        let mut current_miso_word: u32 = 0;
        let mut bit_count = 0;
        let mut tx_id = 1;

        let word_bits = self.config.bits_per_word.max(1) as usize;

        // Iterate through clock edges
        for i in 1..sclk.len() {
            let (t_clk, clk_val) = sclk[i];
            let prev_clk_val = sclk[i - 1].1;

            let is_target_edge = if sample_on_rising {
                prev_clk_val == Logic4::Zero && clk_val == Logic4::One
            } else {
                prev_clk_val == Logic4::One && clk_val == Logic4::Zero
            };

            if !is_target_edge {
                continue;
            }

            // Check if Chip Select is active (0)
            let is_cs_active = if !cs_n.is_empty() {
                sample_signal(cs_n, t_clk) == Logic4::Zero
            } else {
                true // if no CS specified, assume always active
            };

            if !is_cs_active {
                // If CS transitioned inactive, flush current packet if any bits collected
                if let Some(start_t) = current_tx_start.take() {
                    if !mosi_bytes.is_empty() || !miso_bytes.is_empty() {
                        let mut fields = HashMap::new();
                        let mosi_hex = mosi_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
                        let miso_hex = miso_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
                        fields.insert("mosi".to_string(), format!("[{}]", mosi_hex));
                        fields.insert("miso".to_string(), format!("[{}]", miso_hex));

                        let summary = format!("SPI Packet (MOSI: [{}], MISO: [{}])", mosi_hex, miso_hex);
                        transactions.push(DecodedTransaction {
                            id: tx_id,
                            protocol: ProtocolKind::Spi,
                            start_time_ps: start_t,
                            end_time_ps: t_clk,
                            summary,
                            data_payload: mosi_bytes.clone(),
                            status: TransactionStatus::Ok,
                            fields,
                        });
                        tx_id += 1;
                    }
                    mosi_bytes.clear();
                    miso_bytes.clear();
                    current_mosi_word = 0;
                    current_miso_word = 0;
                    bit_count = 0;
                }
                continue;
            }

            if current_tx_start.is_none() {
                current_tx_start = Some(t_clk);
            }

            // Sample MOSI & MISO
            let mosi_bit = sample_signal(mosi, t_clk) == Logic4::One;
            let miso_bit = sample_signal(miso, t_clk) == Logic4::One;

            if self.config.msb_first {
                current_mosi_word = (current_mosi_word << 1) | (mosi_bit as u32);
                current_miso_word = (current_miso_word << 1) | (miso_bit as u32);
            } else {
                current_mosi_word |= (mosi_bit as u32) << bit_count;
                current_miso_word |= (miso_bit as u32) << bit_count;
            }
            bit_count += 1;

            if bit_count == word_bits {
                mosi_bytes.push((current_mosi_word & 0xFF) as u8);
                miso_bytes.push((current_miso_word & 0xFF) as u8);
                current_mosi_word = 0;
                current_miso_word = 0;
                bit_count = 0;
            }
        }

        // Flush trailing packet
        if let Some(start_t) = current_tx_start {
            if bit_count > 0 {
                mosi_bytes.push((current_mosi_word & 0xFF) as u8);
                miso_bytes.push((current_miso_word & 0xFF) as u8);
            }
            if !mosi_bytes.is_empty() || !miso_bytes.is_empty() {
                let end_t = sclk.last().map(|s| s.0).unwrap_or(start_t);
                let mut fields = HashMap::new();
                let mosi_hex = mosi_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
                let miso_hex = miso_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
                fields.insert("mosi".to_string(), format!("[{}]", mosi_hex));
                fields.insert("miso".to_string(), format!("[{}]", miso_hex));

                let summary = format!("SPI Packet (MOSI: [{}], MISO: [{}])", mosi_hex, miso_hex);
                transactions.push(DecodedTransaction {
                    id: tx_id,
                    protocol: ProtocolKind::Spi,
                    start_time_ps: start_t,
                    end_time_ps: end_t,
                    summary,
                    data_payload: mosi_bytes,
                    status: TransactionStatus::Ok,
                    fields,
                });
            }
        }

        transactions
    }
}
