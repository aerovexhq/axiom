use super::*;
use crate::elaborate;
use axiom_core::FileId;
use axiom_syntax::parse_hdl;

#[test]
fn test_fsm_detection_uart() {
    let src = r#"
module uart_transceiver (
    input wire clk,
    input wire rst_n,
    input wire tx_start,
    output reg tx_serial,
    output reg tx_busy
);
    localparam TX_IDLE  = 2'b00;
    localparam TX_START = 2'b01;
    localparam TX_DATA  = 2'b10;
    localparam TX_STOP  = 2'b11;

    reg [1:0] tx_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            tx_state  <= TX_IDLE;
            tx_serial <= 1'b1;
            tx_busy   <= 1'b0;
        end else begin
            case (tx_state)
                TX_IDLE: begin
                    tx_serial <= 1'b1;
                    tx_busy   <= 1'b0;
                    if (tx_start) begin
                        tx_busy  <= 1'b1;
                        tx_state <= TX_START;
                    end
                end
                TX_START: begin
                    tx_serial <= 1'b0;
                    tx_state  <= TX_DATA;
                end
                TX_DATA: begin
                    tx_serial <= 1'b1;
                    tx_state  <= TX_STOP;
                end
                TX_STOP: begin
                    tx_serial <= 1'b1;
                    tx_state  <= TX_IDLE;
                end
                default: tx_state <= TX_IDLE;
            endcase
        end
    end
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty(), "Parse diags: {:?}", diags);

    let circuit = elaborate(&ast, "uart_transceiver").expect("Elab failed");
    let graph = synthesize_microarch(&circuit, Some(&ast));

    assert!(!graph.blocks.is_empty(), "Expected macro blocks");
    let fsm_block = graph.blocks.iter().find(|b| matches!(b.kind, MacroKind::Fsm(_)));
    assert!(fsm_block.is_some(), "Expected FSM block for uart");

    if let Some(MacroBlock { kind: MacroKind::Fsm(fsm), .. }) = fsm_block {
        assert_eq!(fsm.state_reg, "tx_state");
        assert!(fsm.states.len() >= 4, "Expected 4 states, got {}", fsm.states.len());
        assert_eq!(fsm.reset_state, "TX_IDLE");
        assert!(!fsm.transitions.is_empty(), "Expected state transitions");
    }
}

#[test]
fn test_fsm_detection_spi() {
    let src = r#"
module spi_master (
    input wire clk,
    input wire rst_n,
    input wire start,
    output reg busy,
    output reg done
);
    localparam STATE_IDLE = 2'b00;
    localparam STATE_TX   = 2'b01;
    localparam STATE_DONE = 2'b10;

    reg [1:0] state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= STATE_IDLE;
            busy  <= 1'b0;
            done  <= 1'b0;
        end else begin
            case (state)
                STATE_IDLE: begin
                    busy <= 1'b0;
                    if (start) begin
                        busy  <= 1'b1;
                        state <= STATE_TX;
                    end
                end
                STATE_TX: begin
                    state <= STATE_DONE;
                end
                STATE_DONE: begin
                    done  <= 1'b1;
                    state <= STATE_IDLE;
                end
                default: state <= STATE_IDLE;
            endcase
        end
    end
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "spi_master").expect("Elab failed");
    let graph = synthesize_microarch(&circuit, Some(&ast));

    let fsm_block = graph.blocks.iter().find(|b| matches!(b.kind, MacroKind::Fsm(_)));
    assert!(fsm_block.is_some(), "Expected FSM block for spi");
}

#[test]
fn test_alu_detection_8bit() {
    let src = r#"
module alu_8bit (
    input wire [2:0] opcode,
    input wire [7:0] a,
    input wire [7:0] b,
    output reg [7:0] result,
    output wire zero_flag
);
    always @(*) begin
        case (opcode)
            3'b000: result = a + b;
            3'b001: result = a - b;
            3'b010: result = a & b;
            3'b011: result = a | b;
            3'b100: result = a ^ b;
            default: result = 8'h00;
        endcase
    end
    assign zero_flag = (result == 8'h00);
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "alu_8bit").expect("Elab failed");
    let graph = synthesize_microarch(&circuit, Some(&ast));

    let alu_block = graph.blocks.iter().find(|b| matches!(b.kind, MacroKind::Alu(_)));
    assert!(alu_block.is_some(), "Expected ALU block");

    if let Some(MacroBlock { kind: MacroKind::Alu(alu), .. }) = alu_block {
        assert_eq!(alu.opcode_signal, "opcode");
        assert!(alu.operations.len() >= 5);
        assert!(alu.flags.iter().any(|f| f.name == "ZERO"));
    }
}

#[test]
fn test_regfile_detection_riscv() {
    let src = r#"
module riscv_mini_core (
    input wire clk,
    input wire rst_n,
    input wire step_en,
    output reg [31:0] pc
);
    wire [6:0] opcode = 7'b0010011;
    wire [4:0] rd = 5'd1;
    wire [2:0] funct3 = 3'd0;
    wire [4:0] rs1 = 5'd0;
    wire [4:0] rs2 = 5'd0;
    wire [31:0] imm_i = 32'd5;

    reg [31:0] regfile [0:7];

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            pc <= 32'd0;
        end else if (step_en) begin
            pc <= pc + 32'd4;
        end
    end
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "riscv_mini_core").expect("Elab failed");
    let graph = synthesize_microarch(&circuit, Some(&ast));

    let regfile_block = graph.blocks.iter().find(|b| matches!(b.kind, MacroKind::RegisterFile(_)));
    assert!(regfile_block.is_some(), "Expected Register File block");

    let pc_block = graph.blocks.iter().find(|b| matches!(b.kind, MacroKind::DatapathReg(_)));
    assert!(pc_block.is_some(), "Expected PC register block");
}

#[test]
fn test_comb_logic_synthesis() {
    let src = r#"
module logic_circuit (
    input wire A,
    input wire B,
    input wire C,
    output wire F
);
    assign F = (A & B) | C;
endmodule
"#;
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty());

    let circuit = elaborate(&ast, "logic_circuit").expect("Elab failed");
    let graph = synthesize_microarch(&circuit, Some(&ast));

    assert_eq!(graph.blocks.len(), 1);
    assert_eq!(graph.blocks[0].name, "logic_circuit");
}
