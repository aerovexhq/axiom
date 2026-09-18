// Axiom EDA — Vivado-Style Project Model & Multi-File Architecture
// Conforming to IEEE 1800 SystemVerilog & Xilinx Vivado project structures

export type FileSetType = "sources_1" | "sim_1" | "constrs_1";
export type FileFormat = "verilog" | "systemverilog" | "xdc";

export interface ProjectFile {
  id: string;
  name: string;           // e.g. "riscv_top.v", "rv32_alu.v", "timing.xdc"
  fileType: FileFormat;
  fileSet: FileSetType;
  isTop?: boolean;
  content: string;
  isReadOnly?: boolean;
}

export interface AxiomProject {
  id: string;
  name: string;           // e.g. "riscv_core_soc", "uart_comm_hub"
  targetDevice: string;   // e.g. "Artix-7 (xc7a35t-csg324-1)"
  topModule: string;      // e.g. "riscv_mini_core", "uart_transceiver"
  activeFileId: string;   // Active file displayed in editor
  openFileIds: string[];  // Open tabs in editor
  files: ProjectFile[];
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: "processors" | "protocols" | "power" | "standard";
  description: string;
  defaultTopModule: string;
  defaultDevice: string;
  files: Omit<ProjectFile, "id">[];
}

export const FPGA_TARGET_DEVICES: { id: string; name: string; family: string; logicCells: string }[] = [
  { id: "xc7a35t-csg324-1", name: "Artix-7 xc7a35t-csg324-1", family: "Artix-7", logicCells: "33,280" },
  { id: "xc7a100t-csg324-1", name: "Artix-7 xc7a100t-csg324-1", family: "Artix-7", logicCells: "101,440" },
  { id: "xc7z020-clg400-1", name: "Zynq-7000 xc7z020-clg400-1", family: "Zynq-7000 SoC", logicCells: "85,000" },
  { id: "xc7k325t-ffg900-2", name: "Kintex-7 xc7k325t-ffg900-2", family: "Kintex-7", logicCells: "326,080" },
  { id: "xcku5p-ffvb676-2-e", name: "Kintex UltraScale+ xcku5p", family: "UltraScale+", logicCells: "474,600" },
  { id: "axiom-virtual-silicon", name: "Axiom Virtual Silicon (Native JIT)", family: "Axiom In-RAM", logicCells: "Unlimited" }
];

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "logic_circuit_project",
    name: "Combinational Logic Circuit (A, B, C → F)",
    category: "standard",
    description: "Gate-level combinational circuit with inputs A, B, C and output F = ((~A & B) & C) | ~B, with intermediate nets w1, w2, w3, w4.",
    defaultTopModule: "logic_circuit",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "logic_circuit.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: logic_circuit.v
// Axiom Multi-File Project: Combinational Logic Circuit
// Inputs: A, B, C | Output: F
// Logic equations:
//   w1 = ~A
//   w2 = w1 & B
//   w3 = w2 & C
//   w4 = ~B
//   F  = w3 | w4
\`timescale 1ns / 1ps

module logic_circuit (
    input  wire A,
    input  wire B,
    input  wire C,
    output wire F
);

  // Intermediate nets connecting gates
  wire w1;
  wire w2;
  wire w3;
  wire w4;

  // Combinational gate assignments
  assign w1 = ~A;        // NOT gate 1: invert A
  assign w2 = w1 & B;    // AND gate 1: w1 AND B
  assign w3 = w2 & C;    // AND gate 2: w2 AND C
  assign w4 = ~B;        // NOT gate 2: invert B
  assign F  = w3 | w4;   // OR gate:   w3 OR w4

endmodule
`
      },
      {
        name: "tb_logic_circuit.sv",
        fileType: "systemverilog",
        fileSet: "sim_1",
        content: `// Vivado Simulation Source: tb_logic_circuit.sv
// Testbench sweeping all 8 truth table combinations for logic_circuit
\`timescale 1ns / 1ps

module tb_logic_circuit;
  reg  A;
  reg  B;
  reg  C;
  wire F;

  // Instantiate Unit Under Test (UUT)
  logic_circuit uut (
    .A(A),
    .B(B),
    .C(C),
    .F(F)
  );

  initial begin
    $dumpfile("logic_circuit.vcd");
    $dumpvars(0, tb_logic_circuit);

    // Test all 8 minterms (2^3 = 8)
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
`
      },
      {
        name: "timing.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: `# Vivado Constraints: timing.xdc
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
`
      }
    ]
  },
  {
    id: "riscv_soc_project",
    name: "32-Bit RV32I RISC-V Embedded SoC",
    category: "processors",
    description: "Multi-file RV32I datapath with Program Counter, instruction memory, 8x32 register file, and single-cycle ALU.",
    defaultTopModule: "riscv_mini_core",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "riscv_top.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: riscv_top.v
// Axiom Multi-File Project: 32-Bit RISC-V Mini Core Datapath
\`timescale 1ns / 1ps

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

  // Instruction Memory (Embedded Program)
  always @(*) begin
    case (pc[4:2])
      3'b000: instr = 32'h00500093; // addi x1, x0, 5  (x1 = 5)
      3'b001: instr = 32'h00A00113; // addi x2, x0, 10 (x2 = 10)
      3'b010: instr = 32'h002081B3; // add  x3, x1, x2 (x3 = 15)
      3'b011: instr = 32'h40110233; // sub  x4, x2, x1 (x4 = 5)
      3'b100: instr = 32'h0020C2B3; // xor  x5, x1, x2 (x5 = 15)
      3'b101: instr = 32'h0010E333; // or   x6, x1, x2
      3'b110: instr = 32'h0020F3B3; // and  x7, x1, x2
      3'b111: instr = 32'h0000006F; // jal  x0, 0      (loop)
      default: instr = 32'h00000013; // nop
    endcase
  end

  // Instruction Decode Fields
  wire [6:0] opcode = instr[6:0];
  wire [4:0] rd     = instr[11:7];
  wire [2:0] funct3 = instr[14:12];
  wire [4:0] rs1    = instr[19:15];
  wire [4:0] rs2    = instr[24:20];
  wire [6:0] funct7 = instr[31:25];
  wire [31:0] imm_i = {{20{instr[31]}}, instr[31:20]};

  // 8-Entry 32-Bit Register File
  reg [31:0] regfile [0:7];

  wire [31:0] src_a = (rs1[2:0] == 3'd0) ? 32'd0 : regfile[rs1[2:0]];
  wire [31:0] src_b = (rs2[2:0] == 3'd0) ? 32'd0 : regfile[rs2[2:0]];

  // Single-Cycle Execution ALU
  always @(*) begin
    case (funct3)
      3'b000:  alu_result = (opcode == 7'b0110011 && funct7[5]) ? (src_a - src_b) : (src_a + (opcode == 7'b0010011 ? imm_i : src_b));
      3'b100:  alu_result = src_a ^ (opcode == 7'b0010011 ? imm_i : src_b);
      3'b110:  alu_result = src_a | (opcode == 7'b0010011 ? imm_i : src_b);
      3'b111:  alu_result = src_a & (opcode == 7'b0010011 ? imm_i : src_b);
      default: alu_result = src_a + imm_i;
    endcase
  end

  // Sequential Program Counter & Register Updates
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
      if (opcode == 7'b1101111) // JAL
        pc <= pc; // loop
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
`
      },
      {
        name: "timing.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: `## Vivado Timing Constraints: timing.xdc
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
`
      },
      {
        name: "tb_riscv.sv",
        fileType: "systemverilog",
        fileSet: "sim_1",
        content: `// Vivado Simulation Source: tb_riscv.sv
\`timescale 1ns / 1ps

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
`
      }
    ]
  },
  {
    id: "uart_subsystem_project",
    name: "Full-Duplex UART Transceiver Subsystem",
    category: "protocols",
    description: "Parameterized UART with baud divider, 8-N-1 framing, start/stop bit validation, and shift registers.",
    defaultTopModule: "uart_transceiver",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "uart_top.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: uart_top.v
// Axiom Multi-File Project: Full-Duplex UART Transceiver
\`timescale 1ns / 1ps

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
      endcase
    end
  end

endmodule
`
      },
      {
        name: "uart_pins.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: `## Vivado Physical & Timing Constraints: uart_pins.xdc
create_clock -period 20.000 -name sys_clk_pin -waveform {0.000 10.000} [get_ports clk]

set_property PACKAGE_PIN E3 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]

set_property PACKAGE_PIN C4 [get_ports rx_serial]
set_property IOSTANDARD LVCMOS33 [get_ports rx_serial]

set_property PACKAGE_PIN D4 [get_ports tx_serial]
set_property IOSTANDARD LVCMOS33 [get_ports tx_serial]
`
      }
    ]
  },
  {
    id: "spi_master_project",
    name: "Configurable SPI Bus Master Controller",
    category: "protocols",
    description: "Configurable SPI bus master with selectable CPOL/CPHA, active-low chip select, and full-duplex byte transfers.",
    defaultTopModule: "spi_master",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "spi_master.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: spi_master.v
\`timescale 1ns / 1ps

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
      endcase
    end
  end

endmodule
`
      },
      {
        name: "spi_timing.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: `## SPI Timing Constraints: spi_timing.xdc
create_clock -period 10.000 -name sys_clk [get_ports clk]
set_output_delay -clock [get_clocks sys_clk] 2.000 [get_ports {sck cs_n mosi}]
set_input_delay -clock [get_clocks sys_clk] 1.500 [get_ports miso]
`
      }
    ]
  },
  {
    id: "pwm_inverter_project",
    name: "PWM Power Modulator with Dead-Time Protection",
    category: "power",
    description: "High-resolution pulse-width modulator with complimentary half-bridge outputs and shoot-through protection.",
    defaultTopModule: "pwm_generator",
    defaultDevice: "Zynq-7000 xc7z020-clg400-1",
    files: [
      {
        name: "pwm_top.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: pwm_top.v
\`timescale 1ns / 1ps

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

  // Period Counter (0 to 255)
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

  // Dead-Time Insertion for Half-Bridge Safety (Prevents Shoot-Through)
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
`
      },
      {
        name: "pwm_pins.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: `## PWM Constraints: pwm_pins.xdc
create_clock -period 10.000 -name clk [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports {pwm_high pwm_low}]
`
      }
    ]
  },
  {
    id: "alu_8bit_project",
    name: "8-Bit Arithmetic Logic Unit (ALU) Datapath",
    category: "standard",
    description: "Multi-function ALU with ADD, SUB, AND, OR, XOR, SHL, SHR operations, zero/carry flags, and power-aware switching.",
    defaultTopModule: "alu_8bit",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "alu_8bit.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: alu_8bit.v
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
`
      },
      {
        name: "alu_tb.sv",
        fileType: "systemverilog",
        fileSet: "sim_1",
        content: `// Vivado Simulation Testbench: alu_tb.sv
\`timescale 1ns / 1ps

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
`
      }
    ]
  },
  {
    id: "counter_hazard_project",
    name: "Synchronous Counter with Glitch Hazards",
    category: "standard",
    description: "Counter with clear, enable, up/down, and continuous combinational decode exhibiting delta-cycle hazard tracking.",
    defaultTopModule: "counter_glitch_demo",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "counter_glitch.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: counter_glitch.v
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

  assign terminal_count = (count == 8'hFF);

  wire path_a = count[0] & count[1];
  wire path_b = count[0] ^ count[1];
  assign glitch_hazard_wire = path_a ^ path_b;

endmodule
`
      }
    ]
  },
  {
    id: "empty_rtl_project",
    name: "Empty RTL Project",
    category: "standard",
    description: "Clean empty Verilog project ready for custom synthesis and simulation.",
    defaultTopModule: "top",
    defaultDevice: "Artix-7 xc7a35t-csg324-1",
    files: [
      {
        name: "top.v",
        fileType: "verilog",
        fileSet: "sources_1",
        isTop: true,
        content: `// Vivado Design Source: top.v
\`timescale 1ns / 1ps

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
`
      },
      {
        name: "constraints.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: `## Vivado Constraints: constraints.xdc
create_clock -period 10.000 -name clk [get_ports clk]
`
      }
    ]
  }
];

// Factory: Create a new project instance from a template
export function createProjectFromTemplate(
  templateId: string,
  projectName?: string,
  targetDevice?: string
): AxiomProject {
  const template = PROJECT_TEMPLATES.find((t) => t.id === templateId) ?? PROJECT_TEMPLATES[0];
  const name = projectName?.trim() || template.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const device = targetDevice || template.defaultDevice;

  const files: ProjectFile[] = template.files.map((f, idx) => ({
    ...f,
    id: `file_${Date.now()}_${idx}`
  }));

  const topFile = files.find((f) => f.isTop) ?? files[0];

  return {
    id: `proj_${Date.now()}`,
    name,
    targetDevice: device,
    topModule: template.defaultTopModule,
    activeFileId: topFile.id,
    openFileIds: [topFile.id],
    files,
    templateId: template.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Utility: Bundle all HDL design sources (sources_1) into a single elaboration string
export function bundleProjectSources(project: AxiomProject): string {
  const sources = project.files.filter(
    (f) => f.fileSet === "sources_1" && (f.fileType === "verilog" || f.fileType === "systemverilog")
  );

  return sources
    .map((f) => `// ==========================================\n// File: ${f.name}\n// ==========================================\n${f.content}`)
    .join("\n\n");
}

// Set new top module in project
export function setProjectTopModule(
  project: AxiomProject,
  topModule: string,
  fileId?: string
): AxiomProject {
  return {
    ...project,
    topModule,
    files: project.files.map((f) => ({
      ...f,
      isTop: fileId ? f.id === fileId : f.isTop
    })),
    updatedAt: new Date().toISOString()
  };
}

// Add a file to project
export function addFileToProject(
  project: AxiomProject,
  file: Omit<ProjectFile, "id">
): { project: AxiomProject; newFileId: string } {
  const newFileId = `file_${Date.now()}`;
  const newFile: ProjectFile = {
    ...file,
    id: newFileId
  };

  const updatedProject: AxiomProject = {
    ...project,
    files: [...project.files, newFile],
    openFileIds: [...new Set([...project.openFileIds, newFileId])],
    activeFileId: newFileId,
    updatedAt: new Date().toISOString()
  };

  return { project: updatedProject, newFileId };
}

// Delete a file from project
export function deleteFileFromProject(project: AxiomProject, fileId: string): AxiomProject {
  if (project.files.length <= 1) return project;

  const remainingFiles = project.files.filter((f) => f.id !== fileId);
  const remainingOpenIds = project.openFileIds.filter((id) => id !== fileId);

  const newActiveId =
    project.activeFileId === fileId
      ? remainingOpenIds[0] ?? remainingFiles[0].id
      : project.activeFileId;

  return {
    ...project,
    files: remainingFiles,
    openFileIds: remainingOpenIds.length > 0 ? remainingOpenIds : [remainingFiles[0].id],
    activeFileId: newActiveId,
    updatedAt: new Date().toISOString()
  };
}

// Update file content in project
export function updateFileContent(
  project: AxiomProject,
  fileId: string,
  newContent: string
): AxiomProject {
  return {
    ...project,
    files: project.files.map((f) => (f.id === fileId ? { ...f, content: newContent } : f)),
    updatedAt: new Date().toISOString()
  };
}

// Local storage persistence
const STORAGE_KEY = "axiom_current_project";

export function loadSavedProject(): AxiomProject | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.files && parsed.files.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not load saved project from localStorage:", e);
  }

  // Default: start from clean "no project" standpoint
  return null;
}

export function saveProjectToStorage(project: AxiomProject | null): void {
  try {
    if (project) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn("Could not save project to localStorage:", e);
  }
}

export function clearSavedProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Could not clear project from localStorage:", e);
  }
}
