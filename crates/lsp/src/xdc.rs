use crate::types::{CompletionItem, HoverResult, LspDiagnostic, LspRange};

/// Vivado XDC (Xilinx Design Constraints) & SDC Static Analysis Linter.
pub struct XdcLinter;

impl XdcLinter {
    pub fn lint(source: &str) -> Vec<LspDiagnostic> {
        let mut diagnostics = Vec::new();

        for (line_idx, line) in source.lines().enumerate() {
            let line_num = (line_idx + 1) as u32;
            let trimmed = line.trim();

            // Ignore empty lines and full-line comments
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            // Strip inline comment (e.g. "set_property ... # comment")
            let content_part = strip_inline_comment(line);
            let trimmed_content = content_part.trim();
            if trimmed_content.is_empty() {
                continue;
            }

            let start_col = (line.find(trimmed_content).unwrap_or(0) + 1) as u32;
            let end_col = (start_col as usize + trimmed_content.len()) as u32;

            // 1. Delimiter parity check (brackets, braces, quotes)
            if let Some(delim_err) = check_delimiter_parity(trimmed_content) {
                diagnostics.push(
                    LspDiagnostic::error(
                        "AXIOM_XDC_E003_UNCLOSED_DELIMITER",
                        delim_err,
                        line_num,
                        start_col,
                        line_num,
                        end_col,
                    )
                    .with_help("Ensure all opening brackets '[', braces '{', and quotes '\"' have matching closing delimiters."),
                );
                continue;
            }

            // 2. Tokenize command arguments
            let tokens = tokenize_tcl_line(trimmed_content);
            if tokens.is_empty() {
                continue;
            }

            let cmd = &tokens[0].text;
            let cmd_start_col = start_col + tokens[0].col_offset as u32;
            let cmd_end_col = cmd_start_col + cmd.len() as u32;

            match cmd.as_str() {
                "set_property" => {
                    Self::lint_set_property(line_num, start_col, end_col, &tokens, &mut diagnostics);
                }
                "create_clock" => {
                    Self::lint_create_clock(line_num, start_col, end_col, &tokens, &mut diagnostics);
                }
                "create_generated_clock" => {
                    Self::lint_create_generated_clock(line_num, start_col, end_col, &tokens, &mut diagnostics);
                }
                "set_input_delay" | "set_output_delay" => {
                    Self::lint_io_delay(line_num, start_col, end_col, cmd, &tokens, &mut diagnostics);
                }
                "set_false_path" | "set_max_delay" | "set_min_delay" | "set_multicycle_path" => {
                    Self::lint_timing_exception(line_num, start_col, end_col, cmd, &tokens, &mut diagnostics);
                }
                "set_clock_groups" => {
                    Self::lint_clock_groups(line_num, start_col, end_col, &tokens, &mut diagnostics);
                }
                "get_ports" | "get_pins" | "get_cells" | "get_nets" | "get_clocks"
                | "all_inputs" | "all_outputs" | "all_clocks" | "current_design"
                | "set" | "puts" | "expr" | "if" | "else" | "foreach" | "break" | "continue" => {
                    // Valid standalone or utility Tcl / SDC commands
                }
                _ => {
                    diagnostics.push(
                        LspDiagnostic::error(
                            "AXIOM_XDC_E001_UNKNOWN_COMMAND",
                            format!(
                                "Unknown Vivado constraint directive '{}'. Supported commands include `set_property`, `create_clock`, `get_ports`, etc.",
                                cmd
                            ),
                            line_num,
                            cmd_start_col,
                            line_num,
                            cmd_end_col,
                        )
                        .with_help("Verify command spelling against Vivado Design Suite 7-Series / UltraScale+ XDC guidelines."),
                    );
                }
            }
        }

        diagnostics
    }

    fn lint_set_property(
        line_num: u32,
        line_start_col: u32,
        line_end_col: u32,
        tokens: &[TokenSpan],
        diags: &mut Vec<LspDiagnostic>,
    ) {
        // Syntax: set_property <PROPERTY> <VALUE> <OBJECTS>
        if tokens.len() < 4 {
            diags.push(
                LspDiagnostic::error(
                    "AXIOM_XDC_E002_MISSING_ARGS",
                    format!(
                        "`set_property` requires 3 arguments: <PROPERTY> <VALUE> <OBJECTS>. Found {} argument(s).",
                        tokens.len().saturating_sub(1)
                    ),
                    line_num,
                    line_start_col,
                    line_num,
                    line_end_col,
                )
                .with_help("Example: `set_property PACKAGE_PIN J15 [get_ports {clk}]`"),
            );
            return;
        }

        let prop_token = &tokens[1];
        let val_token = &tokens[2];

        let prop_name = prop_token.text.trim();
        let prop_col = line_start_col + prop_token.col_offset as u32;

        // Validate property name
        let known_props = [
            "PACKAGE_PIN",
            "IOSTANDARD",
            "DRIVE",
            "SLEW",
            "PULLUP",
            "PULLDOWN",
            "DIFF_TERM",
            "DIFF_TERM_ADV",
            "IN_TERM",
            "OFFCHIP_TERM",
            "KEEPER",
            "DONT_TOUCH",
            "MARK_DEBUG",
            "LOC",
            "BEL",
            "PROHIBIT",
            "CLOCK_DEDICATED_ROUTE",
            "VCCAUX_IO",
            "IBUF_LOW_PWR",
            "LUTNM",
            "HLUTNM",
        ];

        let prop_upper = prop_name.to_ascii_uppercase();
        if !known_props.contains(&prop_upper.as_str()) {
            diags.push(
                LspDiagnostic::warning(
                    "AXIOM_XDC_W001_UNKNOWN_PROPERTY",
                    format!(
                        "Unrecognized Vivado constraint property '{}'. Standard properties include PACKAGE_PIN, IOSTANDARD, DRIVE, SLEW, etc.",
                        prop_name
                    ),
                    line_num,
                    prop_col,
                    line_num,
                    prop_col + prop_name.len() as u32,
                )
                .with_help("Check AMD Vivado UG903 for full list of valid XDC physical synthesis properties."),
            );
        }

        // Validate property value
        let val_str = val_token.text.trim_matches(|c| c == '{' || c == '}' || c == '"');
        let val_col = line_start_col + val_token.col_offset as u32;

        if prop_upper == "IOSTANDARD" {
            let valid_standards = [
                "LVCMOS33",
                "LVCMOS25",
                "LVCMOS18",
                "LVCMOS15",
                "LVCMOS12",
                "LVDS",
                "LVDS_25",
                "TMDS_33",
                "SSTL15",
                "SSTL15_R",
                "SSTL135",
                "SSTL135_R",
                "DIFF_SSTL15",
                "DIFF_SSTL15_R",
                "DIFF_SSTL135",
                "DIFF_SSTL135_R",
                "HSTL_I",
                "HSTL_II",
                "HSTL_I_18",
                "HSTL_II_18",
                "MOBILE_DDR",
                "PCI33_3",
            ];
            let val_upper = val_str.to_ascii_uppercase();
            if !valid_standards.contains(&val_upper.as_str()) {
                diags.push(
                    LspDiagnostic::warning(
                        "AXIOM_XDC_W002_UNKNOWN_IOSTANDARD",
                        format!(
                            "Unrecognized IOSTANDARD '{}'. Expected valid standard such as LVCMOS33, LVCMOS18, LVDS_25, SSTL15.",
                            val_str
                        ),
                        line_num,
                        val_col,
                        line_num,
                        val_col + val_token.text.len() as u32,
                    )
                    .with_help("Select a standard supported by your target FPGA device I/O bank."),
                );
            }
        } else if prop_upper == "PACKAGE_PIN" {
            // Valid FPGA pin format: single or dual letters followed by 1 to 3 digits (e.g. J15, L16, M13, H17, W5, AA1)
            let is_valid_pin = !val_str.is_empty()
                && val_str.chars().all(|c| c.is_ascii_alphanumeric())
                && val_str.chars().next().is_some_and(|c| c.is_ascii_uppercase());

            if !is_valid_pin {
                diags.push(
                    LspDiagnostic::warning(
                        "AXIOM_XDC_W003_INVALID_PIN_SYNTAX",
                        format!(
                            "Package pin '{}' does not match standard FPGA ball/pin coordinate format (e.g. J15, L16, AA1, W5).",
                            val_str
                        ),
                        line_num,
                        val_col,
                        line_num,
                        val_col + val_token.text.len() as u32,
                    )
                    .with_help("Package pin numbers are alphanumeric coordinates corresponding to BGA/QFP package balls."),
                );
            }
        }

        // Validate target objects (tokens 3..end)
        let targets_str = tokens[3..]
            .iter()
            .map(|t| t.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        if !targets_str.contains('[') || !targets_str.contains(']') {
            diags.push(
                LspDiagnostic::error(
                    "AXIOM_XDC_E002_MISSING_TARGETS",
                    "`set_property` targets should be specified using an object query, e.g. `[get_ports {A}]` or `[get_cells {U1}]`.",
                    line_num,
                    line_start_col + tokens[3].col_offset as u32,
                    line_num,
                    line_end_col,
                )
                .with_help("Use `[get_ports {name}]` for top-level IO or `[get_pins {name}]` / `[get_cells {name}]` for internal instances."),
            );
        } else if targets_str.contains("get_port ") || targets_str.contains("get_port\t") {
            diags.push(
                LspDiagnostic::warning(
                    "AXIOM_XDC_W004_TYPO_GET_PORTS",
                    "Did you mean `get_ports`? (`get_port` is not a standard Vivado Tcl command).",
                    line_num,
                    line_start_col + tokens[3].col_offset as u32,
                    line_num,
                    line_end_col,
                )
                .with_help("Replace `get_port` with `get_ports`."),
            );
        }
    }

    fn lint_create_clock(
        line_num: u32,
        start_col: u32,
        end_col: u32,
        tokens: &[TokenSpan],
        diags: &mut Vec<LspDiagnostic>,
    ) {
        // Syntax: create_clock [-name <name>] -period <val_ns> [-waveform {<rise> <fall>}] [get_ports <port>]
        let has_period = tokens.iter().position(|t| t.text == "-period");
        match has_period {
            None => {
                diags.push(
                    LspDiagnostic::error(
                        "AXIOM_XDC_E004_MISSING_CLOCK_PERIOD",
                        "`create_clock` directive requires a `-period <value_ns>` argument.",
                        line_num,
                        start_col,
                        line_num,
                        end_col,
                    )
                    .with_help("Example: `create_clock -name sys_clk -period 10.000 [get_ports {clk}]`"),
                );
            }
            Some(idx) => {
                if idx + 1 >= tokens.len() {
                    diags.push(
                        LspDiagnostic::error(
                            "AXIOM_XDC_E004_MISSING_CLOCK_PERIOD",
                            "`create_clock -period` flag is missing a period value (e.g. 10.000 in nanoseconds).",
                            line_num,
                            start_col,
                            line_num,
                            end_col,
                        ),
                    );
                } else {
                    let val_str = &tokens[idx + 1].text;
                    if let Ok(period) = val_str.parse::<f64>() {
                        if period <= 0.0 {
                            diags.push(
                                LspDiagnostic::error(
                                    "AXIOM_XDC_E005_INVALID_CLOCK_PERIOD",
                                    format!("Clock period must be greater than zero, found: {period} ns."),
                                    line_num,
                                    start_col + tokens[idx + 1].col_offset as u32,
                                    line_num,
                                    start_col + tokens[idx + 1].col_offset as u32 + val_str.len() as u32,
                                ),
                            );
                        }
                    } else {
                        diags.push(
                            LspDiagnostic::error(
                                "AXIOM_XDC_E005_INVALID_CLOCK_PERIOD",
                                format!("Invalid clock period numeric value '{}'. Expected positive float in nanoseconds.", val_str),
                                line_num,
                                start_col + tokens[idx + 1].col_offset as u32,
                                line_num,
                                start_col + tokens[idx + 1].col_offset as u32 + val_str.len() as u32,
                            ),
                        );
                    }
                }
            }
        }
    }

    fn lint_create_generated_clock(
        line_num: u32,
        start_col: u32,
        end_col: u32,
        tokens: &[TokenSpan],
        diags: &mut Vec<LspDiagnostic>,
    ) {
        if !tokens.iter().any(|t| t.text == "-source") {
            diags.push(
                LspDiagnostic::error(
                    "AXIOM_XDC_E006_MISSING_CLOCK_SOURCE",
                    "`create_generated_clock` requires `-source <pin_or_port>` to identify master clock origin.",
                    line_num,
                    start_col,
                    line_num,
                    end_col,
                )
                .with_help("Example: `create_generated_clock -name clk_div2 -source [get_ports clk] -divide_by 2 [get_pins div/Q]`"),
            );
        }
    }

    fn lint_io_delay(
        line_num: u32,
        start_col: u32,
        end_col: u32,
        cmd: &str,
        tokens: &[TokenSpan],
        diags: &mut Vec<LspDiagnostic>,
    ) {
        if !tokens.iter().any(|t| t.text == "-clock") {
            diags.push(
                LspDiagnostic::warning(
                    "AXIOM_XDC_W005_MISSING_CLOCK_REF",
                    format!("`{cmd}` typically requires `-clock [get_clocks <name>]` for reference static timing analysis."),
                    line_num,
                    start_col,
                    line_num,
                    end_col,
                )
                .with_help(format!("Example: `{cmd} -clock [get_clocks sys_clk] 2.5 [get_ports {{din}}]`")),
            );
        }
    }

    fn lint_timing_exception(
        _line_num: u32,
        _start_col: u32,
        _end_col: u32,
        _cmd: &str,
        _tokens: &[TokenSpan],
        _diags: &mut Vec<LspDiagnostic>,
    ) {
        // Valid SDC timing exceptions
    }

    fn lint_clock_groups(
        line_num: u32,
        start_col: u32,
        end_col: u32,
        tokens: &[TokenSpan],
        diags: &mut Vec<LspDiagnostic>,
    ) {
        let has_async = tokens.iter().any(|t| t.text == "-asynchronous");
        let has_log_excl = tokens.iter().any(|t| t.text == "-logically_exclusive");
        let has_phys_excl = tokens.iter().any(|t| t.text == "-physically_exclusive");

        if !has_async && !has_log_excl && !has_phys_excl {
            diags.push(
                LspDiagnostic::warning(
                    "AXIOM_XDC_W006_CLOCK_GROUP_RELATION",
                    "`set_clock_groups` should specify `-asynchronous`, `-logically_exclusive`, or `-physically_exclusive`.",
                    line_num,
                    start_col,
                    line_num,
                    end_col,
                ),
            );
        }
    }
}

/// Token with text and horizontal character offset within trimmed line
#[derive(Debug, Clone)]
struct TokenSpan {
    text: String,
    col_offset: usize,
}

fn tokenize_tcl_line(line: &str) -> Vec<TokenSpan> {
    let mut tokens = Vec::new();
    let bytes = line.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        // Skip whitespace
        while i < bytes.len() && (bytes[i] == b' ' || bytes[i] == b'\t') {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }

        let token_start = i;

        // Group brackets `[...]` or braces `{...}` or quotes `"..."` as single tokens
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
                i += 1; // Include closing quote
            }
        } else {
            // Normal word
            while i < bytes.len() && bytes[i] != b' ' && bytes[i] != b'\t' && bytes[i] != b'[' && bytes[i] != b']' {
                i += 1;
            }
        }

        let text = line[token_start..i].to_string();
        tokens.push(TokenSpan {
            text,
            col_offset: token_start,
        });
    }

    tokens
}

fn strip_inline_comment(line: &str) -> &str {
    let mut in_quote = false;
    let mut in_brace: usize = 0;
    let bytes = line.as_bytes();

    for i in 0..bytes.len() {
        if bytes[i] == b'"' && (i == 0 || bytes[i - 1] != b'\\') {
            in_quote = !in_quote;
        } else if !in_quote && bytes[i] == b'{' {
            in_brace += 1;
        } else if !in_quote && bytes[i] == b'}' {
            in_brace = in_brace.saturating_sub(1);
        } else if !in_quote && in_brace == 0 && bytes[i] == b'#' {
            // In Tcl, # is a comment if at the beginning of command (start or after whitespace)
            if i == 0 || bytes[i - 1] == b' ' || bytes[i - 1] == b'\t' || bytes[i - 1] == b';' {
                return &line[..i];
            }
        }
    }
    line
}

fn check_delimiter_parity(line: &str) -> Option<String> {
    let mut bracket_depth = 0;
    let mut brace_depth = 0;
    let mut in_quote = false;
    let bytes = line.as_bytes();

    for i in 0..bytes.len() {
        if bytes[i] == b'"' && (i == 0 || bytes[i - 1] != b'\\') {
            in_quote = !in_quote;
        } else if !in_quote {
            match bytes[i] {
                b'[' => bracket_depth += 1,
                b']' => {
                    if bracket_depth == 0 {
                        return Some("Unexpected closing bracket ']' with no matching opening bracket.".to_string());
                    }
                    bracket_depth -= 1;
                }
                b'{' => brace_depth += 1,
                b'}' => {
                    if brace_depth == 0 {
                        return Some("Unexpected closing brace '}' with no matching opening brace.".to_string());
                    }
                    brace_depth -= 1;
                }
                _ => {}
            }
        }
    }

    if in_quote {
        return Some("Unterminated string quote '\"'.".to_string());
    }
    if bracket_depth > 0 {
        return Some(format!("Unclosed square bracket '[' (missing {} closing ']').", bracket_depth));
    }
    if brace_depth > 0 {
        return Some(format!("Unclosed curly brace '{{' (missing {} closing '}}').", brace_depth));
    }

    None
}

/// Vivado XDC Hover Documentation Provider.
pub struct XdcHover;

impl XdcHover {
    pub fn hover(source: &str, line: u32, column: u32) -> Option<HoverResult> {
        let (word, word_range) = find_word_at_pos(source, line, column)?;

        let doc = match word.as_str() {
            "set_property" => Some(
                "### `set_property` (Vivado Constraint Directive)\n\n\
                Assigns physical placement, electrical IO standards, or design attributes to netlist objects.\n\n\
                **Syntax:**\n\
                ```tcl\n\
                set_property <PROPERTY> <VALUE> [get_<objects> {<NAME>}]\n\
                ```\n\n\
                **Common Properties:**\n\
                - `PACKAGE_PIN`: Physical FPGA BGA ball or QFP package pin.\n\
                - `IOSTANDARD`: Signaling standard (e.g. `LVCMOS33`, `LVDS_25`).\n\
                - `DRIVE`: Output drive strength in mA (e.g. `4`, `8`, `12`, `16`).\n\
                - `SLEW`: Output transition rate (`SLOW`, `FAST`).\n\
                - `PULLUP` / `PULLDOWN`: Internal weak pull resistor (`TRUE`, `FALSE`)."
            ),
            "PACKAGE_PIN" => Some(
                "### `PACKAGE_PIN` (Physical Pin Mapping)\n\n\
                Specifies the physical package ball or pin on the target FPGA silicon die connected to a top-level RTL port.\n\n\
                **Example:**\n\
                ```tcl\n\
                set_property PACKAGE_PIN J15 [get_ports {A}]\n\
                ```"
            ),
            "IOSTANDARD" => Some(
                "### `IOSTANDARD` (Electrical I/O Standard)\n\n\
                Defines the voltage level, threshold levels, and driver impedance for an I/O buffer.\n\n\
                **Standards:**\n\
                - `LVCMOS33`: 3.3V Low-Voltage CMOS single-ended signaling.\n\
                - `LVCMOS18`: 1.8V Low-Voltage CMOS single-ended signaling.\n\
                - `LVDS_25`: 2.5V Low-Voltage Differential Signaling.\n\
                - `SSTL15`: 1.5V Stub Series Terminated Logic for DDR3 memory."
            ),
            "LVCMOS33" => Some(
                "### `LVCMOS33`\n\n\
                3.3V Low-Voltage CMOS single-ended digital I/O standard. Common on Artix-7, Spartan-7, and Kintex-7 FPGA evaluation boards for tactile switches, pushbuttons, and LEDs."
            ),
            "LVCMOS18" => Some(
                "### `LVCMOS18`\n\n\
                1.8V Low-Voltage CMOS digital I/O standard. Frequently used for high-speed peripheral interfaces and low-power memory."
            ),
            "LVDS_25" | "LVDS" => Some(
                "### `LVDS_25` / `LVDS`\n\n\
                Low-Voltage Differential Signaling standard operating at 2.5V or 1.8V. Provides high noise immunity and Gbps serial rates."
            ),
            "get_ports" => Some(
                "### `get_ports` (Tcl Object Accessor)\n\n\
                Queries top-level RTL ports in the active hardware design matching the specified pattern.\n\n\
                **Syntax:**\n\
                ```tcl\n\
                get_ports {<pattern>}\n\
                ```\n\
                Supports bus index slices (e.g. `led[0]`, `sw[*]`)."
            ),
            "get_pins" => Some(
                "### `get_pins` (Tcl Object Accessor)\n\n\
                Queries internal instance pins inside the elaborated netlist hierarchy (e.g. `clk_wiz_0/inst/clk_out1`)."
            ),
            "get_cells" => Some(
                "### `get_cells` (Tcl Object Accessor)\n\n\
                Queries elaborated design cells and logic instances matching a name or pattern."
            ),
            "get_nets" => Some(
                "### `get_nets` (Tcl Object Accessor)\n\n\
                Queries routing wires and interconnect nets in the hardware netlist."
            ),
            "get_clocks" => Some(
                "### `get_clocks` (Tcl Object Accessor)\n\n\
                Queries defined static timing clock domains declared via `create_clock` or `create_generated_clock`."
            ),
            "create_clock" => Some(
                "### `create_clock` (SDC Primary Clock Constraint)\n\n\
                Defines a primary periodic clock waveform for Static Timing Analysis (STA).\n\n\
                **Syntax:**\n\
                ```tcl\n\
                create_clock -name <clk_name> -period <ns> [-waveform {<rise> <fall>}] [get_ports <port>]\n\
                ```\n\n\
                **Example:**\n\
                ```tcl\n\
                create_clock -name sys_clk -period 10.000 [get_ports {clk_100mhz}]\n\
                ```"
            ),
            "create_generated_clock" => Some(
                "### `create_generated_clock` (SDC Derived Clock)\n\n\
                Defines an internally generated clock derived from a master clock (e.g. frequency dividers, PLLs, MMCMs).\n\n\
                **Syntax:**\n\
                ```tcl\n\
                create_generated_clock -name <name> -source <pin> -divide_by <n> [get_pins <pin>]\n\
                ```"
            ),
            "set_input_delay" => Some(
                "### `set_input_delay` (SDC Board Timing Constraint)\n\n\
                Specifies external data arrival times relative to a clock edge at the package pin boundaries."
            ),
            "set_output_delay" => Some(
                "### `set_output_delay` (SDC Board Timing Constraint)\n\n\
                Specifies external setup/hold requirements for outgoing data relative to a clock edge."
            ),
            "set_false_path" => Some(
                "### `set_false_path` (Timing Exception)\n\n\
                Instructs the Static Timing Analysis engine to ignore timing paths between specified clocks, pins, or registers (e.g. asynchronous clock domain crossings, static configuration registers)."
            ),
            "set_multicycle_path" => Some(
                "### `set_multicycle_path` (Timing Exception)\n\n\
                Relaxes setup or hold timing margin by N clock cycles for paths designed with multi-cycle enable pulses."
            ),
            "set_clock_groups" => Some(
                "### `set_clock_groups` (SDC Clock Domain Relationship)\n\n\
                Declares asynchronous or mutually exclusive clock domains to suppress false cross-domain timing violations."
            ),
            "DRIVE" => Some(
                "### `DRIVE` (Output Drive Strength)\n\n\
                Specifies the output buffer drive current in milliamps (e.g. `4`, `8`, `12`, `16`)."
            ),
            "SLEW" => Some(
                "### `SLEW` (Output Slew Rate)\n\n\
                Controls output buffer edge transition rate: `FAST` (faster switching, higher EMI) or `SLOW` (reduced noise and ground bounce)."
            ),
            "PULLUP" => Some(
                "### `PULLUP` (Internal Pull-Up Resistor)\n\n\
                Enables weak internal pull-up resistor to VCCO rail (`TRUE` or `FALSE`). Frequently used for active-low buttons or I2C lines."
            ),
            "PULLDOWN" => Some(
                "### `PULLDOWN` (Internal Pull-Down Resistor)\n\n\
                Enables weak internal pull-down resistor to GND (`TRUE` or `FALSE`). Frequently used for active-high switches."
            ),
            "DONT_TOUCH" => Some(
                "### `DONT_TOUCH` (Optimization Barrier)\n\n\
                Prevents Vivado synthesis and implementation engines from optimizing away or restructuring a net or cell (`TRUE` or `FALSE`)."
            ),
            _ => None,
        };

        doc.map(|contents| HoverResult {
            contents: contents.to_string(),
            range: Some(word_range),
        })
    }
}

/// Vivado XDC Autocompletion & Snippets Provider.
pub struct XdcCompletion;

impl XdcCompletion {
    #[allow(clippy::vec_init_then_push)]
    pub fn complete(_source: &str, _line: u32, _column: u32) -> Vec<CompletionItem> {
        let mut items = Vec::new();

        // 1. Core Directives Snippets (Kind = 27: Snippet)
        items.push(CompletionItem {
            label: "set_property PACKAGE_PIN".to_string(),
            kind: 27,
            detail: "Assign package pin to port".to_string(),
            insert_text: "set_property PACKAGE_PIN ${1:J15} [get_ports {${2:port}}]".to_string(),
            documentation: Some("Maps top-level port to FPGA physical package pin.".to_string()),
        });

        items.push(CompletionItem {
            label: "set_property IOSTANDARD".to_string(),
            kind: 27,
            detail: "Assign I/O voltage standard".to_string(),
            insert_text: "set_property IOSTANDARD ${1:LVCMOS33} [get_ports {${2:port}}]".to_string(),
            documentation: Some("Sets signaling standard (e.g. LVCMOS33, LVDS_25, SSTL15).".to_string()),
        });

        items.push(CompletionItem {
            label: "create_clock".to_string(),
            kind: 27,
            detail: "Define primary clock constraint".to_string(),
            insert_text: "create_clock -name ${1:sys_clk} -period ${2:10.000} [get_ports {${3:clk}}]".to_string(),
            documentation: Some("Defines primary STA clock domain with period in nanoseconds.".to_string()),
        });

        items.push(CompletionItem {
            label: "create_generated_clock".to_string(),
            kind: 27,
            detail: "Define derived clock constraint".to_string(),
            insert_text: "create_generated_clock -name ${1:clk_div2} -source [get_ports ${2:clk}] -divide_by ${3:2} [get_pins {${4:div_reg/Q}}]".to_string(),
            documentation: Some("Defines derived clock for PLLs or clock divider flip-flops.".to_string()),
        });

        items.push(CompletionItem {
            label: "set_input_delay".to_string(),
            kind: 27,
            detail: "Board input delay margin".to_string(),
            insert_text: "set_input_delay -clock [get_clocks ${1:sys_clk}] -max ${2:2.0} [get_ports {${3:din}}]".to_string(),
            documentation: Some("Constrains external data arrival times for setup/hold analysis.".to_string()),
        });

        items.push(CompletionItem {
            label: "set_output_delay".to_string(),
            kind: 27,
            detail: "Board output delay margin".to_string(),
            insert_text: "set_output_delay -clock [get_clocks ${1:sys_clk}] -max ${2:2.0} [get_ports {${3:dout}}]".to_string(),
            documentation: Some("Constrains outgoing data requirements relative to board clock.".to_string()),
        });

        items.push(CompletionItem {
            label: "set_false_path".to_string(),
            kind: 27,
            detail: "Timing exception (ignore CDC paths)".to_string(),
            insert_text: "set_false_path -from [get_clocks ${1:clk_a}] -to [get_clocks ${2:clk_b}]".to_string(),
            documentation: Some("Instructs STA engine to ignore paths between asynchronous domains.".to_string()),
        });

        // 2. Commands & Directives (Kind = 14: Keyword)
        let keywords = [
            ("set_property", "Assign physical or timing attribute"),
            ("create_clock", "Define primary clock domain"),
            ("create_generated_clock", "Define divided/multiplied clock"),
            ("set_input_delay", "Define external input arrival timing"),
            ("set_output_delay", "Define external output requirement"),
            ("set_false_path", "Ignore paths between asynchronous clocks"),
            ("set_multicycle_path", "Relax setup/hold check by N cycles"),
            ("set_clock_groups", "Define asynchronous clock domains"),
            ("get_ports", "Query top-level design ports"),
            ("get_pins", "Query internal instance pins"),
            ("get_cells", "Query netlist logic cells"),
            ("get_nets", "Query interconnect routing nets"),
            ("get_clocks", "Query defined clock domains"),
            ("all_inputs", "Query all top-level input ports"),
            ("all_outputs", "Query all top-level output ports"),
            ("all_clocks", "Query all defined clock domains"),
        ];

        for (kw, desc) in keywords {
            items.push(CompletionItem {
                label: kw.to_string(),
                kind: 14,
                detail: desc.to_string(),
                insert_text: kw.to_string(),
                documentation: None,
            });
        }

        // 3. Properties (Kind = 10: Property)
        let properties = [
            ("PACKAGE_PIN", "Physical BGA/QFP package ball coordinate"),
            ("IOSTANDARD", "Signaling voltage standard (LVCMOS33, etc.)"),
            ("DRIVE", "Output buffer drive current in mA"),
            ("SLEW", "Output slew rate: FAST or SLOW"),
            ("PULLUP", "Enable weak pull-up resistor (TRUE/FALSE)"),
            ("PULLDOWN", "Enable weak pull-down resistor (TRUE/FALSE)"),
            ("DIFF_TERM", "Enable 100 ohm differential termination"),
            ("DONT_TOUCH", "Preserve net/cell from synthesis optimization"),
            ("MARK_DEBUG", "Mark net for Vivado logic analyzer probing"),
            ("LOC", "Site location constraint on FPGA fabric"),
            ("BEL", "Basic Element site constraint"),
        ];

        for (prop, desc) in properties {
            items.push(CompletionItem {
                label: prop.to_string(),
                kind: 10,
                detail: desc.to_string(),
                insert_text: prop.to_string(),
                documentation: None,
            });
        }

        // 4. IO Standards (Kind = 21: Constant)
        let standards = [
            ("LVCMOS33", "3.3V Low-Voltage CMOS"),
            ("LVCMOS25", "2.5V Low-Voltage CMOS"),
            ("LVCMOS18", "1.8V Low-Voltage CMOS"),
            ("LVCMOS15", "1.5V Low-Voltage CMOS"),
            ("LVCMOS12", "1.2V Low-Voltage CMOS"),
            ("LVDS_25", "2.5V Low-Voltage Differential"),
            ("TMDS_33", "3.3V Transition Minimized Differential (HDMI/DVI)"),
            ("SSTL15", "1.5V Stub Series Terminated Logic (DDR3)"),
            ("DIFF_SSTL15", "Differential 1.5V SSTL (DDR3 Clock)"),
        ];

        for (std, desc) in standards {
            items.push(CompletionItem {
                label: std.to_string(),
                kind: 21,
                detail: desc.to_string(),
                insert_text: std.to_string(),
                documentation: None,
            });
        }

        items
    }
}

fn find_word_at_pos(source: &str, line: u32, column: u32) -> Option<(String, LspRange)> {
    if line == 0 || column == 0 {
        return None;
    }
    let lines: Vec<&str> = source.lines().collect();
    if (line as usize) > lines.len() {
        return None;
    }
    let line_str = lines[(line - 1) as usize];
    let col_idx = (column - 1) as usize;
    if col_idx > line_str.len() {
        return None;
    }

    let target_idx = if col_idx == line_str.len()
        || !is_xdc_ident_char(line_str.as_bytes().get(col_idx).copied().unwrap_or(0))
    {
        if col_idx > 0 && is_xdc_ident_char(line_str.as_bytes()[col_idx - 1]) {
            col_idx - 1
        } else {
            return None;
        }
    } else {
        col_idx
    };

    let bytes = line_str.as_bytes();
    let mut start = target_idx;
    while start > 0 && is_xdc_ident_char(bytes[start - 1]) {
        start -= 1;
    }
    let mut end = target_idx;
    while end < bytes.len() && is_xdc_ident_char(bytes[end]) {
        end += 1;
    }

    if start == end {
        return None;
    }

    let word = line_str[start..end].to_string();
    let range = LspRange::new(line, (start + 1) as u32, line, (end + 1) as u32);
    Some((word, range))
}

fn is_xdc_ident_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'-'
}
