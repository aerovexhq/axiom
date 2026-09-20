use super::types::*;

pub struct LayoutEngine;

impl LayoutEngine {
    pub fn layout_graph(
        top_name: &str,
        mut blocks: Vec<MacroBlock>,
    ) -> MicroarchGraph {
        let mut buses = Vec::new();
        let mut control_wires = Vec::new();

        // 1. Partition blocks into Control Row (top) and Datapath Row (bottom)
        let mut control_blocks = Vec::new();
        let mut datapath_blocks = Vec::new();

        for block in blocks.drain(..) {
            if block.category == MacroCategory::Control {
                control_blocks.push(block);
            } else {
                datapath_blocks.push(block);
            }
        }

        // Layout Control Row: Y = 50
        let mut curr_x = 50.0;
        for block in &mut control_blocks {
            block.x = curr_x;
            block.y = 50.0;
            curr_x += block.width + 60.0;
        }

        // Layout Datapath Row: Y = 220
        let mut curr_dp_x = 50.0;
        for block in &mut datapath_blocks {
            block.x = curr_dp_x;
            block.y = 220.0;
            curr_dp_x += block.width + 60.0;
        }

        let mut all_blocks = control_blocks;
        all_blocks.extend(datapath_blocks);

        // 2. Synthesize Buses and Control Wires by matching output ports to downstream input ports
        let block_refs = all_blocks.clone();
        for src in &block_refs {
            for out_port in &src.outputs {
                for dst in &block_refs {
                    if src.id == dst.id {
                        continue;
                    }
                    for in_port in &dst.inputs {
                        if Self::ports_match(&out_port.name, &in_port.name) {
                            let src_x = src.x + out_port.offset_x;
                            let src_y = src.y + out_port.offset_y;
                            let dst_x = dst.x + in_port.offset_x;
                            let dst_y = dst.y + in_port.offset_y;

                            let mid_x = (src_x + dst_x) / 2.0;
                            let wire_points = vec![
                                (src_x, src_y),
                                (mid_x, src_y),
                                (mid_x, dst_y),
                                (dst_x, dst_y),
                            ];

                            if out_port.width > 1 || out_port.is_datapath {
                                buses.push(MicroarchBus {
                                    id: format!("bus_{}_{}", src.name, out_port.name),
                                    name: out_port.name.clone(),
                                    source_node: src.id.clone(),
                                    source_port: out_port.id.clone(),
                                    target_node: dst.id.clone(),
                                    target_port: in_port.id.clone(),
                                    width: out_port.width,
                                    is_datapath: true,
                                    wire_points,
                                    initial_value_hex: "0x00000000".to_string(),
                                });
                            } else {
                                control_wires.push(MicroarchControlWire {
                                    id: format!("wire_{}_{}", src.name, out_port.name),
                                    name: out_port.name.clone(),
                                    source_node: src.id.clone(),
                                    source_port: out_port.id.clone(),
                                    target_node: dst.id.clone(),
                                    target_port: in_port.id.clone(),
                                    signal_type: if out_port.is_clock {
                                        "Clock".to_string()
                                    } else if out_port.is_reset {
                                        "Reset".to_string()
                                    } else {
                                        "Control".to_string()
                                    },
                                    wire_points,
                                });
                            }
                        }
                    }
                }
            }
        }

        // 3. Compute Graph Bounds
        let max_x = curr_x.max(curr_dp_x) + 100.0;
        let bounds = GraphBounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x,
            max_y: 420.0,
            width: max_x,
            height: 420.0,
        };

        MicroarchGraph {
            top_module: top_name.to_string(),
            blocks: all_blocks,
            buses,
            control_wires,
            bounds,
        }
    }

    fn ports_match(out_name: &str, in_name: &str) -> bool {
        let clean_out = out_name.split('[').next().unwrap_or(out_name).trim();
        let clean_in = in_name.split('[').next().unwrap_or(in_name).trim();

        if clean_out == clean_in {
            return true;
        }

        // Substring matching: e.g. "instr" matches "instr[31:0]"
        if clean_out.contains(clean_in) || clean_in.contains(clean_out) {
            return true;
        }

        // Domain specific bindings
        if (clean_out == "pc" && clean_in.contains("pc")) ||
           (clean_out == "next_alu" && clean_in == "rd") ||
           (clean_out == "src_a" && clean_in.contains("a")) ||
           (clean_out == "src_b" && clean_in.contains("b")) ||
           (clean_out.contains("dout") && clean_in.contains("din")) ||
           (clean_out.contains("dout") && (clean_in == "A" || clean_in == "B")) {
            return true;
        }

        false
    }
}
