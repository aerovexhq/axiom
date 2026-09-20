pub mod arith_mapper;
pub mod io_mapper;
pub mod lut_mapper;
pub mod seq_mapper;
pub mod types;
pub mod verilog_gen;

#[cfg(test)]
pub mod tests;

pub use arith_mapper::ArithMapper;
pub use io_mapper::IoMapper;
pub use lut_mapper::LutMapper;
pub use seq_mapper::SeqMapper;
pub use types::*;
pub use verilog_gen::VerilogNetlistGenerator;

use crate::bir::{BirCircuit, PrimitiveKind};
use axiom_syntax::{PortDirection, SourceFile};
use hashbrown::{HashMap, HashSet};

/// Main entrance for In-RAM FPGA logic synthesis and technology mapping.
pub fn synthesize(circuit: &BirCircuit, config: &SynthConfig) -> Result<SynthesizedCircuit, SynthError> {
    synthesize_internal(circuit, None, config)
}

/// Synthesize directly from AST source file with exact formal port declarations.
pub fn synthesize_from_ast(
    source: &SourceFile,
    top_name: &str,
    config: &SynthConfig,
) -> Result<SynthesizedCircuit, SynthError> {
    let circuit = crate::elaborator::Elaborator::elaborate(source, top_name)
        .map_err(|e| SynthError::MappingError(top_name.to_string(), e.to_string()))?;
    let top_module = source.modules.iter().find(|m| m.name == top_name);
    synthesize_internal(&circuit, top_module, config)
}

fn synthesize_internal(
    circuit: &BirCircuit,
    top_module: Option<&axiom_syntax::ModuleDef>,
    config: &SynthConfig,
) -> Result<SynthesizedCircuit, SynthError> {
    if circuit.nets.is_empty() && circuit.continuous_assigns.is_empty() && circuit.processes.is_empty() {
        return Err(SynthError::EmptyCircuit);
    }

    // 1. Resolve Primary Ports
    let ports = resolve_primary_ports(circuit, top_module);

    // 2. Map I/O Buffers (IBUF, OBUF, BUFG)
    let io_result = IoMapper::map_ports(&ports);
    let mut all_cells = io_result.cells;

    // 3. Map Combinational & Arithmetic Continuous Assignments
    let mut mapped_assign_targets = HashSet::new();

    for (idx, assign) in circuit.continuous_assigns.iter().enumerate() {
        // Try arithmetic carry chains first for multi-bit operations
        if let Some(arith) = ArithMapper::try_map_arithmetic(circuit, assign, config.target_family, idx) {
            all_cells.extend(arith.carry_cells);
            all_cells.extend(arith.lut_cells);
            mapped_assign_targets.insert(assign.target);
            continue;
        }

        // Map to K-LUT
        let lut_result = LutMapper::map_continuous_assign(circuit, assign, idx);
        all_cells.extend(lut_result.cells);
        mapped_assign_targets.insert(assign.target);
    }

    // 4. Map Sequential Clocked Processes (FDRE / FDCE)
    for (idx, proc) in circuit.processes.iter().enumerate() {
        let seq_result = SeqMapper::map_clocked_process(circuit, proc, idx);
        all_cells.extend(seq_result.cells);
    }

    // 5. Preserve existing primitives (e.g. DSP48, RAMB36, pre-instantiated primitives)
    for prim in &circuit.primitive_instances {
        let mut port_map = HashMap::new();
        for (pname, net_id) in &prim.ports {
            if let Some(net) = circuit.get_net(*net_id) {
                port_map.insert(pname.clone(), net.name.clone());
            }
        }

        all_cells.push(SynthesizedCell {
            id: format!("cell_{}", prim.name),
            name: prim.name.clone(),
            kind: prim.primitive_kind,
            scope: prim.scope.clone(),
            ports: port_map,
            params: prim.params.clone(),
            equation: None,
            source_line: None,
            delay_ps: 120.0,
        });
    }

    // 6. Deduce Interconnect Nets
    let nets = build_synthesized_nets(circuit, &all_cells);

    // 7. Calculate Statistics
    let stats = compute_synthesis_stats(&all_cells, config);

    let synth_circuit = SynthesizedCircuit {
        top_module: circuit.top_name.clone(),
        target_device: config.target_device.clone(),
        target_family: config.target_family,
        ports,
        cells: all_cells,
        nets,
        stats,
    };

    Ok(synth_circuit)
}

impl SynthesizedCircuit {
    pub fn to_verilog(&self) -> String {
        VerilogNetlistGenerator::generate(self)
    }
}

fn resolve_primary_ports(
    circuit: &BirCircuit,
    top_module: Option<&axiom_syntax::ModuleDef>,
) -> Vec<SynthesizedPort> {
    let mut ports = Vec::new();

    if let Some(module) = top_module {
        for p in &module.ports {
            let width = if let Some(range) = &p.range {
                let msb_val = match &range.msb {
                    axiom_syntax::Expr::UnsizedInt(v, _) => *v as u32,
                    axiom_syntax::Expr::Number(vec, _) => vec.to_u64().unwrap_or(0) as u32,
                    _ => 0,
                };
                let lsb_val = match &range.lsb {
                    axiom_syntax::Expr::UnsizedInt(v, _) => *v as u32,
                    axiom_syntax::Expr::Number(vec, _) => vec.to_u64().unwrap_or(0) as u32,
                    _ => 0,
                };
                msb_val.abs_diff(lsb_val) + 1
            } else {
                1
            };

            let is_clk = p.name.contains("clk") || p.name.contains("clock");
            let is_rst = p.name.contains("rst") || p.name.contains("reset");

            ports.push(SynthesizedPort {
                name: p.name.clone(),
                direction: p.direction,
                width,
                is_clock: is_clk,
                is_reset: is_rst,
            });
        }
    } else {
        // Fallback: infer from nets with short single-identifier names
        let driven_nets: HashSet<crate::bir::NetId> = circuit.continuous_assigns.iter().map(|a| a.target).collect();

        for net in &circuit.nets {
            let name = if let Some((_, leaf)) = net.name.rsplit_once('.') {
                leaf
            } else {
                net.name.as_str()
            };

            // Skip internal generated wires
            if name.starts_with('_') || name.contains(".lut_") {
                continue;
            }

            let is_clk = name.contains("clk") || name.contains("clock");
            let is_rst = name.contains("rst") || name.contains("reset");

            let is_driven = driven_nets.contains(&net.id);
            let direction = if is_driven {
                PortDirection::Output
            } else {
                PortDirection::Input
            };

            ports.push(SynthesizedPort {
                name: name.to_string(),
                direction,
                width: net.width,
                is_clock: is_clk,
                is_reset: is_rst,
            });
        }
    }

    ports
}

fn build_synthesized_nets(
    circuit: &BirCircuit,
    cells: &[SynthesizedCell],
) -> Vec<SynthesizedNet> {
    let mut net_map: HashMap<String, SynthesizedNet> = HashMap::new();

    // Register all nets from circuit
    for net in &circuit.nets {
        let clean_name = if let Some((_, leaf)) = net.name.rsplit_once('.') {
            leaf.to_string()
        } else {
            net.name.clone()
        };

        net_map.insert(
            clean_name.clone(),
            SynthesizedNet {
                name: clean_name,
                width: net.width,
                driver_cell: None,
                driver_pin: None,
                load_cells: Vec::new(),
                is_clock: net.name.contains("clk"),
                is_reset: net.name.contains("rst"),
            },
        );
    }

    // Connect cell pins to nets
    for cell in cells {
        for (pin, net_name) in &cell.ports {
            let entry = net_map.entry(net_name.clone()).or_insert_with(|| SynthesizedNet {
                name: net_name.clone(),
                width: 1,
                driver_cell: None,
                driver_pin: None,
                load_cells: Vec::new(),
                is_clock: net_name.contains("clk"),
                is_reset: net_name.contains("rst"),
            });

            // Output pins are drivers
            let is_driver = pin == "O" || pin == "Q" || pin == "P" || pin == "CO" || pin.starts_with("O[");
            if is_driver {
                entry.driver_cell = Some(cell.name.clone());
                entry.driver_pin = Some(pin.clone());
            } else {
                entry.load_cells.push((cell.name.clone(), pin.clone()));
            }
        }
    }

    let mut nets: Vec<SynthesizedNet> = net_map.into_values().collect();
    nets.sort_by(|a, b| a.name.cmp(&b.name));
    nets
}

fn compute_synthesis_stats(cells: &[SynthesizedCell], config: &SynthConfig) -> SynthesisStats {
    let mut lut1 = 0;
    let mut lut2 = 0;
    let mut lut3 = 0;
    let mut lut4 = 0;
    let mut lut5 = 0;
    let mut lut6 = 0;
    let mut lut6_2 = 0;

    let mut fdre = 0;
    let mut fdce = 0;

    let mut carry4 = 0;
    let mut carry8 = 0;

    let mut ibuf = 0;
    let mut obuf = 0;
    let mut bufg = 0;

    let mut dsp = 0;
    let mut bram = 0;

    for cell in cells {
        match cell.kind {
            PrimitiveKind::Lut1 => lut1 += 1,
            PrimitiveKind::Lut2 => lut2 += 1,
            PrimitiveKind::Lut3 => lut3 += 1,
            PrimitiveKind::Lut4 => lut4 += 1,
            PrimitiveKind::Lut5 => lut5 += 1,
            PrimitiveKind::Lut6 => lut6 += 1,
            PrimitiveKind::Lut6_2 => lut6_2 += 1,
            PrimitiveKind::Fdre => fdre += 1,
            PrimitiveKind::Fdce => fdce += 1,
            PrimitiveKind::Carry4 => carry4 += 1,
            PrimitiveKind::Carry8 => carry8 += 1,
            PrimitiveKind::Ibuf => ibuf += 1,
            PrimitiveKind::Obuf => obuf += 1,
            PrimitiveKind::Bufg | PrimitiveKind::Bufgce => bufg += 1,
            PrimitiveKind::Dsp48e2 | PrimitiveKind::Dsp48e1 => dsp += 1,
            PrimitiveKind::Ramb36e2 | PrimitiveKind::Ramb18e2 => bram += 1,
            _ => {}
        }
    }

    let total_luts = lut1 + lut2 + lut3 + lut4 + lut5 + lut6 + lut6_2;
    let total_ffs = fdre + fdce;
    let total_carries = carry4 + carry8;
    let total_iobs = ibuf + obuf + bufg;
    let total_cells = cells.len() as u32;

    let target_lut_cap = config.target_family.lut_capacity();
    let target_ff_cap = config.target_family.ff_capacity();

    let lut_util = (total_luts as f32 / target_lut_cap as f32) * 100.0;
    let ff_util = (total_ffs as f32 / target_ff_cap as f32) * 100.0;

    // Approximate logic depth based on LUT count and presence of carries
    let logic_depth = if total_carries > 0 {
        3 + (total_luts / 4).min(4)
    } else if total_luts > 0 {
        1 + (total_luts / 2).min(3)
    } else {
        1
    };

    let estimated_delay_ps = 350.0 + (logic_depth as f32 * 55.0) + 650.0; // IBUF + logic + OBUF

    SynthesisStats {
        lut1_count: lut1,
        lut2_count: lut2,
        lut3_count: lut3,
        lut4_count: lut4,
        lut5_count: lut5,
        lut6_count: lut6,
        lut6_2_count: lut6_2,
        total_luts,
        fdre_count: fdre,
        fdce_count: fdce,
        total_ffs,
        carry4_count: carry4,
        carry8_count: carry8,
        total_carries,
        ibuf_count: ibuf,
        obuf_count: obuf,
        bufg_count: bufg,
        total_iobs,
        dsp_count: dsp,
        bram_count: bram,
        total_cells,
        target_lut_capacity: target_lut_cap,
        target_ff_capacity: target_ff_cap,
        lut_utilization_pct: lut_util,
        ff_utilization_pct: ff_util,
        logic_depth,
        estimated_delay_ps,
    }
}
