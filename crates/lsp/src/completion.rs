use crate::types::CompletionItem;
use axiom_core::FileId;
use axiom_syntax::ast::*;
use axiom_syntax::parse_hdl;

pub struct VerilogCompletion;

impl VerilogCompletion {
    pub fn complete(source: &str, line: u32, column: u32) -> Vec<CompletionItem> {
        let mut items = Vec::new();

        // 1. Structural Snippets
        items.push(CompletionItem {
            label: "module ... endmodule".to_string(),
            kind: 27, // Snippet
            detail: "Module declaration template".to_string(),
            insert_text: "module ${1:module_name} (\n    input  wire        clk,\n    input  wire        rst_n,\n    input  wire [${2:7}:0] din,\n    output reg  [${2:7}:0] dout\n);\n\n    ${0}\n\nendmodule\n".to_string(),
            documentation: Some("Declares a complete synthesizable Verilog module with clock, reset, and data ports.".to_string()),
        });

        items.push(CompletionItem {
            label: "always @(posedge clk)".to_string(),
            kind: 27, // Snippet
            detail: "Clocked sequential flip-flop block".to_string(),
            insert_text: "always @(posedge ${1:clk} or negedge ${2:rst_n}) begin\n    if (!${2:rst_n}) begin\n        ${3:dout} <= '0;\n    end else begin\n        ${0}\n    end\nend\n".to_string(),
            documentation: Some("Standard asynchronous active-low reset D-flip-flop sequential process.".to_string()),
        });

        items.push(CompletionItem {
            label: "always @(*)".to_string(),
            kind: 27, // Snippet
            detail: "Combinational logic block".to_string(),
            insert_text: "always @(*) begin\n    ${0}\nend\n".to_string(),
            documentation: Some("Level-sensitive combinational procedural block with automatic sensitivity list.".to_string()),
        });

        items.push(CompletionItem {
            label: "case ... endcase".to_string(),
            kind: 27, // Snippet
            detail: "Case statement block".to_string(),
            insert_text: "case (${1:sel})\n    ${2:2'b00}: begin\n        ${3}\n    end\n    default: begin\n        ${0}\n    end\nendcase\n".to_string(),
            documentation: Some("Full multi-way conditional branching statement with default clause.".to_string()),
        });

        items.push(CompletionItem {
            label: "casez ... endcase".to_string(),
            kind: 27, // Snippet
            detail: "Casez statement with don't-care bit support".to_string(),
            insert_text: "casez (${1:sel})\n    ${2:4'b1???}: begin\n        ${3}\n    end\n    default: begin\n        ${0}\n    end\nendcase\n".to_string(),
            documentation: Some("Casez multi-way branch treating ? and z as don't-care matching bits.".to_string()),
        });

        items.push(CompletionItem {
            label: "casex ... endcase".to_string(),
            kind: 27, // Snippet
            detail: "Casex statement with don't-care bit support".to_string(),
            insert_text: "casex (${1:sel})\n    ${2:4'b1xxx}: begin\n        ${3}\n    end\n    default: begin\n        ${0}\n    end\nendcase\n".to_string(),
            documentation: Some("Casex multi-way branch treating x and z as don't-care matching bits.".to_string()),
        });

        items.push(CompletionItem {
            label: "forever begin ... end".to_string(),
            kind: 27, // Snippet
            detail: "Unbounded simulation loop".to_string(),
            insert_text: "forever begin\n    #${1:5} ${2:clk = ~clk};\nend\n".to_string(),
            documentation: Some("Continuous simulation loop typically used for clock generation.".to_string()),
        });

        items.push(CompletionItem {
            label: "repeat (...) begin ... end".to_string(),
            kind: 27, // Snippet
            detail: "Bounded iteration loop".to_string(),
            insert_text: "repeat (${1:count}) begin\n    ${0}\nend\n".to_string(),
            documentation: Some("Executes procedural statements a fixed number of iterations.".to_string()),
        });

        items.push(CompletionItem {
            label: "while (...) begin ... end".to_string(),
            kind: 27, // Snippet
            detail: "Conditional while loop".to_string(),
            insert_text: "while (${1:condition}) begin\n    ${0}\nend\n".to_string(),
            documentation: Some("Procedural while loop executing until condition is false.".to_string()),
        });

        items.push(CompletionItem {
            label: "assign".to_string(),
            kind: 27, // Snippet
            detail: "Continuous assignment".to_string(),
            insert_text: "assign ${1:net_name} = ${2:expression};\n".to_string(),
            documentation: Some("Combinational continuous net driver.".to_string()),
        });

        items.push(CompletionItem {
            label: "testbench template".to_string(),
            kind: 27, // Snippet
            detail: "Self-checking testbench harness".to_string(),
            insert_text: "`timescale 1ns / 1ps\n\nmodule tb_${1:dut};\n    reg clk = 0;\n    reg rst_n = 0;\n\n    always #5 clk = ~clk; // 100MHz\n\n    initial begin\n        #20 rst_n = 1;\n        #200;\n        $finish;\n    end\nendmodule\n".to_string(),
            documentation: Some("Complete self-contained simulation testbench harness with clock oscillator.".to_string()),
        });

        // 2. Xilinx Hardware Primitives
        items.extend(crate::primitives_doc::primitive_completions());

        // 3. Standard Keywords
        let keywords = [
            ("always", "Procedural execution block"),
            ("always_comb", "SystemVerilog combinational block"),
            ("always_ff", "SystemVerilog clocked flip-flop block"),
            ("always_latch", "SystemVerilog latch block"),
            ("and", "Built-in gate primitive"),
            ("assign", "Continuous combinational assignment"),
            ("begin", "Block delimiter start"),
            ("buf", "Non-inverting buffer primitive"),
            ("case", "Multi-way conditional branch"),
            ("casex", "Case ignoring X and Z bits"),
            ("casez", "Case treating Z as don't care"),
            ("default", "Fallback case arm"),
            ("else", "Conditional alternative branch"),
            ("end", "Block delimiter end"),
            ("endcase", "End of case statement"),
            ("endfunction", "End of function declaration"),
            ("endgenerate", "End of generate block"),
            ("endmodule", "End of module declaration"),
            ("endtask", "End of task declaration"),
            ("for", "Loop statement"),
            ("forever", "Unbounded simulation loop"),
            ("function", "Pure combinational function declaration"),
            ("generate", "Elaboration-time generation block"),
            ("if", "Conditional branch statement"),
            ("initial", "Time-zero simulation initialization"),
            ("inout", "Bidirectional bus port"),
            ("input", "Incoming module port"),
            ("integer", "32-bit signed integer variable"),
            ("localparam", "Elaboration local constant"),
            ("logic", "Unified 4-state data type (SystemVerilog)"),
            ("module", "Module declaration keyword"),
            ("nand", "NAND gate primitive"),
            ("negedge", "Falling edge event qualifier"),
            ("nor", "NOR gate primitive"),
            ("not", "Inverter gate primitive"),
            ("or", "OR gate primitive"),
            ("output", "Outgoing module port"),
            ("parameter", "Elaboration configurable parameter"),
            ("posedge", "Rising edge event qualifier"),
            ("reg", "Procedural register variable"),
            ("repeat", "Bounded iteration loop"),
            ("task", "Simulation task declaration"),
            ("while", "Conditional procedural loop"),
            ("wire", "Combinational net connection"),
            ("xnor", "XNOR gate primitive"),
            ("xor", "XOR gate primitive"),
            ("$display", "Console formatting display system task"),
            ("$dumpfile", "Designate VCD waveform dump output file"),
            ("$dumpvars", "Specify hierarchy and signals for VCD trace dump"),
            ("$finish", "Terminate simulation run"),
            ("$stop", "Pause simulation for debugging"),
            ("$time", "Current physical simulation time in ticks"),
        ];

        for (kw, desc) in keywords {
            items.push(CompletionItem {
                label: kw.to_string(),
                kind: 14, // Keyword
                detail: desc.to_string(),
                insert_text: kw.to_string(),
                documentation: Some(format!("Verilog / SystemVerilog Keyword: `{}`", kw)),
            });
        }

        // 3. AST In-Scope Signals & Modules
        let file_id = FileId(1);
        let (ast, _) = parse_hdl(file_id, source);

        for module in &ast.modules {
            // Module name completion
            items.push(CompletionItem {
                label: module.name.clone(),
                kind: 8, // Module
                detail: format!("Module with {} ports", module.ports.len()),
                insert_text: module.name.clone(),
                documentation: Some(format!("Module `{}` defined in active file.", module.name)),
            });

            // Target offset of cursor
            let target_offset = line_col_to_offset(source, line, column);
            let inside_this_module = match target_offset {
                Some(off) => off >= (module.span.start as usize) && off <= (module.span.end as usize),
                None => true,
            };

            if inside_this_module {
                // Ports
                for port in &module.ports {
                    let dir = match port.direction {
                        PortDirection::Input => "input",
                        PortDirection::Output => "output",
                        PortDirection::Inout => "inout",
                    };
                    items.push(CompletionItem {
                        label: port.name.clone(),
                        kind: 6, // Variable
                        detail: format!("Port ({})", dir),
                        insert_text: port.name.clone(),
                        documentation: Some(format!("Module Port `{}` ({})", port.name, dir)),
                    });
                }

                // Parameters
                for param in &module.params {
                    items.push(CompletionItem {
                        label: param.name.clone(),
                        kind: 21, // Constant
                        detail: if param.is_local { "localparam".to_string() } else { "parameter".to_string() },
                        insert_text: param.name.clone(),
                        documentation: Some(format!("Parameter `{}`", param.name)),
                    });
                }

                // Internal Nets
                for item in &module.items {
                    match item {
                        ModuleItem::NetDecl(net) => {
                            let dt_str = match net.data_type {
                                DataType::Wire => "wire",
                                DataType::Reg => "reg",
                                DataType::Logic => "logic",
                                DataType::Integer => "integer",
                                DataType::Genvar => "genvar",
                                DataType::Implicit => "net",
                            };
                            for name in &net.names {
                                items.push(CompletionItem {
                                    label: name.clone(),
                                    kind: 6, // Variable
                                    detail: format!("Internal {}", dt_str),
                                    insert_text: name.clone(),
                                    documentation: Some(format!("Internal net `{}` ({})", name, dt_str)),
                                });
                            }
                        }
                        ModuleItem::ParamDecl(param) => {
                            items.push(CompletionItem {
                                label: param.name.clone(),
                                kind: 21, // Constant
                                detail: if param.is_local { "localparam".to_string() } else { "parameter".to_string() },
                                insert_text: param.name.clone(),
                                documentation: Some(format!("Parameter `{}`", param.name)),
                            });
                        }
                        ModuleItem::Instance(inst) => {
                            items.push(CompletionItem {
                                label: inst.instance_name.clone(),
                                kind: 8, // Module Instance
                                detail: format!("Instance of `{}`", inst.module_name),
                                insert_text: inst.instance_name.clone(),
                                documentation: Some(format!("Instantiated module `{}` as `{}`", inst.module_name, inst.instance_name)),
                            });
                        }
                        _ => {}
                    }
                }
            }
        }

        // 4. Named Module Port Autocompletion in Instantiations
        let target_offset = line_col_to_offset(source, line, column);
        if let Some(off) = target_offset {
            if let Some(ctx) = find_instantiation_context(source, off) {
                let mut port_items = Vec::new();

                // Check user-defined modules in AST
                if let Some(target_mod) = ast.modules.iter().find(|m| m.name == ctx.module_name) {
                    for port in &target_mod.ports {
                        let dir_str = match port.direction {
                            PortDirection::Input => "input",
                            PortDirection::Output => "output",
                            PortDirection::Inout => "inout",
                        };
                        let insert_text = if ctx.has_dot {
                            format!("{}(${{1:{}}})", port.name, port.name)
                        } else {
                            format!(".{}(${{1:{}}})", port.name, port.name)
                        };
                        port_items.push(CompletionItem {
                            label: format!(".{}", port.name),
                            kind: 27, // Snippet
                            detail: format!("Port ({}) of `{}`", dir_str, target_mod.name),
                            insert_text,
                            documentation: Some(format!(
                                "Named port connection to `{}` port `{}` ({})",
                                target_mod.name, port.name, dir_str
                            )),
                        });
                    }

                    // SystemVerilog wildcard .*
                    let sv_star_insert = if ctx.has_dot { "*".to_string() } else { ".*".to_string() };
                    port_items.push(CompletionItem {
                        label: ".*".to_string(),
                        kind: 14, // Keyword
                        detail: "Wildcard Port Connection (SystemVerilog)".to_string(),
                        insert_text: sv_star_insert,
                        documentation: Some(format!(
                            "Connects all identically-named signals to `{}` ports automatically.",
                            target_mod.name
                        )),
                    });
                } else if let Some(prim_ports) = crate::primitives_doc::primitive_ports(ctx.module_name) {
                    for (port_name, dir_str) in prim_ports {
                        let insert_text = if ctx.has_dot {
                            format!("{}(${{1:{}}})", port_name, port_name.to_ascii_lowercase())
                        } else {
                            format!(".{}(${{1:{}}})", port_name, port_name.to_ascii_lowercase())
                        };
                        port_items.push(CompletionItem {
                            label: format!(".{}", port_name),
                            kind: 27, // Snippet
                            detail: format!("Primitive Port ({}) of `{}`", dir_str, ctx.module_name),
                            insert_text,
                            documentation: Some(format!(
                                "Named connection to Xilinx primitive `{}` port `{}` ({})",
                                ctx.module_name, port_name, dir_str
                            )),
                        });
                    }
                }

                if !port_items.is_empty() {
                    items.splice(0..0, port_items);
                }
            }
        }

        // Deduplicate items by label
        let mut seen = std::collections::HashSet::new();
        items.retain(|item| seen.insert(item.label.clone()));

        items
    }
}

struct InstantiationContext<'a> {
    pub module_name: &'a str,
    pub has_dot: bool,
}

fn find_instantiation_context<'a>(source: &'a str, target_offset: usize) -> Option<InstantiationContext<'a>> {
    let prefix = &source[..target_offset.min(source.len())];
    let bytes = prefix.as_bytes();
    let mut i = bytes.len();

    // Skip trailing identifier characters being typed
    while i > 0 && (bytes[i - 1].is_ascii_alphanumeric() || bytes[i - 1] == b'_' || bytes[i - 1] == b'$') {
        i -= 1;
    }

    // Check if preceded by '.'
    let has_dot = i > 0 && bytes[i - 1] == b'.';

    // Scan backwards to find matching unclosed '('
    let mut depth = 0;
    let mut scan = if has_dot { i - 1 } else { i };
    let mut open_paren_idx = None;

    while scan > 0 {
        scan -= 1;
        let b = bytes[scan];
        if b == b')' {
            depth += 1;
        } else if b == b'(' {
            if depth == 0 {
                open_paren_idx = Some(scan);
                break;
            } else {
                depth -= 1;
            }
        } else if b == b';' {
            return None;
        }
    }

    let paren_idx = open_paren_idx?;
    let before_paren = prefix[..paren_idx].trim_end();
    let p_bytes = before_paren.as_bytes();
    let mut p_len = p_bytes.len();

    // Extract instance name (token right before '(')
    let inst_end = p_len;
    while p_len > 0 && (p_bytes[p_len - 1].is_ascii_alphanumeric() || p_bytes[p_len - 1] == b'_') {
        p_len -= 1;
    }
    let inst_start = p_len;
    if inst_start == inst_end {
        return None;
    }

    let before_inst = before_paren[..inst_start].trim_end();

    // If before_inst ends with ')', it could be a parameter list: ModuleName #( ... )
    let before_inst = if before_inst.ends_with(')') {
        let mut p_depth = 0;
        let b_bytes = before_inst.as_bytes();
        let mut b_scan = b_bytes.len();
        let mut hash_idx = None;
        while b_scan > 0 {
            b_scan -= 1;
            if b_bytes[b_scan] == b')' {
                p_depth += 1;
            } else if b_bytes[b_scan] == b'(' {
                p_depth -= 1;
                if p_depth == 0 {
                    let before_op = before_inst[..b_scan].trim_end();
                    if before_op.ends_with('#') {
                        hash_idx = Some(before_op.len() - 1);
                        break;
                    }
                }
            }
        }
        if let Some(h_idx) = hash_idx {
            before_inst[..h_idx].trim_end()
        } else {
            before_inst
        }
    } else {
        before_inst
    };

    // Extract module name (token before instance name or before '#')
    let mod_bytes = before_inst.as_bytes();
    let mut m_len = mod_bytes.len();
    let mod_end = m_len;
    while m_len > 0 && (mod_bytes[m_len - 1].is_ascii_alphanumeric() || mod_bytes[m_len - 1] == b'_') {
        m_len -= 1;
    }
    let mod_start = m_len;
    if mod_start == mod_end {
        return None;
    }
    let module_name = &before_inst[mod_start..mod_end];

    // Exclude control-flow / procedural keywords
    let is_keyword = matches!(
        module_name,
        "if" | "else" | "case" | "casex" | "casez" | "for" | "forever" | "repeat" | "while"
            | "initial" | "always" | "always_comb" | "always_ff" | "always_latch"
            | "function" | "task" | "begin" | "end" | "assert" | "cover" | "assume"
            | "module" | "endmodule" | "generate" | "endgenerate"
    );
    if is_keyword {
        return None;
    }

    Some(InstantiationContext {
        module_name,
        has_dot,
    })
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
