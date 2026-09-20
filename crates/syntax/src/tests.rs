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
}
