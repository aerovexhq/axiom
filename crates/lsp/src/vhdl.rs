use crate::types::{CompletionItem, HoverResult, LspDiagnostic};

/// VHDL (IEEE 1076) Static Analysis Linter.
pub struct VhdlLinter;

impl VhdlLinter {
    pub fn lint(source: &str) -> Vec<LspDiagnostic> {
        let mut diagnostics = Vec::new();
        let mut declared_entities: Vec<(String, u32, u32, u32)> = Vec::new(); // (name, line, start_col, end_col)

        let mut in_port_clause = false;
        let mut port_paren_depth: i32 = 0;
        let mut current_process_sens: Vec<String> = Vec::new();

        let mut global_paren_count: i32 = 0;
        let mut last_open_paren_pos: Option<(u32, u32)> = None;

        for (line_idx, line) in source.lines().enumerate() {
            let line_num = (line_idx + 1) as u32;
            let trimmed = line.trim();

            // Ignore empty lines and comment lines
            if trimmed.is_empty() || trimmed.starts_with("--") {
                continue;
            }

            // Strip inline comment
            let code_part = if let Some(pos) = line.find("--") {
                &line[..pos]
            } else {
                line
            };
            let trimmed_code = code_part.trim();
            if trimmed_code.is_empty() {
                continue;
            }

            let start_col = (line.find(trimmed_code).unwrap_or(0) + 1) as u32;
            let end_col = (start_col as usize + trimmed_code.len()) as u32;
            let lower = trimmed_code.to_lowercase();

            // 1. Delimiter balance (parentheses globally, quotes per line)
            let mut in_quote = false;
            for (char_idx, c) in trimmed_code.chars().enumerate() {
                if c == '"' {
                    in_quote = !in_quote;
                } else if !in_quote {
                    if c == '(' {
                        global_paren_count += 1;
                        last_open_paren_pos = Some((line_num, start_col + char_idx as u32));
                    } else if c == ')' {
                        global_paren_count -= 1;
                        if global_paren_count < 0 {
                            let col = start_col + char_idx as u32;
                            diagnostics.push(
                                LspDiagnostic::error(
                                    "AXIOM_VHDL_E003_UNCLOSED_DELIMITER",
                                    "Unexpected closing parenthesis ')' with no matching opening delimiter.",
                                    line_num,
                                    col,
                                    line_num,
                                    col + 1,
                                )
                                .with_help("Ensure every closing parenthesis has a corresponding opening delimiter."),
                            );
                            global_paren_count = 0;
                        }
                    }
                }
            }
            if in_quote {
                diagnostics.push(
                    LspDiagnostic::error(
                        "AXIOM_VHDL_E003_UNCLOSED_DELIMITER",
                        "Unclosed string literal quote '\"'.",
                        line_num,
                        start_col,
                        line_num,
                        end_col,
                    )
                    .with_help("Ensure all string literals are properly closed with '\"'."),
                );
            }

            // 2. Entity Declaration: `entity <Name> is`
            if lower.starts_with("entity ") {
                let parts: Vec<&str> = trimmed_code.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[1].trim_matches(';');
                    if name.to_lowercase() != "is" {
                        let name_col = (line.find(name).unwrap_or(0) + 1) as u32;
                        declared_entities.push((name.to_string(), line_num, name_col, name_col + name.len() as u32));
                    }
                }
            }

            // 3. Architecture Declaration: `architecture <ArchName> of <EntityTarget> is`
            if lower.starts_with("architecture ") {
                let parts: Vec<&str> = trimmed_code.split_whitespace().collect();
                // Expected tokens: architecture, <name>, of, <entity>, is
                if let Some(of_idx) = parts.iter().position(|&p| p.eq_ignore_ascii_case("of")) {
                    if of_idx + 1 < parts.len() {
                        let target_entity = parts[of_idx + 1].trim_matches(';');
                        let target_col = (line.find(target_entity).unwrap_or(0) + 1) as u32;

                        if !declared_entities.is_empty() {
                            let matched = declared_entities.iter().any(|(e, _, _, _)| e.eq_ignore_ascii_case(target_entity));
                            if !matched {
                                let (first_ent, _, _, _) = &declared_entities[0];
                                diagnostics.push(
                                    LspDiagnostic::error(
                                        "AXIOM_VHDL_E001_ENTITY_MISMATCH",
                                        format!(
                                            "Architecture references entity '{}', but declared entity is '{}'.",
                                            target_entity, first_ent
                                        ),
                                        line_num,
                                        target_col,
                                        line_num,
                                        target_col + target_entity.len() as u32,
                                    )
                                    .with_help(format!("Change target entity to '{}' or declare entity '{}'.", first_ent, target_entity)),
                                );
                            }
                        }
                    }
                }
            }

            // 4. Port Clause Tracking & Direction / Type Checking
            if lower.contains("port ") && lower.contains('(') {
                in_port_clause = true;
            }

            if in_port_clause {
                for c in trimmed_code.chars() {
                    if c == '(' {
                        port_paren_depth += 1;
                    } else if c == ')' {
                        port_paren_depth -= 1;
                        if port_paren_depth <= 0 {
                            in_port_clause = false;
                        }
                    }
                }

                // Check for Verilog-style `input` or `output` keyword mistake
                if lower.contains("input ") || lower.contains("output ") {
                    let is_input = lower.contains("input ");
                    let bad_word = if is_input { "input" } else { "output" };
                    let correct_word = if is_input { "in" } else { "out" };
                    let bad_col = (line.to_lowercase().find(bad_word).unwrap_or(0) + 1) as u32;

                    diagnostics.push(
                        LspDiagnostic::error(
                            "AXIOM_VHDL_E002_PORT_DIRECTION",
                            format!(
                                "Invalid port direction '{}'. In VHDL, port directions must be 'in', 'out', 'inout', or 'buffer'.",
                                bad_word
                            ),
                            line_num,
                            bad_col,
                            line_num,
                            bad_col + bad_word.len() as u32,
                        )
                        .with_help(format!("Replace '{}' with '{}'.", bad_word, correct_word)),
                    );
                }
            }

            // 5. Process Sensitivity List Tracking
            if lower.starts_with("process") {
                current_process_sens.clear();

                if let Some(open_p) = trimmed_code.find('(') {
                    if let Some(close_p) = trimmed_code.find(')') {
                        let inner = &trimmed_code[open_p + 1..close_p];
                        for sig in inner.split(',') {
                            let s = sig.trim();
                            if !s.is_empty() {
                                current_process_sens.push(s.to_lowercase());
                            }
                        }
                    }
                }
            }

            // Check clocked edge statements against sensitivity list
            if lower.contains("rising_edge(") || lower.contains("falling_edge(") {
                let func = if lower.contains("rising_edge(") { "rising_edge" } else { "falling_edge" };
                if let Some(pos) = lower.find(func) {
                    let sub = &trimmed_code[pos + func.len()..];
                    if let Some(open_p) = sub.find('(') {
                        if let Some(close_p) = sub.find(')') {
                            let clk_name = sub[open_p + 1..close_p].trim();
                            if !clk_name.is_empty() && !current_process_sens.is_empty() {
                                if !current_process_sens.iter().any(|s| s.eq_ignore_ascii_case(clk_name)) {
                                    let clk_col = (line.find(clk_name).unwrap_or(0) + 1) as u32;
                                    diagnostics.push(
                                        LspDiagnostic::warning(
                                            "AXIOM_VHDL_W001_PROCESS_SENSITIVITY",
                                            format!(
                                                "Clock signal '{}' is evaluated by '{}' but missing from the process sensitivity list.",
                                                clk_name, func
                                            ),
                                            line_num,
                                            clk_col,
                                            line_num,
                                            clk_col + clk_name.len() as u32,
                                        )
                                        .with_help(format!("Add '{}' to the process sensitivity list: process({})", clk_name, clk_name)),
                                    );
                                }
                            }
                        }
                    }
                }
            }

            if lower.starts_with("end process") {
                current_process_sens.clear();
            }
        }

        if global_paren_count > 0 {
            let (open_line, open_col) = last_open_paren_pos.unwrap_or((1, 1));
            diagnostics.push(
                LspDiagnostic::error(
                    "AXIOM_VHDL_E003_UNCLOSED_DELIMITER",
                    "Unclosed opening parenthesis '('.",
                    open_line,
                    open_col,
                    open_line,
                    open_col + 1,
                )
                .with_help("Ensure all opening parentheses '(' have matching closing delimiters ')'."),
            );
        }

        diagnostics
    }
}

/// VHDL Hover Documentation Provider.
pub struct VhdlHover;

impl VhdlHover {
    pub fn hover(source: &str, line: u32, column: u32) -> Option<HoverResult> {
        let lines: Vec<&str> = source.lines().collect();
        if (line as usize) < 1 || (line as usize) > lines.len() {
            return None;
        }
        let line_str = lines[(line - 1) as usize];
        let token = extract_word_at(line_str, column)?;
        let lower = token.to_lowercase();

        let doc = match lower.as_str() {
            "entity" => "**entity** (VHDL Primary Design Unit)\n\nDeclares the external interface and port connections of a hardware component.",
            "architecture" => "**architecture** (VHDL Secondary Design Unit)\n\nDefines the internal structural or behavioral implementation of a declared entity.",
            "process" => "**process** (VHDL Sequential Execution Block)\n\nExecutes statements sequentially when any signal in its sensitivity list changes value.",
            "rising_edge" => "**rising_edge(s)** (IEEE Standard Function)\n\nReturns TRUE when signal `s` transitions from '0' to '1'. Preferred over `s'event and s = '1'`.",
            "falling_edge" => "**falling_edge(s)** (IEEE Standard Function)\n\nReturns TRUE when signal `s` transitions from '1' to '0'.",
            "std_logic" => "**std_logic** (IEEE 1164 9-State Logic Type)\n\nStates: 'U' (uninitialized), 'X' (forcing unknown), '0' (forcing 0), '1' (forcing 1), 'Z' (high impedance), 'W' (weak unknown), 'L' (weak 0), 'H' (weak 1), '-' (don't care).",
            "std_logic_vector" => "**std_logic_vector** (IEEE 1164 Vector of std_logic)\n\nStandard bit vector array indexed with `(N-1 downto 0)`.",
            "signed" => "**signed** (IEEE numeric_std)\n\nTwo's complement signed arithmetic vector.",
            "unsigned" => "**unsigned** (IEEE numeric_std)\n\nUnsigned binary arithmetic vector.",
            "others" => "**others => '0'** (VHDL Aggregate Aggregate Assign)\n\nAssigns default value to all remaining array elements or record fields.",
            "downto" => "**downto** (VHDL Range Direction)\n\nDescending bit range indexing (e.g. `7 downto 0`).",
            _ => return None,
        };

        Some(HoverResult {
            contents: doc.to_string(),
            range: None,
        })
    }
}

/// VHDL Completion Provider.
pub struct VhdlCompletion;

impl VhdlCompletion {
    pub fn completions() -> Vec<CompletionItem> {
        vec![
            CompletionItem {
                label: "entity".to_string(),
                kind: 14, // Snippet
                detail: "VHDL Entity Declaration".to_string(),
                insert_text: "entity ${1:module_name} is\n    port (\n        clk   : in  std_logic;\n        rst_n : in  std_logic\n    );\nend entity ${1:module_name};".to_string(),
                documentation: Some("Declare a new VHDL hardware entity interface.".to_string()),
            },
            CompletionItem {
                label: "architecture".to_string(),
                kind: 14,
                detail: "VHDL Architecture Body".to_string(),
                insert_text: "architecture rtl of ${1:entity_name} is\nbegin\n    $0\nend architecture rtl;".to_string(),
                documentation: Some("Implement architecture behavior for an entity.".to_string()),
            },
            CompletionItem {
                label: "process".to_string(),
                kind: 14,
                detail: "Clocked Process".to_string(),
                insert_text: "process(clk, rst_n)\nbegin\n    if rst_n = '0' then\n        $0\n    elsif rising_edge(clk) then\n        \n    end if;\nend process;".to_string(),
                documentation: Some("Synchronous clocked process with asynchronous active-low reset.".to_string()),
            },
        ]
    }
}

fn extract_word_at(line: &str, col: u32) -> Option<String> {
    if col < 1 || (col as usize) > line.len() {
        return None;
    }
    let chars: Vec<char> = line.chars().collect();
    let idx = (col - 1) as usize;

    let is_ident_char = |c: char| c.is_alphanumeric() || c == '_';
    if !is_ident_char(chars[idx]) {
        return None;
    }

    let mut start = idx;
    while start > 0 && is_ident_char(chars[start - 1]) {
        start -= 1;
    }

    let mut end = idx;
    while end < chars.len() && is_ident_char(chars[end]) {
        end += 1;
    }

    Some(chars[start..end].iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vhdl_lint_clean_valid_entity() {
        let src = r#"
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity counter is
    port (
        clk      : in  std_logic;
        rst_n    : in  std_logic;
        count_out: out std_logic_vector(7 downto 0)
    );
end entity counter;

architecture rtl of counter is
    signal count : std_logic_vector(7 downto 0);
begin
    process(clk, rst_n)
    begin
        if rst_n = '0' then
            count <= (others => '0');
        elsif rising_edge(clk) then
            count <= count;
        end if;
    end process;

    count_out <= count;
end architecture rtl;
"#;
        let diags = VhdlLinter::lint(src);
        assert!(diags.is_empty(), "Expected 0 diagnostics, got {:?}", diags);
    }

    #[test]
    fn test_vhdl_lint_entity_mismatch() {
        let src = r#"
entity my_alu is
    port (
        clk : in std_logic
    );
end entity my_alu;

architecture rtl of wrong_alu is
begin
end architecture rtl;
"#;
        let diags = VhdlLinter::lint(src);
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "AXIOM_VHDL_E001_ENTITY_MISMATCH");
    }

    #[test]
    fn test_vhdl_lint_input_output_direction_error() {
        let src = r#"
entity test is
    port (
        clk : input std_logic
    );
end entity test;
"#;
        let diags = VhdlLinter::lint(src);
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "AXIOM_VHDL_E002_PORT_DIRECTION");
    }

    #[test]
    fn test_vhdl_lint_clock_missing_from_sensitivity() {
        let src = r#"
architecture rtl of counter is
begin
    process(rst_n)
    begin
        if rising_edge(clk) then
        end if;
    end process;
end architecture rtl;
"#;
        let diags = VhdlLinter::lint(src);
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "AXIOM_VHDL_W001_PROCESS_SENSITIVITY");
    }
}
