use crate::types::{CompletionItem, HoverResult, LspDiagnostic};

/// Memory Initialization File (.coe, .mem, .hex) Static Analysis Linter.
pub struct MemLinter;

impl MemLinter {
    pub fn lint(source: &str, file_name: &str) -> Vec<LspDiagnostic> {
        let is_coe = file_name.ends_with(".coe") || source.contains("memory_initialization_radix");

        if is_coe {
            Self::lint_coe(source)
        } else {
            Self::lint_verilog_mem(source)
        }
    }

    /// Lint Xilinx Vivado Coefficient (.coe) file
    fn lint_coe(source: &str) -> Vec<LspDiagnostic> {
        let mut diagnostics = Vec::new();

        let mut declared_radix: Option<u32> = None;
        let mut found_vector = false;
        let mut in_vector = false;
        let mut vector_tokens: Vec<(String, u32, u32, u32)> = Vec::new(); // (text, line, start_col, end_col)

        for (line_idx, line) in source.lines().enumerate() {
            let line_num = (line_idx + 1) as u32;
            let trimmed = line.trim();

            if trimmed.is_empty() || trimmed.starts_with(';') {
                continue;
            }

            // Strip inline comment `;`
            let code_part = if let Some(pos) = line.find(';') {
                // Semicolons can also end the vector! If this line has memory_initialization_vector, check carefully
                if !trimmed.to_lowercase().contains("memory_initialization_vector") && in_vector {
                    &line[..=pos]
                } else if trimmed.starts_with(";") {
                    continue;
                } else {
                    line
                }
            } else {
                line
            };
            let trimmed_code = code_part.trim();
            let lower = trimmed_code.to_lowercase();

            // Check Radix
            if lower.contains("memory_initialization_radix") {
                if let Some(eq_idx) = trimmed_code.find('=') {
                    let val_str = trimmed_code[eq_idx + 1..].trim().trim_end_matches(';').trim();
                    let val_col = (line.find(val_str).unwrap_or(0) + 1) as u32;

                    match val_str {
                        "2" | "10" | "16" => {
                            declared_radix = val_str.parse().ok();
                        }
                        _ => {
                            diagnostics.push(
                                LspDiagnostic::error(
                                    "AXIOM_MEM_E001_INVALID_RADIX",
                                    format!("Invalid memory initialization radix '{}'. Supported radices are 2, 10, or 16.", val_str),
                                    line_num,
                                    val_col,
                                    line_num,
                                    val_col + val_str.len() as u32,
                                )
                                .with_help("Specify `memory_initialization_radix = 16;` for hexadecimal or 2 for binary."),
                            );
                        }
                    }
                }
            }

            // Check Vector header
            if lower.contains("memory_initialization_vector") {
                found_vector = true;
                in_vector = true;

                if let Some(eq_idx) = trimmed_code.find('=') {
                    let rest = trimmed_code[eq_idx + 1..].trim();
                    if !rest.is_empty() {
                        Self::collect_vector_tokens(rest, line_num, (line.find(rest).unwrap_or(0) + 1) as u32, &mut vector_tokens);
                    }
                }
                continue;
            }

            if in_vector {
                Self::collect_vector_tokens(trimmed_code, line_num, (line.find(trimmed_code).unwrap_or(0) + 1) as u32, &mut vector_tokens);
                if trimmed.ends_with(';') {
                    in_vector = false;
                }
            }
        }

        // Validate radix presence
        if declared_radix.is_none() && diagnostics.is_empty() {
            diagnostics.push(
                LspDiagnostic::error(
                    "AXIOM_MEM_E001_MISSING_RADIX",
                    "Missing `memory_initialization_radix = <2|10|16>;` header.",
                    1,
                    1,
                    1,
                    1,
                )
                .with_help("Add `memory_initialization_radix = 16;` at the top of the .coe file."),
            );
        }

        if !found_vector {
            diagnostics.push(
                LspDiagnostic::error(
                    "AXIOM_MEM_E002_MISSING_VECTOR",
                    "Missing `memory_initialization_vector = ...;` declaration.",
                    1,
                    1,
                    1,
                    1,
                )
                .with_help("Add `memory_initialization_vector = <data>;` containing initialization words."),
            );
        }

        // Validate digits against radix
        let radix = declared_radix.unwrap_or(16);
        let mut word_lengths: Vec<usize> = Vec::new();

        for (token, line_num, start_col, end_col) in &vector_tokens {
            let clean = token.trim_matches(',').trim_matches(';');
            if clean.is_empty() {
                continue;
            }

            let valid = match radix {
                2 => clean.chars().all(|c| c == '0' || c == '1'),
                10 => clean.chars().all(|c| c.is_ascii_digit()),
                16 => clean.chars().all(|c| c.is_ascii_hexdigit()),
                _ => true,
            };

            if !valid {
                diagnostics.push(
                    LspDiagnostic::error(
                        "AXIOM_MEM_E003_INVALID_DIGIT",
                        format!("Vector word '{}' contains characters invalid for radix {}.", clean, radix),
                        *line_num,
                        *start_col,
                        *line_num,
                        *end_col,
                    )
                    .with_help(format!("Ensure all digits conform to radix {} formatting.", radix)),
                );
            } else {
                word_lengths.push(clean.len());
            }
        }

        // Check word length consistency if radix == 16 or 2
        if (radix == 16 || radix == 2) && word_lengths.len() > 1 {
            let first_len = word_lengths[0];
            for (idx, &len) in word_lengths.iter().enumerate().skip(1) {
                if len != first_len {
                    let (_, line_num, start_col, end_col) = &vector_tokens[idx];
                    diagnostics.push(
                        LspDiagnostic::warning(
                            "AXIOM_MEM_W001_WIDTH_INCONSISTENCY",
                            format!("Word length {} does not match preceding word length {}.", len, first_len),
                            *line_num,
                            *start_col,
                            *line_num,
                            *end_col,
                        )
                        .with_help("Ensure all memory initialization words share a uniform bit-width."),
                    );
                    break;
                }
            }
        }

        diagnostics
    }

    /// Lint Verilog $readmemh / $readmemb (.mem, .hex) file
    fn lint_verilog_mem(source: &str) -> Vec<LspDiagnostic> {
        let mut diagnostics = Vec::new();

        for (line_idx, line) in source.lines().enumerate() {
            let line_num = (line_idx + 1) as u32;
            let trimmed = line.trim();

            if trimmed.is_empty() || trimmed.starts_with("//") {
                continue;
            }

            let tokens = trimmed.split_whitespace();
            for token in tokens {
                let token_col = (line.find(token).unwrap_or(0) + 1) as u32;
                let token_end = token_col + token.len() as u32;

                if token.starts_with('@') {
                    // Address directive, e.g. @0000 or @1F
                    let addr_hex = &token[1..];
                    if addr_hex.is_empty() || !addr_hex.chars().all(|c| c.is_ascii_hexdigit()) {
                        diagnostics.push(
                            LspDiagnostic::error(
                                "AXIOM_MEM_E004_INVALID_ADDRESS",
                                format!("Invalid hexadecimal address directive '{}'.", token),
                                line_num,
                                token_col,
                                line_num,
                                token_end,
                            )
                            .with_help("Address directives must format as `@<hex_address>` (e.g. `@0000` or `@003F`)."),
                        );
                    }
                } else {
                    // Data token (hex)
                    let clean = token.trim_matches(',').trim_matches(';');
                    if !clean.chars().all(|c| c.is_ascii_hexdigit() || c == 'x' || c == 'X' || c == 'z' || c == 'Z' || c == '_') {
                        diagnostics.push(
                            LspDiagnostic::error(
                                "AXIOM_MEM_E005_INVALID_DATA",
                                format!("Invalid hexadecimal data entry '{}'.", clean),
                                line_num,
                                token_col,
                                line_num,
                                token_end,
                            )
                            .with_help("Verilog `$readmemh` data vectors accept hexadecimal digits 0-9, a-f, A-F, and x/z."),
                        );
                    }
                }
            }
        }

        diagnostics
    }

    fn collect_vector_tokens(
        s: &str,
        line_num: u32,
        base_col: u32,
        tokens: &mut Vec<(String, u32, u32, u32)>,
    ) {
        for part in s.split(|c: char| c.is_whitespace() || c == ',') {
            let trimmed = part.trim_matches(';').trim();
            if !trimmed.is_empty() {
                tokens.push((trimmed.to_string(), line_num, base_col, base_col + trimmed.len() as u32));
            }
        }
    }
}

/// Memory File Hover Documentation Provider.
pub struct MemHover;

impl MemHover {
    pub fn hover(source: &str, line: u32, _column: u32) -> Option<HoverResult> {
        let lines: Vec<&str> = source.lines().collect();
        if (line as usize) < 1 || (line as usize) > lines.len() {
            return None;
        }
        let line_str = lines[(line - 1) as usize];
        let lower = line_str.to_lowercase();

        if lower.contains("memory_initialization_radix") {
            return Some(HoverResult {
                contents: "**memory_initialization_radix** (Xilinx COE Directive)\n\nDefines the numerical base of the data values in `memory_initialization_vector`.\n- `2`: Binary (e.g. `00110001`)\n- `10`: Decimal (e.g. `49`)\n- `16`: Hexadecimal (e.g. `31`)".to_string(),
                range: None,
            });
        }

        if lower.contains("memory_initialization_vector") {
            return Some(HoverResult {
                contents: "**memory_initialization_vector** (Xilinx COE Directive)\n\nComma- or whitespace-delimited sequence of data words used to initialize BRAM or ROM primitives, terminated by a semicolon `;`.".to_string(),
                range: None,
            });
        }

        if line_str.contains('@') {
            return Some(HoverResult {
                contents: "**@<address>** (Verilog Memory Address Directive)\n\nSpecifies the starting memory word index for subsequent data entries in `$readmemh` or `$readmemb` files.".to_string(),
                range: None,
            });
        }

        None
    }
}

/// Memory File Completion Provider.
pub struct MemCompletion;

impl MemCompletion {
    pub fn completions() -> Vec<CompletionItem> {
        vec![
            CompletionItem {
                label: "coe_header".to_string(),
                kind: 14,
                detail: "Xilinx COE Header".to_string(),
                insert_text: "; Vivado Memory Initialization Vector (COE)\nmemory_initialization_radix = 16;\nmemory_initialization_vector =\n  ${1:00000000},\n  ${2:00000001};".to_string(),
                documentation: Some("Standard Xilinx BRAM/ROM COE template.".to_string()),
            },
            CompletionItem {
                label: "readmemh_entry".to_string(),
                kind: 14,
                detail: "Verilog $readmemh Address Block".to_string(),
                insert_text: "@${1:0000} ${2:00000000} ${3:00000001}".to_string(),
                documentation: Some("Memory vector block with address directive.".to_string()),
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coe_lint_valid_hex() {
        let coe = r#"
; Vivado BRAM initialization
memory_initialization_radix = 16;
memory_initialization_vector =
    0001,
    0002,
    0003,
    0004;
"#;
        let diags = MemLinter::lint(coe, "rom.coe");
        assert!(diags.is_empty(), "Expected 0 diags, got {:?}", diags);
    }

    #[test]
    fn test_coe_lint_invalid_radix() {
        let coe = r#"
memory_initialization_radix = 8;
memory_initialization_vector = 01, 02;
"#;
        let diags = MemLinter::lint(coe, "rom.coe");
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "AXIOM_MEM_E001_INVALID_RADIX");
    }

    #[test]
    fn test_coe_lint_invalid_digit_in_hex() {
        let coe = r#"
memory_initialization_radix = 16;
memory_initialization_vector =
    0001,
    000Z,
    0003;
"#;
        let diags = MemLinter::lint(coe, "rom.coe");
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "AXIOM_MEM_E003_INVALID_DIGIT");
    }

    #[test]
    fn test_verilog_mem_lint_valid() {
        let mem = r#"
// Memory vectors for RV32 instruction ROM
@0000 00000093 00000113 00000193
@0004 00000293 deadbeef caffe001
"#;
        let diags = MemLinter::lint(mem, "rom.mem");
        assert!(diags.is_empty(), "Expected 0 diags, got {:?}", diags);
    }

    #[test]
    fn test_verilog_mem_lint_invalid_addr() {
        let mem = r#"
@XYZ12 00000093
"#;
        let diags = MemLinter::lint(mem, "rom.mem");
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "AXIOM_MEM_E004_INVALID_ADDRESS");
    }
}
