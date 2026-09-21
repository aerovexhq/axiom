#[cfg(test)]
mod tests {
    use crate::*;
    use axiom_core::FileId;
    use axiom_syntax::parse_hdl;

    #[test]
    fn test_elaborate_alu() {
        let src = r#"
module alu #(parameter WIDTH = 16) (
    input wire [WIDTH-1:0] a,
    input wire [WIDTH-1:0] b,
    output wire [WIDTH-1:0] out,
    output wire zero
);
    assign out = a & b;
    assign zero = ~out;
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "alu").expect("Elaboration failed");
        assert_eq!(circuit.top_name, "alu");
        assert_eq!(circuit.nets.len(), 4);

        let net_a = circuit.get_net_by_name("alu.a").expect("net a missing");
        assert_eq!(net_a.width, 16);

        let net_out = circuit.get_net_by_name("alu.out").expect("net out missing");
        assert_eq!(net_out.width, 16);

        let net_zero = circuit.get_net_by_name("alu.zero").expect("net zero missing");
        assert_eq!(net_zero.width, 1);

        assert_eq!(circuit.continuous_assigns.len(), 2);
    }

    #[test]
    fn test_elaborate_clocked_counter_and_sensitivity() {
        let src = r#"
module counter (
    input wire clk,
    input wire rst_n,
    output reg [7:0] count
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 8'h00;
        end else begin
            count <= count + 1;
        end
    end
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "counter").expect("Elaboration failed");
        assert_eq!(circuit.nets.len(), 3);

        let clk_net = circuit.get_net_by_name("counter.clk").expect("clk missing");
        let rst_net = circuit.get_net_by_name("counter.rst_n").expect("rst_n missing");

        assert_eq!(circuit.processes.len(), 1);
        let proc = &circuit.processes[0];
        assert_eq!(proc.kind, BirProcessKind::Clocked);
        assert_eq!(proc.triggers.len(), 2);

        // Verify sensitivity map
        let clk_dependents = circuit.sensitivity_map.get(&clk_net.id).expect("clk sensitivity missing");
        assert!(clk_dependents.contains(&proc.id));

        let rst_dependents = circuit.sensitivity_map.get(&rst_net.id).expect("rst sensitivity missing");
        assert!(rst_dependents.contains(&proc.id));
    }

    #[test]
    fn test_elaborate_hierarchical_submodule() {
        let src = r#"
module inverter #(parameter WIDTH = 8) (
    input wire [WIDTH-1:0] din,
    output wire [WIDTH-1:0] dout
);
    assign dout = ~din;
endmodule

module top (
    input wire [7:0] in_bus,
    output wire [7:0] out_bus
);
    inverter #(.WIDTH(8)) u_inv (
        .din(in_bus),
        .dout(out_bus)
    );
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "top").expect("Elaboration failed");
        assert_eq!(circuit.top_name, "top");

        // Top nets: top.in_bus, top.out_bus
        assert!(circuit.get_net_by_name("top.in_bus").is_some());
        assert!(circuit.get_net_by_name("top.out_bus").is_some());

        // Child nets: top.u_inv.din, top.u_inv.dout
        let child_din = circuit.get_net_by_name("top.u_inv.din").expect("u_inv.din missing");
        let child_dout = circuit.get_net_by_name("top.u_inv.dout").expect("u_inv.dout missing");
        assert_eq!(child_din.width, 8);
        assert_eq!(child_dout.width, 8);
    }

    #[test]
    fn test_elaborate_lut6_2_and_bufg() {
        let src = r#"
module lut_bufg_top (
    input wire clk_in,
    input wire i0, i1, i2, i3, i4, i5,
    output wire clk_out,
    output wire o5, o6
);
    BUFG u_bufg (
        .I(clk_in),
        .O(clk_out)
    );

    LUT6_2 #(.INIT(64'h8000000000000001)) u_lut (
        .I0(i0), .I1(i1), .I2(i2), .I3(i3), .I4(i4), .I5(i5),
        .O5(o5),
        .O6(o6)
    );
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(2), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "lut_bufg_top").expect("Elaboration failed");
        assert_eq!(circuit.primitive_instances.len(), 2);
        assert_eq!(circuit.primitive_instances[0].primitive_kind, PrimitiveKind::Bufg);
        assert_eq!(circuit.primitive_instances[1].primitive_kind, PrimitiveKind::Lut6_2);

        assert!(circuit.get_net_by_name("lut_bufg_top.clk_out").is_some());
        assert!(circuit.get_net_by_name("lut_bufg_top.o6").is_some());
        assert!(circuit.get_net_by_name("lut_bufg_top.o5").is_some());
    }

    #[test]
    fn test_elaborate_fdre_and_dsp48e2() {
        let src = r#"
module dsp_top (
    input wire clk,
    input wire rst,
    input wire [29:0] a,
    input wire [17:0] b,
    output wire [47:0] p,
    output wire valid_out
);
    wire [47:0] p_internal;
    wire valid_reg;

    DSP48E2 #(.PREG(1), .MREG(1)) u_dsp (
        .CLK(clk),
        .RSTP(rst),
        .CEP(1'b1),
        .A(a),
        .B(b),
        .P(p_internal)
    );

    FDRE #(.INIT(1'b0)) u_valid (
        .C(clk),
        .R(rst),
        .CE(1'b1),
        .D(1'b1),
        .Q(valid_reg)
    );

    assign p = p_internal;
    assign valid_out = valid_reg;
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(3), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "dsp_top").expect("Elaboration failed");
        assert_eq!(circuit.primitive_instances.len(), 2);
        assert_eq!(circuit.primitive_instances[0].primitive_kind, PrimitiveKind::Dsp48e2);
        assert_eq!(circuit.primitive_instances[1].primitive_kind, PrimitiveKind::Fdre);

        assert!(circuit.get_net_by_name("dsp_top.p").is_some());
        assert!(circuit.get_net_by_name("dsp_top.valid_out").is_some());
    }

    #[test]
    fn test_elaborate_ramb36e2() {
        let src = r#"
module bram_top (
    input wire clk,
    input wire we,
    input wire [14:0] addr,
    input wire [31:0] din,
    output wire [31:0] dout
);
    RAMB36E2 #(.DOA_REG(1)) u_bram (
        .CLKARDCLK(clk),
        .ENARDEN(1'b1),
        .WEA(we),
        .ADDRARDADDR(addr),
        .DINADIN(din),
        .DOUTADOUT(dout)
    );
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(4), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "bram_top").expect("Elaboration failed");
        assert_eq!(circuit.primitive_instances.len(), 1);
        assert_eq!(circuit.primitive_instances[0].primitive_kind, PrimitiveKind::Ramb36e2);
        assert!(circuit.get_net_by_name("bram_top.dout").is_some());
    }

    #[test]
    fn test_elaborate_gate_primitives_uygulama_0() {
        let src = r#"
module uygulama_0 (
    input  wire A,
    input  wire B,
    input  wire C,
    output wire F
);
    wire w1, w2, w3, w4;

    not g1 (w2, A);
    and g2 (w1, w2, B);
    not g3 (w4, B);
    and g4 (w3, w1, C);
    or  g5 (F, w4, w3);
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(5), src);
        assert!(diags.is_empty(), "Parsing diagnostics: {diags:?}");

        let circuit = elaborate(&ast, "uygulama_0").expect("Elaboration failed");
        assert_eq!(circuit.top_name, "uygulama_0");
        assert_eq!(circuit.nets.len(), 8);
        assert_eq!(circuit.continuous_assigns.len(), 5);
        assert!(circuit.get_net_by_name("uygulama_0.F").is_some());
        assert!(circuit.get_net_by_name("uygulama_0.w1").is_some());
        assert!(circuit.get_net_by_name("uygulama_0.w2").is_some());
        assert!(circuit.get_net_by_name("uygulama_0.w3").is_some());
        assert!(circuit.get_net_by_name("uygulama_0.w4").is_some());
    }
}
