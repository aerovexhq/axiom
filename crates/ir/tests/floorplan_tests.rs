use axiom_ir::floorplan::{generate_floorplan, SiteType};
use axiom_ir::synth::{synthesize_from_ast, SynthConfig};
use axiom_syntax::parse_hdl;
use axiom_core::FileId;

#[test]
fn test_floorplan_end_to_end_artix7() {
    let verilog = r#"
        module logic_circuit(
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

    let (ast, diags) = parse_hdl(FileId(1), verilog);
    assert!(diags.is_empty(), "Verilog syntax errors: {:?}", diags);

    let config = SynthConfig::for_device("xc7a35tcpg236-1");
    let synth = synthesize_from_ast(&ast, "logic_circuit", &config).expect("Synthesis should succeed");

    let floorplan = generate_floorplan(&synth, "xc7a35tcpg236-1");
    assert_eq!(floorplan.device_name, "xc7a35tcpg236-1");
    assert_eq!(floorplan.grid_width, 40);
    assert_eq!(floorplan.grid_height, 60);
    assert!(!floorplan.clock_regions.is_empty());

    // Verify placed cells
    assert!(floorplan.placed_cells.len() >= 4);

    // Verify IOB placements on boundaries
    let placed_iobs: Vec<_> = floorplan.placed_cells.values().filter(|c| c.site_type == SiteType::Iob).collect();
    assert!(!placed_iobs.is_empty(), "Should place primary I/O buffers in IOB sites");
    for iob in &placed_iobs {
        assert!(iob.col == 0 || iob.col == floorplan.grid_width - 1, "IOBs must be on outer columns");
    }

    // Verify critical path exists
    assert!(floorplan.critical_path.is_some());
    let cp = floorplan.critical_path.unwrap();
    assert!(!cp.hops.is_empty());
    assert!(cp.total_delay_ps > 0.0);
    assert!(cp.logic_levels >= 1);
}

#[test]
fn test_floorplan_ultrascale_plus_device() {
    let verilog = r#"
        module counter_top(
            input wire clk,
            input wire rst,
            output reg [3:0] count
        );
            always @(posedge clk) begin
                if (rst)
                    count <= 4'b0000;
                else
                    count <= count + 1'b1;
            end
        endmodule
    "#;

    let (ast, diags) = parse_hdl(FileId(1), verilog);
    assert!(diags.is_empty());

    let config = SynthConfig::for_device("xcku5p-ffvb676-2-e");
    let synth = synthesize_from_ast(&ast, "counter_top", &config).expect("Synthesis should succeed");

    let floorplan = generate_floorplan(&synth, "xcku5p-ffvb676-2-e");
    assert_eq!(floorplan.grid_width, 80);
    assert_eq!(floorplan.grid_height, 120);
    assert_eq!(floorplan.clock_regions.len(), 16); // 4x4 clock regions

    assert!(!floorplan.placed_cells.is_empty());
    assert!(floorplan.total_wirelength >= 0.0);
}
