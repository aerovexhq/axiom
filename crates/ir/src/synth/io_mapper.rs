use crate::bir::PrimitiveKind;
use crate::synth::types::{SynthesizedCell, SynthesizedPort};
use hashbrown::HashMap;

/// Maps primary circuit ports to physical I/O pads and clock buffers (IBUF, OBUF, BUFG).
pub struct IoMapper;

pub struct MappedIoResult {
    pub cells: Vec<SynthesizedCell>,
    pub input_wire_renames: HashMap<String, String>, // external_name -> internal_net_name
    pub output_wire_renames: HashMap<String, String>,
}

impl IoMapper {
    pub fn map_ports(ports: &[SynthesizedPort]) -> MappedIoResult {
        let mut cells = Vec::new();
        let mut input_wire_renames = HashMap::new();
        let mut output_wire_renames = HashMap::new();

        for port in ports {
            let width = port.width.max(1);

            match port.direction {
                axiom_syntax::PortDirection::Input => {
                    if port.is_clock {
                        // Clock input: IBUF -> BUFG -> internal_clk
                        let ibuf_net = format!("{}_ibuf", port.name);
                        let bufg_net = format!("{}_bufg", port.name);

                        let mut ibuf_ports = HashMap::new();
                        ibuf_ports.insert("I".to_string(), port.name.clone());
                        ibuf_ports.insert("O".to_string(), ibuf_net.clone());

                        cells.push(SynthesizedCell {
                            id: format!("cell_ibuf_{}", port.name),
                            name: format!("ibuf_{}", port.name),
                            kind: PrimitiveKind::Ibuf,
                            scope: "top".to_string(),
                            ports: ibuf_ports,
                            params: HashMap::new(),
                            equation: None,
                            source_line: None,
                            delay_ps: 350.0,
                        });

                        let mut bufg_ports = HashMap::new();
                        bufg_ports.insert("I".to_string(), ibuf_net);
                        bufg_ports.insert("O".to_string(), bufg_net.clone());

                        cells.push(SynthesizedCell {
                            id: format!("cell_bufg_{}", port.name),
                            name: format!("bufg_{}", port.name),
                            kind: PrimitiveKind::Bufg,
                            scope: "top".to_string(),
                            ports: bufg_ports,
                            params: HashMap::new(),
                            equation: None,
                            source_line: None,
                            delay_ps: 90.0,
                        });

                        input_wire_renames.insert(port.name.clone(), bufg_net);
                    } else if width == 1 {
                        let internal_net = format!("{}_ibuf", port.name);
                        let mut ibuf_ports = HashMap::new();
                        ibuf_ports.insert("I".to_string(), port.name.clone());
                        ibuf_ports.insert("O".to_string(), internal_net.clone());

                        cells.push(SynthesizedCell {
                            id: format!("cell_ibuf_{}", port.name),
                            name: format!("ibuf_{}", port.name),
                            kind: PrimitiveKind::Ibuf,
                            scope: "top".to_string(),
                            ports: ibuf_ports,
                            params: HashMap::new(),
                            equation: None,
                            source_line: None,
                            delay_ps: 350.0,
                        });

                        input_wire_renames.insert(port.name.clone(), internal_net);
                    } else {
                        for bit in 0..width {
                            let ext_pin = format!("{}[{bit}]", port.name);
                            let internal_net = format!("{}_ibuf[{bit}]", port.name);
                            let mut ibuf_ports = HashMap::new();
                            ibuf_ports.insert("I".to_string(), ext_pin.clone());
                            ibuf_ports.insert("O".to_string(), internal_net.clone());

                            cells.push(SynthesizedCell {
                                id: format!("cell_ibuf_{}_{bit}", port.name),
                                name: format!("ibuf_{}_{bit}", port.name),
                                kind: PrimitiveKind::Ibuf,
                                scope: "top".to_string(),
                                ports: ibuf_ports,
                                params: HashMap::new(),
                                equation: None,
                                source_line: None,
                                delay_ps: 350.0,
                            });
                        }
                        input_wire_renames.insert(port.name.clone(), format!("{}_ibuf", port.name));
                    }
                }
                axiom_syntax::PortDirection::Output => {
                    if width == 1 {
                        let internal_net = format!("{}_obuf", port.name);
                        let mut obuf_ports = HashMap::new();
                        obuf_ports.insert("I".to_string(), internal_net.clone());
                        obuf_ports.insert("O".to_string(), port.name.clone());

                        cells.push(SynthesizedCell {
                            id: format!("cell_obuf_{}", port.name),
                            name: format!("obuf_{}", port.name),
                            kind: PrimitiveKind::Obuf,
                            scope: "top".to_string(),
                            ports: obuf_ports,
                            params: HashMap::new(),
                            equation: None,
                            source_line: None,
                            delay_ps: 650.0,
                        });

                        output_wire_renames.insert(port.name.clone(), internal_net);
                    } else {
                        for bit in 0..width {
                            let ext_pin = format!("{}[{bit}]", port.name);
                            let internal_net = format!("{}_obuf[{bit}]", port.name);
                            let mut obuf_ports = HashMap::new();
                            obuf_ports.insert("I".to_string(), internal_net.clone());
                            obuf_ports.insert("O".to_string(), ext_pin.clone());

                            cells.push(SynthesizedCell {
                                id: format!("cell_obuf_{}_{bit}", port.name),
                                name: format!("obuf_{}_{bit}", port.name),
                                kind: PrimitiveKind::Obuf,
                                scope: "top".to_string(),
                                ports: obuf_ports,
                                params: HashMap::new(),
                                equation: None,
                                source_line: None,
                                delay_ps: 650.0,
                            });
                        }
                        output_wire_renames.insert(port.name.clone(), format!("{}_obuf", port.name));
                    }
                }
                axiom_syntax::PortDirection::Inout => {
                    // InOut treated as IBUF for now
                    input_wire_renames.insert(port.name.clone(), port.name.clone());
                }
            }
        }

        MappedIoResult {
            cells,
            input_wire_renames,
            output_wire_renames,
        }
    }
}
