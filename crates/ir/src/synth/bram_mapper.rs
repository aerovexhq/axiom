use crate::bir::{BirCircuit, PrimitiveKind};
use crate::synth::types::{FpgaFamily, SynthesizedCell};
use axiom_syntax::ast::{ModuleDef, ModuleItem};
use hashbrown::HashMap;

/// Maps memory arrays and synchronous RAM blocks into physical FPGA Block RAM primitives (RAMB18E2 / RAMB36E2).
pub struct BramMapper;

pub struct MappedBramResult {
    pub cells: Vec<SynthesizedCell>,
}

impl BramMapper {
    /// Inspects the module definition and elaborated circuit for memory arrays.
    pub fn map_bram_blocks(
        circuit: &BirCircuit,
        top_module: Option<&ModuleDef>,
        _family: FpgaFamily,
    ) -> MappedBramResult {
        let mut cells = Vec::new();

        if let Some(module) = top_module {
            for item in &module.items {
                if let ModuleItem::NetDecl(decl) = item {
                    for raw_name in &decl.names {
                        let name_lower = raw_name.to_lowercase();
                        if name_lower.contains("ram")
                            || name_lower.contains("mem")
                            || name_lower.contains("bram")
                            || name_lower.contains("rom")
                            || name_lower.contains("buffer")
                            || name_lower.contains('[')
                        {
                            let clean_name = raw_name.split('[').next().unwrap_or(raw_name).trim().to_string();

                            // Estimate word width and depth
                            let word_width = if let Some(range) = &decl.range {
                                Self::eval_range_width(range)
                            } else {
                                16
                            };

                            let depth = Self::extract_array_depth(raw_name).unwrap_or(1024);
                            let total_bits = word_width as u64 * depth as u64;

                            let (prim_kind, cell_prefix) = if total_bits <= 18_432 {
                                (PrimitiveKind::Ramb18e2, "ramb18e2")
                            } else {
                                (PrimitiveKind::Ramb36e2, "ramb36e2")
                            };

                            let cell_name = format!("{}_{}", cell_prefix, clean_name);
                            let mut ports = HashMap::new();

                            // Find clock net if available in circuit
                            let clk_net = circuit.nets.iter().find(|n| {
                                let l = n.name.to_lowercase();
                                l.contains("clk") || l.contains("clock")
                            }).map(|n| n.name.clone()).unwrap_or_else(|| "clk".to_string());

                            ports.insert("CLKARDCLK".to_string(), clk_net.clone());
                            ports.insert("CLKBWRCLK".to_string(), clk_net);
                            ports.insert("ENARDEN".to_string(), "1'b1".to_string());
                            ports.insert("ENBWREN".to_string(), "1'b1".to_string());
                            ports.insert("WEA".to_string(), "2'b11".to_string());
                            ports.insert("ADDRARDADDR".to_string(), format!("{clean_name}_addr"));
                            ports.insert("DINADIN".to_string(), format!("{clean_name}_din"));
                            ports.insert("DOUTADOUT".to_string(), format!("{clean_name}_dout"));
                            ports.insert("RSTRAMARSTRAM".to_string(), "1'b0".to_string());

                            let mut params = HashMap::new();
                            params.insert("DOA_REG".to_string(), 1);
                            params.insert("DOB_REG".to_string(), 0);
                            params.insert("WRITE_WIDTH_A".to_string(), word_width as u64);
                            params.insert("READ_WIDTH_A".to_string(), word_width as u64);

                            let equation = format!("Dual-Port Synchronous Block RAM (Depth: {depth}, Width: {word_width}-bit, Total: {} Kb)", total_bits / 1024);

                            cells.push(SynthesizedCell {
                                id: format!("cell_{cell_name}"),
                                name: cell_name,
                                kind: prim_kind,
                                scope: "top".to_string(),
                                ports,
                                params,
                                equation: Some(equation),
                                source_line: None,
                                delay_ps: 650.0,
                            });
                        }
                    }
                }
            }
        }

        MappedBramResult { cells }
    }

    fn eval_range_width(range: &axiom_syntax::ast::Range) -> u32 {
        let msb = match &range.msb {
            axiom_syntax::ast::Expr::UnsizedInt(v, _) => *v as u32,
            axiom_syntax::ast::Expr::Number(vec, _) => vec.to_u64().unwrap_or(0) as u32,
            _ => 15,
        };
        let lsb = match &range.lsb {
            axiom_syntax::ast::Expr::UnsizedInt(v, _) => *v as u32,
            axiom_syntax::ast::Expr::Number(vec, _) => vec.to_u64().unwrap_or(0) as u32,
            _ => 0,
        };
        msb.abs_diff(lsb) + 1
    }

    fn extract_array_depth(raw: &str) -> Option<u32> {
        // Look for pattern [0:1023] or [1023:0]
        if let Some(start) = raw.find('[') {
            if let Some(end) = raw[start..].find(']') {
                let slice = &raw[start + 1..start + end];
                if let Some((p1, p2)) = slice.split_once(':') {
                    let v1: u32 = p1.trim().parse().ok()?;
                    let v2: u32 = p2.trim().parse().ok()?;
                    return Some(v1.abs_diff(v2) + 1);
                }
            }
        }
        None
    }
}
