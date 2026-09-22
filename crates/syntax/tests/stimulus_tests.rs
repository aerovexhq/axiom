// Axiom EDA — Tests for Stimulus & Constrained Random Verification Engine

use axiom_core::FileId;
use axiom_syntax::ast::*;
use axiom_syntax::parse_hdl;
use axiom_syntax::stimulus::*;

#[test]
fn test_clock_generator_edges() {
    let clk = ClockGenerator::new(100); // 100 MHz -> 10,000 ps period
    assert_eq!(clk.period_ps, 10_000);
    assert_eq!(clk.high_duration_ps(), 5_000);
    assert_eq!(clk.low_duration_ps(), 5_000);

    let edges = clk.edges_in_duration(30_000);
    // At 30 ns, we expect edges at 0 (low), 5000 (high), 10000 (low), 15000 (high), 20000 (low), 25000 (high), 30000 (low)
    assert!(edges.len() >= 6);
    assert_eq!(edges[0], (0, false));
    assert_eq!(edges[1], (5000, true));
    assert_eq!(edges[2], (10000, false));
}

#[test]
fn test_clock_generator_custom_duty() {
    let mut clk = ClockGenerator::new(50); // 50 MHz -> 20,000 ps period
    clk.duty_cycle_percent = 25;
    assert_eq!(clk.high_duration_ps(), 5_000);
    assert_eq!(clk.low_duration_ps(), 15_000);
}

#[test]
fn test_reset_generator_events() {
    let rst = ResetGenerator {
        active_low: true,
        assert_delay_ps: 1_000,
        duration_ps: 10_000,
    };

    let events = rst.events_in_duration(20_000);
    assert_eq!(events.len(), 3);
    assert_eq!(events[0], (0, true)); // de-asserted initially
    assert_eq!(events[1], (1_000, false)); // asserted low
    assert_eq!(events[2], (11_000, true)); // released high
}

#[test]
fn test_pulse_train_generator() {
    let pulse = PulseTrainGenerator {
        high_duration_ps: 2_000,
        low_duration_ps: 4_000,
        repeat_count: 3,
        initial_delay_ps: 1_000,
    };

    let events = pulse.events_in_duration(20_000);
    assert_eq!(events[0], (0, false));
    assert_eq!(events[1], (1_000, true));
    assert_eq!(events[2], (3_000, false));
    assert_eq!(events[3], (7_000, true));
}

#[test]
fn test_constrained_random_seed_repeatability() {
    let mut rng1 = ConstrainedRandomGenerator::new(42, 10, 100);
    let mut rng2 = ConstrainedRandomGenerator::new(42, 10, 100);

    let vals1: Vec<u64> = (0..20).map(|_| rng1.next_value()).collect();
    let vals2: Vec<u64> = (0..20).map(|_| rng2.next_value()).collect();

    assert_eq!(vals1, vals2, "Seed-repeatable PRNG must yield identical values");

    for val in vals1 {
        assert!((10..=100).contains(&val), "Value {} must be within [10, 100]", val);
    }
}

#[test]
fn test_constrained_random_illegal_bins() {
    let illegal = vec![15, 20, 25];
    let mut rng = ConstrainedRandomGenerator::new(12345, 10, 30).with_illegal(illegal.clone());

    for _ in 0..100 {
        let val = rng.next_value();
        assert!(!illegal.contains(&val), "Generated value {} was illegal!", val);
        assert!((10..=30).contains(&val));
    }
}

#[test]
fn test_constrained_random_weighted_distribution() {
    // 90% weight in [0, 5], 10% weight in [90, 100]
    let weights = vec![
        WeightRange { min: 0, max: 5, weight: 90 },
        WeightRange { min: 90, max: 100, weight: 10 },
    ];

    let mut rng = ConstrainedRandomGenerator::new(999, 0, 100).with_weights(weights);

    let mut low_count = 0;
    let mut high_count = 0;
    let total_samples = 500;

    for _ in 0..total_samples {
        let val = rng.next_value();
        if val <= 5 {
            low_count += 1;
        } else if val >= 90 {
            high_count += 1;
        }
    }

    assert!(low_count > high_count * 4, "Expected low range to dominate due to 90% weight");
}

#[test]
fn test_testbench_generator_end_to_end() {
    let verilog_code = r#"
module simple_alu (
    input wire clk,
    input wire rst_n,
    input wire [7:0] a,
    input wire [7:0] b,
    output reg [7:0] result
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            result <= 8'h00;
        else
            result <= a + b;
    end
endmodule
"#;

    let file_id = FileId(1);
    let (src_file, diags) = parse_hdl(file_id, verilog_code);
    assert!(diags.is_empty(), "Parse diags: {:?}", diags);
    assert_eq!(src_file.modules.len(), 1);

    let alu_mod = &src_file.modules[0];

    let mut plan = StimulusPlan::new("simple_alu", 50_000);
    plan.add_track(StimulusTrack {
        name: "clk".to_string(),
        direction: PortDirection::Input,
        width: 1,
        radix: "bin".to_string(),
        kind: StimulusTrackKind::Clock(ClockGenerator::new(100)),
    });
    plan.add_track(StimulusTrack {
        name: "rst_n".to_string(),
        direction: PortDirection::Input,
        width: 1,
        radix: "bin".to_string(),
        kind: StimulusTrackKind::Reset(ResetGenerator::default()),
    });
    plan.add_track(StimulusTrack {
        name: "a".to_string(),
        direction: PortDirection::Input,
        width: 8,
        radix: "hex".to_string(),
        kind: StimulusTrackKind::ConstrainedRandom(ConstrainedRandomGenerator::new(101, 0, 255)),
    });
    plan.add_track(StimulusTrack {
        name: "b".to_string(),
        direction: PortDirection::Input,
        width: 8,
        radix: "hex".to_string(),
        kind: StimulusTrackKind::ConstrainedRandom(ConstrainedRandomGenerator::new(202, 0, 255)),
    });

    let tb_code = TestbenchGenerator::generate_testbench(alu_mod, &plan);

    assert!(tb_code.contains("module tb_simple_alu;"));
    assert!(tb_code.contains("simple_alu u_dut ("));
    assert!(tb_code.contains(".clk(clk)"));
    assert!(tb_code.contains(".result(result)"));
    assert!(tb_code.contains("$dumpfile(\"tb_simple_alu.vcd\");"));
    assert!(tb_code.contains("$finish;"));

    // Verify generated testbench parses with parse_hdl without errors!
    let (tb_ast, tb_diags) = parse_hdl(FileId(2), &tb_code);
    assert!(tb_diags.is_empty(), "Generated testbench syntax errors: {:?}", tb_diags);
    assert_eq!(tb_ast.modules.len(), 1);
    assert_eq!(tb_ast.modules[0].name, "tb_simple_alu");
}
