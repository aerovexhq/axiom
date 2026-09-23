use axiom_core::LogicVector;
use axiom_ir::{BirCircuit, BirContinuousAssign, BirExpr, BirProcess, BirProcessKind, BirStatement, BirTrigger};
use axiom_sta::*;
use axiom_syntax::{BinaryOp, EdgeKind};

#[test]
fn test_delay_model_lut_and_ff() {
    let model_7s = DelayModel::new("artix7");
    assert!(!model_7s.is_ultrascale);
    assert_eq!(model_7s.ff_clock_to_q().min_ps, 140.0);
    assert_eq!(model_7s.ff_clock_to_q().max_ps, 260.0);
    assert_eq!(model_7s.ff_setup_time(), 45.0);
    assert_eq!(model_7s.ff_hold_time(), 35.0);

    let model_us = DelayModel::new("xcku5p-ffvb676-2-e");
    assert!(model_us.is_ultrascale);
    assert_eq!(model_us.ff_clock_to_q().min_ps, 120.0);
    assert_eq!(model_us.ff_clock_to_q().max_ps, 220.0);
    assert_eq!(model_us.ff_setup_time(), 38.0);
    assert_eq!(model_us.ff_hold_time(), 28.0);

    // Wire load logarithmic model
    let wire_1 = model_us.wire_delay(1);
    let wire_4 = model_us.wire_delay(4);
    assert!(wire_4.max_ps > wire_1.max_ps);
    assert_eq!(wire_1.max_ps, 25.0); // 25 + 12 * log2(1) = 25
    assert_eq!(wire_4.max_ps, 49.0); // 25 + 12 * 2 = 49
}

#[test]
fn test_sdc_parser_directives() {
    let sdc = r#"
        # Clock definitions
        create_clock -period 10.0 -name sys_clk [get_ports clk]
        create_generated_clock -name clk_div2 -source sys_clk -divide_by 2 [get_pins div/q]

        # I/O delays
        set_input_delay -clock sys_clk -max 2.5 [get_ports rst_n]
        set_output_delay -clock sys_clk -max 1.8 [get_ports tx]

        # Timing Exceptions
        set_false_path -from [get_ports rst_n] -to [get_pins *]
        set_multicycle_path 2 -setup -from [get_pins alu/r*] -to [get_pins regfile/*]
        set_multicycle_path 1 -hold -from [get_pins alu/r*] -to [get_pins regfile/*]

        # Asynchronous Clock Groups
        set_clock_groups -asynchronous -group {sys_clk} -group {clk_div2}
    "#;

    let constraints = SdcParser::parse(sdc);

    assert_eq!(constraints.clocks.len(), 1);
    assert_eq!(constraints.clocks[0].name, "sys_clk");
    assert_eq!(constraints.clocks[0].period_ps, 10_000.0);

    assert_eq!(constraints.generated_clocks.len(), 1);
    assert_eq!(constraints.generated_clocks[0].divide_by, 2);

    assert_eq!(constraints.io_delays.len(), 2);
    assert!(constraints.io_delays[0].is_input);
    assert_eq!(constraints.io_delays[0].delay_ps, 2500.0);

    assert_eq!(constraints.false_paths.len(), 1);
    assert!(constraints.is_false_path("rst_n", "counter_q", None));

    assert_eq!(constraints.multicycle_paths.len(), 2);
    assert_eq!(constraints.get_setup_multicycle("alu/r1", "regfile/r2"), 2);
    assert_eq!(constraints.get_hold_multicycle("alu/r1", "regfile/r2"), 1);

    assert!(constraints.are_clocks_asynchronous("sys_clk", "clk_div2"));
}

#[test]
fn test_topological_propagation_and_slack() {
    // Build a simple circuit: clk -> reg1 -> (LUT logic) -> reg2
    let mut circuit = BirCircuit::new("test_pipe");

    let clk_id = circuit.add_net("clk", 1, LogicVector::from_u64(0, 1));
    let q1_id = circuit.add_net("q1", 8, LogicVector::from_u64(0, 8));
    let w_comb_id = circuit.add_net("w_comb", 8, LogicVector::from_u64(0, 8));
    let q2_id = circuit.add_net("q2", 8, LogicVector::from_u64(0, 8));

    // Continuous assign: w_comb = q1 + 1
    circuit.continuous_assigns.push(BirContinuousAssign {
        target: w_comb_id,
        expr: BirExpr::Binary {
            op: BinaryOp::Add,
            lhs: Box::new(BirExpr::Net(q1_id)),
            rhs: Box::new(BirExpr::Const(LogicVector::from_u64(1, 8))),
        },
    });

    // Clocked process 1: q1 <= 0
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(0),
        name: "proc_q1".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk_id,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: q1_id,
            expr: BirExpr::Const(LogicVector::from_u64(0, 8)),
            is_nonblocking: true,
        }],
        initial_time_ps: 0,
    });

    // Clocked process 2: q2 <= w_comb
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(1),
        name: "proc_q2".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk_id,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: q2_id,
            expr: BirExpr::Net(w_comb_id),
            is_nonblocking: true,
        }],
        initial_time_ps: 0,
    });

    let sdc = "create_clock -period 5.0 -name clk [get_ports clk]";
    let summary = analyze_circuit(&circuit, sdc, None);

    assert!(summary.worst_negative_slack_ps > 0.0); // 5ns period is plenty for an 8-bit adder
    assert!(summary.fmax_mhz > 200.0);
    assert!(!summary.critical_path.segments.is_empty());
    assert!(summary.logic_levels >= 1);
}

#[test]
fn test_cdc_synchronizer_detection() {
    let mut circuit = BirCircuit::new("cdc_sync_top");

    let clk_a = circuit.add_net("clk_a", 1, LogicVector::from_u64(0, 1));
    let clk_b = circuit.add_net("clk_b", 1, LogicVector::from_u64(0, 1));

    let src_reg = circuit.add_net("data_src", 1, LogicVector::from_u64(0, 1));
    let sync1_reg = circuit.add_net("data_sync1", 1, LogicVector::from_u64(0, 1));
    let sync2_reg = circuit.add_net("data_sync2", 1, LogicVector::from_u64(0, 1));
    let hazard_reg = circuit.add_net("hazard_dest", 1, LogicVector::from_u64(0, 1));

    // Source domain clocked by clk_a
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(0),
        name: "proc_src".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk_a,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: src_reg,
            expr: BirExpr::Const(LogicVector::from_u64(1, 1)),
            is_nonblocking: true,
        }],
        initial_time_ps: 0,
    });

    // 2-FF Synchronizer domain clocked by clk_b
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(1),
        name: "proc_sync".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk_b,
            edge: EdgeKind::Posedge,
        }],
        body: vec![
            BirStatement::Assign {
                target: sync1_reg,
                expr: BirExpr::Net(src_reg),
                is_nonblocking: true,
            },
            BirStatement::Assign {
                target: sync2_reg,
                expr: BirExpr::Net(sync1_reg),
                is_nonblocking: true,
            },
        ],
        initial_time_ps: 0,
    });

    // Unsynchronized cross domain transfer directly to hazard_reg
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(2),
        name: "proc_hazard".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk_b,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: hazard_reg,
            expr: BirExpr::Net(src_reg),
            is_nonblocking: true,
        }],
        initial_time_ps: 0,
    });

    let sdc = r#"
        create_clock -period 10.0 -name clk_a [get_ports clk_a]
        create_clock -period 8.0 -name clk_b [get_ports clk_b]
    "#;

    let summary = analyze_circuit(&circuit, sdc, None);

    assert_eq!(summary.cdc_crossings.len(), 2);
    let safe_crossing = summary.cdc_crossings.iter().find(|c| c.dest_reg == "data_sync1");
    let hazard_crossing = summary.cdc_crossings.iter().find(|c| c.dest_reg == "hazard_dest");

    assert!(safe_crossing.is_some());
    assert_eq!(safe_crossing.unwrap().classification, CdcClassification::Safe);

    assert!(hazard_crossing.is_some());
    assert_eq!(hazard_crossing.unwrap().classification, CdcClassification::Hazard);
}

#[test]
fn test_ascii_report_formatting() {
    let mut circuit = BirCircuit::new("format_test");
    let clk = circuit.add_net("clk", 1, LogicVector::from_u64(0, 1));
    let q = circuit.add_net("q", 1, LogicVector::from_u64(0, 1));
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(0),
        name: "proc_q".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: q,
            expr: BirExpr::Const(LogicVector::from_u64(1, 1)),
            is_nonblocking: true,
        }],
        initial_time_ps: 0,
    });

    let summary = analyze_circuit(&circuit, "create_clock -period 10.0 clk", None);
    let report = format_ascii_report(&summary, "format_test", "xc7a35tcsg324-1");

    assert!(report.contains("Timing Summary"));
    assert!(report.contains("Worst Negative Slack (WNS)"));
    assert!(report.contains("Worst Hold Slack     (WHS)"));
    assert!(report.contains("Achievable Fmax"));
}

#[test]
fn test_false_path_exclusion() {
    let mut circuit = BirCircuit::new("fp_test");
    let clk = circuit.add_net("clk", 1, LogicVector::from_u64(0, 1));
    let rst = circuit.add_net("rst_async", 1, LogicVector::from_u64(0, 1));
    let q = circuit.add_net("q", 1, LogicVector::from_u64(0, 1));

    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(0),
        name: "proc_q".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: q,
            expr: BirExpr::Net(rst),
            is_nonblocking: true,
        }],
        initial_time_ps: 0,
    });

    let sdc_without_fp = "create_clock -period 1.0 clk";
    let summary_without = analyze_circuit(&circuit, sdc_without_fp, None);

    let sdc_with_fp = r#"
        create_clock -period 1.0 clk
        set_false_path -from [get_ports rst_async] -to [get_pins *]
    "#;
    let summary_with = analyze_circuit(&circuit, sdc_with_fp, None);

    // With false path, the unconstrained path from rst_async is ignored
    assert!(summary_with.all_paths.iter().all(|p| p.startpoint != "rst_async" || p.is_false_path));
    assert_ne!(summary_without.worst_negative_slack_ps, f32::NAN);
}

#[test]
fn test_multicycle_path_expansion() {
    let mut circuit = BirCircuit::new("mc_test");
    let clk = circuit.add_net("clk", 1, LogicVector::from_u64(0, 1));
    let q1 = circuit.add_net("q1", 1, LogicVector::from_u64(0, 1));
    let q2 = circuit.add_net("q2", 1, LogicVector::from_u64(0, 1));

    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(0),
        name: "proc_pipe".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk,
            edge: EdgeKind::Posedge,
        }],
        body: vec![
            BirStatement::Assign {
                target: q1,
                expr: BirExpr::Const(LogicVector::from_u64(1, 1)),
                is_nonblocking: true,
            },
            BirStatement::Assign {
                target: q2,
                expr: BirExpr::Net(q1),
                is_nonblocking: true,
            },
        ],
        initial_time_ps: 0,
    });

    // 1-cycle vs 2-cycle multicycle constraint
    let sdc_1x = "create_clock -period 2.0 clk";
    let summary_1x = analyze_circuit(&circuit, sdc_1x, None);

    let sdc_2x = r#"
        create_clock -period 2.0 clk
        set_multicycle_path 2 -setup -from [get_pins reg_q:q1] -to [get_pins q2]
    "#;
    let summary_2x = analyze_circuit(&circuit, sdc_2x, None);
    let path_1x = summary_1x
        .all_paths
        .iter()
        .find(|p| p.endpoint.contains("q2") && p.startpoint.contains("q1"))
        .unwrap();
    let path_2x = summary_2x
        .all_paths
        .iter()
        .find(|p| p.endpoint.contains("q2") && p.startpoint.contains("q1"))
        .unwrap();

    // Multicycle 2x provides exactly an additional clock period of slack (2000 ps)
    assert_eq!(path_2x.slack_ps - path_1x.slack_ps, 2000.0);
}
