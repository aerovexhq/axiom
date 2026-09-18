pub mod completion;
pub mod hover;
pub mod linter;
pub mod server;
pub mod types;

pub use completion::VerilogCompletion;
pub use hover::VerilogHover;
pub use linter::VerilogLinter;
pub use server::LspServer;
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lint_syntax_error() {
        let code = "module broken ( input clk ;\n endmodule"; // missing closing parenthesis
        let diags = VerilogLinter::lint(code);
        assert!(!diags.is_empty(), "Should detect syntax error");
        assert_eq!(diags[0].code, "AXIOM_E001_SYNTAX_ERROR");
    }

    #[test]
    fn test_lint_blocking_in_always_ff() {
        let code = r#"
module dff (
    input wire clk,
    input wire d,
    output reg q
);
    always @(posedge clk) begin
        q = d; // Bad! Blocking assignment in sequential logic
    end
endmodule
"#;
        let diags = VerilogLinter::lint(code);
        let blocking_diag = diags.iter().find(|d| d.code == "AXIOM_W001_BLOCKING_IN_SEQ");
        assert!(blocking_diag.is_some(), "Should detect blocking assignment in clocked always block");
    }

    #[test]
    fn test_lint_nonblocking_in_comb() {
        let code = r#"
module comb (
    input wire a,
    input wire b,
    output reg y
);
    always @(*) begin
        y <= a & b; // Bad! Non-blocking assignment in combinational logic
    end
endmodule
"#;
        let diags = VerilogLinter::lint(code);
        let nonblocking_diag = diags.iter().find(|d| d.code == "AXIOM_W002_NONBLOCKING_IN_COMB");
        assert!(nonblocking_diag.is_some(), "Should detect non-blocking assignment in combinational block");
    }

    #[test]
    fn test_lint_unused_and_undriven_signals() {
        let code = r#"
module test_wires (
    input wire clk,
    input wire in1,
    output wire out1
);
    wire dead_wire; // Unused and undriven
    wire driven_only; // Driven but unused
    wire read_only; // Undriven but read

    assign driven_only = in1;
    assign out1 = read_only;
endmodule
"#;
        let diags = VerilogLinter::lint(code);
        assert!(diags.iter().any(|d| d.code == "AXIOM_W004_UNUSED_SIGNAL" && d.message.contains("dead_wire")));
        assert!(diags.iter().any(|d| d.code == "AXIOM_W003_UNDRIVEN_NET" && d.message.contains("read_only")));
        assert!(diags.iter().any(|d| d.code == "AXIOM_W004_UNUSED_SIGNAL" && d.message.contains("driven_only")));
    }

    #[test]
    fn test_lint_multidriver_contention() {
        let code = r#"
module contention (
    input wire a,
    input wire b,
    output wire y
);
    assign y = a;
    assign y = b; // Contention! Multiple continuous assignments
endmodule
"#;
        let diags = VerilogLinter::lint(code);
        let multi_diag = diags.iter().find(|d| d.code == "AXIOM_E002_MULTI_DRIVER");
        assert!(multi_diag.is_some(), "Should detect multi-driver contention on wire y");
    }

    #[test]
    fn test_hover_keyword_and_signal() {
        let code = r#"
module counter (
    input wire clk,
    output reg [7:0] count
);
    always @(posedge clk) begin
        count <= count + 1'b1;
    end
endmodule
"#;
        // Hover over 'always' at line 6, col 6
        let h_always = VerilogHover::hover(code, 6, 6);
        assert!(h_always.is_some());
        assert!(h_always.unwrap().contents.contains("`always` Block"));

        // Hover over 'clk' at line 3, col 16
        let h_clk = VerilogHover::hover(code, 3, 16);
        assert!(h_clk.is_some());
        assert!(h_clk.unwrap().contents.contains("Port `clk`"));
    }

    #[test]
    fn test_completion_snippets_and_nets() {
        let code = r#"
module my_alu (
    input wire [3:0] opcode,
    output reg [7:0] result
);
endmodule
"#;
        let comps = VerilogCompletion::complete(code, 5, 1);
        assert!(comps.iter().any(|c| c.label == "always @(posedge clk)"));
        assert!(comps.iter().any(|c| c.label == "opcode"));
        assert!(comps.iter().any(|c| c.label == "result"));
    }
}
