use std::env;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};

use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::AxiomSimulator;
use axiom_syntax::parse_hdl;
use axiom_telemetry::{SaifWriter, TelemetryCollector, VcdWriter};

struct SharedTelemetryListener(Arc<Mutex<TelemetryCollector>>);
impl axiom_sim::SimEventListener for SharedTelemetryListener {
    fn on_signal_change(
        &mut self,
        net: axiom_ir::NetId,
        net_name: &str,
        val: &LogicVector,
        time: SimTime,
        delta: u32,
    ) {
        if let Ok(mut col) = self.0.lock() {
            col.on_signal_change(net, net_name, val, time, delta);
        }
    }
}

struct SharedVcdListener(Arc<Mutex<VcdWriter>>);
impl axiom_sim::SimEventListener for SharedVcdListener {
    fn on_signal_change(
        &mut self,
        net: axiom_ir::NetId,
        net_name: &str,
        val: &LogicVector,
        time: SimTime,
        delta: u32,
    ) {
        if let Ok(mut vcd) = self.0.lock() {
            vcd.on_signal_change(net, net_name, val, time, delta);
        }
    }
}

fn resolve_fixture_path(name: &str) -> String {
    let direct = format!("tests/fixtures/{}", name);
    if Path::new(&direct).exists() {
        return direct;
    }
    let parent = format!("../../tests/fixtures/{}", name);
    if Path::new(&parent).exists() {
        return parent;
    }
    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let cand = Path::new(&manifest_dir).join("../../tests/fixtures").join(name);
        if cand.exists() {
            return cand.to_string_lossy().to_string();
        }
    }
    direct
}

#[test]
fn test_conformance_alu_32bit_reference_vectors() {
    let path = resolve_fixture_path("alu.v");
    let src = fs::read_to_string(&path).expect("Failed to read alu.v");

    let (ast, diags) = parse_hdl(FileId(1), &src);
    assert!(diags.is_empty(), "ALU parsing emitted errors: {:?}", diags);

    let circuit = elaborate(&ast, "alu").expect("Elaboration failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Simulator init failed");

    // Force A = 0x1234_5678, B = 0x0000_0001, OP = ADD (3'b000)
    let a_val = LogicVector::from_u64(0x1234_5678, 32);
    let b_val = LogicVector::from_u64(0x0000_0001, 32);
    let op_add = LogicVector::from_u64(0, 3);

    sim.force_signal_and_settle("a", &a_val).unwrap();
    sim.force_signal_and_settle("b", &b_val).unwrap();
    sim.force_signal_and_settle("opcode", &op_add).unwrap();

    let _ = sim.step_delta().unwrap();

    let res_net = sim.compiled.circuit.get_net_by_name("result").unwrap().clone();
    let res = sim.compiled.arena.read_net(&res_net);
    assert_eq!(
        res.to_u64().unwrap(),
        0x1234_5679,
        "ALU ADD mismatch vs Vivado standard reference"
    );

    // Test SUB (3'b001)
    let op_sub = LogicVector::from_u64(1, 3);
    sim.force_signal_and_settle("opcode", &op_sub).unwrap();
    let _ = sim.step_delta().unwrap();

    let res = sim.compiled.arena.read_net(&res_net);
    assert_eq!(
        res.to_u64().unwrap(),
        0x1234_5677,
        "ALU SUB mismatch vs Vivado standard reference"
    );
}

#[test]
fn test_conformance_counter_multi_cycle_and_vcd() {
    let path = resolve_fixture_path("counter.v");
    let src = fs::read_to_string(&path).expect("Failed to read counter.v");

    let (ast, diags) = parse_hdl(FileId(1), &src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "counter").expect("Elaboration failed");
    let vcd = Arc::new(Mutex::new(VcdWriter::new(&circuit, "1 ps")));

    let mut sim = AxiomSimulator::new(circuit).expect("Simulator init failed");
    sim.add_listener(Box::new(SharedVcdListener(Arc::clone(&vcd))));

    // Reset cycle
    sim.force_signal_and_settle("rst_n", &LogicVector::from_u64(0, 1)).unwrap();
    sim.force_signal_and_settle("enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("up_down", &LogicVector::from_u64(1, 1)).unwrap();

    // Toggle clk
    for _ in 0..2 {
        sim.force_signal_and_settle("clk", &LogicVector::from_u64(0, 1)).unwrap();
        sim.tick(SimTime::from_picoseconds(500)).unwrap();
        sim.force_signal_and_settle("clk", &LogicVector::from_u64(1, 1)).unwrap();
        sim.tick(SimTime::from_picoseconds(500)).unwrap();
    }

    let count_net = sim.compiled.circuit.get_net_by_name("count").unwrap().clone();
    let count_val = sim.compiled.arena.read_net(&count_net);
    assert_eq!(count_val.to_u64().unwrap(), 0, "Counter should be 0 during reset");

    // Deassert reset
    sim.force_signal_and_settle("rst_n", &LogicVector::from_u64(1, 1)).unwrap();

    // 8 clock cycles up
    for _ in 0..8 {
        sim.force_signal_and_settle("clk", &LogicVector::from_u64(0, 1)).unwrap();
        sim.tick(SimTime::from_picoseconds(500)).unwrap();
        sim.force_signal_and_settle("clk", &LogicVector::from_u64(1, 1)).unwrap();
        sim.tick(SimTime::from_picoseconds(500)).unwrap();
    }

    let count_val = sim.compiled.arena.read_net(&count_net);
    assert_eq!(count_val.to_u64().unwrap(), 8, "Counter should have incremented to 8");

    // Verify VCD output structure
    let vcd_str = vcd.lock().unwrap().as_str().to_string();
    assert!(vcd_str.contains("$version"));
    assert!(vcd_str.contains("$scope module counter"));
    assert!(vcd_str.contains("$var wire 8"));
    assert!(vcd_str.contains("$enddefinitions $end"));
}

#[test]
fn test_conformance_fifo_flow_control_and_saif() {
    let path = resolve_fixture_path("fifo.v");
    let src = fs::read_to_string(&path).expect("Failed to read fifo.v");

    let (ast, diags) = parse_hdl(FileId(1), &src);
    assert!(diags.is_empty(), "FIFO parsing errors: {:?}", diags);

    let circuit = elaborate(&ast, "fifo_4deep").expect("Elaboration failed");
    let collector = Arc::new(Mutex::new(TelemetryCollector::new(&circuit)));

    let mut sim = AxiomSimulator::new(circuit).expect("Simulator init failed");
    sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));

    // 1. Reset
    sim.force_signal_and_settle("rst_n", &LogicVector::from_u64(0, 1)).unwrap();
    sim.force_signal_and_settle("wr_en", &LogicVector::from_u64(0, 1)).unwrap();
    sim.force_signal_and_settle("rd_en", &LogicVector::from_u64(0, 1)).unwrap();
    sim.force_signal_and_settle("clk", &LogicVector::from_u64(0, 1)).unwrap();
    sim.tick(SimTime::from_picoseconds(500)).unwrap();
    sim.force_signal_and_settle("clk", &LogicVector::from_u64(1, 1)).unwrap();
    sim.tick(SimTime::from_picoseconds(500)).unwrap();

    let empty_net = sim.compiled.circuit.get_net_by_name("empty").unwrap().clone();
    let empty_val = sim.compiled.arena.read_net(&empty_net);
    assert_eq!(empty_val.to_u64().unwrap(), 1, "FIFO should be empty after reset");

    // 2. Release reset and push item
    sim.force_signal_and_settle("rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("din", &LogicVector::from_u64(0xA5, 8)).unwrap();
    sim.force_signal_and_settle("wr_en", &LogicVector::from_u64(1, 1)).unwrap();

    // Clock high
    sim.force_signal_and_settle("clk", &LogicVector::from_u64(0, 1)).unwrap();
    sim.tick(SimTime::from_picoseconds(500)).unwrap();
    sim.force_signal_and_settle("clk", &LogicVector::from_u64(1, 1)).unwrap();
    sim.tick(SimTime::from_picoseconds(500)).unwrap();

    // Verify SAIF generation
    let saif = SaifWriter::generate_saif(
        &sim.compiled.circuit,
        &collector.lock().unwrap(),
        sim.current_time,
    );

    assert!(saif.contains("(SAIFILE"), "SAIF must contain header");
    assert!(saif.contains("(DESIGN \"fifo_4deep\")"), "SAIF must match top design");
    assert!(saif.contains("(PROGRAM_NAME \"Axiom Simulator\")"));
    assert!(saif.contains("(NET"));
}

#[test]
fn test_conformance_hierarchical_submodule_interconnect() {
    let path = resolve_fixture_path("hierarchy.v");
    let src = fs::read_to_string(&path).expect("Failed to read hierarchy.v");

    let (ast, diags) = parse_hdl(FileId(1), &src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "hierarchy_top").expect("Elaboration failed");
    let sim = AxiomSimulator::new(circuit).expect("Simulator init failed");

    // Check hierarchical net naming
    assert!(
        sim.compiled.circuit.get_net_by_name("hierarchy_top.u_adder.a").is_some(),
        "Hierarchical net hierarchy_top.u_adder.a must be preserved in netlist"
    );
    assert!(
        sim.compiled.circuit.get_net_by_name("hierarchy_top.u_adder.b").is_some(),
        "Hierarchical net hierarchy_top.u_adder.b must be preserved in netlist"
    );
    assert!(
        sim.compiled.circuit.get_net_by_name("hierarchy_top.u_adder.sum").is_some(),
        "Hierarchical net hierarchy_top.u_adder.sum must be preserved in netlist"
    );
}
