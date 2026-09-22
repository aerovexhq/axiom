use hashbrown::HashMap;

/// A parsed value sample at a normalized picosecond timestamp.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VcdSample {
    pub time_ps: u64,
    pub value: String,
}

/// An imported signal definition with scope and sample history.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VcdSignal {
    pub id: String,
    pub name: String,
    pub scope: String,
    pub full_name: String,
    pub width: u32,
    pub var_type: String,
    pub samples: Vec<VcdSample>,
}

/// A parsed IEEE 1364 Value Change Dump (VCD) structure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedVcd {
    pub date: Option<String>,
    pub version: Option<String>,
    pub timescale_str: Option<String>,
    pub timescale_ps: u64,
    pub signals: Vec<VcdSignal>,
    pub end_time_ps: u64,
}

/// A detected value divergence between simulation and golden reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WaveformMismatch {
    pub signal_name: String,
    pub start_time_ps: u64,
    pub end_time_ps: u64,
    pub sim_value: String,
    pub golden_value: String,
}

/// Result report from golden model waveform diffing.
#[derive(Debug, Clone, PartialEq)]
pub struct VcdDiffReport {
    pub overall_match_percentage: f64,
    pub total_mismatches: usize,
    pub compared_signals: usize,
    pub mismatches: Vec<WaveformMismatch>,
}

/// High-speed IEEE 1364 VCD streaming parser.
pub struct VcdParser;

impl VcdParser {
    /// Parse timescale token (e.g. "1ns", "10 ps", "100fs") into (multiplier_in_ps, display_str).
    pub fn parse_timescale(raw: &str) -> (u64, String) {
        let cleaned = raw.trim();
        let mut num_str = String::new();
        let mut unit_str = String::new();

        for ch in cleaned.chars() {
            if ch.is_ascii_digit() {
                if unit_str.is_empty() {
                    num_str.push(ch);
                }
            } else if ch.is_alphabetic() {
                unit_str.push(ch);
            }
        }

        let num: u64 = num_str.parse().unwrap_or(1);
        let unit = unit_str.to_lowercase();

        let ps_per_unit = match unit.as_str() {
            "s" => 1_000_000_000_000u64,
            "ms" => 1_000_000_000u64,
            "us" => 1_000_000u64,
            "ns" => 1_000u64,
            "ps" => 1u64,
            "fs" => 1u64, // sub-picosecond clamped to 1ps
            _ => 1_000u64, // default 1ns
        };

        let total_ps = (num * ps_per_unit).max(1);
        let display = format!("{num}{unit}");
        (total_ps, display)
    }

    /// Parse raw VCD text into structured `ParsedVcd`.
    pub fn parse(content: &str) -> Result<ParsedVcd, String> {
        let mut date: Option<String> = None;
        let mut version: Option<String> = None;
        let mut timescale_str: Option<String> = None;
        let mut timescale_ps = 1_000u64; // Default 1ns = 1000ps
        let mut scope_stack: Vec<String> = Vec::new();
        let mut id_to_index: HashMap<String, usize> = HashMap::new();
        let mut signals: Vec<VcdSignal> = Vec::new();

        let mut current_time_units = 0u64;
        let mut max_time_ps = 0u64;

        let lines: Vec<&str> = content.lines().collect();
        let mut idx = 0;

        while idx < lines.len() {
            let line = lines[idx].trim();
            idx += 1;

            if line.is_empty() {
                continue;
            }

            // 1. Header Directives
            if line.starts_with("$date") {
                let mut d = String::new();
                while idx < lines.len() && !lines[idx].contains("$end") {
                    if !d.is_empty() {
                        d.push(' ');
                    }
                    d.push_str(lines[idx].trim());
                    idx += 1;
                }
                if idx < lines.len() {
                    idx += 1; // skip line containing $end
                }
                date = Some(d);
                continue;
            }

            if line.starts_with("$version") {
                let mut v = String::new();
                while idx < lines.len() && !lines[idx].contains("$end") {
                    if !v.is_empty() {
                        v.push(' ');
                    }
                    v.push_str(lines[idx].trim());
                    idx += 1;
                }
                if idx < lines.len() {
                    idx += 1;
                }
                version = Some(v);
                continue;
            }

            if line.starts_with("$timescale") {
                let mut ts_raw = String::new();
                if let Some(after) = line.strip_prefix("$timescale") {
                    let cleaned = after.trim();
                    if cleaned.ends_with("$end") {
                        ts_raw = cleaned.trim_end_matches("$end").trim().to_string();
                    }
                }
                if ts_raw.is_empty() {
                    while idx < lines.len() && !lines[idx].contains("$end") {
                        ts_raw.push_str(lines[idx].trim());
                        idx += 1;
                    }
                    if idx < lines.len() {
                        idx += 1;
                    }
                }
                let (ps, disp) = Self::parse_timescale(&ts_raw);
                timescale_ps = ps;
                timescale_str = Some(disp);
                continue;
            }

            // 2. Scope definition
            if line.starts_with("$scope") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    scope_stack.push(parts[2].to_string());
                }
                continue;
            }

            if line.starts_with("$upscope") {
                scope_stack.pop();
                continue;
            }

            // 3. Variable definition
            // e.g. "$var wire 1 ! clk $end" or "$var reg 8 " data [7:0] $end"
            if line.starts_with("$var") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 {
                    let var_type = parts[1].to_string();
                    let width: u32 = parts[2].parse().unwrap_or(1);
                    let id = parts[3].to_string();
                    let name = parts[4].to_string();

                    let scope = if scope_stack.is_empty() {
                        "top".to_string()
                    } else {
                        scope_stack.join(".")
                    };

                    let full_name = format!("{scope}.{name}");
                    let sig_idx = signals.len();

                    signals.push(VcdSignal {
                        id: id.clone(),
                        name,
                        scope,
                        full_name,
                        width,
                        var_type,
                        samples: Vec::new(),
                    });

                    id_to_index.insert(id, sig_idx);
                }
                continue;
            }

            if line.starts_with("$enddefinitions") {
                continue;
            }

            // 4. Timestamp advancement
            if let Some(rest) = line.strip_prefix('#') {
                if let Ok(t) = rest.trim().parse::<u64>() {
                    current_time_units = t;
                    let ps = current_time_units.saturating_mul(timescale_ps);
                    if ps > max_time_ps {
                        max_time_ps = ps;
                    }
                }
                continue;
            }

            // 5. Value Changes
            // Scalar change: e.g. "0!", "1!", "x!", "z!"
            let first_char = line.chars().next().unwrap_or(' ');
            if (first_char == '0' || first_char == '1' || first_char == 'x' || first_char == 'X' || first_char == 'z' || first_char == 'Z') && line.len() > 1 && !line.starts_with("$dump") {
                let val_char = first_char.to_ascii_lowercase();
                let ident = &line[1..].trim();
                if let Some(&sig_idx) = id_to_index.get(*ident) {
                    let time_ps = current_time_units.saturating_mul(timescale_ps);
                    let val_str = val_char.to_string();
                    signals[sig_idx].samples.push(VcdSample {
                        time_ps,
                        value: val_str,
                    });
                }
                continue;
            }

            // Vector change: e.g. "b101001 !" or "b01010101 data_id"
            if (first_char == 'b' || first_char == 'B') && line.len() > 1 {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let bits = parts[0][1..].trim().to_string();
                    let ident = parts[1].trim();
                    if let Some(&sig_idx) = id_to_index.get(ident) {
                        let time_ps = current_time_units.saturating_mul(timescale_ps);
                        signals[sig_idx].samples.push(VcdSample {
                            time_ps,
                            value: bits,
                        });
                    }
                }
                continue;
            }
        }

        Ok(ParsedVcd {
            date,
            version,
            timescale_str,
            timescale_ps,
            signals,
            end_time_ps: max_time_ps,
        })
    }
}

/// Normalizes a binary/hex/logic string for reliable value comparison.
pub fn normalize_val(val: &str, width: u32) -> String {
    let lower = val.to_lowercase();
    let cleaned = lower.trim();

    // If starts with 8'hA5, strip prefix
    let core = if let Some((_, rest)) = cleaned.split_once("'h") {
        rest
    } else if let Some((_, rest)) = cleaned.split_once("'b") {
        rest
    } else if let Some((_, rest)) = cleaned.split_once("'d") {
        rest
    } else {
        cleaned
    };

    if width == 1 {
        // Scalar: map to 0, 1, x, z
        match core.chars().next() {
            Some('1') => "1".to_string(),
            Some('0') => "0".to_string(),
            Some('x') => "x".to_string(),
            Some('z') => "z".to_string(),
            _ => core.to_string(),
        }
    } else {
        // Vector: pad or trim to match bit width
        let unpadded = core.trim_start_matches('0');
        if unpadded.is_empty() {
            "0".to_string()
        } else {
            unpadded.to_string()
        }
    }
}

/// Compares a simulation trace against an imported golden VCD.
#[allow(clippy::type_complexity)]
pub fn diff_waveforms(
    sim_traces: &[(String, u32, Vec<(u64, String)>)], // (name, width, [(time_ps, value)])
    golden: &ParsedVcd,
) -> VcdDiffReport {
    let mut mismatches: Vec<WaveformMismatch> = Vec::new();
    let mut total_duration_ps = 0u64;
    let mut total_mismatch_duration_ps = 0u64;
    let mut compared_count = 0usize;

    // Index golden signals by leaf name and full name
    let mut golden_by_name: HashMap<String, &VcdSignal> = HashMap::new();
    for sig in &golden.signals {
        golden_by_name.insert(sig.name.clone(), sig);
        golden_by_name.insert(sig.full_name.clone(), sig);
    }

    for (sim_name, width, sim_samples) in sim_traces {
        // Find matching golden signal
        let short_name = sim_name.rsplit_once('.').map(|(_, l)| l).unwrap_or(sim_name.as_str());
        let golden_sig = golden_by_name.get(sim_name).or_else(|| golden_by_name.get(short_name));

        if let Some(gold) = golden_sig {
            compared_count += 1;

            if sim_samples.is_empty() && gold.samples.is_empty() {
                continue;
            }

            // Collect all transition timestamps
            let mut timestamps: Vec<u64> = Vec::new();
            for (t, _) in sim_samples {
                timestamps.push(*t);
            }
            for sample in &gold.samples {
                timestamps.push(sample.time_ps);
            }
            timestamps.sort_unstable();
            timestamps.dedup();

            if timestamps.is_empty() {
                continue;
            }

            let max_t = *timestamps.last().unwrap_or(&0);
            total_duration_ps = total_duration_ps.max(max_t);

            // Step through timeline
            let mut active_mismatch_start: Option<(u64, String, String)> = None;

            for i in 0..timestamps.len() {
                let t = timestamps[i];
                let next_t = if i + 1 < timestamps.len() {
                    timestamps[i + 1]
                } else {
                    t + 1000 // Last step margin (1ns)
                };

                // Get sim value at time t
                let sim_val = sim_samples
                    .iter()
                    .rfind(|(st, _)| *st <= t)
                    .map(|(_, v)| v.as_str())
                    .unwrap_or("x");

                // Get golden value at time t
                let gold_val = gold
                    .samples
                    .iter()
                    .rfind(|gs| gs.time_ps <= t)
                    .map(|gs| gs.value.as_str())
                    .unwrap_or("x");

                let norm_sim = normalize_val(sim_val, *width);
                let norm_gold = normalize_val(gold_val, gold.width);

                let is_mismatch = norm_sim != norm_gold;

                if is_mismatch {
                    let dt = next_t.saturating_sub(t);
                    total_mismatch_duration_ps = total_mismatch_duration_ps.saturating_add(dt);

                    if let Some((start_t, ref s_val, ref g_val)) = active_mismatch_start {
                        if s_val == &norm_sim && g_val == &norm_gold {
                            // Continue active mismatch
                        } else {
                            // Close previous, start new
                            mismatches.push(WaveformMismatch {
                                signal_name: short_name.to_string(),
                                start_time_ps: start_t,
                                end_time_ps: t,
                                sim_value: s_val.clone(),
                                golden_value: g_val.clone(),
                            });
                            active_mismatch_start = Some((t, norm_sim, norm_gold));
                        }
                    } else {
                        active_mismatch_start = Some((t, norm_sim, norm_gold));
                    }
                } else if let Some((start_t, s_val, g_val)) = active_mismatch_start.take() {
                    mismatches.push(WaveformMismatch {
                        signal_name: short_name.to_string(),
                        start_time_ps: start_t,
                        end_time_ps: t,
                        sim_value: s_val,
                        golden_value: g_val,
                    });
                }
            }

            // Close trailing mismatch
            if let Some((start_t, s_val, g_val)) = active_mismatch_start {
                mismatches.push(WaveformMismatch {
                    signal_name: short_name.to_string(),
                    start_time_ps: start_t,
                    end_time_ps: max_t,
                    sim_value: s_val,
                    golden_value: g_val,
                });
            }
        }
    }

    let match_pct = if total_duration_ps == 0 || compared_count == 0 {
        100.0
    } else {
        let ratio = (total_duration_ps.saturating_sub(total_mismatch_duration_ps)) as f64
            / total_duration_ps as f64;
        (ratio * 100.0).clamp(0.0, 100.0)
    };

    VcdDiffReport {
        overall_match_percentage: (match_pct * 10.0).round() / 10.0,
        total_mismatches: mismatches.len(),
        compared_signals: compared_count,
        mismatches,
    }
}
