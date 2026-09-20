use crate::synth::types::SynthesizedCircuit;
use axiom_syntax::PortDirection;

/// Generates IEEE 1364 compliant structural Verilog gate-level netlists.
pub struct VerilogNetlistGenerator;

impl VerilogNetlistGenerator {
    pub fn generate(circuit: &SynthesizedCircuit) -> String {
        let mut out = String::new();

        out.push_str("// ==========================================================================\n");
        out.push_str("// Axiom EDA — Synthesized Gate-Level Structural Netlist\n");
        out.push_str(&format!("// Top Module:   {}\n", circuit.top_module));
        out.push_str(&format!("// Target Part:  {}\n", circuit.target_device));
        out.push_str(&format!("// Family:       {}\n", circuit.target_family.display_name()));
        out.push_str(&format!(
            "// Total Cells:  {} ({} LUTs, {} FFs, {} Carries, {} IOBs)\n",
            circuit.stats.total_cells,
            circuit.stats.total_luts,
            circuit.stats.total_ffs,
            circuit.stats.total_carries,
            circuit.stats.total_iobs
        ));
        out.push_str("// ==========================================================================\n\n");
        out.push_str("`timescale 1ps/1ps\n\n");

        // Module Header
        out.push_str(&format!("module {} (\n", circuit.top_module));
        let num_ports = circuit.ports.len();
        for (i, port) in circuit.ports.iter().enumerate() {
            let comma = if i + 1 < num_ports { "," } else { "" };
            let dir = match port.direction {
                PortDirection::Input => "input ",
                PortDirection::Output => "output",
                PortDirection::Inout => "inout ",
            };
            if port.width > 1 {
                out.push_str(&format!("    {} [{}:0] {}{}\n", dir, port.width - 1, port.name, comma));
            } else {
                out.push_str(&format!("    {} {}{}\n", dir, port.name, comma));
            }
        }
        out.push_str(");\n\n");

        // Internal Wires
        out.push_str("    // --- Internal Interconnect Wires ---\n");
        for net in &circuit.nets {
            // Only declare if not already a primary port
            if !circuit.ports.iter().any(|p| p.name == net.name) {
                if net.width > 1 {
                    out.push_str(&format!("    wire [{}:0] {};\n", net.width - 1, net.name));
                } else {
                    out.push_str(&format!("    wire {};\n", net.name));
                }
            }
        }
        out.push('\n');

        // Primitive Cell Instantiations
        out.push_str("    // --- Physical FPGA Primitive Cell Instantiations ---\n");
        for cell in &circuit.cells {
            let prim_name = format!("{:?}", cell.kind).to_ascii_uppercase();

            if let Some(equation) = &cell.equation {
                out.push_str(&format!("    // Boolean Equation: {equation}\n"));
            }

            // Parameters (e.g. #(.INIT(64'h...)))
            if !cell.params.is_empty() {
                let mut param_strs = Vec::new();
                for (pname, pval) in &cell.params {
                    let hex_width = match cell.kind {
                        crate::bir::PrimitiveKind::Lut6 | crate::bir::PrimitiveKind::Lut6_2 => 64,
                        crate::bir::PrimitiveKind::Lut5 => 32,
                        crate::bir::PrimitiveKind::Lut4 => 16,
                        crate::bir::PrimitiveKind::Lut3 => 8,
                        crate::bir::PrimitiveKind::Lut2 => 4,
                        crate::bir::PrimitiveKind::Lut1 => 2,
                        _ => 32,
                    };
                    param_strs.push(format!(".{pname}({hex_width}'h{pval:X})"));
                }
                out.push_str(&format!("    {} #(\n", prim_name));
                out.push_str(&format!("        {}\n", param_strs.join(", ")));
                out.push_str(&format!("    ) {} (\n", cell.name));
            } else {
                out.push_str(&format!("    {} {} (\n", prim_name, cell.name));
            }

            // Port connections
            let mut port_list: Vec<(&String, &String)> = cell.ports.iter().collect();
            port_list.sort_by(|a, b| a.0.cmp(b.0));
            let total_ports = port_list.len();

            for (p_idx, (pin_name, net_name)) in port_list.iter().enumerate() {
                let p_comma = if p_idx + 1 < total_ports { "," } else { "" };
                out.push_str(&format!("        .{pin_name}({net_name}){p_comma}\n"));
            }
            out.push_str("    );\n\n");
        }

        out.push_str(&format!("endmodule // {}\n", circuit.top_module));
        out
    }
}
