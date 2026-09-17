`timescale 1ns/1ps

module counter #(
    parameter int WIDTH = 8
)(
    input  wire             clk,
    input  wire             rst_n,
    input  wire             enable,
    input  wire             up_down,
    output reg  [WIDTH-1:0] count
);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= '0;
        end else if (enable) begin
            if (up_down) begin
                count <= count + 1;
            end else begin
                count <= count - 1;
            end
        end
    end

endmodule
