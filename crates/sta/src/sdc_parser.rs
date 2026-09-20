use crate::constraints::{
    ClockConstraint, ClockGroupsConstraint, DelayConstraint, FalsePathConstraint,
    GeneratedClockConstraint, IoDelayConstraint, MulticycleConstraint, TimingConstraints,
};

/// Parser for Synopsys Design Constraints (SDC) and Vivado XDC timing directives.
pub struct SdcParser;

impl SdcParser {
    /// Parse an SDC or XDC string into structured TimingConstraints.
    pub fn parse(content: &str) -> TimingConstraints {
        let mut constraints = TimingConstraints::new();

        for raw_line in content.lines() {
            let line = strip_comment(raw_line).trim();
            if line.is_empty() {
                continue;
            }

            let tokens = tokenize_tcl_line(line);
            if tokens.is_empty() {
                continue;
            }

            let cmd = &tokens[0];
            match cmd.as_str() {
                "create_clock" => {
                    if let Some(c) = Self::parse_create_clock(&tokens[1..]) {
                        constraints.clocks.push(c);
                    }
                }
                "create_generated_clock" => {
                    if let Some(gc) = Self::parse_create_generated_clock(&tokens[1..]) {
                        constraints.generated_clocks.push(gc);
                    }
                }
                "set_input_delay" => {
                    if let Some(io) = Self::parse_io_delay(&tokens[1..], true) {
                        constraints.io_delays.push(io);
                    }
                }
                "set_output_delay" => {
                    if let Some(io) = Self::parse_io_delay(&tokens[1..], false) {
                        constraints.io_delays.push(io);
                    }
                }
                "set_false_path" => {
                    if let Some(fp) = Self::parse_false_path(&tokens[1..]) {
                        constraints.false_paths.push(fp);
                    }
                }
                "set_multicycle_path" => {
                    if let Some(mc) = Self::parse_multicycle_path(&tokens[1..]) {
                        constraints.multicycle_paths.push(mc);
                    }
                }
                "set_clock_groups" => {
                    if let Some(cg) = Self::parse_clock_groups(&tokens[1..]) {
                        constraints.clock_groups.push(cg);
                    }
                }
                "set_max_delay" => {
                    if let Some(d) = Self::parse_delay_override(&tokens[1..], true) {
                        constraints.delay_overrides.push(d);
                    }
                }
                "set_min_delay" => {
                    if let Some(d) = Self::parse_delay_override(&tokens[1..], false) {
                        constraints.delay_overrides.push(d);
                    }
                }
                _ => {
                    // Ignore non-timing commands (e.g. set_property PACKAGE_PIN, IOSTANDARD)
                }
            }
        }

        constraints
    }

    fn parse_create_clock(tokens: &[String]) -> Option<ClockConstraint> {
        let mut period_ns: Option<f32> = None;
        let mut name: Option<String> = None;
        let mut port_or_pin: Option<String> = None;
        let mut waveform: Option<(f32, f32)> = None;

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-period" => {
                    if i + 1 < tokens.len() {
                        period_ns = tokens[i + 1].parse::<f32>().ok();
                        i += 2;
                        continue;
                    }
                }
                "-name" => {
                    if i + 1 < tokens.len() {
                        name = Some(clean_identifier(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-waveform" => {
                    if i + 1 < tokens.len() {
                        let wf_str = clean_braces(&tokens[i + 1]);
                        let parts: Vec<f32> = wf_str
                            .split_whitespace()
                            .filter_map(|s| s.parse::<f32>().ok())
                            .collect();
                        if parts.len() >= 2 {
                            waveform = Some((parts[0], parts[1]));
                        }
                        i += 2;
                        continue;
                    }
                }
                token => {
                    if !token.starts_with('-') {
                        let extracted = extract_object_name(token);
                        if !extracted.is_empty() {
                            port_or_pin = Some(extracted);
                        }
                    }
                }
            }
            i += 1;
        }

        let period = period_ns?;
        let period_ps = period * 1000.0;
        let clk_port = port_or_pin.unwrap_or_else(|| "clk".to_string());
        let clk_name = name.unwrap_or_else(|| clk_port.clone());
        let (rise_ps, fall_ps) = match waveform {
            Some((r, f)) => (r * 1000.0, f * 1000.0),
            None => (0.0, period_ps / 2.0),
        };

        Some(ClockConstraint {
            name: clk_name,
            period_ps,
            port_or_pin: clk_port,
            waveform_rise_ps: rise_ps,
            waveform_fall_ps: fall_ps,
        })
    }

    fn parse_create_generated_clock(tokens: &[String]) -> Option<GeneratedClockConstraint> {
        let mut name: Option<String> = None;
        let mut source_clock: Option<String> = None;
        let mut divide_by: u32 = 1;
        let mut multiply_by: u32 = 1;
        let mut pin: Option<String> = None;

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-name" => {
                    if i + 1 < tokens.len() {
                        name = Some(clean_identifier(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-source" => {
                    if i + 1 < tokens.len() {
                        source_clock = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-divide_by" => {
                    if i + 1 < tokens.len() {
                        divide_by = tokens[i + 1].parse::<u32>().unwrap_or(1);
                        i += 2;
                        continue;
                    }
                }
                "-multiply_by" => {
                    if i + 1 < tokens.len() {
                        multiply_by = tokens[i + 1].parse::<u32>().unwrap_or(1);
                        i += 2;
                        continue;
                    }
                }
                token => {
                    if !token.starts_with('-') {
                        let extracted = extract_object_name(token);
                        if !extracted.is_empty() {
                            pin = Some(extracted);
                        }
                    }
                }
            }
            i += 1;
        }

        let target_pin = pin?;
        let clk_name = name.unwrap_or_else(|| format!("{}_gen", target_pin));
        let src_clk = source_clock.unwrap_or_else(|| "clk".to_string());

        Some(GeneratedClockConstraint {
            name: clk_name,
            source_clock: src_clk,
            divide_by,
            multiply_by,
            pin: target_pin,
        })
    }

    fn parse_io_delay(tokens: &[String], is_input: bool) -> Option<IoDelayConstraint> {
        let mut clock_name: Option<String> = None;
        let mut delay_ns: Option<f32> = None;
        let mut is_max = true;
        let mut port_name: Option<String> = None;

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-clock" => {
                    if i + 1 < tokens.len() {
                        clock_name = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-min" => {
                    is_max = false;
                }
                "-max" => {
                    is_max = true;
                }
                token => {
                    if let Ok(d) = token.parse::<f32>() {
                        delay_ns = Some(d);
                    } else if !token.starts_with('-') {
                        let extracted = extract_object_name(token);
                        if !extracted.is_empty() {
                            port_name = Some(extracted);
                        }
                    }
                }
            }
            i += 1;
        }

        let delay = delay_ns?;
        Some(IoDelayConstraint {
            is_input,
            clock_name: clock_name.unwrap_or_else(|| "clk".to_string()),
            delay_ps: delay * 1000.0,
            is_max,
            port_name: port_name.unwrap_or_else(|| "*".to_string()),
        })
    }

    fn parse_false_path(tokens: &[String]) -> Option<FalsePathConstraint> {
        let mut from: Option<String> = None;
        let mut to: Option<String> = None;
        let mut through: Option<String> = None;

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-from" => {
                    if i + 1 < tokens.len() {
                        from = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-to" => {
                    if i + 1 < tokens.len() {
                        to = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-through" => {
                    if i + 1 < tokens.len() {
                        through = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                _ => {}
            }
            i += 1;
        }

        Some(FalsePathConstraint { from, to, through })
    }

    fn parse_multicycle_path(tokens: &[String]) -> Option<MulticycleConstraint> {
        let mut multiplier: Option<u32> = None;
        let mut is_setup = true;
        let mut from: Option<String> = None;
        let mut to: Option<String> = None;

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-setup" => is_setup = true,
                "-hold" => is_setup = false,
                "-from" => {
                    if i + 1 < tokens.len() {
                        from = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-to" => {
                    if i + 1 < tokens.len() {
                        to = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                token => {
                    if let Ok(num) = token.parse::<u32>() {
                        multiplier = Some(num);
                    }
                }
            }
            i += 1;
        }

        Some(MulticycleConstraint {
            multiplier: multiplier.unwrap_or(2),
            is_setup,
            from,
            to,
        })
    }

    fn parse_clock_groups(tokens: &[String]) -> Option<ClockGroupsConstraint> {
        let mut is_asynchronous = false;
        let mut groups: Vec<Vec<String>> = Vec::new();

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-asynchronous" => is_asynchronous = true,
                "-group" => {
                    if i + 1 < tokens.len() {
                        let group_str = clean_braces(&tokens[i + 1]);
                        let items: Vec<String> = group_str
                            .split_whitespace()
                            .map(clean_identifier)
                            .filter(|s| !s.is_empty())
                            .collect();
                        if !items.is_empty() {
                            groups.push(items);
                        }
                        i += 2;
                        continue;
                    }
                }
                _ => {}
            }
            i += 1;
        }

        Some(ClockGroupsConstraint {
            is_asynchronous,
            groups,
        })
    }

    fn parse_delay_override(tokens: &[String], is_max: bool) -> Option<DelayConstraint> {
        let mut delay_ns: Option<f32> = None;
        let mut from: Option<String> = None;
        let mut to: Option<String> = None;

        let mut i = 0;
        while i < tokens.len() {
            match tokens[i].as_str() {
                "-from" => {
                    if i + 1 < tokens.len() {
                        from = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                "-to" => {
                    if i + 1 < tokens.len() {
                        to = Some(extract_object_name(&tokens[i + 1]));
                        i += 2;
                        continue;
                    }
                }
                token => {
                    if let Ok(d) = token.parse::<f32>() {
                        delay_ns = Some(d);
                    }
                }
            }
            i += 1;
        }

        let delay = delay_ns?;
        Some(DelayConstraint {
            is_max,
            delay_ps: delay * 1000.0,
            from,
            to,
        })
    }
}

/// Strip `#` comments outside of quotes/braces.
fn strip_comment(line: &str) -> &str {
    let mut in_quote = false;
    let bytes = line.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b'"' && (i == 0 || bytes[i - 1] != b'\\') {
            in_quote = !in_quote;
        } else if !in_quote && bytes[i] == b'#' {
            if i == 0 || bytes[i - 1] == b' ' || bytes[i - 1] == b'\t' || bytes[i - 1] == b';' {
                return &line[..i];
            }
        }
    }
    line
}

/// Tokenize Tcl command line grouping brackets `[...]` and braces `{...}`.
fn tokenize_tcl_line(line: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let bytes = line.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        while i < bytes.len() && (bytes[i] == b' ' || bytes[i] == b'\t' || bytes[i] == b';') {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }

        let start = i;
        if bytes[i] == b'[' {
            let mut depth = 1;
            i += 1;
            while i < bytes.len() && depth > 0 {
                if bytes[i] == b'[' {
                    depth += 1;
                } else if bytes[i] == b']' {
                    depth -= 1;
                }
                i += 1;
            }
        } else if bytes[i] == b'{' {
            let mut depth = 1;
            i += 1;
            while i < bytes.len() && depth > 0 {
                if bytes[i] == b'{' {
                    depth += 1;
                } else if bytes[i] == b'}' {
                    depth -= 1;
                }
                i += 1;
            }
        } else if bytes[i] == b'"' {
            i += 1;
            while i < bytes.len() && bytes[i] != b'"' {
                if bytes[i] == b'\\' && i + 1 < bytes.len() {
                    i += 2;
                } else {
                    i += 1;
                }
            }
            if i < bytes.len() {
                i += 1;
            }
        } else {
            while i < bytes.len() && bytes[i] != b' ' && bytes[i] != b'\t' && bytes[i] != b';' {
                i += 1;
            }
        }

        let token = line[start..i].to_string();
        if !token.is_empty() {
            tokens.push(token);
        }
    }

    tokens
}

/// Extract inner object name from patterns like `[get_ports {clk}]`, `[get_pins clk_i]`, `{A}`, `"B"`
fn extract_object_name(token: &str) -> String {
    let trimmed = token.trim();
    if trimmed.starts_with('[') && trimmed.ends_with(']') {
        let inner = &trimmed[1..trimmed.len() - 1].trim();
        // Inner might be "get_ports clk" or "get_pins {mod/clk}"
        let parts: Vec<&str> = inner.split_whitespace().collect();
        if parts.len() >= 2 {
            return clean_identifier(parts[1]);
        }
    }
    clean_identifier(trimmed)
}

fn clean_braces(s: &str) -> &str {
    let trimmed = s.trim();
    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        &trimmed[1..trimmed.len() - 1].trim()
    } else {
        trimmed
    }
}

fn clean_identifier(s: &str) -> String {
    let unbraced = clean_braces(s);
    unbraced.trim_matches(|c| c == '{' || c == '}' || c == '"' || c == '[' || c == ']').to_string()
}
