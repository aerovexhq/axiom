use crate::types::{HoverResult, LspRange};
use axiom_core::{offset_to_line_col, FileId};
use axiom_syntax::ast::*;
use axiom_syntax::parse_hdl;

pub struct VerilogHover;

impl VerilogHover {
    pub fn hover(source: &str, line: u32, column: u32) -> Option<HoverResult> {
        let (word, word_range) = find_word_at_pos(source, line, column)?;

        // 1. Check keyword documentation
        if let Some(doc) = keyword_doc(&word) {
            return Some(HoverResult {
                contents: doc.to_string(),
                range: Some(word_range),
            });
        }

        // 2. Parse AST to locate signal, port, parameter, or module
        let file_id = FileId(1);
        let (ast, _) = parse_hdl(file_id, source);

        // Check if word matches a module definition
        for module in &ast.modules {
            if module.name == word {
                let mut ports_str = String::new();
                for p in &module.ports {
                    let dir_str = match p.direction {
                        PortDirection::Input => "input",
                        PortDirection::Output => "output",
                        PortDirection::Inout => "inout",
                    };
                    let dt_str = match p.data_type {
                        DataType::Wire => "wire",
                        DataType::Reg => "reg",
                        DataType::Logic => "logic",
                        DataType::Integer => "integer",
                        DataType::Implicit => "",
                    };
                    ports_str.push_str(&format!("- `{}`: {} {}\n", p.name, dir_str, dt_str));
                }
                let doc = format!(
                    "### Module `{}`\n\n**Ports ({}):**\n{}",
                    module.name,
                    module.ports.len(),
                    if ports_str.is_empty() { "*(No ports declared)*\n".to_string() } else { ports_str }
                );
                return Some(HoverResult {
                    contents: doc,
                    range: Some(word_range),
                });
            }
        }

        // Check inside the module containing the cursor
        let target_offset = line_col_to_offset(source, line, column);
        for module in &ast.modules {
            if let Some(offset) = target_offset {
                if offset < (module.span.start as usize) || offset > (module.span.end as usize) {
                    continue;
                }
            }

            // Check ports
            for port in &module.ports {
                if port.name == word {
                    let dir_str = match port.direction {
                        PortDirection::Input => "input",
                        PortDirection::Output => "output",
                        PortDirection::Inout => "inout",
                    };
                    let dt_str = match port.data_type {
                        DataType::Wire => "wire",
                        DataType::Reg => "reg",
                        DataType::Logic => "logic",
                        DataType::Integer => "integer",
                        DataType::Implicit => "logic",
                    };
                    let (decl_line, decl_col) = offset_to_line_col(source, port.span.start);
                    let doc = format!(
                        "### Port `{}`\n\n- **Direction**: `{}`\n- **Data Type**: `{}`\n- **Declared**: Line {}, Column {}\n- **Scope**: Module `{}`",
                        port.name, dir_str, dt_str, decl_line, decl_col, module.name
                    );
                    return Some(HoverResult {
                        contents: doc,
                        range: Some(word_range),
                    });
                }
            }

            // Check parameters
            for param in &module.params {
                if param.name == word {
                    let kind = if param.is_local { "localparam" } else { "parameter" };
                    let (decl_line, decl_col) = offset_to_line_col(source, param.span.start);
                    let doc = format!(
                        "### Parameter `{}`\n\n- **Kind**: `{}`\n- **Declared**: Line {}, Column {}\n- **Scope**: Module `{}`",
                        param.name, kind, decl_line, decl_col, module.name
                    );
                    return Some(HoverResult {
                        contents: doc,
                        range: Some(word_range),
                    });
                }
            }

            // Check items: NetDecl, Instance, etc.
            for item in &module.items {
                match item {
                    ModuleItem::NetDecl(net) => {
                        if net.names.iter().any(|n| n == &word) {
                            let dt_str = match net.data_type {
                                DataType::Wire => "wire",
                                DataType::Reg => "reg",
                                DataType::Logic => "logic",
                                DataType::Integer => "integer",
                                DataType::Implicit => "wire",
                            };
                            let (decl_line, decl_col) = offset_to_line_col(source, net.span.start);
                            let doc = format!(
                                "### Internal Signal `{}`\n\n- **Data Type**: `{}`\n- **Declared**: Line {}, Column {}\n- **Scope**: Module `{}`",
                                word, dt_str, decl_line, decl_col, module.name
                            );
                            return Some(HoverResult {
                                contents: doc,
                                range: Some(word_range),
                            });
                        }
                    }
                    ModuleItem::ParamDecl(param) => {
                        if param.name == word {
                            let kind = if param.is_local { "localparam" } else { "parameter" };
                            let (decl_line, decl_col) = offset_to_line_col(source, param.span.start);
                            let doc = format!(
                                "### Parameter `{}`\n\n- **Kind**: `{}`\n- **Declared**: Line {}, Column {}\n- **Scope**: Module `{}`",
                                param.name, kind, decl_line, decl_col, module.name
                            );
                            return Some(HoverResult {
                                contents: doc,
                                range: Some(word_range),
                            });
                        }
                    }
                    ModuleItem::Instance(inst) => {
                        if inst.instance_name == word {
                            let (decl_line, decl_col) = offset_to_line_col(source, inst.span.start);
                            let doc = format!(
                                "### Instance `{}`\n\n- **Module**: `{}`\n- **Bindings**: {} ports, {} params\n- **Declared**: Line {}, Column {}\n- **Scope**: Module `{}`",
                                inst.instance_name,
                                inst.module_name,
                                inst.port_bindings.len(),
                                inst.param_bindings.len(),
                                decl_line,
                                decl_col,
                                module.name
                            );
                            return Some(HoverResult {
                                contents: doc,
                                range: Some(word_range),
                            });
                        }
                    }
                    _ => {}
                }
            }
        }

        None
    }
}

fn line_col_to_offset(source: &str, line: u32, column: u32) -> Option<usize> {
    if line == 0 || column == 0 {
        return None;
    }
    let mut cur_line = 1;
    let mut cur_col = 1;
    for (idx, ch) in source.char_indices() {
        if cur_line == line && cur_col == column {
            return Some(idx);
        }
        if ch == '\n' {
            cur_line += 1;
            cur_col = 1;
        } else {
            cur_col += 1;
        }
    }
    None
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

    // If cursor is at the end or on whitespace/punctuation, inspect previous character if it's alphanumeric
    let target_idx = if col_idx == line_str.len() || !is_ident_char(line_str.as_bytes().get(col_idx).copied().unwrap_or(0)) {
        if col_idx > 0 && is_ident_char(line_str.as_bytes()[col_idx - 1]) {
            col_idx - 1
        } else {
            return None;
        }
    } else {
        col_idx
    };

    let bytes = line_str.as_bytes();
    let mut start = target_idx;
    while start > 0 && is_ident_char(bytes[start - 1]) {
        start -= 1;
    }
    let mut end = target_idx;
    while end < bytes.len() && is_ident_char(bytes[end]) {
        end += 1;
    }

    if start == end {
        return None;
    }

    let word = line_str[start..end].to_string();
    let range = LspRange::new(line, (start + 1) as u32, line, (end + 1) as u32);
    Some((word, range))
}

fn is_ident_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'$'
}

fn keyword_doc(kw: &str) -> Option<&'static str> {
    match kw {
        "always" => Some(
            "### `always` Block\n\nProcedural statement that executes repeatedly in simulation. Used for sequential flip-flops (with edge sensitivity) or combinational logic (with level sensitivity)."
        ),
        "always_ff" => Some(
            "### `always_ff` (SystemVerilog)\n\nDedicated procedural block for synthesizable flip-flop sequential logic. Guaranteed edge-triggered clock/reset behavior."
        ),
        "always_comb" => Some(
            "### `always_comb` (SystemVerilog)\n\nDedicated procedural block for synthesizable combinational logic. Implicitly sensitive to all read inputs; executes once at time 0."
        ),
        "always_latch" => Some(
            "### `always_latch` (SystemVerilog)\n\nDedicated procedural block for synthesizable level-sensitive latch logic."
        ),
        "assign" => Some(
            "### `assign` (Continuous Assignment)\n\nContinuously drives a `wire` or net with a combinational expression. Evaluated whenever any RHS operand transitions."
        ),
        "initial" => Some(
            "### `initial` Block\n\nProcedural block that executes exactly once at simulation time $t = 0$. Primarily used in testbenches for stimulus generation."
        ),
        "module" => Some(
            "### `module` ... `endmodule`\n\nThe fundamental hardware abstraction and structural instantiation unit in Verilog and SystemVerilog."
        ),
        "input" => Some(
            "### `input` Port\n\nDeclares an incoming hardware signal driven externally and read by this module."
        ),
        "output" => Some(
            "### `output` Port\n\nDeclares an outgoing hardware signal driven by this module."
        ),
        "inout" => Some(
            "### `inout` Bidirectional Port\n\nDeclares a bidirectional tri-state bus port (e.g. I2C SDA, memory data bus)."
        ),
        "wire" => Some(
            "### `wire`\n\nStandard structural 4-state net (`0`, `1`, `X`, `Z`) representing a physical combinational wire connection."
        ),
        "reg" => Some(
            "### `reg`\n\nProcedural variable storage that retains its value between sequential procedural assignments (`<=` or `=`)."
        ),
        "logic" => Some(
            "### `logic` (SystemVerilog)\n\nUnified 4-state data type replacing ambiguous `wire` and `reg` distinctions. Can be driven by a continuous assignment or within procedural blocks."
        ),
        "posedge" => Some(
            "### `posedge`\n\nRising-edge transition event trigger (`0 -> 1`, `0 -> X/Z`, `X/Z -> 1`)."
        ),
        "negedge" => Some(
            "### `negedge`\n\nFalling-edge transition event trigger (`1 -> 0`, `1 -> X/Z`, `X/Z -> 0`)."
        ),
        "parameter" => Some(
            "### `parameter`\n\nCompile-time elaboration constant that can be overridden when instantiating the module."
        ),
        "localparam" => Some(
            "### `localparam`\n\nLocal module constant that cannot be directly overridden by module instantiation."
        ),
        "case" => Some(
            "### `case` ... `endcase`\n\nMulti-way branch statement that compares an expression against case items in lexical order."
        ),
        "default" => Some(
            "### `default` Clause\n\nFallback branch in a `case` statement executed when no preceding pattern matches."
        ),
        "if" => Some(
            "### `if` ... `else`\n\nConditional branching statement inside procedural blocks."
        ),
        "for" => Some(
            "### `for` Loop\n\nProcedural or generate looping construct evaluated during simulation or compile-time elaboration."
        ),
        "generate" => Some(
            "### `generate` ... `endgenerate`\n\nElaboration-time conditional or iterative hardware instantiation block."
        ),
        _ => None,
    }
}
