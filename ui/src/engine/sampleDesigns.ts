export interface SampleDesign {
  id: string;
  name: string;
  description: string;
  topModule: string;
  code: string;
}

export const SAMPLE_DESIGNS: SampleDesign[] = [
  {
    id: "alu",
    name: "8-bit Arithmetic Logic Unit (ALU)",
    description: "Multi-function ALU with ADD, SUB, AND, OR, XOR, SHL, SHR operations, zero/carry flags, and power-aware switching.",
    topModule: "alu_8bit",
    code: `// Betterado Sample: 8-Bit Arithmetic Logic Unit
// IEEE 1800-2017 compliant Verilog
\`timescale 1ns / 1ps

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

  // Combinational calculation
  reg [8:0] next_calc;

  always @(*) begin
    case (opcode)
      3'b000: next_calc = a + b;            // ADD
      3'b001: next_calc = a - b;            // SUB
      3'b010: next_calc = {1'b0, a & b};    // AND
      3'b011: next_calc = {1'b0, a | b};    // OR
      3'b100: next_calc = {1'b0, a ^ b};    // XOR
      3'b101: next_calc = {1'b0, a << 1};   // SHL
      3'b110: next_calc = {1'b0, a >> 1};   // SHR
      3'b111: next_calc = {1'b0, ~a};       // NOT
      default: next_calc = 9'b0;
    endcase
  end

  // Synchronous register update
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      result     <= 8'h00;
      carry_flag <= 1'b0;
    end else begin
      result     <= next_calc[7:0];
      carry_flag <= next_calc[8];
    end
  end

  // Zero flag continuous assignment
  assign zero_flag = (result == 8'h00);

endmodule
`
  },
  {
    id: "counter",
    name: "Synchronous 8-Bit Counter with Glitch Hazards",
    description: "Counter with clear, enable, up/down, and continuous combinational decode exhibiting delta-cycle hazard tracking.",
    topModule: "counter_glitch_demo",
    code: `// Betterado Sample: Synchronous Counter with Delta Glitch Demo
\`timescale 1ns / 1ps

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

  // Terminal count flag
  assign terminal_count = (count == 8'hFF);

  // Combinational logic with asymmetric path delays (causes delta glitches)
  wire path_a = count[0] & count[1];
  wire path_b = count[0] ^ count[1];
  assign glitch_hazard_wire = path_a ^ path_b;

endmodule
`
  },
  {
    id: "hierarchy",
    name: "Hierarchical Core with Clock Divider & PDN",
    description: "Hierarchical SoC subsystem featuring a frequency divider, accumulator, and power telemetry rail modeling.",
    topModule: "soc_subsystem_top",
    code: `// Betterado Sample: Hierarchical SoC Subsystem
\`timescale 1ns / 1ps

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
`
  }
];
