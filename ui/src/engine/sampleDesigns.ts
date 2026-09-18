export interface SampleDesign {
  id: string;
  name: string;
  category: "processors" | "protocols" | "power" | "standard";
  description: string;
  topModule: string;
  code: string;
}

export const SAMPLE_DESIGNS: SampleDesign[] = [
  {
    id: "alu",
    name: "8-bit Arithmetic Logic Unit (ALU)",
    category: "standard",
    description: "Multi-function ALU with ADD, SUB, AND, OR, XOR, SHL, SHR operations, zero/carry flags, and power-aware switching.",
    topModule: "alu_8bit",
    code: `// Axiom Sample: 8-Bit Arithmetic Logic Unit
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
    category: "standard",
    description: "Counter with clear, enable, up/down, and continuous combinational decode exhibiting delta-cycle hazard tracking.",
    topModule: "counter_glitch_demo",
    code: `// Axiom Sample: Synchronous Counter with Delta Glitch Demo
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
    category: "standard",
    description: "Hierarchical SoC subsystem featuring a frequency divider, accumulator, and power telemetry rail modeling.",
    topModule: "soc_subsystem_top",
    code: `// Axiom Sample: Hierarchical SoC Subsystem
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
  },
  {
    id: "uart",
    name: "UART Transceiver with Baud Rate Generator",
    category: "protocols",
    description: "Full-duplex serial UART with parameterized baud divider, 8-N-1 framing, start/stop bit validation, and shift registers.",
    topModule: "uart_transceiver",
    code: `// Axiom Sample: Full-Duplex UART Transceiver
// 8-N-1 Framing: 1 Start Bit, 8 Data Bits, 1 Stop Bit
\`timescale 1ns / 1ps

module uart_transceiver (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       tx_start,
    input  wire [7:0] tx_data,
    input  wire       rx_serial,
    output reg        tx_serial,
    output reg        tx_busy,
    output reg        tx_done,
    output reg  [7:0] rx_data,
    output reg        rx_ready,
    output reg        rx_error
);

  // Baud Clock Generator (Prescaler: 4 clock cycles per baud)
  reg [3:0] baud_counter;
  reg       baud_tick;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      baud_counter <= 4'd0;
      baud_tick    <= 1'b0;
    end else if (baud_counter == 4'd3) begin
      baud_counter <= 4'd0;
      baud_tick    <= 1'b1;
    end else begin
      baud_counter <= baud_counter + 1'b1;
      baud_tick    <= 1'b0;
    end
  end

  // TX Transmitter State Machine
  localparam TX_IDLE  = 2'b00;
  localparam TX_START = 2'b01;
  localparam TX_DATA  = 2'b10;
  localparam TX_STOP  = 2'b11;

  reg [1:0] tx_state;
  reg [7:0] tx_shift_reg;
  reg [2:0] tx_bit_index;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_state     <= TX_IDLE;
      tx_serial    <= 1'b1; // Idle line is high
      tx_busy      <= 1'b0;
      tx_done      <= 1'b0;
      tx_shift_reg <= 8'h00;
      tx_bit_index <= 3'd0;
    end else begin
      tx_done <= 1'b0;
      case (tx_state)
        TX_IDLE: begin
          tx_serial <= 1'b1;
          tx_busy   <= 1'b0;
          if (tx_start) begin
            tx_shift_reg <= tx_data;
            tx_busy      <= 1'b1;
            tx_state     <= TX_START;
          end
        end

        TX_START: begin
          if (baud_tick) begin
            tx_serial    <= 1'b0; // Start bit: low
            tx_bit_index <= 3'd0;
            tx_state     <= TX_DATA;
          end
        end

        TX_DATA: begin
          if (baud_tick) begin
            tx_serial    <= tx_shift_reg[0];
            tx_shift_reg <= {1'b0, tx_shift_reg[7:1]};
            if (tx_bit_index == 3'd7)
              tx_state <= TX_STOP;
            else
              tx_bit_index <= tx_bit_index + 1'b1;
          end
        end

        TX_STOP: begin
          if (baud_tick) begin
            tx_serial <= 1'b1; // Stop bit: high
            tx_done   <= 1'b1;
            tx_busy   <= 1'b0;
            tx_state  <= TX_IDLE;
          end
        end
      endcase
    end
  end

  // RX Receiver State Machine
  localparam RX_IDLE  = 2'b00;
  localparam RX_START = 2'b01;
  localparam RX_DATA  = 2'b10;
  localparam RX_STOP  = 2'b11;

  reg [1:0] rx_state;
  reg [7:0] rx_shift_reg;
  reg [2:0] rx_bit_index;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rx_state     <= RX_IDLE;
      rx_data      <= 8'h00;
      rx_ready     <= 1'b0;
      rx_error     <= 1'b0;
      rx_shift_reg <= 8'h00;
      rx_bit_index <= 3'd0;
    end else begin
      rx_ready <= 1'b0;
      case (rx_state)
        RX_IDLE: begin
          if (~rx_serial) begin // Falling edge start bit
            rx_bit_index <= 3'd0;
            rx_state     <= RX_START;
          end
        end

        RX_START: begin
          if (baud_tick) begin
            if (~rx_serial)
              rx_state <= RX_DATA;
            else
              rx_state <= RX_IDLE; // False start
          end
        end

        RX_DATA: begin
          if (baud_tick) begin
            rx_shift_reg <= {rx_serial, rx_shift_reg[7:1]};
            if (rx_bit_index == 3'd7)
              rx_state <= RX_STOP;
            else
              rx_bit_index <= rx_bit_index + 1'b1;
          end
        end

        RX_STOP: begin
          if (baud_tick) begin
            if (rx_serial) begin // Stop bit verified
              rx_data  <= rx_shift_reg;
              rx_ready <= 1'b1;
              rx_error <= 1'b0;
            end else begin
              rx_error <= 1'b1; // Framing error
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
    id: "spi",
    name: "SPI Master Controller (Modes 0-3)",
    category: "protocols",
    description: "Configurable SPI bus master with selectable CPOL/CPHA, active-low chip select, and 8-bit full-duplex transfers.",
    topModule: "spi_master",
    code: `// Axiom Sample: Configurable SPI Master Controller
\`timescale 1ns / 1ps

module spi_master (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       start,
    input  wire       cpol,
    input  wire       cpha,
    input  wire [7:0] tx_byte,
    output reg  [7:0] rx_byte,
    output reg        busy,
    output reg        done,
    output reg        sck,
    output reg        cs_n,
    output reg        mosi,
    input  wire       miso
);

  reg [2:0] bit_cnt;
  reg [7:0] shift_tx;
  reg [7:0] shift_rx;
  reg [1:0] clk_div;

  localparam STATE_IDLE = 2'b00;
  localparam STATE_TX   = 2'b01;
  localparam STATE_DONE = 2'b10;
  reg [1:0] state;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state      <= STATE_IDLE;
      sck        <= 1'b0;
      cs_n       <= 1'b1;
      mosi       <= 1'b0;
      rx_byte    <= 8'h00;
      busy       <= 1'b0;
      done       <= 1'b0;
      bit_cnt    <= 3'd0;
      shift_tx   <= 8'h00;
      shift_rx   <= 8'h00;
      clk_div    <= 2'b00;
    end else begin
      done <= 1'b0;
      case (state)
        STATE_IDLE: begin
          cs_n    <= 1'b1;
          sck     <= cpol;
          busy    <= 1'b0;
          clk_div <= 2'b00;
          if (start) begin
            shift_tx <= tx_byte;
            shift_rx <= 8'h00;
            cs_n     <= 1'b0; // Assert CS
            busy     <= 1'b1;
            bit_cnt  <= 3'd0;
            mosi     <= tx_byte[7];
            state    <= STATE_TX;
          end
        end

        STATE_TX: begin
          clk_div <= clk_div + 1'b1;
          if (clk_div == 2'b01) begin
            sck <= ~cpol; // Toggle SCK lead
            shift_rx <= {shift_rx[6:0], miso};
          end else if (clk_div == 2'b11) begin
            sck <= cpol; // Toggle SCK trail
            shift_tx <= {shift_tx[6:0], 1'b0};
            mosi     <= shift_tx[6];
            if (bit_cnt == 3'd7) begin
              state <= STATE_DONE;
            end else begin
              bit_cnt <= bit_cnt + 1'b1;
            end
          end
        end

        STATE_DONE: begin
          cs_n    <= 1'b1;
          sck     <= cpol;
          busy    <= 1'b0;
          done    <= 1'b1;
          rx_byte <= shift_rx;
          state   <= STATE_IDLE;
        end
      endcase
    end
  end

endmodule
`
  },
  {
    id: "pwm",
    name: "PWM Generator & Power Modulator",
    category: "power",
    description: "High-resolution pulse-width modulator with programmable duty cycle, complimentary outputs, and dead-time insertion for power stages.",
    topModule: "pwm_generator",
    code: `// Axiom Sample: Synchronous PWM Generator with Dead-Time
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
    id: "riscv",
    name: "32-Bit RISC-V Mini Core Datapath",
    category: "processors",
    description: "RV32I datapath featuring Program Counter, instruction memory, 8x32 register file, and 32-bit ALU executing native instructions.",
    topModule: "riscv_mini_core",
    code: `// Axiom Sample: 32-Bit RISC-V Mini Core Datapath
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
  wire [31:0] src_b = (opcode == 7'b0010011) ? imm_i :
                      ((rs2[2:0] == 3'd0) ? 32'd0 : regfile[rs2[2:0]]);

  // 32-Bit Arithmetic Logic Unit
  reg [31:0] next_alu;
  always @(*) begin
    case (funct3)
      3'b000: next_alu = (funct7[5] && opcode == 7'b0110011) ? (src_a - src_b) : (src_a + src_b);
      3'b100: next_alu = src_a ^ src_b;
      3'b110: next_alu = src_a | src_b;
      3'b111: next_alu = src_a & src_b;
      default: next_alu = src_a + src_b;
    endcase
  end

  // Program Counter & Pipeline Advance
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      pc         <= 32'd0;
      alu_result <= 32'd0;
      reg_x1     <= 32'd0;
      reg_x2     <= 32'd0;
      regfile[1] <= 32'd0;
      regfile[2] <= 32'd0;
      regfile[3] <= 32'd0;
      regfile[4] <= 32'd0;
      regfile[5] <= 32'd0;
      regfile[6] <= 32'd0;
      regfile[7] <= 32'd0;
    end else if (step_en) begin
      pc         <= pc + 32'd4;
      alu_result <= next_alu;
      if (rd[2:0] != 3'd0) begin
        regfile[rd[2:0]] <= next_alu;
      end
      reg_x1 <= (rd[2:0] == 3'd1) ? next_alu : regfile[1];
      reg_x2 <= (rd[2:0] == 2) ? next_alu : regfile[2];
    end
  end

  assign branch_taken = (opcode == 7'b1100011 && src_a == src_b);

endmodule
`
  }
];
