use betterado_core::FileId;
use betterado_ir::elaborate;
use betterado_syntax::parse_hdl;

#[test]
fn test_fixture_alu_elaboration() {
    let src = include_str!("../../../tests/fixtures/alu.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    if !diags.is_empty() {
        panic!("DIAGS: {}", diags.iter().map(|d| d.message.clone()).collect::<Vec<_>>().join(" | "));
    }
    assert_eq!(ast.modules.len(), 1);

    let circuit = elaborate(&ast, "alu").expect("Elaborating ALU failed");
    assert_eq!(circuit.top_name, "alu");

    let a = circuit.get_net_by_name("alu.a").expect("alu.a missing");
    let b = circuit.get_net_by_name("alu.b").expect("alu.b missing");
    let result = circuit.get_net_by_name("alu.result").expect("alu.result missing");
    let zero = circuit.get_net_by_name("alu.zero").expect("alu.zero missing");

    assert_eq!(a.width, 32);
    assert_eq!(b.width, 32);
    assert_eq!(result.width, 32);
    assert_eq!(zero.width, 1);

    assert_eq!(circuit.continuous_assigns.len(), 1);
    assert_eq!(circuit.processes.len(), 1);
}

#[test]
fn test_fixture_counter_elaboration() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(2), src);
    assert!(diags.is_empty(), "Parsing Counter fixture failed: {diags:?}");

    let circuit = elaborate(&ast, "counter").expect("Elaborating Counter failed");
    assert_eq!(circuit.top_name, "counter");

    let clk = circuit.get_net_by_name("counter.clk").expect("counter.clk missing");
    let count = circuit.get_net_by_name("counter.count").expect("counter.count missing");

    assert_eq!(clk.width, 1);
    assert_eq!(count.width, 8);

    assert_eq!(circuit.processes.len(), 1);
    let proc = &circuit.processes[0];

    // Sensitivity map must contain clk -> proc
    let deps = circuit.sensitivity_map.get(&clk.id).expect("clk missing in sensitivity map");
    assert!(deps.contains(&proc.id));
}

#[test]
fn test_fixture_hierarchy_elaboration() {
    let src = include_str!("../../../tests/fixtures/hierarchy.v");
    let (ast, diags) = parse_hdl(FileId(3), src);
    assert!(diags.is_empty(), "Parsing Hierarchy fixture failed: {diags:?}");
    assert_eq!(ast.modules.len(), 2);

    let circuit = elaborate(&ast, "hierarchy_top").expect("Elaborating Hierarchy failed");
    assert_eq!(circuit.top_name, "hierarchy_top");

    // Parent nets
    let in_a = circuit.get_net_by_name("hierarchy_top.in_a").expect("in_a missing");
    let in_b = circuit.get_net_by_name("hierarchy_top.in_b").expect("in_b missing");
    let result = circuit.get_net_by_name("hierarchy_top.result").expect("result missing");

    assert_eq!(in_a.width, 16);
    assert_eq!(in_b.width, 16);
    assert_eq!(result.width, 16);

    // Child nets
    let child_a = circuit.get_net_by_name("hierarchy_top.u_adder.a").expect("u_adder.a missing");
    let child_b = circuit.get_net_by_name("hierarchy_top.u_adder.b").expect("u_adder.b missing");
    let child_sum = circuit.get_net_by_name("hierarchy_top.u_adder.sum").expect("u_adder.sum missing");

    assert_eq!(child_a.width, 16);
    assert_eq!(child_b.width, 16);
    assert_eq!(child_sum.width, 16);
}
