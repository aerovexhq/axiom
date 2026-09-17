`timescale 1ns/1ps

module adder #(
    parameter int WIDTH = 16
)(
    input  wire [WIDTH-1:0] a,
    input  wire [WIDTH-1:0] b,
    output wire [WIDTH-1:0] sum
);
    assign sum = a + b;
endmodule

module hierarchy_top (
    input  wire [15:0] in_a,
    input  wire [15:0] in_b,
    output wire [15:0] result
);
    adder #(.WIDTH(16)) u_adder (
        .a(in_a),
        .b(in_b),
        .sum(result)
    );
endmodule
