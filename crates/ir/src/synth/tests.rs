use super::*;
use axiom_core::FileId;
use axiom_syntax::parse_hdl;

#[test]
fn test_synth_logic_circuit() {
    let source = r#"
    module logic_circuit (
        input wire A,
        input wire B,
        input wire C,
        output wire F
    );
        wire w1 = ~A;
        wire w2 = w1 & B;
        wire w3 = w2 & C;
        wire w4 = ~B;
        assign F = w3 | w4;
    endmodule
    "#;

    let (ast, diags) = parse_hdl(FileId(1), source);
    assert!(diags.is_empty(), "Parse diagnostics: {:?}", diags);

    let config = SynthConfig::for_device("xc7a100tcsg324-1");
    let result = synthesize_from_ast(&ast, "logic_circuit", &config);
    assert!(result.is_ok(), "Synthesis error: {:?}", result.err());

    let synth = result.unwrap();
    assert_eq!(synth.top_module, "logic_circuit");
    assert_eq!(synth.target_family, FpgaFamily::Artix7);

    // Primary ports
    assert_eq!(synth.ports.len(), 4);
    assert!(synth.ports.iter().any(|p| p.name == "A"));
    assert!(synth.ports.iter().any(|p| p.name == "F"));

    // Check cells: should have IBUFs, OBUF, and LUTs
    assert!(synth.cells.iter().any(|c| c.kind == PrimitiveKind::Ibuf));
    assert!(synth.cells.iter().any(|c| c.kind == PrimitiveKind::Obuf));
    assert!(synth.stats.total_luts >= 1, "Expected LUTs to be generated");

    // Check LUT equation and INIT
    let lut_cell = synth.cells.iter().find(|c| matches!(c.kind, PrimitiveKind::Lut1 | PrimitiveKind::Lut2 | PrimitiveKind::Lut3 | PrimitiveKind::Lut4));
    assert!(lut_cell.is_some());
    let lut = lut_cell.unwrap();
    assert!(lut.params.contains_key("INIT"));
    assert!(lut.equation.is_some());

    // Structural Verilog generation
    let verilog = synth.to_verilog();
    assert!(verilog.contains("module logic_circuit"));
    assert!(verilog.contains("IBUF"));
    assert!(verilog.contains("OBUF"));
    assert!(verilog.contains("endmodule"));
}

#[test]
fn test_synth_counter_sequential() {
    let source = r#"
    module counter (
        input wire clk,
        input wire rst_n,
        output reg [3:0] count
    );
        always @(posedge clk or negedge rst_n) begin
            if (!rst_n)
                count <= 4'b0000;
            else
                count <= count + 1;
        end
    endmodule
    "#;

    let (ast, diags) = parse_hdl(FileId(1), source);
    assert!(diags.is_empty());

    let config = SynthConfig::for_device("xcku5p-ffvb676-2-e");
    let synth = synthesize_from_ast(&ast, "counter", &config).unwrap();

    assert_eq!(synth.top_module, "counter");
    assert_eq!(synth.target_family, FpgaFamily::UltraScalePlus);

    // Should have BUFG for clock
    assert!(synth.cells.iter().any(|c| c.kind == PrimitiveKind::Bufg));

    // Should have Flip-Flops for 4-bit count
    let ff_count = synth.stats.total_ffs;
    assert_eq!(ff_count, 4, "Expected 4 flip-flops for [3:0] count");

    // Check verilog export
    let verilog = synth.to_verilog();
    assert!(verilog.contains("BUFG"));
    assert!(verilog.contains("FDCE") || verilog.contains("FDRE"));
}

#[test]
fn test_synth_arithmetic_carry_chains() {
    let source = r#"
    module adder_8bit (
        input wire [7:0] a,
        input wire [7:0] b,
        output wire [7:0] sum
    );
        assign sum = a + b;
    endmodule
    "#;

    let (ast, diags) = parse_hdl(FileId(1), source);
    assert!(diags.is_empty());

    // 7-Series: maps to CARRY4
    let config_7series = SynthConfig::for_device("xc7a100tcsg324-1");
    let synth_7 = synthesize_from_ast(&ast, "adder_8bit", &config_7series).unwrap();
    assert_eq!(synth_7.stats.carry4_count, 2, "8-bit adder should map to two CARRY4 blocks");

    // UltraScale+: maps to CARRY8
    let config_usp = SynthConfig::for_device("xcku5p-ffvb676-2-e");
    let synth_usp = synthesize_from_ast(&ast, "adder_8bit", &config_usp).unwrap();
    assert_eq!(synth_usp.stats.carry8_count, 1, "8-bit adder should map to one CARRY8 block");
}
