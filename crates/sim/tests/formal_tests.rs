use axiom_core::{FileId, Logic4, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::formal::{
    run_formal_verification, FormalConfig, FormalEngineKind, FormalGoalKind, FormalResultStatus,
};
use axiom_syntax::parse_hdl;

#[test]
fn test_formal_counter_bound_proven() {
    let verilog = r#"
module counter (
    input clk,
    input rst_n,
    output reg [3:0] count
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            count <= 4'b0000;
        else if (count < 4'd10)
            count <= count + 1'b1;
        else
            count <= 4'b0000;
    end

    p_bound: assert property (@(posedge clk) count <= 4'd10);
endmodule
"#;

    let (ast, diags) = parse_hdl(FileId(1), verilog);
    assert!(diags.is_empty(), "Parsing failed: {:?}", diags);

    let circuit = elaborate(&ast, "counter").expect("Elaboration failed");

    // Collect assertions from AST
    let mut assertions = Vec::new();
    for module in &ast.modules {
        for item in &module.items {
            if let axiom_syntax::ast::ModuleItem::Assertion(asrt) = item {
                let mut parser = axiom_sim::assertion::SvaParser::new(&asrt.expr_text);
                if let Some(mut parsed) = parser.parse_assertion("asrt_0") {
                    parsed.name = asrt.label.clone().unwrap_or_else(|| "asrt_0".to_string());
                    parsed.clock = "clk".to_string();
                    parsed.edge = axiom_sim::assertion::ClockEdge::Posedge;
                    assertions.push(parsed);
                }
            }
        }
    }

    let config = FormalConfig {
        max_depth: 15,
        engine: FormalEngineKind::Bmc,
        reset_cycles: 1,
        clock_name: Some("clk".to_string()),
        reset_name: Some("rst_n".to_string()),
        ..Default::default()
    };

    let report = run_formal_verification(&circuit, &config, &assertions);
    println!("Report goals: {:?}", report.goals);

    assert_eq!(report.total_goals, 1);
    assert_eq!(report.proven_count, 1);
    assert_eq!(report.falsified_count, 0);
    assert_eq!(report.goals[0].status, FormalResultStatus::Proven);
    assert_eq!(report.goals[0].name, "p_bound");
}

#[test]
fn test_formal_falsified_with_counterexample() {
    let verilog = r#"
module counter_failing (
    input clk,
    input rst_n,
    output reg [3:0] count
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            count <= 4'b0000;
        else
            count <= count + 1'b1;
    end

    p_small: assert property (@(posedge clk) count < 4'd3);
endmodule
"#;

    let (ast, diags) = parse_hdl(FileId(1), verilog);
    assert!(diags.is_empty(), "Parsing failed: {:?}", diags);

    let circuit = elaborate(&ast, "counter_failing").expect("Elaboration failed");

    let mut assertions = Vec::new();
    for module in &ast.modules {
        for item in &module.items {
            if let axiom_syntax::ast::ModuleItem::Assertion(asrt) = item {
                let mut parser = axiom_sim::assertion::SvaParser::new(&asrt.expr_text);
                if let Some(mut parsed) = parser.parse_assertion("asrt_fail") {
                    parsed.name = asrt.label.clone().unwrap_or_else(|| "asrt_fail".to_string());
                    parsed.clock = "clk".to_string();
                    parsed.edge = axiom_sim::assertion::ClockEdge::Posedge;
                    assertions.push(parsed);
                }
            }
        }
    }

    let config = FormalConfig {
        max_depth: 10,
        engine: FormalEngineKind::Bmc,
        reset_cycles: 1,
        clock_name: Some("clk".to_string()),
        reset_name: Some("rst_n".to_string()),
        ..Default::default()
    };

    let report = run_formal_verification(&circuit, &config, &assertions);

    assert_eq!(report.total_goals, 1);
    assert_eq!(report.falsified_count, 1);
    let goal = &report.goals[0];
    assert_eq!(goal.status, FormalResultStatus::Falsified);
    assert!(goal.trace.is_some(), "Expected counterexample trace");

    let trace = goal.trace.as_ref().unwrap();
    assert!(trace.steps.len() >= 3, "Trace should contain multiple steps leading to failure");
    assert!(trace.cycle_index >= 2, "Failure cycle should be at or after count exceeds 3");
}

#[test]
fn test_formal_cover_property_witnessed() {
    let verilog = r#"
module state_cover (
    input clk,
    input rst_n,
    output reg [1:0] state
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= 2'b00;
        else
            state <= state + 1'b1;
    end

    c_reach_two: cover property (@(posedge clk) state == 2'd2);
endmodule
"#;

    let (ast, diags) = parse_hdl(FileId(1), verilog);
    assert!(diags.is_empty(), "Parsing failed: {:?}", diags);

    let circuit = elaborate(&ast, "state_cover").expect("Elaboration failed");

    let mut assertions = Vec::new();
    for module in &ast.modules {
        for item in &module.items {
            if let axiom_syntax::ast::ModuleItem::Assertion(asrt) = item {
                let mut parser = axiom_sim::assertion::SvaParser::new(&asrt.expr_text);
                if let Some(mut parsed) = parser.parse_assertion("cov_0") {
                    parsed.name = asrt.label.clone().unwrap_or_else(|| "cov_0".to_string());
                    parsed.kind = axiom_sim::assertion::AssertionKind::Cover;
                    parsed.clock = "clk".to_string();
                    parsed.edge = axiom_sim::assertion::ClockEdge::Posedge;
                    assertions.push(parsed);
                }
            }
        }
    }

    let config = FormalConfig {
        max_depth: 8,
        engine: FormalEngineKind::Bmc,
        reset_cycles: 1,
        clock_name: Some("clk".to_string()),
        reset_name: Some("rst_n".to_string()),
        ..Default::default()
    };

    let report = run_formal_verification(&circuit, &config, &assertions);

    assert_eq!(report.covered_count, 1);
    let goal = &report.goals[0];
    assert_eq!(goal.kind, FormalGoalKind::Cover);
    assert_eq!(goal.status, FormalResultStatus::Covered);
    assert!(goal.trace.is_some(), "Expected witness trace for covered goal");
}

#[test]
fn test_formal_k_induction_mode() {
    let verilog = r#"
module invariant_check (
    input clk,
    input rst_n,
    output reg [7:0] val
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            val <= 8'h00;
        else if (val < 8'hFF)
            val <= val + 1'b1;
        else
            val <= 8'hFF;
    end

    p_inv: assert property (@(posedge clk) val <= 8'hFF);
endmodule
"#;

    let (ast, _diags) = parse_hdl(FileId(1), verilog);
    let circuit = elaborate(&ast, "invariant_check").expect("Elaboration failed");

    let mut assertions = Vec::new();
    for module in &ast.modules {
        for item in &module.items {
            if let axiom_syntax::ast::ModuleItem::Assertion(asrt) = item {
                let mut parser = axiom_sim::assertion::SvaParser::new(&asrt.expr_text);
                if let Some(mut parsed) = parser.parse_assertion("asrt_inv") {
                    parsed.name = asrt.label.clone().unwrap_or_else(|| "asrt_inv".to_string());
                    parsed.clock = "clk".to_string();
                    parsed.edge = axiom_sim::assertion::ClockEdge::Posedge;
                    assertions.push(parsed);
                }
            }
        }
    }

    let config = FormalConfig {
        max_depth: 10,
        engine: FormalEngineKind::KInduction,
        reset_cycles: 1,
        clock_name: Some("clk".to_string()),
        reset_name: Some("rst_n".to_string()),
        ..Default::default()
    };

    let report = run_formal_verification(&circuit, &config, &assertions);

    assert_eq!(report.proven_count, 1);
    assert_eq!(report.goals[0].status, FormalResultStatus::Proven);
    assert!(report.goals[0].note.as_ref().unwrap().contains("k-induction"));
}

#[test]
fn test_formal_default_structural_goals() {
    let verilog = r#"
module simple_alu (
    input clk,
    input rst_n,
    input [3:0] a,
    input [3:0] b,
    output reg [3:0] out_data
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            out_data <= 4'b0000;
        else
            out_data <= a + b;
    end
endmodule
"#;

    let (ast, diags) = parse_hdl(FileId(1), verilog);
    assert!(diags.is_empty());
    let circuit = elaborate(&ast, "simple_alu").expect("Elaboration failed");

    let config = FormalConfig {
        max_depth: 5,
        engine: FormalEngineKind::Bmc,
        reset_cycles: 1,
        clock_name: Some("clk".to_string()),
        reset_name: Some("rst_n".to_string()),
        ..Default::default()
    };

    // Pass empty assertions to verify default structural goal inference
    let report = run_formal_verification(&circuit, &config, &[]);

    assert!(report.total_goals >= 1, "Should infer at least 1 default structural goal");
    assert!(report.proven_count >= 1 || report.covered_count >= 1);
}
