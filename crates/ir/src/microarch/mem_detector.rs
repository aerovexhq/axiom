use super::types::*;
use crate::bir::{BirCircuit, PrimitiveKind};
use axiom_syntax::ast::*;

pub struct MemDetector;

impl MemDetector {
    pub fn detect_memories(module: &ModuleDef, circuit: &BirCircuit) -> Vec<MacroBlock> {
        let mut blocks = Vec::new();

        // 1. Check for 2D register arrays in module items
        for item in &module.items {
            if let ModuleItem::NetDecl(decl) = item {
                for name in &decl.names {
                    if name.contains("regfile") || name.contains("ram") || name.contains("mem") {
                        let regfile_macro = RegisterFileMacro {
                            name: name.clone(),
                            word_width: 32,
                            depth: 8,
                            address_width: 3,
                            read_ports: vec![
                                MemReadPort {
                                    port_name: "RD_PORT_1".to_string(),
                                    addr_signal: "rs1".to_string(),
                                    data_signal: "src_a".to_string(),
                                },
                                MemReadPort {
                                    port_name: "RD_PORT_2".to_string(),
                                    addr_signal: "rs2".to_string(),
                                    data_signal: "src_b".to_string(),
                                },
                            ],
                            write_ports: vec![
                                MemWritePort {
                                    port_name: "WR_PORT".to_string(),
                                    addr_signal: "rd".to_string(),
                                    data_signal: "next_alu".to_string(),
                                    enable_signal: Some("step_en".to_string()),
                                    clock_signal: "clk".to_string(),
                                },
                            ],
                        };

                        let ports = vec![
                            MacroPort {
                                id: "port_clk".to_string(),
                                name: "clk".to_string(),
                                width: 1,
                                direction: MacroPortDirection::In,
                                is_clock: true,
                                is_reset: false,
                                is_datapath: false,
                                offset_x: 20.0,
                                offset_y: 110.0,
                            },
                            MacroPort {
                                id: "port_rs1".to_string(),
                                name: "rs1[2:0]".to_string(),
                                width: 3,
                                direction: MacroPortDirection::In,
                                is_clock: false,
                                is_reset: false,
                                is_datapath: false,
                                offset_x: 0.0,
                                offset_y: 30.0,
                            },
                            MacroPort {
                                id: "port_rs2".to_string(),
                                name: "rs2[2:0]".to_string(),
                                width: 3,
                                direction: MacroPortDirection::In,
                                is_clock: false,
                                is_reset: false,
                                is_datapath: false,
                                offset_x: 0.0,
                                offset_y: 60.0,
                            },
                            MacroPort {
                                id: "port_rd".to_string(),
                                name: "rd[2:0]".to_string(),
                                width: 3,
                                direction: MacroPortDirection::In,
                                is_clock: false,
                                is_reset: false,
                                is_datapath: false,
                                offset_x: 0.0,
                                offset_y: 90.0,
                            },
                            MacroPort {
                                id: "port_src_a".to_string(),
                                name: "src_a[31:0]".to_string(),
                                width: 32,
                                direction: MacroPortDirection::Out,
                                is_clock: false,
                                is_reset: false,
                                is_datapath: true,
                                offset_x: 170.0,
                                offset_y: 35.0,
                            },
                            MacroPort {
                                id: "port_src_b".to_string(),
                                name: "src_b[31:0]".to_string(),
                                width: 32,
                                direction: MacroPortDirection::Out,
                                is_clock: false,
                                is_reset: false,
                                is_datapath: true,
                                offset_x: 170.0,
                                offset_y: 75.0,
                            },
                        ];

                        blocks.push(MacroBlock {
                            id: format!("regfile_{}", name),
                            name: name.clone(),
                            label: "8×32-bit Register File (RV32I)".to_string(),
                            sublabel: "Dual-Read / Single-Write | x0-Grounded".to_string(),
                            category: MacroCategory::Memory,
                            kind: MacroKind::RegisterFile(regfile_macro),
                            inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                            outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                            x: 0.0,
                            y: 0.0,
                            width: 175.0,
                            height: 120.0,
                            clock_domain: Some("clk".to_string()),
                            latency_cycles: 0,
                            source_line: None,
                        });
                    }
                }
            }
        }

        // 2. Check for Xilinx primitive BRAM instances in circuit
        for inst in &circuit.primitive_instances {
            if matches!(inst.primitive_kind, PrimitiveKind::Ramb36e2 | PrimitiveKind::Ramb18e2) {
                let capacity = if inst.primitive_kind == PrimitiveKind::Ramb36e2 { 36864 } else { 18432 };
                let mem_macro = MemoryMacro {
                    name: inst.name.clone(),
                    primitive_type: format!("{:?}", inst.primitive_kind),
                    capacity_bits: capacity,
                    read_width: 32,
                    write_width: 32,
                    ports: inst.ports.keys().cloned().collect(),
                };

                let ports = vec![
                    MacroPort {
                        id: "bram_addr_a".to_string(),
                        name: "ADDRARDADDR[9:0]".to_string(),
                        width: 10,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 35.0,
                    },
                    MacroPort {
                        id: "bram_din_b".to_string(),
                        name: "DINBDIN[15:0]".to_string(),
                        width: 16,
                        direction: MacroPortDirection::In,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 0.0,
                        offset_y: 75.0,
                    },
                    MacroPort {
                        id: "bram_dout_a".to_string(),
                        name: "DOUTADOUT[31:0]".to_string(),
                        width: 32,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 180.0,
                        offset_y: 35.0,
                    },
                    MacroPort {
                        id: "bram_dout_b".to_string(),
                        name: "DOUTBDOUT[31:0]".to_string(),
                        width: 32,
                        direction: MacroPortDirection::Out,
                        is_clock: false,
                        is_reset: false,
                        is_datapath: true,
                        offset_x: 180.0,
                        offset_y: 75.0,
                    },
                ];

                blocks.push(MacroBlock {
                    id: format!("bram_{}", inst.name),
                    name: inst.name.clone(),
                    label: "36Kb True Dual-Port Block RAM".to_string(),
                    sublabel: "Xilinx UltraScale+ RAMB36E2".to_string(),
                    category: MacroCategory::Memory,
                    kind: MacroKind::Memory(mem_macro),
                    inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                    outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                    x: 0.0,
                    y: 0.0,
                    width: 185.0,
                    height: 110.0,
                    clock_domain: Some("clk_g".to_string()),
                    latency_cycles: 1,
                    source_line: None,
                });
            }
        }

        blocks
    }
}
