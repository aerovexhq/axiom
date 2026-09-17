// Axiom Conformance Benchmark: 4-Deep Synchronous FIFO
// IEEE 1800-2017 compliant Verilog
`timescale 1ns / 1ps

module fifo_4deep (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       wr_en,
    input  wire       rd_en,
    input  wire [7:0] din,
    output reg  [7:0] dout,
    output wire       full,
    output wire       empty,
    output wire [2:0] count
);

  reg [7:0] mem_0;
  reg [7:0] mem_1;
  reg [7:0] mem_2;
  reg [7:0] mem_3;
  reg [1:0] wr_ptr;
  reg [1:0] rd_ptr;
  reg [2:0] fifo_count;

  assign full  = (fifo_count == 3'd4);
  assign empty = (fifo_count == 3'd0);
  assign count = fifo_count;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      wr_ptr     <= 2'b00;
      rd_ptr     <= 2'b00;
      fifo_count <= 3'd0;
      dout       <= 8'h00;
      mem_0      <= 8'h00;
      mem_1      <= 8'h00;
      mem_2      <= 8'h00;
      mem_3      <= 8'h00;
    end else begin
      // Write logic
      if (wr_en && !full) begin
        case (wr_ptr)
          2'b00: mem_0 <= din;
          2'b01: mem_1 <= din;
          2'b10: mem_2 <= din;
          2'b11: mem_3 <= din;
        endcase
        wr_ptr <= wr_ptr + 1'b1;
      end

      // Read logic
      if (rd_en && !empty) begin
        case (rd_ptr)
          2'b00: dout <= mem_0;
          2'b01: dout <= mem_1;
          2'b10: dout <= mem_2;
          2'b11: dout <= mem_3;
        endcase
        rd_ptr <= rd_ptr + 1'b1;
      end

      // Counter tracking
      case ({wr_en && !full, rd_en && !empty})
        2'b10: fifo_count <= fifo_count + 1'b1;
        2'b01: fifo_count <= fifo_count - 1'b1;
        default: fifo_count <= fifo_count;
      endcase
    end
  end

endmodule
