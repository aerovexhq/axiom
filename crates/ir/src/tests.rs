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
}
