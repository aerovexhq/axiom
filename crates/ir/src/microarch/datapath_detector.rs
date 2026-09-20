use super::types::*;
use crate::bir::{BirCircuit, PrimitiveKind};
use axiom_syntax::ast::*;

pub struct DatapathDetector;

impl DatapathDetector {
    pub fn detect_datapath_elements(module: &ModuleDef, circuit: &BirCircuit) -> Vec<MacroBlock> {
        let mut blocks = Vec::new();

        // 1. Check for Instruction Decoder (e.g. RISC-V)
        if Self::has_instruction_decode(module) {
            let decoder_macro = DecoderMacro {
                name: "u_decoder".to_string(),
                input_bus: "instr[31:0]".to_string(),
                fields: vec![
                    DecoderField { name: "opcode".to_string(), range_str: "instr[6:0]".to_string(), width: 7 },
                    DecoderField { name: "rd".to_string(), range_str: "instr[11:7]".to_string(), width: 5 },
                    DecoderField { name: "funct3".to_string(), range_str: "instr[14:12]".to_string(), width: 3 },
                    DecoderField { name: "rs1".to_string(), range_str: "instr[19:15]".to_string(), width: 5 },
                    DecoderField { name: "rs2".to_string(), range_str: "instr[24:20]".to_string(), width: 5 },
                    DecoderField { name: "imm_i".to_string(), range_str: "sign_ext(instr[31:20])".to_string(), width: 32 },
                ],
            };

            let ports = vec![
                MacroPort {
                    id: "dec_in_instr".to_string(),
                    name: "instr[31:0]".to_string(),
                    width: 32,
                    direction: MacroPortDirection::In,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: true,
                    offset_x: 0.0,
                    offset_y: 50.0,
                },
                MacroPort {
                    id: "dec_out_opcode".to_string(),
                    name: "opcode[6:0]".to_string(),
                    width: 7,
                    direction: MacroPortDirection::Out,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 160.0,
                    offset_y: 20.0,
                },
                MacroPort {
                    id: "dec_out_rd".to_string(),
                    name: "rd[4:0]".to_string(),
                    width: 5,
                    direction: MacroPortDirection::Out,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 160.0,
                    offset_y: 40.0,
                },
                MacroPort {
                    id: "dec_out_rs".to_string(),
                    name: "rs1/rs2[4:0]".to_string(),
                    width: 5,
                    direction: MacroPortDirection::Out,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 160.0,
                    offset_y: 60.0,
                },
                MacroPort {
                    id: "dec_out_imm".to_string(),
                    name: "imm_i[31:0]".to_string(),
                    width: 32,
                    direction: MacroPortDirection::Out,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: true,
                    offset_x: 160.0,
                    offset_y: 80.0,
                },
            ];

            blocks.push(MacroBlock {
                id: "dec_block_rv32".to_string(),
                name: "u_decoder".to_string(),
                label: "RISC-V Instruction Decoder".to_string(),
                sublabel: "Field Splitter & Immediate Generator".to_string(),
                category: MacroCategory::Control,
                kind: MacroKind::Decoder(decoder_macro),
                inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                x: 0.0,
                y: 0.0,
                width: 165.0,
                height: 105.0,
                clock_domain: None,
                latency_cycles: 0,
                source_line: None,
            });
        }

        // 2. Check for Instruction ROM / Embedded Program
        if module.name.contains("riscv") {
            blocks.push(MacroBlock {
                id: "rom_block_instr".to_string(),
                name: "instr_rom".to_string(),
                label: "Instruction Memory (ROM)".to_string(),
                sublabel: "8-Word Embedded RV32I Program".to_string(),
                category: MacroCategory::Memory,
                kind: MacroKind::Generic(GenericMacro {
                    name: "instr_rom".to_string(),
                    description: "32-bit asynchronous instruction lookup table".to_string(),
                }),
                inputs: vec![
                    MacroPort {
                        id: "rom_addr".to_string(),
                        name: "pc[4:2]".to_string(),
                        width: 3,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 35.0,
                    },
                ],
                outputs: vec![
                    MacroPort {
                        id: "rom_data".to_string(),
                        name: "instr[31:0]".to_string(),
                        width: 32,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 160.0,
                        offset_y: 35.0,
                    },
                ],
                x: 0.0,
                y: 0.0,
                width: 165.0,
                height: 80.0,
                clock_domain: None,
                latency_cycles: 0,
                source_line: None,
            });
        }

        // 3. Scan for Program Counter (PC), Accumulator, or Counter registers
        for (idx, item) in module.items.iter().enumerate() {
            if let ModuleItem::ProceduralBlock(proc) = item {
                if let Some(macro_block) = Self::analyze_datapath_reg(proc, idx) {
                    blocks.push(macro_block);
                }
            }
        }

        // 4. Check for Xilinx DSP48E2 Multiplier-Accumulator slice
        for inst in &circuit.primitive_instances {
            if inst.primitive_kind == PrimitiveKind::Dsp48e2 || inst.primitive_kind == PrimitiveKind::Dsp48e1 {
                let ports = vec![
                    MacroPort {
                        id: "dsp_clk".to_string(),
                        name: "CLK".to_string(),
                        width: 1,
                        direction: MacroPortDirection::In,
                        is_clock: true,
                        is_reset: false,
                        is_datapath: false,
                        offset_x: 20.0,
                        offset_y: 110.0,
                    },
                    MacroPort {
                        id: "dsp_a".to_string(),
                        name: "A[29:0]".to_string(),
                        width: 30,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 30.0,
                    },
                    MacroPort {
                        id: "dsp_b".to_string(),
                        name: "B[17:0]".to_string(),
                        width: 18,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 60.0,
                    },
                    MacroPort {
                        id: "dsp_c".to_string(),
                        name: "C[47:0]".to_string(),
                        width: 48,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 90.0,
                    },
                    MacroPort {
                        id: "dsp_p".to_string(),
                        name: "P[47:0]".to_string(),
                        width: 48,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 180.0,
                        offset_y: 50.0,
                    },
                ];

                blocks.push(MacroBlock {
                    id: format!("dsp_{}", inst.name),
                    name: inst.name.clone(),
                    label: "DSP48E2 MAC Engine".to_string(),
                    sublabel: "27×18 Multiplier & 48-bit Accumulator".to_string(),
                    category: MacroCategory::Datapath,
                    kind: MacroKind::Primitive(PrimitiveMacro {
                        name: inst.name.clone(),
                        prim_type: "DSP48E2".to_string(),
                        description: "High-performance UltraScale+ DSP Slice".to_string(),
                    }),
                    inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                    outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                    x: 0.0,
                    y: 0.0,
                    width: 185.0,
                    height: 120.0,
                    clock_domain: Some("clk_g".to_string()),
                    latency_cycles: 2,
                    source_line: None,
                });
            }
        }

        blocks
    }

    fn has_instruction_decode(module: &ModuleDef) -> bool {
        for item in &module.items {
            if let ModuleItem::NetDecl(decl) = item {
                for name in &decl.names {
                    if name == "opcode" || name == "funct3" || name == "imm_i" {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn analyze_datapath_reg(proc: &ProceduralBlock, idx: usize) -> Option<MacroBlock> {
        let mut pc_target = None;
        let mut accum_target = None;
        let mut counter_target = None;

        Self::scan_stmt(&proc.body, &mut |target, rhs| {
            let rhs_str = Self::expr_to_string(rhs);
            if target == "pc" && rhs_str.contains("pc +") {
                pc_target = Some(target.to_string());
            } else if target.contains("accum") && rhs_str.contains("+") {
                accum_target = Some(target.to_string());
            } else if (target.contains("count") || target.contains("cnt")) && rhs_str.contains("+") {
                counter_target = Some(target.to_string());
            }
        });

        if let Some(pc) = pc_target {
            return Some(MacroBlock {
                id: format!("pc_reg_{}", idx),
                name: pc.clone(),
                label: "Program Counter (PC)".to_string(),
                sublabel: "32-bit Sequencer (+4 Step)".to_string(),
                category: MacroCategory::Datapath,
                kind: MacroKind::DatapathReg(DatapathRegMacro {
                    name: pc,
                    width: 32,
                    reg_type: "PC".to_string(),
                    step_behavior: "pc <= pc + 4".to_string(),
                    clock_signal: "clk".to_string(),
                    reset_signal: Some("rst_n".to_string()),
                    enable_signal: Some("step_en".to_string()),
                }),
                inputs: vec![
                    MacroPort {
                        id: "pc_clk".to_string(),
                        name: "clk".to_string(),
                        width: 1,
                        direction: MacroPortDirection::In,
                        is_clock: true,
                        is_reset: false,
                        is_datapath: false,
                        offset_x: 20.0,
                        offset_y: 80.0,
                    },
                    MacroPort {
                        id: "pc_step".to_string(),
                        name: "step_en".to_string(),
                        width: 1,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: false,
                        offset_x: 0.0,
                        offset_y: 40.0,
                    },
                ],
                outputs: vec![
                    MacroPort {
                        id: "pc_out".to_string(),
                        name: "pc[31:0]".to_string(),
                        width: 32,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 160.0,
                        offset_y: 40.0,
                    },
                ],
                x: 0.0,
                y: 0.0,
                width: 165.0,
                height: 85.0,
                clock_domain: Some("clk".to_string()),
                latency_cycles: 1,
                source_line: None,
            });
        }

        if let Some(accum) = accum_target {
            return Some(MacroBlock {
                id: format!("accum_reg_{}", idx),
                name: accum.clone(),
                label: "16-bit Accumulator Datapath".to_string(),
                sublabel: "Synchronous Sum Accumulator".to_string(),
                category: MacroCategory::Datapath,
                kind: MacroKind::DatapathReg(DatapathRegMacro {
                    name: accum,
                    width: 16,
                    reg_type: "Accumulator".to_string(),
                    step_behavior: "accum <= accum + data_in".to_string(),
                    clock_signal: "divided_clk".to_string(),
                    reset_signal: Some("sys_rst_n".to_string()),
                    enable_signal: None,
                }),
                inputs: vec![
                    MacroPort {
                        id: "accum_in".to_string(),
                        name: "data_in[7:0]".to_string(),
                        width: 8,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 40.0,
                    },
                ],
                outputs: vec![
                    MacroPort {
                        id: "accum_out".to_string(),
                        name: "accum_out[15:0]".to_string(),
                        width: 16,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 160.0,
                        offset_y: 40.0,
                    },
                ],
                x: 0.0,
                y: 0.0,
                width: 170.0,
                height: 85.0,
                clock_domain: Some("divided_clk".to_string()),
                latency_cycles: 1,
                source_line: None,
            });
        }

        if let Some(cnt) = counter_target {
            return Some(MacroBlock {
                id: format!("counter_reg_{}", idx),
                name: cnt.clone(),
                label: format!("Synchronous Counter ({})", cnt),
                sublabel: "Up/Down Datapath Register".to_string(),
                category: MacroCategory::Datapath,
                kind: MacroKind::DatapathReg(DatapathRegMacro {
                    name: cnt,
                    width: 8,
                    reg_type: "Counter".to_string(),
                    step_behavior: "count <= count ± 1".to_string(),
                    clock_signal: "clk".to_string(),
                    reset_signal: Some("rst_n".to_string()),
                    enable_signal: Some("enable".to_string()),
                }),
                inputs: vec![
                    MacroPort {
                        id: "cnt_en".to_string(),
                        name: "enable".to_string(),
                        width: 1,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: false,
                        offset_x: 0.0,
                        offset_y: 40.0,
                    },
                ],
                outputs: vec![
                    MacroPort {
                        id: "cnt_out".to_string(),
                        name: "count[7:0]".to_string(),
                        width: 8,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 160.0,
                        offset_y: 40.0,
                    },
                ],
                x: 0.0,
                y: 0.0,
                width: 170.0,
                height: 85.0,
                clock_domain: Some("clk".to_string()),
                latency_cycles: 1,
                source_line: None,
            });
        }

        None
    }

    fn scan_stmt<F>(stmt: &Statement, cb: &mut F)
    where
        F: FnMut(&str, &Expr),
    {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::scan_stmt(s, cb);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    cb(name, rhs);
                }
            }
            Statement::If { then_branch, else_branch, .. } => {
                Self::scan_stmt(then_branch, cb);
                if let Some(else_b) = else_branch {
                    Self::scan_stmt(else_b, cb);
                }
            }
            _ => {}
        }
    }

    fn expr_to_string(expr: &Expr) -> String {
        match expr {
            Expr::Ident(n, _) => n.clone(),
            Expr::Binary { op, lhs, rhs, .. } => {
                let op_s = match op {
                    BinaryOp::Add => "+",
                    BinaryOp::Sub => "-",
                    _ => "op",
                };
                format!("{} {} {}", Self::expr_to_string(lhs), op_s, Self::expr_to_string(rhs))
            }
            Expr::Number(n, _) => format!("{}", n.to_u64().unwrap_or(0)),
            Expr::UnsizedInt(v, _) => format!("{}", v),
            _ => "expr".to_string(),
        }
    }
}
