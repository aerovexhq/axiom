use axiom_core::{FileId, Logic4, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::AxiomSimulator;
use axiom_syntax::parse_hdl;

#[test]
fn test_sim_lut6_2_truth_table() {
    let src = r#"
module lut_test (
    input wire i0, i1, i2, i3, i4, i5,
    output wire o5, o6
);
    // Bit 0 = 1, Bit 63 = 1, all others 0
    LUT6_2 #(.INIT(64'h8000000000000001)) u_lut (
        .I0(i0), .I1(i1), .I2(i2), .I3(i3), .I4(i4), .I5(i5),
        .O5(o5),
        .O6(o6)
    );
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(10), src);
    assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

    let circuit = elaborate(&ast, "lut_test").expect("Elaboration failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Sim initialization failed");

    // Default inputs: all 0 -> index = 0 -> bit 0 of INIT is 1
    // At t=0 after initialization, O6 and O5 should be 1
    let val_o6 = sim.get_signal("lut_test.o6").unwrap();
    let val_o5 = sim.get_signal("lut_test.o5").unwrap();
    assert_eq!(val_o6.get_bit(0), Logic4::One);
    assert_eq!(val_o5.get_bit(0), Logic4::One);

    // Force I0=1 -> index = 1 -> bit 1 of INIT is 0
    sim.force_signal("lut_test.i0", &LogicVector::from_u64(1, 1)).unwrap();
    sim.step_delta().unwrap();

    let val_o6_after = sim.get_signal("lut_test.o6").unwrap();
    let val_o5_after = sim.get_signal("lut_test.o5").unwrap();
    assert_eq!(val_o6_after.get_bit(0), Logic4::Zero);
    assert_eq!(val_o5_after.get_bit(0), Logic4::Zero);

    // Force all inputs to 1 -> index = 63 (6'b111111)
    // O6 index = 63 -> bit 63 of INIT is 1 -> O6 = 1
    // O5 index = {0, 11111} = 31 -> bit 31 of INIT is 0 -> O5 = 0
    sim.force_signal("lut_test.i1", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("lut_test.i2", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("lut_test.i3", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("lut_test.i4", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("lut_test.i5", &LogicVector::from_u64(1, 1)).unwrap();
    sim.step_delta().unwrap();

    let val_o6_all1 = sim.get_signal("lut_test.o6").unwrap();
    let val_o5_all1 = sim.get_signal("lut_test.o5").unwrap();
    assert_eq!(val_o6_all1.get_bit(0), Logic4::One);
    assert_eq!(val_o5_all1.get_bit(0), Logic4::Zero);
}

#[test]
fn test_sim_bufg_and_fdre() {
    let src = r#"
module bufg_fdre_test (
    input wire clk_in,
    input wire rst,
    input wire d,
    output wire q
);
    wire clk_buffered;

    BUFG u_bufg (
        .I(clk_in),
        .O(clk_buffered)
    );

    FDRE #(.INIT(1'b0)) u_ff (
        .C(clk_buffered),
        .R(rst),
        .CE(1'b1),
        .D(d),
        .Q(q)
    );
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(11), src);
    assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

    let circuit = elaborate(&ast, "bufg_fdre_test").expect("Elaboration failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Sim initialization failed");

    // Verify BUFG buffers clock
    sim.force_signal("bufg_fdre_test.clk_in", &LogicVector::from_u64(1, 1)).unwrap();
    sim.step_delta().unwrap();
    let clk_val = sim.get_signal("bufg_fdre_test.clk_buffered").unwrap();
    assert_eq!(clk_val.get_bit(0), Logic4::One);

    // Initial Q is 0
    let q_init = sim.get_signal("bufg_fdre_test.q").unwrap();
    assert_eq!(q_init.get_bit(0), Logic4::Zero);

    // Set D=1, drop clk to 0, then tick posedge
    sim.force_signal("bufg_fdre_test.d", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("bufg_fdre_test.clk_in", &LogicVector::from_u64(0, 1)).unwrap();
    sim.step_delta().unwrap();

    // Rising edge on clock
    sim.tick(SimTime::from_picoseconds(1000)).unwrap();
    sim.force_signal("bufg_fdre_test.clk_in", &LogicVector::from_u64(1, 1)).unwrap();
    sim.step_delta().unwrap();

    // After posedge clk with D=1, Q should latch 1
    let q_latched = sim.get_signal("bufg_fdre_test.q").unwrap();
    assert_eq!(q_latched.get_bit(0), Logic4::One);

    // Assert synchronous reset R=1 and tick clock
    sim.force_signal("bufg_fdre_test.rst", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal("bufg_fdre_test.clk_in", &LogicVector::from_u64(0, 1)).unwrap();
    sim.step_delta().unwrap();

    sim.tick(SimTime::from_picoseconds(1000)).unwrap();
    sim.force_signal("bufg_fdre_test.clk_in", &LogicVector::from_u64(1, 1)).unwrap();
    sim.step_delta().unwrap();

    // Q should reset to 0
    let q_reset = sim.get_signal("bufg_fdre_test.q").unwrap();
    assert_eq!(q_reset.get_bit(0), Logic4::Zero);
}

#[test]
fn test_sim_dsp48e2_multiply_accumulate() {
    let src = r#"
module dsp_sim_test (
    input wire [29:0] a,
    input wire [17:0] b,
    output wire [47:0] p
);
    DSP48E2 #(.PREG(0), .MREG(0)) u_dsp (
        .A(a),
        .B(b),
        .P(p)
    );
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(12), src);
    assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

    let circuit = elaborate(&ast, "dsp_sim_test").expect("Elaboration failed");
    let mut sim = AxiomSimulator::new(circuit).expect("Sim initialization failed");

    // Feed A=12, B=10 -> P = 12 * 10 = 120
    sim.force_signal("dsp_sim_test.a", &LogicVector::from_u64(12, 30)).unwrap();
    sim.force_signal("dsp_sim_test.b", &LogicVector::from_u64(10, 18)).unwrap();
    sim.step_delta().unwrap();

    let val_p = sim.get_signal("dsp_sim_test.p").unwrap();
    assert_eq!(val_p.to_u64(), Some(120));

    // Feed A=25, B=4 -> P = 25 * 4 = 100
    sim.force_signal("dsp_sim_test.a", &LogicVector::from_u64(25, 30)).unwrap();
    sim.force_signal("dsp_sim_test.b", &LogicVector::from_u64(4, 18)).unwrap();
    sim.step_delta().unwrap();

    let val_p2 = sim.get_signal("dsp_sim_test.p").unwrap();
    assert_eq!(val_p2.to_u64(), Some(100));
}
