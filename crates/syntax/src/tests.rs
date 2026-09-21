#[cfg(test)]
mod tests {
    use crate::*;
    use axiom_core::{FileId, Logic4};

    #[test]
    fn test_lexer_tokenization() {
        let src = "module alu #(parameter WIDTH = 32) (input wire [WIDTH-1:0] a, b);\n  // comment\n  assign out = a & b;\nendmodule";
        let mut lexer = Lexer::new(FileId(1), src);
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::Module);
        assert_eq!(tokens[1].kind, TokenKind::Ident("alu".into()));
        assert_eq!(tokens[2].kind, TokenKind::Hash);
        assert_eq!(tokens[3].kind, TokenKind::LParen);
        assert_eq!(tokens[4].kind, TokenKind::Parameter);
        assert_eq!(tokens[5].kind, TokenKind::Ident("WIDTH".into()));
        assert_eq!(tokens[6].kind, TokenKind::AssignEq);
        assert_eq!(tokens[7].kind, TokenKind::UnsizedInt(32));
    }

    #[test]
    fn test_lexer_sized_numbers() {
        let src = "32'hDEAD_BEEF 8'b1010_0101 16'd1000 '0 '1";
        let mut lexer = Lexer::new(FileId(1), src);
        let tokens = lexer.tokenize();

        if let TokenKind::Number(ref v) = tokens[0].kind {
            assert_eq!(v.width(), 32);
            assert_eq!(v.to_u64(), Some(0xDEAD_BEEF));
        } else {
            panic!("Expected 32'hDEAD_BEEF");
        }

        if let TokenKind::Number(ref v) = tokens[1].kind {
            assert_eq!(v.width(), 8);
            assert_eq!(v.to_u64(), Some(0xA5));
        } else {
            panic!("Expected 8'b1010_0101");
        }

        if let TokenKind::Number(ref v) = tokens[3].kind {
            assert_eq!(v.width(), 1);
            assert_eq!(v.get_bit(0), Logic4::Zero);
        } else {
            panic!("Expected '0");
        }
    }

    #[test]
    fn test_parse_simple_alu() {
        let src = r#"
module alu #(parameter WIDTH = 32) (
    input wire [WIDTH-1:0] a,
    input wire [WIDTH-1:0] b,
    input wire [1:0] op,
    output reg [WIDTH-1:0] result,
    output wire zero
);
    assign zero = (result == 0);

    always @* begin
        case (op)
            2'b00: result = a + b;
            2'b01: result = a - b;
            2'b10: result = a & b;
            default: result = a | b;
        endcase
    end
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);

        let m = &file.modules[0];
        assert_eq!(m.name, "alu");
        assert_eq!(m.params.len(), 1);
        assert_eq!(m.params[0].name, "WIDTH");
        assert_eq!(m.ports.len(), 5);
        assert_eq!(m.items.len(), 2); // 1 assign, 1 always
    }

    #[test]
    fn test_parse_counter_with_clocked_always() {
        let src = r#"
module counter (
    input clk,
    input rst_n,
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
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);

        let m = &file.modules[0];
        assert_eq!(m.name, "counter");
        assert_eq!(m.ports.len(), 3);
    }

    #[test]
    fn test_parse_module_instance() {
        let src = r#"
module top (
    input clk,
    input [7:0] din,
    output [7:0] dout
);
    alu #(.WIDTH(8)) u_alu (
        .a(din),
        .b(8'h01),
        .op(2'b00),
        .result(dout)
    );
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);
        let m = &file.modules[0];
        assert_eq!(m.items.len(), 1);
        if let ModuleItem::Instance(ref inst) = m.items[0] {
            assert_eq!(inst.module_name, "alu");
            assert_eq!(inst.instance_name, "u_alu");
            assert_eq!(inst.param_bindings.len(), 1);
            assert_eq!(inst.port_bindings.len(), 4);
        } else {
            panic!("Expected ModuleItem::Instance");
        }
    }

    #[test]
    fn test_parse_sva_assertion() {
        let src = r#"
module arbiter (
    input clk,
    input req,
    input ack
);
    check_ack: assert property (@(posedge clk) req |-> ##[1:4] ack);
    check_rose: assert property (@(posedge clk) $rose(req) |=> ack);
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);
        let m = &file.modules[0];
        assert_eq!(m.items.len(), 2);
        if let ModuleItem::Assertion(ref asrt) = m.items[0] {
            assert_eq!(asrt.label.as_deref(), Some("check_ack"));
            assert_eq!(asrt.kind, AssertionKind::Assert);
            assert!(asrt.clock.is_some());
            assert!(asrt.expr_text.contains("|->"));
            assert!(asrt.expr_text.contains("##"));
        } else {
            panic!("Expected ModuleItem::Assertion");
        }
    }

    #[test]
    fn test_parse_gate_primitives_and_positional_bindings() {
        let src = r#"
module gate_demo (
    input wire A,
    input wire B,
    input wire C,
    output wire F
);
    wire w1, w2, w3, w4;

    not g1 (w2, A);
    and g2 (w1, w2, B);
    not g3 (w4, B);
    and g4 (w3, w1, C);
    or  g5 (F, w4, w3);

    // Anonymous gate primitives
    and (w1, w2, B);
    or  (F, w4, w3);
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);
        let m = &file.modules[0];
        assert_eq!(m.items.len(), 8);

        if let ModuleItem::Instance(ref inst) = m.items[1] {
            assert_eq!(inst.module_name, "not");
            assert_eq!(inst.instance_name, "g1");
            assert_eq!(inst.port_bindings.len(), 2);
            assert_eq!(inst.port_bindings[0].0, "out");
            assert_eq!(inst.port_bindings[1].0, "in0");
        } else {
            panic!("Expected ModuleItem::Instance for g1");
        }

        if let ModuleItem::Instance(ref inst) = m.items[6] {
            assert_eq!(inst.module_name, "and");
            assert!(inst.instance_name.starts_with("and_"));
            assert_eq!(inst.port_bindings.len(), 3);
            assert_eq!(inst.port_bindings[0].0, "out");
            assert_eq!(inst.port_bindings[1].0, "in0");
            assert_eq!(inst.port_bindings[2].0, "in1");
        } else {
            panic!("Expected anonymous gate primitive");
        }
    }

    #[test]
    fn test_parse_non_ansi_ports() {
        let src = r#"
module full_adder (a, b, cin, sum, cout);
    input a, b, cin;
    output sum, cout;
    wire a, b, cin;
    wire sum, cout;

    assign sum = a ^ b ^ cin;
    assign cout = (a & b) | (b & cin) | (a & cin);
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        let m = &file.modules[0];
        assert_eq!(m.ports.len(), 5);
        assert_eq!(m.ports[0].name, "a");
        assert_eq!(m.ports[0].direction, PortDirection::Input);
        assert_eq!(m.ports[3].name, "sum");
        assert_eq!(m.ports[3].direction, PortDirection::Output);
        assert_eq!(m.items.len(), 4); // 2 wire decls + 2 assigns
    }

    #[test]
    fn test_parse_multi_assign() {
        let src = r#"
module multi_assign (output wire x, y, z);
    assign x = 1'b0, y = 1'b1, z = x & y;
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        let m = &file.modules[0];
        assert_eq!(m.items.len(), 3);
        assert!(matches!(m.items[0], ModuleItem::ContinuousAssign(_)));
        assert!(matches!(m.items[1], ModuleItem::ContinuousAssign(_)));
        assert!(matches!(m.items[2], ModuleItem::ContinuousAssign(_)));
    }

    #[test]
    fn test_parse_multi_instance() {
        let src = r#"
module multi_inst (input a, b, output w1, w2);
    not g1(w1, a), g2(w2, b);
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        let m = &file.modules[0];
        assert_eq!(m.items.len(), 2);
        if let ModuleItem::Instance(ref i1) = m.items[0] {
            assert_eq!(i1.instance_name, "g1");
            assert_eq!(i1.module_name, "not");
        }
        if let ModuleItem::Instance(ref i2) = m.items[1] {
            assert_eq!(i2.instance_name, "g2");
            assert_eq!(i2.module_name, "not");
        }
    }

    #[test]
    fn test_parse_named_blocks_and_local_decls() {
        let src = r#"
module tb ();
    reg [7:0] arr [0:3];
    initial begin : init_block
        integer i;
        for (i = 0; i < 4; i = i + 1) begin : loop_b
            arr[i] = 8'h00;
        end : loop_b
    end : init_block
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);
    }

    #[test]
    fn test_parse_procedural_loops() {
        let src = r#"
module loop_mod (input clk, output reg [3:0] q);
    initial begin
        forever #10 q = ~q;
    end
    initial begin
        repeat (4) begin
            #5 q = q + 1;
        end
    end
    initial begin
        while (q < 4'd10) begin
            #2 q = q + 1;
        end
    end
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);
    }

    #[test]
    fn test_parse_casez_casex() {
        let src = r#"
module prio_enc (input [3:0] in, output reg [1:0] out);
    always @* begin
        casez (in)
            4'b1???: out = 2'd3;
            4'b01??: out = 2'd2;
            4'b001?: out = 2'd1;
            default: out = 2'd0;
        endcase
    end
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        let m = &file.modules[0];
        if let ModuleItem::ProceduralBlock(ref pb) = m.items[0] {
            if let Statement::Block(ref stmts) = pb.body {
                if let Statement::Case { kind, .. } = stmts[0] {
                    assert_eq!(kind, CaseKind::CaseZ);
                } else {
                    panic!("Expected Statement::Case");
                }
            }
        }
    }

    #[test]
    fn test_parse_indexed_part_select() {
        let src = r#"
module part_sel (input [31:0] data, output [7:0] byte0, byte1);
    assign byte0 = data[0 +: 8];
    assign byte1 = data[15 -: 8];
endmodule
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        let m = &file.modules[0];
        assert_eq!(m.items.len(), 2);
    }

    #[test]
    fn test_parse_compiler_directives() {
        let src = r#"
`timescale 1ns / 1ps
`default_nettype none
`resetall
`celldefine
module dummy (input a, output y);
    assign y = a;
endmodule
`endcelldefine
"#;
        let (file, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Diagnostics should be empty, got: {diags:?}");
        assert_eq!(file.modules.len(), 1);
        assert_eq!(file.modules[0].name, "dummy");
    }
}
