use axiom_telemetry::vcd_import::{diff_waveforms, normalize_val, VcdParser};

#[test]
fn test_vcd_parser_timescale_scaling() {
    assert_eq!(VcdParser::parse_timescale("1ps"), (1, "1ps".into()));
    assert_eq!(VcdParser::parse_timescale("10ps"), (10, "10ps".into()));
    assert_eq!(VcdParser::parse_timescale("1ns"), (1000, "1ns".into()));
    assert_eq!(VcdParser::parse_timescale("10 ns"), (10000, "10ns".into()));
    assert_eq!(VcdParser::parse_timescale("1us"), (1_000_000, "1us".into()));
}

#[test]
fn test_vcd_parser_full_vcd() {
    let sample_vcd = r#"
$date
   2026-09-21 Axiom Test
$end
$version
   Axiom HDL Engine 1.0.0
$end
$timescale
   1ns
$end
$scope module top $end
$var wire 1 ! clk $end
$var wire 1 @ rst $end
$scope module u_core $end
$var wire 8 # data [7:0] $end
$upscope $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
1@
b00000000 #
$end
#10
1!
#20
0!
b00000001 #
#30
1!
b00000010 #
"#;

    let parsed = VcdParser::parse(sample_vcd).expect("VCD parse failed");
    assert_eq!(parsed.timescale_ps, 1000);
    assert_eq!(parsed.signals.len(), 3);

    // clk signal
    let clk = parsed.signals.iter().find(|s| s.name == "clk").expect("clk found");
    assert_eq!(clk.full_name, "top.clk");
    assert_eq!(clk.width, 1);
    assert_eq!(clk.samples.len(), 4);
    assert_eq!(clk.samples[0].time_ps, 0);
    assert_eq!(clk.samples[0].value, "0");
    assert_eq!(clk.samples[1].time_ps, 10000); // #10 * 1000ps
    assert_eq!(clk.samples[1].value, "1");

    // data signal
    let data = parsed.signals.iter().find(|s| s.name == "data").expect("data found");
    assert_eq!(data.full_name, "top.u_core.data");
    assert_eq!(data.width, 8);
    assert_eq!(data.samples.len(), 3);
    assert_eq!(data.samples[2].time_ps, 30000);
    assert_eq!(data.samples[2].value, "00000010");
}

#[test]
fn test_waveform_diffing_clean_match() {
    let sample_vcd = r#"
$timescale 1ns $end
$scope module top $end
$var wire 1 ! clk $end
$upscope $end
$enddefinitions $end
#0
0!
#10
1!
#20
0!
"#;
    let golden = VcdParser::parse(sample_vcd).unwrap();

    let sim_traces = vec![(
        "clk".to_string(),
        1u32,
        vec![
            (0u64, "0".to_string()),
            (10000u64, "1".to_string()),
            (20000u64, "0".to_string()),
        ],
    )];

    let report = diff_waveforms(&sim_traces, &golden);
    assert_eq!(report.compared_signals, 1);
    assert_eq!(report.total_mismatches, 0);
    assert_eq!(report.overall_match_percentage, 100.0);
}

#[test]
fn test_waveform_diffing_mismatch_detection() {
    let sample_vcd = r#"
$timescale 1ns $end
$scope module top $end
$var wire 1 ! clk $end
$var wire 4 " alu_out [3:0] $end
$upscope $end
$enddefinitions $end
#0
0!
b0000 "
#10
1!
b0011 "
#20
0!
b0110 "
"#;
    let golden = VcdParser::parse(sample_vcd).unwrap();

    // Simulation has glitch/mismatch on alu_out at t=10ns (sim has 0010 instead of 0011)
    let sim_traces = vec![
        (
            "clk".to_string(),
            1u32,
            vec![
                (0u64, "0".to_string()),
                (10000u64, "1".to_string()),
                (20000u64, "0".to_string()),
            ],
        ),
        (
            "alu_out".to_string(),
            4u32,
            vec![
                (0u64, "0000".to_string()),
                (10000u64, "0010".to_string()), // mismatch here!
                (20000u64, "0110".to_string()),
            ],
        ),
    ];

    let report = diff_waveforms(&sim_traces, &golden);
    assert_eq!(report.compared_signals, 2);
    assert!(report.total_mismatches > 0);
    assert!(report.overall_match_percentage < 100.0);

    let mm = &report.mismatches[0];
    assert_eq!(mm.signal_name, "alu_out");
    assert_eq!(mm.start_time_ps, 10000);
}

#[test]
fn test_normalize_val() {
    assert_eq!(normalize_val("0", 1), "0");
    assert_eq!(normalize_val("1", 1), "1");
    assert_eq!(normalize_val("1'b1", 1), "1");
    assert_eq!(normalize_val("8'h05", 8), "5");
    assert_eq!(normalize_val("00000101", 8), "101");
}
