use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::{AxiomSimulator, SimTraceRecorder};
use axiom_syntax::parse_hdl;

#[test]
fn test_manual_delta_stepping() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty(), "Parsing counter failed: {diags:?}");

    let circuit = elaborate(&ast, "counter").expect("Elaborating counter failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Creating simulator failed");

    let val_one = LogicVector::from_u64(1, 1);
    let val_zero = LogicVector::from_u64(0, 1);

    // Initial state: release reset (rst_n = 1), enable up-counting (up_down = 1)
    sim.force_signal("counter.rst_n", &val_one).unwrap();
    sim.force_signal("counter.enable", &val_one).unwrap();
    sim.force_signal("counter.up_down", &val_one).unwrap();
    sim.force_signal("counter.clk", &val_zero).unwrap();
    sim.settle_current_time().unwrap();

    let count_init = sim.get_signal("counter.count").unwrap();
    assert_eq!(count_init.to_u64(), Some(0));

    // 1. Manually step a rising clock edge
    sim.force_signal("counter.clk", &val_one).unwrap();

    // After posedge clk at current_time, active processes ran, scheduling NBA for count.
    // Step delta cycle 0:
    let delta0 = sim.step_delta().unwrap();
    assert!(delta0.active_nbas > 0, "NBA should be committed during delta stepping");

    // After NBA commits in delta 0, new value of count is visible!
    let count_step1 = sim.get_signal("counter.count").unwrap();
    assert_eq!(count_step1.to_u64(), Some(1), "Count should increment to 1");

    // 2. Clock falling edge (should NOT increment on negedge)
    sim.force_signal("counter.clk", &val_zero).unwrap();
    sim.settle_current_time().unwrap();
    let count_step2 = sim.get_signal("counter.count").unwrap();
    assert_eq!(count_step2.to_u64(), Some(1), "Count must stay 1 on negedge");

    // 3. Second clock rising edge
    sim.force_signal("counter.clk", &val_one).unwrap();
    sim.settle_current_time().unwrap();
    let count_step3 = sim.get_signal("counter.count").unwrap();
    assert_eq!(count_step3.to_u64(), Some(2), "Count should increment to 2");
}

#[test]
fn test_multicycle_clock_counting() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty(), "Parsing counter failed: {diags:?}");

    let circuit = elaborate(&ast, "counter").expect("Elaborating counter failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Creating simulator failed");

    let val_one = LogicVector::from_u64(1, 1);
    let val_zero = LogicVector::from_u64(0, 1);

    // Initial signals
    sim.force_signal("counter.rst_n", &val_one).unwrap();
    sim.force_signal("counter.enable", &val_one).unwrap();
    sim.force_signal("counter.up_down", &val_one).unwrap();
    sim.force_signal("counter.clk", &val_zero).unwrap();

    // Configure 50 MHz clock (10 ns half-period)
    let half_period = SimTime::from_nanoseconds(10);
    sim.add_clock("counter.clk", half_period).unwrap();

    // Advance simulation by 200 ns (10 full clock cycles of 20ns period)
    let summary = sim.tick(SimTime::from_nanoseconds(200)).unwrap();
    assert_eq!(summary.end_time, SimTime::from_nanoseconds(200));

    // The counter should have executed 10 posedges, so count = 10
    let count_val = sim.get_signal("counter.count").unwrap();
    assert_eq!(count_val.to_u64(), Some(10), "Counter should equal 10 after 10 clock periods");
}

#[test]
fn test_alu_simulation() {
    let src = include_str!("../../../tests/fixtures/alu.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty(), "Parsing alu failed: {diags:?}");

    let circuit = elaborate(&ast, "alu").expect("Elaborating alu failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Creating simulator failed");

    let a_val = LogicVector::from_u64(45, 32);
    let b_val = LogicVector::from_u64(15, 32);
    let op_add = LogicVector::from_u64(0, 3); // ADD
    let op_sub = LogicVector::from_u64(1, 3); // SUB

    sim.force_signal_and_settle("alu.a", &a_val).unwrap();
    sim.force_signal_and_settle("alu.b", &b_val).unwrap();
    sim.force_signal_and_settle("alu.opcode", &op_add).unwrap();

    let res_add = sim.get_signal("alu.result").unwrap();
    let zero_add = sim.get_signal("alu.zero").unwrap();
    assert_eq!(res_add.to_u64(), Some(60));
    assert_eq!(zero_add.to_u64(), Some(0));

    // Test SUB (45 - 15 = 30)
    sim.force_signal_and_settle("alu.opcode", &op_sub).unwrap();
    let res_sub = sim.get_signal("alu.result").unwrap();
    assert_eq!(res_sub.to_u64(), Some(30));

    // Test SUB to ZERO (45 - 45 = 0 -> zero flag = 1)
    sim.force_signal_and_settle("alu.b", &a_val).unwrap();
    let res_zero = sim.get_signal("alu.result").unwrap();
    let zero_flag = sim.get_signal("alu.zero").unwrap();
    assert_eq!(res_zero.to_u64(), Some(0));
    assert_eq!(zero_flag.to_u64(), Some(1));
}

#[test]
fn test_checkpoint_and_rollback() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "counter").expect("Elaborating counter failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Creating simulator failed");

    sim.force_signal("counter.rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("counter.enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("counter.up_down", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("counter.clk", &LogicVector::from_u64(0, 1)).unwrap();

    sim.add_clock("counter.clk", SimTime::from_nanoseconds(10)).unwrap();

    // Advance 6 cycles (120 ns) -> count should be 6
    sim.tick(SimTime::from_nanoseconds(120)).unwrap();
    assert_eq!(sim.get_signal("counter.count").unwrap().to_u64(), Some(6));

    // Save checkpoint at t=120ns
    let cp = sim.create_checkpoint();

    // Advance another 8 cycles (160 ns) to 280 ns -> count should be 14
    sim.tick(SimTime::from_nanoseconds(160)).unwrap();
    assert_eq!(sim.current_time, SimTime::from_nanoseconds(280));
    assert_eq!(sim.get_signal("counter.count").unwrap().to_u64(), Some(14));

    // Rollback to checkpoint at t=120ns!
    sim.restore_checkpoint(cp).unwrap();
    assert_eq!(sim.current_time, SimTime::from_nanoseconds(120));
    assert_eq!(sim.get_signal("counter.count").unwrap().to_u64(), Some(6));

    // Continue simulation from restored point for 2 cycles (40 ns) -> count should be 8
    sim.tick(SimTime::from_nanoseconds(40)).unwrap();
    assert_eq!(sim.current_time, SimTime::from_nanoseconds(160));
    assert_eq!(sim.get_signal("counter.count").unwrap().to_u64(), Some(8));
}

#[test]
fn test_trace_listener_capture() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "counter").expect("Elaborating counter failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Creating simulator failed");

    let recorder = Box::new(SimTraceRecorder::new());
    sim.add_listener(recorder);

    sim.force_signal("counter.rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("counter.enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("counter.up_down", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("counter.clk", &LogicVector::from_u64(0, 1)).unwrap();

    sim.force_signal("counter.clk", &LogicVector::from_u64(1, 1)).unwrap();
    sim.settle_current_time().unwrap();

    // Listener was called!
    assert!(!sim.listeners.is_empty());
}
