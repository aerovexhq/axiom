use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::AxiomSimulator;
use axiom_syntax::parse_hdl;
use axiom_telemetry::{SaifWriter, TelemetryCollector, VcdWriter};
use std::sync::{Arc, Mutex};

/// Helper wrapper allowing a shared TelemetryCollector to be used as a SimEventListener.
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

/// Helper wrapper allowing a shared VcdWriter to be used as a SimEventListener.
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

#[test]
fn test_dynamic_power_and_energy_accumulation() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "counter").expect("Elaboration failed");
    let collector = Arc::new(Mutex::new(TelemetryCollector::new(&circuit)));

    let mut sim = AxiomSimulator::new(circuit).expect("Simulator creation failed");
    sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));

    // Set initial values
    sim.force_signal_and_settle("counter.rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.up_down", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.clk", &LogicVector::from_u64(0, 1)).unwrap();

    // Add 50 MHz clock (10 ns half-period)
    sim.add_clock("counter.clk", SimTime::from_nanoseconds(10)).unwrap();

    // Advance 10 clock cycles (200 ns)
    sim.tick(SimTime::from_nanoseconds(200)).unwrap();

    let mut col = collector.lock().unwrap();
    assert!(col.total_energy_joules > 0.0, "Total energy must be greater than zero");

    let frame = col.generate_frame(SimTime::from_nanoseconds(200));
    assert!(frame.total_energy_uj > 0.0);
    assert!(frame.instantaneous_power_mw > 0.0);
    assert!(frame.rail_currents_ma.contains_key("V_CORE"));
    assert!(frame.rail_voltages_v.contains_key("V_CORE"));
    assert!(col.module_energy_joules.contains_key("counter"));
}

#[test]
fn test_voltage_sag_under_heavy_switching() {
    let src = include_str!("../../../tests/fixtures/alu.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "alu").expect("Elaboration failed");
    let collector = Arc::new(Mutex::new(TelemetryCollector::new(&circuit)));

    let mut sim = AxiomSimulator::new(circuit).expect("Simulator creation failed");
    sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));

    let zeros = LogicVector::from_u64(0, 32);
    let ones = LogicVector::from_u64(0xFFFF_FFFF, 32);
    let op_add = LogicVector::from_u64(0, 3);

    // Initial state: A=0, B=0, ADD -> result=0
    sim.force_signal_and_settle("alu.a", &zeros).unwrap();
    sim.force_signal_and_settle("alu.b", &zeros).unwrap();
    sim.force_signal_and_settle("alu.opcode", &op_add).unwrap();

    // Advance time slightly to t=1ns
    sim.tick(SimTime::from_nanoseconds(1)).unwrap();

    // Major switching event: all 32 bits flip from 0 to 1 at t=1ns!
    sim.force_signal_and_settle("alu.a", &ones).unwrap();

    let mut col = collector.lock().unwrap();
    let frame = col.generate_frame(SimTime::from_nanoseconds(1));

    let core_voltage = frame.rail_voltages_v["V_CORE"];
    let nominal_core = 0.90;

    // Due to the simultaneous 32-bit transition and large di/dt, the PDN impedance causes a voltage droop!
    assert!(
        core_voltage < nominal_core,
        "Heavy switching must cause measurable voltage droop on V_CORE: got {core_voltage}V < {nominal_core}V"
    );
}

#[test]
fn test_vcd_export_generation() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "counter").expect("Elaboration failed");
    let vcd_writer = Arc::new(Mutex::new(VcdWriter::new(&circuit, "1 ps")));

    let mut sim = AxiomSimulator::new(circuit).expect("Simulator creation failed");
    sim.add_listener(Box::new(SharedVcdListener(Arc::clone(&vcd_writer))));

    sim.force_signal_and_settle("counter.rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.up_down", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.clk", &LogicVector::from_u64(0, 1)).unwrap();

    sim.add_clock("counter.clk", SimTime::from_nanoseconds(10)).unwrap();
    sim.tick(SimTime::from_nanoseconds(60)).unwrap();

    let vcd = vcd_writer.lock().unwrap();
    let vcd_str = vcd.as_str();

    assert!(vcd_str.contains("$date"));
    assert!(vcd_str.contains("$version"));
    assert!(vcd_str.contains("$timescale\n   1 ps\n$end"));
    assert!(vcd_str.contains("$scope module counter $end"));
    assert!(vcd_str.contains("$var wire 1"));
    assert!(vcd_str.contains("$var wire 8"));
    assert!(vcd_str.contains("$dumpvars"));
    assert!(vcd_str.contains("#10000"));
}

#[test]
fn test_saif_export_generation() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "counter").expect("Elaboration failed");
    let collector = Arc::new(Mutex::new(TelemetryCollector::new(&circuit)));

    let mut sim = AxiomSimulator::new(circuit.clone()).expect("Simulator creation failed");
    sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));

    sim.force_signal_and_settle("counter.rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.up_down", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("counter.clk", &LogicVector::from_u64(0, 1)).unwrap();

    sim.add_clock("counter.clk", SimTime::from_nanoseconds(10)).unwrap();
    sim.tick(SimTime::from_nanoseconds(100)).unwrap();

    let col = collector.lock().unwrap();
    let saif_output = SaifWriter::generate_saif(&circuit, &col, SimTime::from_nanoseconds(100));

    assert!(saif_output.contains("(SAIFILE"));
    assert!(saif_output.contains("(SAIFVERSION \"2.0\")"));
    assert!(saif_output.contains("(DESIGN \"counter\")"));
    assert!(saif_output.contains("(DURATION 100000)"));
    assert!(saif_output.contains("(INSTANCE counter"));
    assert!(saif_output.contains("(NET"));
    assert!(saif_output.contains("(clk (T0"));
    assert!(saif_output.contains("(TC "));
}
