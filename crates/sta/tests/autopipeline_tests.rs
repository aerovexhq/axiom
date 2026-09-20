use axiom_core::{FileId, LogicVector};
use axiom_ir::{BirCircuit, BirContinuousAssign, BirExpr, BirProcess, BirProcessKind, BirStatement, BirTrigger};
use axiom_sta::{analyze_circuit, AutoPipeliner};
use axiom_syntax::{parse_hdl, BinaryOp, EdgeKind};

#[test]
fn test_sta_autopipeline_end_to_end() {
    let mut circuit = BirCircuit::new("pipe_demo");

    let clk = circuit.add_net("clk", 1, LogicVector::from_u64(0, 1));
    let r_in = circuit.add_net("r_in", 8, LogicVector::from_u64(0, 8));
    let w1 = circuit.add_net("w1", 8, LogicVector::from_u64(0, 8));
    let w2 = circuit.add_net("w2", 8, LogicVector::from_u64(0, 8));
    let w3 = circuit.add_net("w3", 8, LogicVector::from_u64(0, 8));
    let r_out = circuit.add_net("r_out", 8, LogicVector::from_u64(0, 8));

    // Launch FF
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(0),
        name: "launch_ff".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: r_in,
            expr: BirExpr::Const(LogicVector::from_u64(42, 8)),
            is_nonblocking: true,
        }],
    });

    // Multi-level combinational chain: r_in -> w1 -> w2 -> w3
    circuit.continuous_assigns.push(BirContinuousAssign {
        target: w1,
        expr: BirExpr::Binary {
            op: BinaryOp::Add,
            lhs: Box::new(BirExpr::Net(r_in)),
            rhs: Box::new(BirExpr::Const(LogicVector::from_u64(1, 8))),
        },
    });

    circuit.continuous_assigns.push(BirContinuousAssign {
        target: w2,
        expr: BirExpr::Binary {
            op: BinaryOp::BitAnd,
            lhs: Box::new(BirExpr::Net(w1)),
            rhs: Box::new(BirExpr::Const(LogicVector::from_u64(0xAA, 8))),
        },
    });

    circuit.continuous_assigns.push(BirContinuousAssign {
        target: w3,
        expr: BirExpr::Binary {
            op: BinaryOp::BitXor,
            lhs: Box::new(BirExpr::Net(w2)),
            rhs: Box::new(BirExpr::Const(LogicVector::from_u64(0x55, 8))),
        },
    });

    // Capture FF
    circuit.processes.push(BirProcess {
        id: axiom_ir::ProcessId(1),
        name: "capture_ff".to_string(),
        kind: BirProcessKind::Clocked,
        triggers: vec![BirTrigger {
            net: clk,
            edge: EdgeKind::Posedge,
        }],
        body: vec![BirStatement::Assign {
            target: r_out,
            expr: BirExpr::Net(w3),
            is_nonblocking: true,
        }],
    });

    // Constrain with very tight clock period (0.5 ns = 500 ps) to ensure negative slack
    let sdc = "create_clock -period 0.5 -name clk [get_ports clk]";
    let summary = analyze_circuit(&circuit, sdc, None);

    let crit_path = &summary.critical_path;
    let rec = AutoPipeliner::analyze_path(crit_path, 500.0, Some("clk"), Some("rst_n"), None);

    assert!(rec.optimal_cut.is_some(), "AutoPipeliner should find an optimal cut");
    let opt = rec.optimal_cut.unwrap();
    assert!(opt.slack_gain_ps > 0.0, "Pipelining should improve slack");
    assert!(opt.predicted_fmax_mhz > rec.current_fmax_mhz, "Pipelining should increase Fmax");
}

#[test]
fn test_autopipeline_verilog_refactoring_and_syntax() {
    let verilog = r#"module accumulator (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [15:0] data_in,
    output wire [15:0] data_out
);
    wire [15:0] acc_sum;
    assign acc_sum = data_in + 16'd42;
    assign data_out = acc_sum ^ 16'hFFFF;
endmodule
"#;

    let (refactored, diff) = AutoPipeliner::refactor_verilog(
        verilog,
        "accumulator",
        "acc_sum",
        "clk",
        Some("rst_n"),
    ).expect("Refactoring should succeed");

    assert!(refactored.contains("wire [15:0] acc_sum_stage1;"));
    assert!(refactored.contains("reg [15:0] acc_sum;"));
    assert!(refactored.contains("assign acc_sum_stage1 = data_in + 16'd42;"));
    assert!(refactored.contains("always @(posedge clk or negedge rst_n) begin"));
    assert!(refactored.contains("acc_sum <= acc_sum_stage1;"));
    assert!(refactored.contains("assign data_out = acc_sum ^ 16'hFFFF;"));
    assert!(!diff.is_empty());

    // Verify refactored Verilog parses cleanly without any syntax errors!
    let (ast, diags) = parse_hdl(FileId(1), &refactored);
    assert!(diags.is_empty(), "Refactored HDL should have zero syntax errors: {:?}", diags);
    assert_eq!(ast.modules.len(), 1);
    assert_eq!(ast.modules[0].name, "accumulator");
}
