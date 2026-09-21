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
            ("task", "Simulation task declaration"),
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

        // Deduplicate items by label
        let mut seen = std::collections::HashSet::new();
        items.retain(|item| seen.insert(item.label.clone()));

        items
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
