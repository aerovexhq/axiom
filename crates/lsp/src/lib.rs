pub mod completion;
pub mod hover;
pub mod linter;
pub mod mem;
pub mod primitives_doc;
pub mod server;
pub mod types;
pub mod vhdl;
pub mod xdc;

pub use completion::VerilogCompletion;
pub use hover::VerilogHover;
pub use linter::VerilogLinter;
pub use mem::{MemCompletion, MemHover, MemLinter};
pub use server::LspServer;
pub use types::*;
pub use vhdl::{VhdlCompletion, VhdlHover, VhdlLinter};
pub use xdc::{XdcCompletion, XdcHover, XdcLinter};

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

    #[test]
    fn test_xdc_lint_clean_default_timing_file() {
        let default_xdc = r#"# Vivado Constraints: timing.xdc
# Artix-7 xc7a35t-csg324-1 package pin assignments

# Inputs: Switches SW0 (A), SW1 (B), SW2 (C)
set_property PACKAGE_PIN J15 [get_ports {A}]
set_property IOSTANDARD LVCMOS33 [get_ports {A}]

set_property PACKAGE_PIN L16 [get_ports {B}]
set_property IOSTANDARD LVCMOS33 [get_ports {B}]

set_property PACKAGE_PIN M13 [get_ports {C}]
set_property IOSTANDARD LVCMOS33 [get_ports {C}]

# Output: LED LD0 (F)
set_property PACKAGE_PIN H17 [get_ports {F}]
set_property IOSTANDARD LVCMOS33 [get_ports {F}]
"#;
        let diags = XdcLinter::lint(default_xdc);
        assert!(
            diags.is_empty(),
            "Default timing.xdc must have 0 errors, found: {:?}",
            diags
        );
    }

    #[test]
    fn test_xdc_lint_errors_and_warnings() {
        let bad_xdc = r#"
set_proprty PACKAGE_PIN J15 [get_ports {A}]
set_property UNKNOWN_PROP VAL [get_ports {B}]
set_property IOSTANDARD BOGUS_STD [get_ports {C}]
set_property PACKAGE_PIN J15 [get_ports {A}
create_clock -name clk_100mhz
"#;
        let diags = XdcLinter::lint(bad_xdc);
        assert!(diags.iter().any(|d| d.code == "AXIOM_XDC_E001_UNKNOWN_COMMAND"));
        assert!(diags.iter().any(|d| d.code == "AXIOM_XDC_W001_UNKNOWN_PROPERTY"));
        assert!(diags.iter().any(|d| d.code == "AXIOM_XDC_W002_UNKNOWN_IOSTANDARD"));
        assert!(diags.iter().any(|d| d.code == "AXIOM_XDC_E003_UNCLOSED_DELIMITER"));
        assert!(diags.iter().any(|d| d.code == "AXIOM_XDC_E004_MISSING_CLOCK_PERIOD"));
    }

    #[test]
    fn test_xdc_hover_and_completion() {
        let code = "set_property PACKAGE_PIN J15 [get_ports {A}]\ncreate_clock -period 10 [get_ports clk]";
        
        let h_prop = XdcHover::hover(code, 1, 5);
        assert!(h_prop.is_some());
        assert!(h_prop.unwrap().contents.contains("`set_property`"));

        let h_pin = XdcHover::hover(code, 1, 16);
        assert!(h_pin.is_some());
        assert!(h_pin.unwrap().contents.contains("`PACKAGE_PIN`"));

        let comps = XdcCompletion::complete(code, 1, 1);
        assert!(comps.iter().any(|c| c.label.contains("PACKAGE_PIN")));
        assert!(comps.iter().any(|c| c.label == "create_clock"));
        assert!(comps.iter().any(|c| c.label == "LVCMOS33"));
    }

    #[test]
    fn test_lint_all_default_design_sources() {
        let logic_circuit = r#"
`timescale 1ns / 1ps

module logic_circuit (
    input  wire A,
    input  wire B,
    input  wire C,
    output wire F
);
  wire w1;
  wire w2;
  wire w3;
  wire w4;

  assign w1 = ~A;
  assign w2 = w1 & B;
  assign w3 = w2 & C;
  assign w4 = ~B;
  assign F  = w3 | w4;
endmodule
"#;
        let diags = VerilogLinter::lint(logic_circuit);
        assert!(diags.is_empty(), "logic_circuit.v should have 0 diagnostics, got: {:?}", diags);

        let alu = r#"
`timescale 1ns / 1ps

module alu_8bit (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [2:0]  opcode,
    input  wire [7:0]  a,
    input  wire [7:0]  b,
    output reg  [7:0]  result,
    output wire        zero_flag,
    output reg         carry_flag
);
  reg [8:0] next_calc;

  always @(*) begin
    case (opcode)
      3'b000: next_calc = a + b;
      3'b001: next_calc = a - b;
      3'b010: next_calc = {1'b0, a & b};
      3'b011: next_calc = {1'b0, a | b};
      3'b100: next_calc = {1'b0, a ^ b};
      3'b101: next_calc = {1'b0, a << 1};
      3'b110: next_calc = {1'b0, a >> 1};
      3'b111: next_calc = {1'b0, ~a};
      default: next_calc = 9'b0;
    endcase
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      result     <= 8'h00;
      carry_flag <= 1'b0;
    end else begin
      result     <= next_calc[7:0];
      carry_flag <= next_calc[8];
    end
  end

  assign zero_flag = (result == 8'h00);
endmodule
"#;
        let diags_alu = VerilogLinter::lint(alu);
        assert!(diags_alu.is_empty(), "alu_8bit.v should have 0 diagnostics, got: {:?}", diags_alu);
    }

    #[test]
    fn test_lint_default_untitled_v() {
        let untitled = r#"// Vivado Design Source: untitled.v
// Axiom EDA Studio — RTL Design Module
`timescale 1ns / 1ps

module untitled (
    input  wire clk,
    input  wire rst_n,
    input  wire [7:0] din,
    output reg  [7:0] dout
);

    // Enter your RTL hardware architecture here
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            dout <= 8'h00;
        end else begin
            dout <= din;
        end
    end

endmodule
"#;
        let diags = VerilogLinter::lint(untitled);
        assert!(diags.is_empty(), "untitled.v should have 0 diagnostics, got: {:?}", diags);
    }

    #[test]
    fn test_lint_all_default_project_files() {
        let uart_top = r#"
`timescale 1ns / 1ps

module uart_transceiver #(
    parameter CLK_FREQ_HZ = 50_000_000,
    parameter BAUD_RATE   = 115_200
)(
    input  wire       clk,
    input  wire       rst_n,
    input  wire       tx_start,
    input  wire [7:0] tx_data,
    output reg        tx_serial,
    output reg        tx_busy,
    output reg        tx_done,
    input  wire       rx_serial,
    output reg  [7:0] rx_data,
    output reg        rx_ready,
    output reg        rx_error
);

  localparam CLKS_PER_BIT = 16;
  localparam [1:0] TX_IDLE  = 2'b00,
                   TX_START = 2'b01,
                   TX_DATA  = 2'b10,
                   TX_STOP  = 2'b11;

  localparam [1:0] RX_IDLE  = 2'b00,
                   RX_START = 2'b01,
                   RX_DATA  = 2'b10,
                   RX_STOP  = 2'b11;

  reg [1:0] tx_state;
  reg [7:0] tx_clk_cnt;
  reg [2:0] tx_bit_idx;
  reg [7:0] tx_shift_reg;

  reg [1:0] rx_state;
  reg [7:0] rx_clk_cnt;
  reg [2:0] rx_bit_idx;
  reg [7:0] rx_shift_reg;
  reg       rx_sync_0, rx_sync_1;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rx_sync_0 <= 1'b1;
      rx_sync_1 <= 1'b1;
    end else begin
      rx_sync_0 <= rx_serial;
      rx_sync_1 <= rx_sync_0;
    end
  end

  // UART Transmitter FSM
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_state     <= TX_IDLE;
      tx_serial    <= 1'b1;
      tx_busy      <= 1'b0;
      tx_done      <= 1'b0;
      tx_clk_cnt   <= 8'd0;
      tx_bit_idx   <= 3'd0;
      tx_shift_reg <= 8'd0;
    end else begin
      tx_done <= 1'b0;
      case (tx_state)
        TX_IDLE: begin
          tx_serial  <= 1'b1;
          tx_busy    <= 1'b0;
          tx_clk_cnt <= 8'd0;
          if (tx_start) begin
            tx_busy      <= 1'b1;
            tx_shift_reg <= tx_data;
            tx_state     <= TX_START;
          end
        end
        TX_START: begin
          tx_serial <= 1'b0;
          if (tx_clk_cnt < CLKS_PER_BIT - 1)
            tx_clk_cnt <= tx_clk_cnt + 1'b1;
          else begin
            tx_clk_cnt <= 8'd0;
            tx_bit_idx <= 3'd0;
            tx_state   <= TX_DATA;
          end
        end
        TX_DATA: begin
          tx_serial <= tx_shift_reg[tx_bit_idx];
          if (tx_clk_cnt < CLKS_PER_BIT - 1)
            tx_clk_cnt <= tx_clk_cnt + 1'b1;
          else begin
            tx_clk_cnt <= 8'd0;
            if (tx_bit_idx < 3'd7)
              tx_bit_idx <= tx_bit_idx + 1'b1;
            else
              tx_state <= TX_STOP;
          end
        end
        TX_STOP: begin
          tx_serial <= 1'b1;
          if (tx_clk_cnt < CLKS_PER_BIT - 1)
            tx_clk_cnt <= tx_clk_cnt + 1'b1;
          else begin
            tx_clk_cnt <= 8'd0;
            tx_busy    <= 1'b0;
            tx_done    <= 1'b1;
            tx_state   <= TX_IDLE;
          end
        end
        default: begin
          tx_state <= TX_IDLE;
        end
      endcase
    end
  end

  // UART Receiver FSM
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rx_state     <= RX_IDLE;
      rx_data      <= 8'd0;
      rx_ready     <= 1'b0;
      rx_error     <= 1'b0;
      rx_clk_cnt   <= 8'd0;
      rx_bit_idx   <= 3'd0;
      rx_shift_reg <= 8'd0;
    end else begin
      rx_ready <= 1'b0;
      case (rx_state)
        RX_IDLE: begin
          rx_clk_cnt <= 8'd0;
          rx_bit_idx <= 3'd0;
          if (!rx_sync_1)
            rx_state <= RX_START;
        end
        RX_START: begin
          if (rx_clk_cnt == (CLKS_PER_BIT / 2)) begin
            if (!rx_sync_1) begin
              rx_clk_cnt <= 8'd0;
              rx_state   <= RX_DATA;
            end else
              rx_state <= RX_IDLE;
          end else
            rx_clk_cnt <= rx_clk_cnt + 1'b1;
        end
        RX_DATA: begin
          if (rx_clk_cnt < CLKS_PER_BIT - 1)
            rx_clk_cnt <= rx_clk_cnt + 1'b1;
          else begin
            rx_clk_cnt <= 8'd0;
            rx_shift_reg[rx_bit_idx] <= rx_sync_1;
            if (rx_bit_idx < 3'd7)
              rx_bit_idx <= rx_bit_idx + 1'b1;
            else
              rx_state <= RX_STOP;
          end
        end
        RX_STOP: begin
          if (rx_clk_cnt < CLKS_PER_BIT - 1)
            rx_clk_cnt <= rx_clk_cnt + 1'b1;
          else begin
            rx_clk_cnt <= 8'd0;
            if (rx_sync_1) begin
              rx_data  <= rx_shift_reg;
              rx_ready <= 1'b1;
              rx_error <= 1'b0;
            end else begin
              rx_error <= 1'b1;
            end
            rx_state <= RX_IDLE;
          end
        end
        default: begin
          rx_state <= RX_IDLE;
        end
      endcase
    end
  end
endmodule
"#;
        assert!(VerilogLinter::lint(uart_top).is_empty());

        let spi_master = r#"
`timescale 1ns / 1ps

module spi_master #(
    parameter CPOL = 1'b0,
    parameter CPHA = 1'b0
)(
    input  wire       clk,
    input  wire       rst_n,
    input  wire       start,
    input  wire [7:0] tx_byte,
    output reg  [7:0] rx_byte,
    output reg        busy,
    output reg        done,
    output reg        sck,
    output reg        cs_n,
    output reg        mosi,
    input  wire       miso
);

  localparam [1:0] S_IDLE  = 2'b00,
                   S_TRANS = 2'b01,
                   S_DONE  = 2'b10;

  reg [1:0] state;
  reg [3:0] bit_cnt;
  reg [3:0] clk_div;
  reg [7:0] tx_shift;
  reg [7:0] rx_shift;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state    <= S_IDLE;
      sck      <= CPOL;
      cs_n     <= 1'b1;
      mosi     <= 1'b0;
      busy     <= 1'b0;
      done     <= 1'b0;
      bit_cnt  <= 4'd0;
      clk_div  <= 4'd0;
      rx_byte  <= 8'd0;
      tx_shift <= 8'd0;
      rx_shift <= 8'd0;
    end else begin
      done <= 1'b0;
      case (state)
        S_IDLE: begin
          cs_n    <= 1'b1;
          sck     <= CPOL;
          busy    <= 1'b0;
          clk_div <= 4'd0;
          bit_cnt <= 4'd0;
          if (start) begin
            busy     <= 1'b1;
            cs_n     <= 1'b0;
            tx_shift <= tx_byte;
            mosi     <= tx_byte[7];
            state    <= S_TRANS;
          end
        end
        S_TRANS: begin
          clk_div <= clk_div + 1'b1;
          if (clk_div == 4'd1) begin
            sck <= ~sck;
            if (sck == CPOL) begin
              rx_shift <= {rx_shift[6:0], miso};
            end else begin
              tx_shift <= {tx_shift[6:0], 1'b0};
              mosi     <= tx_shift[6];
              bit_cnt  <= bit_cnt + 1'b1;
              if (bit_cnt == 4'd7)
                state <= S_DONE;
            end
            clk_div <= 4'd0;
          end
        end
        S_DONE: begin
          cs_n    <= 1'b1;
          sck     <= CPOL;
          busy    <= 1'b0;
          done    <= 1'b1;
          rx_byte <= rx_shift;
          state   <= S_IDLE;
        end
        default: begin
          state <= S_IDLE;
        end
      endcase
    end
  end
endmodule
"#;
        assert!(VerilogLinter::lint(spi_master).is_empty());

        let pwm_top = r#"
`timescale 1ns / 1ps

module pwm_generator (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       enable,
    input  wire [7:0] duty_cycle,
    input  wire [3:0] dead_time,
    output reg        pwm_high,
    output reg        pwm_low,
    output reg  [7:0] period_count,
    output wire       cycle_sync
);

  reg raw_pwm;
  reg [3:0] dt_cnt_high;
  reg [3:0] dt_cnt_low;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      period_count <= 8'd0;
      raw_pwm      <= 1'b0;
    end else if (enable) begin
      period_count <= period_count + 1'b1;
      raw_pwm      <= (period_count < duty_cycle);
    end else begin
      period_count <= 8'd0;
      raw_pwm      <= 1'b0;
    end
  end

  assign cycle_sync = (period_count == 8'h00);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      pwm_high    <= 1'b0;
      pwm_low     <= 1'b0;
      dt_cnt_high <= 4'd0;
      dt_cnt_low  <= 4'd0;
    end else if (!enable) begin
      pwm_high    <= 1'b0;
      pwm_low     <= 1'b0;
    end else begin
      if (raw_pwm) begin
        pwm_low <= 1'b0;
        if (dt_cnt_high >= dead_time)
          pwm_high <= 1'b1;
        else
          dt_cnt_high <= dt_cnt_high + 1'b1;
        dt_cnt_low <= 4'd0;
      end else begin
        pwm_high <= 1'b0;
        if (dt_cnt_low >= dead_time)
          pwm_low <= 1'b1;
        else
          dt_cnt_low <= dt_cnt_low + 1'b1;
        dt_cnt_high <= 4'd0;
      end
    end
  end
endmodule
"#;
        assert!(VerilogLinter::lint(pwm_top).is_empty());

        let riscv_top = r#"
`timescale 1ns / 1ps

module riscv_mini_core (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        step_en,
    output reg  [31:0] pc,
    output reg  [31:0] instr,
    output reg  [31:0] alu_result,
    output reg  [31:0] reg_x1,
    output reg  [31:0] reg_x2,
    output wire        branch_taken
);

  always @(*) begin
    case (pc[4:2])
      3'b000: instr = 32'h00500093;
      3'b001: instr = 32'h00A00113;
      3'b010: instr = 32'h002081B3;
      3'b011: instr = 32'h40110233;
      3'b100: instr = 32'h0020C2B3;
      3'b101: instr = 32'h0010E333;
      3'b110: instr = 32'h0020F3B3;
      3'b111: instr = 32'h0000006F;
      default: instr = 32'h00000013;
    endcase
  end

  wire [6:0] opcode = instr[6:0];
  wire [4:0] rd     = instr[11:7];
  wire [2:0] funct3 = instr[14:12];
  wire [4:0] rs1    = instr[19:15];
  wire [4:0] rs2    = instr[24:20];
  wire [6:0] funct7 = instr[31:25];
  wire [31:0] imm_i = {{20{instr[31]}}, instr[31:20]};

  reg [31:0] regfile [0:7];

  wire [31:0] src_a = (rs1[2:0] == 3'd0) ? 32'd0 : regfile[rs1[2:0]];
  wire [31:0] src_b = (rs2[2:0] == 3'd0) ? 32'd0 : regfile[rs2[2:0]];

  always @(*) begin
    case (funct3)
      3'b000:  alu_result = (opcode == 7'b0110011 && funct7[5]) ? (src_a - src_b) : (src_a + (opcode == 7'b0010011 ? imm_i : src_b));
      3'b100:  alu_result = src_a ^ (opcode == 7'b0010011 ? imm_i : src_b);
      3'b110:  alu_result = src_a | (opcode == 7'b0010011 ? imm_i : src_b);
      3'b111:  alu_result = src_a & (opcode == 7'b0010011 ? imm_i : src_b);
      default: alu_result = src_a + imm_i;
    endcase
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      pc         <= 32'h00000000;
      regfile[0] <= 32'h00000000;
      regfile[1] <= 32'h00000000;
      regfile[2] <= 32'h00000000;
      regfile[3] <= 32'h00000000;
      regfile[4] <= 32'h00000000;
      regfile[5] <= 32'h00000000;
      regfile[6] <= 32'h00000000;
      regfile[7] <= 32'h00000000;
    end else if (step_en) begin
      if (opcode == 7'b1101111)
        pc <= pc;
      else
        pc <= pc + 32'd4;

      if (rd[2:0] != 3'd0) begin
        regfile[rd[2:0]] <= alu_result;
      end
    end
  end

  always @(*) begin
    reg_x1 = regfile[1];
    reg_x2 = regfile[2];
  end

  assign branch_taken = (opcode == 7'b1101111);
endmodule
"#;
        println!("riscv_top diags: {:?}", VerilogLinter::lint(riscv_top));

        let tb_logic_circuit = r#"
`timescale 1ns / 1ps

module tb_logic_circuit;
  reg  A;
  reg  B;
  reg  C;
  wire F;

  logic_circuit uut (
    .A(A),
    .B(B),
    .C(C),
    .F(F)
  );

  initial begin
    $dumpfile("logic_circuit.vcd");
    $dumpvars(0, tb_logic_circuit);

    A = 0; B = 0; C = 0; #10;
    A = 0; B = 0; C = 1; #10;
    A = 0; B = 1; C = 0; #10;
    A = 0; B = 1; C = 1; #10;
    A = 1; B = 0; C = 0; #10;
    A = 1; B = 0; C = 1; #10;
    A = 1; B = 1; C = 0; #10;
    A = 1; B = 1; C = 1; #10;

    $finish;
  end
endmodule
"#;
        println!("tb_logic_circuit diags: {:?}", VerilogLinter::lint(tb_logic_circuit));

        let tb_riscv = r#"
`timescale 1ns / 1ps

module tb_riscv;
  reg clk;
  reg rst_n;
  reg step_en;
  wire [31:0] pc;
  wire [31:0] instr;
  wire [31:0] alu_result;
  wire [31:0] reg_x1;
  wire [31:0] reg_x2;
  wire branch_taken;

  riscv_mini_core uut (
    .clk(clk),
    .rst_n(rst_n),
    .step_en(step_en),
    .pc(pc),
    .instr(instr),
    .alu_result(alu_result),
    .reg_x1(reg_x1),
    .reg_x2(reg_x2),
    .branch_taken(branch_taken)
  );

  always #5 clk = ~clk;

  initial begin
    clk = 0;
    rst_n = 0;
    step_en = 1;
    #20 rst_n = 1;
    #200 $finish;
  end
endmodule
"#;
        println!("tb_riscv diags: {:?}", VerilogLinter::lint(tb_riscv));

        let alu_tb = r#"
`timescale 1ns / 1ps

module alu_tb;
  reg clk;
  reg rst_n;
  reg [2:0] opcode;
  reg [7:0] a, b;
  wire [7:0] result;
  wire zero_flag, carry_flag;

  alu_8bit uut (
    .clk(clk),
    .rst_n(rst_n),
    .opcode(opcode),
    .a(a),
    .b(b),
    .result(result),
    .zero_flag(zero_flag),
    .carry_flag(carry_flag)
  );

  always #5 clk = ~clk;

  initial begin
    clk = 0;
    rst_n = 0;
    opcode = 3'b000;
    a = 8'd10;
    b = 8'd20;
    #15 rst_n = 1;
    #20 opcode = 3'b001;
    #20 opcode = 3'b100;
    #50 $finish;
  end
endmodule
"#;
        println!("alu_tb diags: {:?}", VerilogLinter::lint(alu_tb));

        let counter_glitch = r#"
`timescale 1ns / 1ps

module counter_glitch_demo (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       enable,
    input  wire       up_down,
    output reg  [7:0] count,
    output wire       terminal_count,
    output wire       glitch_hazard_wire
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= 8'h00;
    end else if (enable) begin
      if (up_down)
        count <= count + 1'b1;
      else
        count <= count - 1'b1;
    end
  end

  assign terminal_count = (count == 8'hFF);

  wire path_a = count[0] & count[1];
  wire path_b = count[0] ^ count[1];
  assign glitch_hazard_wire = path_a ^ path_b;

endmodule
"#;
        assert!(VerilogLinter::lint(counter_glitch).is_empty());
        assert!(VerilogLinter::lint(riscv_top).is_empty());
        assert!(VerilogLinter::lint(tb_logic_circuit).is_empty());
        assert!(VerilogLinter::lint(tb_riscv).is_empty());
        assert!(VerilogLinter::lint(alu_tb).is_empty());

        let add_source_tb = r#"
`timescale 1ns / 1ps

module testbench;
  reg clk;
  reg rst_n;

  always #5 clk = ~clk;

  initial begin
    clk = 0;
    rst_n = 0;
    #20 rst_n = 1;

    #500;
    $display("Simulation completed successfully at %0t ps (rst_n=%b)", $time, rst_n);
    $finish;
  end
endmodule
"#;
        assert!(VerilogLinter::lint(add_source_tb).is_empty());

        let top_v = r#"
`timescale 1ns / 1ps

module top (
    input  wire clk,
    input  wire rst_n,
    input  wire [7:0] data_in,
    output reg  [7:0] data_out
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      data_out <= 8'h00;
    else
      data_out <= data_in;
  end

endmodule
"#;
        assert!(VerilogLinter::lint(top_v).is_empty());

        let soc_subsystem = r#"
`timescale 1ns / 1ps

module clk_divider (
    input  wire clk_in,
    input  wire rst_n,
    output reg  clk_out
);
  reg [3:0] div_cnt;

  always @(posedge clk_in or negedge rst_n) begin
    if (!rst_n) begin
      div_cnt <= 4'd0;
      clk_out <= 1'b0;
    end else if (div_cnt == 4'd4) begin
      div_cnt <= 4'd0;
      clk_out <= ~clk_out;
    end else begin
      div_cnt <= div_cnt + 1'b1;
    end
  end
endmodule

module soc_subsystem_top (
    input  wire        sys_clk,
    input  wire        sys_rst_n,
    input  wire [7:0]  data_in,
    output wire [15:0] accum_out,
    output wire        core_heartbeat
);

  wire divided_clk;

  clk_divider u_div (
      .clk_in(sys_clk),
      .rst_n(sys_rst_n),
      .clk_out(divided_clk)
  );

  reg [15:0] accumulator;
  always @(posedge divided_clk or negedge sys_rst_n) begin
    if (!sys_rst_n)
      accumulator <= 16'h0000;
    else
      accumulator <= accumulator + data_in;
  end

  assign accum_out = accumulator;
  assign core_heartbeat = divided_clk;

endmodule
"#;
        assert!(VerilogLinter::lint(soc_subsystem).is_empty());
    }

    #[test]
    fn test_lint_all_default_xdc_files() {
        let riscv_xdc = r#"
## Vivado Timing Constraints: timing.xdc
## Target: Artix-7 xc7a35t-csg324-1
create_clock -period 10.000 -name sys_clk_pin -waveform {0.000 5.000} [get_ports clk]

set_input_delay -clock [get_clocks sys_clk_pin] -min -add_delay 1.500 [get_ports rst_n]
set_input_delay -clock [get_clocks sys_clk_pin] -max -add_delay 3.000 [get_ports rst_n]
set_input_delay -clock [get_clocks sys_clk_pin] -min -add_delay 1.200 [get_ports step_en]
set_input_delay -clock [get_clocks sys_clk_pin] -max -add_delay 2.800 [get_ports step_en]

set_output_delay -clock [get_clocks sys_clk_pin] -min -add_delay 1.000 [get_ports {pc[*]}]
set_output_delay -clock [get_clocks sys_clk_pin] -max -add_delay 3.500 [get_ports {pc[*]}]
set_output_delay -clock [get_clocks sys_clk_pin] -min -add_delay 1.000 [get_ports {alu_result[*]}]
set_output_delay -clock [get_clocks sys_clk_pin] -max -add_delay 3.800 [get_ports {alu_result[*]}]
"#;
        assert!(XdcLinter::lint(riscv_xdc).is_empty());

        let uart_xdc = r#"
## Vivado Physical & Timing Constraints: uart_pins.xdc
create_clock -period 10.000 -name sys_clk [get_ports clk]

set_property PACKAGE_PIN E3 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]

set_property PACKAGE_PIN C12 [get_ports rst_n]
set_property IOSTANDARD LVCMOS33 [get_ports rst_n]

set_property PACKAGE_PIN D4 [get_ports tx_serial]
set_property IOSTANDARD LVCMOS33 [get_ports tx_serial]

set_property PACKAGE_PIN C4 [get_ports rx_serial]
set_property IOSTANDARD LVCMOS33 [get_ports rx_serial]
"#;
        assert!(XdcLinter::lint(uart_xdc).is_empty());

        let spi_xdc = r#"
## SPI Timing Constraints: spi_timing.xdc
create_clock -period 10.000 -name sys_clk [get_ports clk]
set_output_delay -clock [get_clocks sys_clk] 2.000 [get_ports {sck cs_n mosi}]
set_input_delay -clock [get_clocks sys_clk] 1.500 [get_ports miso]
"#;
        assert!(XdcLinter::lint(spi_xdc).is_empty());

        let pwm_xdc = r#"
## PWM Constraints: pwm_pins.xdc
create_clock -period 10.000 -name clk [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports {pwm_high pwm_low}]
"#;
        assert!(XdcLinter::lint(pwm_xdc).is_empty());

        let add_source_xdc = r#"
## Vivado Timing & Physical Constraints: timing.xdc
create_clock -period 10.000 -name clk [get_ports clk]

## Pin Placements & IO Standards
set_property PACKAGE_PIN E3 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]
set_property PACKAGE_PIN C12 [get_ports rst_n]
set_property IOSTANDARD LVCMOS33 [get_ports rst_n]
"#;
        assert!(XdcLinter::lint(add_source_xdc).is_empty());
    }

    #[test]
    fn test_primitive_hover_and_completion() {
        let src = "module test; LUT6_2 u_lut(); DSP48E2 u_dsp(); BUFG u_bufg(); endmodule";
        // Hover on LUT6_2 (line 1, col 15)
        let hover_lut = VerilogHover::hover(src, 1, 15).expect("Should hover LUT6_2");
        assert!(hover_lut.contents.contains("LUT6_2"));
        assert!(hover_lut.contents.contains("Look-Up Table"));

        // Hover on DSP48E2 (line 1, col 31)
        let hover_dsp = VerilogHover::hover(src, 1, 31).expect("Should hover DSP48E2");
        assert!(hover_dsp.contents.contains("DSP48E2"));
        assert!(hover_dsp.contents.contains("Digital Signal Processing"));

        // Completions
        let completions = VerilogCompletion::complete(src, 1, 1);
        assert!(completions.iter().any(|c| c.label == "LUT6_2 instance"));
        assert!(completions.iter().any(|c| c.label == "DSP48E2 instance"));
        assert!(completions.iter().any(|c| c.label == "RAMB36E2 instance"));
        assert!(completions.iter().any(|c| c.label == "BUFG instance"));
        assert!(completions.iter().any(|c| c.label == "FDRE instance"));
    }

    #[test]
    fn test_primitive_lint_clean() {
        let code = r#"
module prim_system (
    input  wire        clk,
    input  wire        rst,
    input  wire [5:0]  lut_in,
    output wire        lut_out6,
    output wire        lut_out5,
    input  wire        d_in,
    output wire        q_out
);
    wire clk_g;
    BUFG u_bufg (
        .I(clk),
        .O(clk_g)
    );

    LUT6_2 #(.INIT(64'h8000000000000001)) u_lut (
        .I0(lut_in[0]), .I1(lut_in[1]), .I2(lut_in[2]),
        .I3(lut_in[3]), .I4(lut_in[4]), .I5(lut_in[5]),
        .O5(lut_out5),
        .O6(lut_out6)
    );

    FDRE #(.INIT(1'b0)) u_dff (
        .C(clk_g),
        .CE(1'b1),
        .R(rst),
        .D(d_in),
        .Q(q_out)
    );
endmodule
"#;
        let diags = VerilogLinter::lint(code);
        assert!(diags.is_empty(), "Should have 0 diagnostics for clean primitive design, got: {diags:?}");

        let dsp_bram_mac = r#"
`timescale 1ns / 1ps

module dsp_bram_mac (
    input  wire        clk,
    input  wire        rst,
    input  wire        en,
    input  wire [9:0]  addr,
    input  wire [15:0] din_coeff,
    output wire [47:0] p_out,
    output wire        valid_out
);

  wire clk_g;
  BUFG u_bufg (
      .I(clk),
      .O(clk_g)
  );

  wire run_step;
  wire mac_active;
  LUT6_2 #(
      .INIT(64'h8000000000000001)
  ) u_lut_ctrl (
      .I0(en),
      .I1(addr[0]),
      .I2(addr[1]),
      .I3(addr[2]),
      .I4(addr[3]),
      .I5(addr[4]),
      .O5(run_step),
      .O6(mac_active)
  );

  wire [31:0] dout_a;
  wire [31:0] dout_b;
  RAMB36E2 #(
      .READ_WIDTH_A(36),
      .WRITE_WIDTH_A(36),
      .READ_WIDTH_B(36),
      .WRITE_WIDTH_B(36)
  ) u_bram (
      .CLKARDCLK(clk_g),
      .ENARDEN(1'b1),
      .WEA(4'b0000),
      .ADDRARDADDR({1'b0, addr, 4'b0000}),
      .DINADIN(32'h0),
      .DOUTADOUT(dout_a),
      .CLKBWRCLK(clk_g),
      .ENBWREN(1'b1),
      .WEB(4'b1111),
      .ADDRBWRADDR({1'b0, addr, 4'b0000}),
      .DINBDIN({16'h0000, din_coeff}),
      .DOUTBDOUT(dout_b)
  );

  DSP48E2 #(
      .USE_MULT("MULTIPLY"),
      .CREG(1),
      .MREG(1),
      .PREG(1)
  ) u_dsp48 (
      .CLK(clk_g),
      .CEA2(run_step),
      .CEB2(run_step),
      .CEM(run_step),
      .CEP(run_step),
      .RSTA(rst),
      .RSTB(rst),
      .RSTM(rst),
      .RSTP(rst),
      .ALUMODE(4'b0000),
      .OPMODE(9'b000000101),
      .A({14'h0, dout_a[15:0]}),
      .B(dout_b[17:0]),
      .C(48'h0),
      .D(27'h0),
      .P(p_out)
  );

  FDRE #(
      .INIT(1'b0)
  ) u_valid_ff (
      .C(clk_g),
      .CE(1'b1),
      .R(rst),
      .D(mac_active),
      .Q(valid_out)
  );

endmodule
"#;
        let diags_dsp = VerilogLinter::lint(dsp_bram_mac);
        assert!(diags_dsp.is_empty(), "dsp_bram_mac.v should have 0 diagnostics, got: {diags_dsp:?}");

        let tb_dsp = r#"
`timescale 1ns / 1ps

module tb_dsp_bram_mac;
  reg clk = 0;
  reg rst = 1;
  reg en = 0;
  reg [9:0] addr = 10'd0;
  reg [15:0] din_coeff = 16'd0;
  wire [47:0] p_out;
  wire valid_out;

  dsp_bram_mac dut (
      .clk(clk),
      .rst(rst),
      .en(en),
      .addr(addr),
      .din_coeff(din_coeff),
      .p_out(p_out),
      .valid_out(valid_out)
  );

  always #5 clk = ~clk;

  initial begin
    #20 rst = 0;
    #10 en = 1; addr = 10'd1; din_coeff = 16'd42;
    #20 addr = 10'd2; din_coeff = 16'd100;
    #50 $finish;
  end
endmodule
"#;
        let diags_tb_dsp = VerilogLinter::lint(tb_dsp);
        assert!(diags_tb_dsp.is_empty(), "tb_dsp_bram_mac.sv should have 0 diagnostics, got: {diags_tb_dsp:?}");
    }

    #[test]
    fn test_lint_class_example_uygulama_0() {
        let code = r#"`timescale 1ns / 1ps
// Istanbul University - Cerrahpasa | Logic Circuits
// Lesson 1: Uygulama 0 (Design Source)
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
        let diags = VerilogLinter::lint(code);
        assert!(diags.is_empty(), "uygulama_0.v should have 0 diagnostics, got: {diags:?}");
    }

    #[test]
    fn test_lint_class_example_tb_uygulama_0() {
        let code = r#"`timescale 1ns / 1ps
// Istanbul University - Cerrahpasa | Logic Circuits
// Lesson 1: tb_uygulama_0 (Benchtest / Testbench Source)
module tb_uygulama_0 ();
    reg A;
    reg B;
    reg C;
    wire F;

    uygulama_0 uut (A, B, C, F);

    initial begin
        #0  A = 1'b1; B = 1'b0; C = 1'b1;
        #25 A = 1'b0; B = 1'b0; C = 1'b1;
        #25 A = 1'b0; B = 1'b0; C = 1'b0;
        #25 A = 1'b1; B = 1'b1; C = 1'b1;
    end

    initial #100 $stop;
endmodule
"#;
        let diags = VerilogLinter::lint(code);
        assert!(diags.is_empty(), "tb_uygulama_0.v should have 0 diagnostics, got: {diags:?}");
    }

    #[test]
    fn test_gate_primitive_hover() {
        let src = "module test; not g1 (w2, A); and g2 (w1, w2, B); or g3 (F, w4, w3); endmodule";
        let hover_not = VerilogHover::hover(src, 1, 14).expect("Should hover not");
        assert!(hover_not.contents.contains("Inverter Gate"));

        let hover_and = VerilogHover::hover(src, 1, 31).expect("Should hover and");
        assert!(hover_and.contents.contains("AND Gate"));

        let hover_or = VerilogHover::hover(src, 1, 52).expect("Should hover or");
        assert!(hover_or.contents.contains("OR Gate"));
    }

    #[test]
    fn test_completion_snippets_and_keywords() {
        let items = VerilogCompletion::complete("module test; endmodule", 1, 1);
        let labels: Vec<&str> = items.iter().map(|i| i.label.as_str()).collect();
        assert!(labels.contains(&"casez ... endcase"));
        assert!(labels.contains(&"casex ... endcase"));
        assert!(labels.contains(&"forever begin ... end"));
        assert!(labels.contains(&"repeat (...) begin ... end"));
        assert!(labels.contains(&"while (...) begin ... end"));
        assert!(labels.contains(&"forever"));
        assert!(labels.contains(&"repeat"));
        assert!(labels.contains(&"while"));
    }

    #[test]
    fn test_named_port_completion_in_instantiation() {
        let code = r#"
module uygulama_0 (input wire A, input wire B, input wire C, output wire F);
endmodule

module tb;
    uygulama_0 uut (
        .
    );
endmodule
"#;
        // Line 7 is "        ." (column 10 is after .)
        let items = VerilogCompletion::complete(code, 7, 10);
        let labels: Vec<&str> = items.iter().map(|i| i.label.as_str()).collect();
        assert!(labels.contains(&".A"), "Should contain .A port completion, got: {labels:?}");
        assert!(labels.contains(&".B"), "Should contain .B port completion");
        assert!(labels.contains(&".C"), "Should contain .C port completion");
        assert!(labels.contains(&".F"), "Should contain .F port completion");
        assert!(labels.contains(&".*"), "Should contain .* wildcard completion");

        // Verify snippet insert_text when preceded by dot
        let item_a = items.iter().find(|i| i.label == ".A").expect(".A should exist");
        assert_eq!(item_a.insert_text, "A(${1:A})", "Insert text should not duplicate leading dot");

        // Test Xilinx primitive named port completion
        let prim_code = r#"
module top;
    FDRE u_ff (
        .
    );
endmodule
"#;
        let prim_items = VerilogCompletion::complete(prim_code, 4, 10);
        let prim_labels: Vec<&str> = prim_items.iter().map(|i| i.label.as_str()).collect();
        assert!(prim_labels.contains(&".D"), "Primitive FDRE should suggest .D, got: {prim_labels:?}");
        assert!(prim_labels.contains(&".C"), "Primitive FDRE should suggest .C");
        assert!(prim_labels.contains(&".Q"), "Primitive FDRE should suggest .Q");
        assert!(prim_labels.contains(&".CE"), "Primitive FDRE should suggest .CE");
        assert!(prim_labels.contains(&".R"), "Primitive FDRE should suggest .R");
    }

    #[test]
    fn test_lint_uygulama_0_valid_gate_netlist() {
        let code = r#"`timescale 1ns / 1ps
// Istanbul University - Cerrahpasa | Logic Circuits
// Lesson 1: Uygulama 0 (Design Source)
// Primitive gate-level implementation:
//   g1: not(w2, A)
//   g2: and(w1, w2, B)
//   g3: not(w4, B)
//   g4: and(w3, w1, C)
//   g5: or(F, w4, w3)

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
        let diags = VerilogLinter::lint(code);
        assert!(diags.is_empty(), "Valid uygulama_0 should produce zero diagnostics, got: {diags:?}");
    }

    #[test]
    fn test_lint_uygulama_0_undeclared_w1hi_and_undriven_w1() {
        let code = r#"`timescale 1ns / 1ps
// Istanbul University - Cerrahpasa | Logic Circuits
// Lesson 1: Uygulama 0 (Design Source)
// Primitive gate-level implementation:
//   g1: not(w2, A)
//   g2: and(w1, w2, B)
//   g3: not(w4, B)
//   g4: and(w3, w1, C)
//   g5: or(F, w4, w3)

module uygulama_0 (
    input  wire A,
    input  wire B,
    input  wire C,
    output wire F
);

    wire w1, w2, w3, w4;

    not g1 (w2, A);
    and g2 (w1hi, w2, B);
    not g3 (w4, B);
    and g4 (w3, w1, C);
    or  g5 (F, w4, w3);

endmodule
"#;
        let diags = VerilogLinter::lint(code);
        assert!(!diags.is_empty(), "Buggy code with w1hi must produce diagnostics!");

        // 1. Must flag undeclared identifier w1hi with error severity
        let undeclared = diags.iter().find(|d| d.code == "AXIOM_E003_UNDECLARED_IDENTIFIER");
        assert!(undeclared.is_some(), "Must report AXIOM_E003_UNDECLARED_IDENTIFIER for w1hi, got: {diags:?}");
        let undeclared_diag = undeclared.unwrap();
        assert!(undeclared_diag.message.contains("w1hi"), "Message should mention 'w1hi'");
        assert_eq!(undeclared_diag.severity, 1, "Undeclared identifier must be Error severity");

        // 2. Must flag undriven net w1 with warning severity
        let undriven = diags.iter().find(|d| d.code == "AXIOM_W003_UNDRIVEN_NET");
        assert!(undriven.is_some(), "Must report AXIOM_W003_UNDRIVEN_NET for w1, got: {diags:?}");
        let undriven_diag = undriven.unwrap();
        assert!(undriven_diag.message.contains("w1"), "Message should mention 'w1'");
        assert_eq!(undriven_diag.severity, 2, "Undriven net must be Warning severity");

        // 3. Must also flag when typo is w1h
        let code_w1h = code.replace("w1hi", "w1h");
        let diags_w1h = VerilogLinter::lint(&code_w1h);
        assert!(diags_w1h.iter().any(|d| d.code == "AXIOM_E003_UNDECLARED_IDENTIFIER" && d.message.contains("w1h")), "Must report undeclared for w1h, got: {diags_w1h:?}");
        assert!(diags_w1h.iter().any(|d| d.code == "AXIOM_W003_UNDRIVEN_NET" && d.message.contains("w1")), "Must report undriven w1 for w1h typo, got: {diags_w1h:?}");
    }
}


