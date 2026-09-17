`timescale 1ns/1ps

module alu #(
    parameter int WIDTH = 32
)(
    input  wire [WIDTH-1:0] a,
    input  wire [WIDTH-1:0] b,
    input  wire [2:0]       opcode,
    output reg  [WIDTH-1:0] result,
    output wire             zero,
    output reg              carry
);

    assign zero = (result == 0);

    always @* begin
        case (opcode)
            3'b000: begin // ADD
                result = a + b;
                carry = 1'b0;
            end
            3'b001: begin // SUB
                result = a - b;
                carry = 1'b0;
            end
            3'b010: begin // AND
                result = a & b;
                carry = 1'b0;
            end
            3'b011: begin // OR
                result = a | b;
                carry = 1'b0;
            end
            3'b100: begin // XOR
                result = a ^ b;
                carry = 1'b0;
            end
            3'b101: begin // NOT A
                result = ~a;
                carry = 1'b0;
            end
            3'b110: begin // SHL
                result = a << 1;
                carry = 1'b0;
            end
            default: begin // SHR
                result = a >> 1;
                carry = 1'b0;
            end
        endcase
    end

endmodule
