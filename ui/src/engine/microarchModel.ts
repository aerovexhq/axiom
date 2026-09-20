// Axiom EDA — Micro-Architectural Block Diagram Synthesis Model

export type MacroCategory = "Control" | "Datapath" | "Memory" | "Peripheral" | "Custom";
export type MacroPortDirection = "In" | "Out" | "InOut";

export interface MacroPort {
  id: string;
  name: string;
  width: number;
  direction: MacroPortDirection;
  is_clock?: boolean;
  is_reset?: boolean;
  is_datapath?: boolean;
  offset_x: number;
  offset_y: number;
}

export interface FsmState {
  id: string;
  name: string;
  value: number;
  binary_str: string;
  is_reset: boolean;
  moore_outputs?: Array<[string, string]>;
}

export interface FsmTransition {
  from_state: string;
  to_state: string;
  condition: string;
  mealy_outputs?: Array<[string, string]>;
}

export interface FsmMacro {
  state_reg: string;
  state_width: number;
  reset_state: string;
  current_state_default: string;
  states: FsmState[];
  transitions: FsmTransition[];
  inputs: string[];
  outputs: string[];
}

export interface AluFlag {
  name: string;
  signal: string;
  description: string;
}

export interface AluOperation {
  opcode_val: number;
  opcode_bin: string;
  name: string;
  expression: string;
}

export interface AluMacro {
  opcode_signal: string;
  opcode_width: number;
  operand_a: string;
  operand_b: string;
  operand_width: number;
  result_signal: string;
  result_width: number;
  flags: AluFlag[];
  operations: AluOperation[];
}

export interface MemReadPort {
  port_name: string;
  addr_signal: string;
  data_signal: string;
}

export interface MemWritePort {
  port_name: string;
  addr_signal: string;
  data_signal: string;
  enable_signal?: string;
  clock_signal: string;
}

export interface RegisterFileMacro {
  name: string;
  word_width: number;
  depth: number;
  address_width: number;
  read_ports: MemReadPort[];
  write_ports: MemWritePort[];
}

export interface MemoryMacro {
  name: string;
  primitive_type: string;
  capacity_bits: number;
  read_width: number;
  write_width: number;
  ports: string[];
}

export interface DatapathRegMacro {
  name: string;
  width: number;
  reg_type: string; // "PC", "Counter", "Accumulator", "ShiftReg"
  step_behavior: string;
  clock_signal: string;
  reset_signal?: string;
  enable_signal?: string;
}

export interface DecoderField {
  name: string;
  range_str: string;
  width: number;
}

export interface DecoderMacro {
  name: string;
  input_bus: string;
  fields: DecoderField[];
}

export interface MacroBlock {
  id: string;
  name: string;
  label: string;
  sublabel: string;
  category: MacroCategory;
  kind: {
    type: "Fsm" | "Alu" | "RegisterFile" | "Memory" | "DatapathReg" | "Decoder" | "Primitive" | "Generic";
    data: any;
  };
  inputs: MacroPort[];
  outputs: MacroPort[];
  x: number;
  y: number;
  width: number;
  height: number;
  clock_domain?: string;
  latency_cycles: number;
  source_line?: number;
}

export interface MicroarchBus {
  id: string;
  name: string;
  source_node: string;
  source_port: string;
  target_node: string;
  target_port: string;
  width: number;
  is_datapath: boolean;
  wire_points: Array<[number, number]>;
  initial_value_hex: string;
}

export interface MicroarchControlWire {
  id: string;
  name: string;
  source_node: string;
  source_port: string;
  target_node: string;
  target_port: string;
  signal_type: string; // "Clock", "Reset", "Control", "Handshake"
  wire_points: Array<[number, number]>;
}

export interface GraphBounds {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  width: number;
  height: number;
}

export interface MicroarchGraph {
  top_module: string;
  blocks: MacroBlock[];
  buses: MicroarchBus[];
  control_wires: MicroarchControlWire[];
  bounds: GraphBounds;
}

// --------------------------------------------------------------------------
// Deterministic Hardware Synthesizers for Sample Designs
// --------------------------------------------------------------------------

export function synthesizeMicroarchGraph(sampleDesignId: string): MicroarchGraph {
  const id = sampleDesignId.toLowerCase();
  if (id.includes("riscv")) {
    return generateRiscvMicroarchGraph();
  } else if (id.includes("uart")) {
    return generateUartMicroarchGraph();
  } else if (id.includes("spi")) {
    return generateSpiMicroarchGraph();
  } else if (id.includes("alu")) {
    return generateAluMicroarchGraph();
  } else if (id.includes("dsp") || id.includes("bram") || id.includes("mac")) {
    return generateDspMacMicroarchGraph();
  } else if (id.includes("counter")) {
    return generateCounterMicroarchGraph();
  }
  return generateLogicCircuitMicroarchGraph();
}

/**
 * RISC-V RV32I 32-Bit Mini Core Datapath & Controller Block Diagram
 */
function generateRiscvMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    // Top Row: Control & Decode
    {
      id: "u_decoder",
      name: "u_decoder",
      label: "RISC-V Instruction Decoder",
      sublabel: "Field Splitter & Immediate Gen",
      category: "Control",
      kind: {
        type: "Decoder",
        data: {
          name: "u_decoder",
          input_bus: "instr[31:0]",
          fields: [
            { name: "opcode", range_str: "instr[6:0]", width: 7 },
            { name: "rd", range_str: "instr[11:7]", width: 5 },
            { name: "funct3", range_str: "instr[14:12]", width: 3 },
            { name: "rs1", range_str: "instr[19:15]", width: 5 },
            { name: "rs2", range_str: "instr[24:20]", width: 5 },
            { name: "imm_i", range_str: "sign_ext(instr[31:20])", width: 32 }
          ]
        }
      },
      inputs: [
        { id: "dec_in", name: "instr[31:0]", width: 32, direction: "In", is_datapath: true, offset_x: 0, offset_y: 50 }
      ],
      outputs: [
        { id: "dec_op", name: "opcode[6:0]", width: 7, direction: "Out", offset_x: 180, offset_y: 20 },
        { id: "dec_rd", name: "rd[4:0]", width: 5, direction: "Out", offset_x: 180, offset_y: 40 },
        { id: "dec_f3", name: "funct3[2:0]", width: 3, direction: "Out", offset_x: 180, offset_y: 60 },
        { id: "dec_imm", name: "imm_i[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 180, offset_y: 80 }
      ],
      x: 320,
      y: 40,
      width: 180,
      height: 105,
      latency_cycles: 0
    },

    // Datapath Row: Left-to-right flow
    // 1. Program Counter
    {
      id: "u_pc",
      name: "pc",
      label: "Program Counter (PC)",
      sublabel: "32-bit Sequencer (+4)",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "pc",
          width: 32,
          reg_type: "PC",
          step_behavior: "pc <= pc + 4",
          clock_signal: "clk",
          reset_signal: "rst_n",
          enable_signal: "step_en"
        }
      },
      inputs: [
        { id: "pc_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 80 },
        { id: "pc_en", name: "step_en", width: 1, direction: "In", offset_x: 0, offset_y: 40 }
      ],
      outputs: [
        { id: "pc_out", name: "pc[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 150, offset_y: 40 }
      ],
      x: 50,
      y: 230,
      width: 150,
      height: 85,
      clock_domain: "clk",
      latency_cycles: 1
    },

    // 2. Instruction Memory (ROM)
    {
      id: "u_rom",
      name: "instr_rom",
      label: "Instruction ROM",
      sublabel: "Embedded RV32I Program",
      category: "Memory",
      kind: {
        type: "Generic",
        data: {
          name: "instr_rom",
          description: "8-word embedded RISC-V program memory"
        }
      },
      inputs: [
        { id: "rom_addr", name: "pc[4:2]", width: 3, direction: "In", is_datapath: true, offset_x: 0, offset_y: 40 }
      ],
      outputs: [
        { id: "rom_data", name: "instr[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 160, offset_y: 40 }
      ],
      x: 260,
      y: 230,
      width: 160,
      height: 85,
      latency_cycles: 0
    },

    // 3. Register File (8x32)
    {
      id: "u_regfile",
      name: "regfile",
      label: "8×32-bit Register File",
      sublabel: "Dual Read / Single Write (x0=0)",
      category: "Memory",
      kind: {
        type: "RegisterFile",
        data: {
          name: "regfile",
          word_width: 32,
          depth: 8,
          address_width: 3,
          read_ports: [
            { port_name: "RS1", addr_signal: "rs1[2:0]", data_signal: "src_a[31:0]" },
            { port_name: "RS2", addr_signal: "rs2[2:0]", data_signal: "src_b[31:0]" }
          ],
          write_ports: [
            { port_name: "RD", addr_signal: "rd[2:0]", data_signal: "next_alu[31:0]", enable_signal: "step_en", clock_signal: "clk" }
          ]
        }
      },
      inputs: [
        { id: "rf_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 110 },
        { id: "rf_rs1", name: "rs1[2:0]", width: 3, direction: "In", offset_x: 0, offset_y: 35 },
        { id: "rf_rs2", name: "rs2[2:0]", width: 3, direction: "In", offset_x: 0, offset_y: 65 },
        { id: "rf_rd", name: "rd[2:0]", width: 3, direction: "In", offset_x: 0, offset_y: 95 }
      ],
      outputs: [
        { id: "rf_src_a", name: "src_a[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 180, offset_y: 40 },
        { id: "rf_src_b", name: "src_b[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 180, offset_y: 80 }
      ],
      x: 480,
      y: 215,
      width: 180,
      height: 115,
      clock_domain: "clk",
      latency_cycles: 0
    },

    // 4. 32-bit ALU
    {
      id: "u_alu",
      name: "alu_rv32",
      label: "32-bit Arithmetic Logic Unit (ALU)",
      sublabel: "ADD, SUB, XOR, OR, AND Ops",
      category: "Datapath",
      kind: {
        type: "Alu",
        data: {
          opcode_signal: "funct3",
          opcode_width: 3,
          operand_a: "src_a",
          operand_b: "src_b",
          operand_width: 32,
          result_signal: "next_alu",
          result_width: 32,
          flags: [
            { name: "ZERO", signal: "branch_taken", description: "Comparator branch condition" }
          ],
          operations: [
            { opcode_val: 0, opcode_bin: "000", name: "ADD / SUB", expression: "src_a ± src_b" },
            { opcode_val: 4, opcode_bin: "100", name: "XOR", expression: "src_a ^ src_b" },
            { opcode_val: 6, opcode_bin: "110", name: "OR", expression: "src_a | src_b" },
            { opcode_val: 7, opcode_bin: "111", name: "AND", expression: "src_a & src_b" }
          ]
        }
      },
      inputs: [
        { id: "alu_a", name: "src_a[31:0]", width: 32, direction: "In", is_datapath: true, offset_x: 0, offset_y: 35 },
        { id: "alu_b", name: "src_b[31:0]", width: 32, direction: "In", is_datapath: true, offset_x: 0, offset_y: 70 },
        { id: "alu_op", name: "funct3[2:0]", width: 3, direction: "In", offset_x: 95, offset_y: 0 }
      ],
      outputs: [
        { id: "alu_res", name: "next_alu[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 190, offset_y: 50 },
        { id: "alu_zero", name: "branch_taken", width: 1, direction: "Out", offset_x: 190, offset_y: 80 }
      ],
      x: 720,
      y: 220,
      width: 190,
      height: 105,
      latency_cycles: 0
    },

    // 5. Writeback & Output Registers
    {
      id: "u_wb",
      name: "writeback_regs",
      label: "Writeback & Shadow Registers",
      sublabel: "alu_result, reg_x1, reg_x2",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "wb_regs",
          width: 32,
          reg_type: "PipelineReg",
          step_behavior: "Sample alu_result and x1/x2",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "wb_in", name: "next_alu[31:0]", width: 32, direction: "In", is_datapath: true, offset_x: 0, offset_y: 40 }
      ],
      outputs: [
        { id: "wb_res", name: "alu_result[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 170, offset_y: 25 },
        { id: "wb_x1", name: "reg_x1[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 170, offset_y: 50 },
        { id: "wb_x2", name: "reg_x2[31:0]", width: 32, direction: "Out", is_datapath: true, offset_x: 170, offset_y: 75 }
      ],
      x: 970,
      y: 225,
      width: 170,
      height: 95,
      clock_domain: "clk",
      latency_cycles: 1
    }
  ];

  const buses: MicroarchBus[] = [
    {
      id: "bus_pc_rom",
      name: "pc[4:2]",
      source_node: "u_pc",
      source_port: "pc_out",
      target_node: "u_rom",
      target_port: "rom_addr",
      width: 3,
      is_datapath: true,
      wire_points: [[200, 270], [230, 270], [230, 270], [260, 270]],
      initial_value_hex: "0x00000000"
    },
    {
      id: "bus_rom_dec",
      name: "instr[31:0]",
      source_node: "u_rom",
      source_port: "rom_data",
      target_node: "u_decoder",
      target_port: "dec_in",
      width: 32,
      is_datapath: true,
      wire_points: [[420, 270], [440, 270], [440, 90], [320, 90]],
      initial_value_hex: "0x00500093"
    },
    {
      id: "bus_rf_alu_a",
      name: "src_a[31:0]",
      source_node: "u_regfile",
      source_port: "rf_src_a",
      target_node: "u_alu",
      target_port: "alu_a",
      width: 32,
      is_datapath: true,
      wire_points: [[660, 255], [690, 255], [690, 255], [720, 255]],
      initial_value_hex: "0x00000005"
    },
    {
      id: "bus_rf_alu_b",
      name: "src_b[31:0]",
      source_node: "u_regfile",
      source_port: "rf_src_b",
      target_node: "u_alu",
      target_port: "alu_b",
      width: 32,
      is_datapath: true,
      wire_points: [[660, 295], [690, 295], [690, 290], [720, 290]],
      initial_value_hex: "0x0000000A"
    },
    {
      id: "bus_alu_wb",
      name: "next_alu[31:0]",
      source_node: "u_alu",
      source_port: "alu_res",
      target_node: "u_wb",
      target_port: "wb_in",
      width: 32,
      is_datapath: true,
      wire_points: [[910, 270], [940, 270], [940, 265], [970, 265]],
      initial_value_hex: "0x0000000F"
    }
  ];

  const control_wires: MicroarchControlWire[] = [
    {
      id: "wire_dec_alu",
      name: "funct3[2:0]",
      source_node: "u_decoder",
      source_port: "dec_f3",
      target_node: "u_alu",
      target_port: "alu_op",
      signal_type: "Control",
      wire_points: [[500, 100], [815, 100], [815, 220]]
    }
  ];

  return {
    top_module: "riscv_mini_core",
    blocks,
    buses,
    control_wires,
    bounds: { min_x: 0, min_y: 0, max_x: 1200, max_y: 400, width: 1200, height: 400 }
  };
}

/**
 * Full-Duplex UART Transceiver Block Diagram
 */
function generateUartMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    // 1. Baud Clock Prescaler
    {
      id: "u_baud",
      name: "baud_generator",
      label: "Baud Prescaler Generator",
      sublabel: "4-Cycle Clock Prescaler (/4)",
      category: "Peripheral",
      kind: {
        type: "DatapathReg",
        data: {
          name: "baud_counter",
          width: 4,
          reg_type: "Counter",
          step_behavior: "baud_counter <= baud_counter + 1",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "baud_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 75 },
        { id: "baud_rst", name: "rst_n", width: 1, direction: "In", is_reset: true, offset_x: 40, offset_y: 75 }
      ],
      outputs: [
        { id: "baud_tick", name: "baud_tick", width: 1, direction: "Out", offset_x: 160, offset_y: 35 }
      ],
      x: 50,
      y: 50,
      width: 160,
      height: 80,
      clock_domain: "clk",
      latency_cycles: 0
    },

    // 2. TX State Machine (FSM)
    {
      id: "u_tx_fsm",
      name: "tx_fsm",
      label: "UART TX State Machine (FSM)",
      sublabel: "4 States | 8-N-1 Serial Framing",
      category: "Control",
      kind: {
        type: "Fsm",
        data: {
          state_reg: "tx_state",
          state_width: 2,
          reset_state: "TX_IDLE",
          current_state_default: "TX_IDLE",
          states: [
            { id: "s0", name: "TX_IDLE", value: 0, binary_str: "00", is_reset: true },
            { id: "s1", name: "TX_START", value: 1, binary_str: "01", is_reset: false },
            { id: "s2", name: "TX_DATA", value: 2, binary_str: "10", is_reset: false },
            { id: "s3", name: "TX_STOP", value: 3, binary_str: "11", is_reset: false }
          ],
          transitions: [
            { from_state: "TX_IDLE", to_state: "TX_START", condition: "tx_start == 1" },
            { from_state: "TX_START", to_state: "TX_DATA", condition: "baud_tick == 1" },
            { from_state: "TX_DATA", to_state: "TX_STOP", condition: "baud_tick && bit_idx == 7" },
            { from_state: "TX_STOP", to_state: "TX_IDLE", condition: "baud_tick == 1" }
          ],
          inputs: ["tx_start", "baud_tick", "bit_idx"],
          outputs: ["tx_busy", "tx_serial", "tx_done"]
        }
      },
      inputs: [
        { id: "tx_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 95 },
        { id: "tx_start_in", name: "tx_start", width: 1, direction: "In", offset_x: 0, offset_y: 30 },
        { id: "tx_tick_in", name: "baud_tick", width: 1, direction: "In", offset_x: 0, offset_y: 60 }
      ],
      outputs: [
        { id: "tx_busy_out", name: "tx_busy", width: 1, direction: "Out", offset_x: 180, offset_y: 25 },
        { id: "tx_ser_out", name: "tx_serial", width: 1, direction: "Out", offset_x: 180, offset_y: 50 },
        { id: "tx_done_out", name: "tx_done", width: 1, direction: "Out", offset_x: 180, offset_y: 75 }
      ],
      x: 270,
      y: 40,
      width: 180,
      height: 100,
      clock_domain: "clk",
      latency_cycles: 1
    },

    // 3. TX Shift Register & Bit Counter
    {
      id: "u_tx_shift",
      name: "tx_shift_reg",
      label: "8-bit TX Shift Register",
      sublabel: "Parallel-In / Serial-Out",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "tx_shift_reg",
          width: 8,
          reg_type: "ShiftReg",
          step_behavior: "tx_shift_reg <= tx_shift_reg >> 1",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "tx_data_in", name: "tx_data[7:0]", width: 8, direction: "In", is_datapath: true, offset_x: 0, offset_y: 40 }
      ],
      outputs: [
        { id: "tx_bit_out", name: "tx_bit", width: 1, direction: "Out", offset_x: 160, offset_y: 40 }
      ],
      x: 270,
      y: 220,
      width: 160,
      height: 85,
      clock_domain: "clk",
      latency_cycles: 1
    },

    // 4. RX Deserializer & Output Register
    {
      id: "u_rx_deser",
      name: "rx_deserializer",
      label: "8-bit RX Deserializer",
      sublabel: "Serial-In / Parallel-Out",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "rx_data",
          width: 8,
          reg_type: "ShiftReg",
          step_behavior: "rx_data <= {rx_serial, rx_data[7:1]}",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "rx_ser_in", name: "rx_serial", width: 1, direction: "In", offset_x: 0, offset_y: 40 }
      ],
      outputs: [
        { id: "rx_data_out", name: "rx_data[7:0]", width: 8, direction: "Out", is_datapath: true, offset_x: 170, offset_y: 35 },
        { id: "rx_ready_out", name: "rx_ready", width: 1, direction: "Out", offset_x: 170, offset_y: 65 }
      ],
      x: 520,
      y: 220,
      width: 170,
      height: 90,
      clock_domain: "clk",
      latency_cycles: 1
    }
  ];

  const control_wires: MicroarchControlWire[] = [
    {
      id: "wire_baud_tx",
      name: "baud_tick",
      source_node: "u_baud",
      source_port: "baud_tick",
      target_node: "u_tx_fsm",
      target_port: "tx_tick_in",
      signal_type: "Control",
      wire_points: [[210, 85], [240, 85], [240, 100], [270, 100]]
    }
  ];

  return {
    top_module: "uart_transceiver",
    blocks,
    buses: [],
    control_wires,
    bounds: { min_x: 0, min_y: 0, max_x: 800, max_y: 380, width: 800, height: 380 }
  };
}

/**
 * Configurable SPI Master Controller Block Diagram
 */
function generateSpiMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    // 1. Clock Divider
    {
      id: "u_clk_div",
      name: "clk_divider",
      label: "SPI Clock Divider",
      sublabel: "2-bit Baud Prescaler (/4)",
      category: "Peripheral",
      kind: {
        type: "DatapathReg",
        data: {
          name: "clk_div",
          width: 2,
          reg_type: "Counter",
          step_behavior: "clk_div <= clk_div + 1",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "div_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 75 }
      ],
      outputs: [
        { id: "div_sck", name: "sck", width: 1, direction: "Out", is_clock: true, offset_x: 150, offset_y: 40 }
      ],
      x: 50,
      y: 50,
      width: 150,
      height: 80,
      clock_domain: "clk",
      latency_cycles: 0
    },

    // 2. SPI Protocol FSM
    {
      id: "u_spi_fsm",
      name: "spi_fsm",
      label: "SPI Protocol Controller (FSM)",
      sublabel: "3 States (IDLE, TX, DONE)",
      category: "Control",
      kind: {
        type: "Fsm",
        data: {
          state_reg: "state",
          state_width: 2,
          reset_state: "STATE_IDLE",
          current_state_default: "STATE_IDLE",
          states: [
            { id: "s0", name: "STATE_IDLE", value: 0, binary_str: "00", is_reset: true },
            { id: "s1", name: "STATE_TX", value: 1, binary_str: "01", is_reset: false },
            { id: "s2", name: "STATE_DONE", value: 2, binary_str: "10", is_reset: false }
          ],
          transitions: [
            { from_state: "STATE_IDLE", to_state: "STATE_TX", condition: "start == 1" },
            { from_state: "STATE_TX", to_state: "STATE_DONE", condition: "bit_cnt == 7 && clk_div == 3" },
            { from_state: "STATE_DONE", to_state: "STATE_IDLE", condition: "unconditional" }
          ],
          inputs: ["start", "bit_cnt", "clk_div"],
          outputs: ["busy", "done", "cs_n"]
        }
      },
      inputs: [
        { id: "fsm_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 95 },
        { id: "fsm_start", name: "start", width: 1, direction: "In", offset_x: 0, offset_y: 35 }
      ],
      outputs: [
        { id: "fsm_cs", name: "cs_n", width: 1, direction: "Out", offset_x: 180, offset_y: 25 },
        { id: "fsm_busy", name: "busy", width: 1, direction: "Out", offset_x: 180, offset_y: 50 },
        { id: "fsm_done", name: "done", width: 1, direction: "Out", offset_x: 180, offset_y: 75 }
      ],
      x: 260,
      y: 40,
      width: 180,
      height: 100,
      clock_domain: "clk",
      latency_cycles: 1
    },

    // 3. Shift Registers & MOSI/MISO Datapath
    {
      id: "u_spi_datapath",
      name: "spi_datapath",
      label: "Full-Duplex SPI Shift Network",
      sublabel: "8-bit TX & RX Shift Registers",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "shift_tx / shift_rx",
          width: 8,
          reg_type: "ShiftReg",
          step_behavior: "shift_tx <= {shift_tx[6:0], 1'b0}",
          clock_signal: "sck"
        }
      },
      inputs: [
        { id: "dp_tx_in", name: "tx_byte[7:0]", width: 8, direction: "In", is_datapath: true, offset_x: 0, offset_y: 35 },
        { id: "dp_miso", name: "miso", width: 1, direction: "In", offset_x: 0, offset_y: 70 }
      ],
      outputs: [
        { id: "dp_rx_out", name: "rx_byte[7:0]", width: 8, direction: "Out", is_datapath: true, offset_x: 180, offset_y: 35 },
        { id: "dp_mosi", name: "mosi", width: 1, direction: "Out", offset_x: 180, offset_y: 70 }
      ],
      x: 260,
      y: 220,
      width: 180,
      height: 95,
      clock_domain: "clk",
      latency_cycles: 1
    }
  ];

  return {
    top_module: "spi_master",
    blocks,
    buses: [],
    control_wires: [],
    bounds: { min_x: 0, min_y: 0, max_x: 600, max_y: 380, width: 600, height: 380 }
  };
}

/**
 * 8-Bit Arithmetic Logic Unit (ALU) Block Diagram
 */
function generateAluMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    // 1. Multi-Operation ALU Core
    {
      id: "u_alu_core",
      name: "alu_core",
      label: "8-bit Arithmetic Logic Unit (ALU)",
      sublabel: "ADD, SUB, AND, OR, XOR, SHL, SHR, NOT",
      category: "Datapath",
      kind: {
        type: "Alu",
        data: {
          opcode_signal: "opcode",
          opcode_width: 3,
          operand_a: "a",
          operand_b: "b",
          operand_width: 8,
          result_signal: "next_calc",
          result_width: 9,
          flags: [
            { name: "ZERO", signal: "zero_flag", description: "Asserted when result == 0" },
            { name: "CARRY", signal: "carry_flag", description: "Carry out from MSB (bit 8)" }
          ],
          operations: [
            { opcode_val: 0, opcode_bin: "000", name: "ADD", expression: "a + b" },
            { opcode_val: 1, opcode_bin: "001", name: "SUB", expression: "a - b" },
            { opcode_val: 2, opcode_bin: "010", name: "AND", expression: "a & b" },
            { opcode_val: 3, opcode_bin: "011", name: "OR", expression: "a | b" },
            { opcode_val: 4, opcode_bin: "100", name: "XOR", expression: "a ^ b" },
            { opcode_val: 5, opcode_bin: "101", name: "SHL", expression: "a << 1" },
            { opcode_val: 6, opcode_bin: "110", name: "SHR", expression: "a >> 1" },
            { opcode_val: 7, opcode_bin: "111", name: "NOT", expression: "~a" }
          ]
        }
      },
      inputs: [
        { id: "alu_a", name: "a[7:0]", width: 8, direction: "In", is_datapath: true, offset_x: 0, offset_y: 35 },
        { id: "alu_b", name: "b[7:0]", width: 8, direction: "In", is_datapath: true, offset_x: 0, offset_y: 75 },
        { id: "alu_op", name: "opcode[2:0]", width: 3, direction: "In", offset_x: 95, offset_y: 0 }
      ],
      outputs: [
        { id: "alu_res", name: "next_calc[7:0]", width: 8, direction: "Out", is_datapath: true, offset_x: 190, offset_y: 40 },
        { id: "alu_carry", name: "carry_bit", width: 1, direction: "Out", offset_x: 190, offset_y: 75 }
      ],
      x: 100,
      y: 120,
      width: 190,
      height: 105,
      latency_cycles: 0
    },

    // 2. Output Pipeline Registers
    {
      id: "u_alu_regs",
      name: "output_regs",
      label: "Synchronous Output Registers",
      sublabel: "result[7:0] & carry_flag",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "result",
          width: 8,
          reg_type: "PipelineReg",
          step_behavior: "result <= next_calc[7:0]",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "reg_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 95 },
        { id: "reg_in", name: "next_calc[7:0]", width: 8, direction: "In", is_datapath: true, offset_x: 0, offset_y: 40 },
        { id: "reg_c_in", name: "carry_bit", width: 1, direction: "In", offset_x: 0, offset_y: 70 }
      ],
      outputs: [
        { id: "reg_res_out", name: "result[7:0]", width: 8, direction: "Out", is_datapath: true, offset_x: 170, offset_y: 35 },
        { id: "reg_c_out", name: "carry_flag", width: 1, direction: "Out", offset_x: 170, offset_y: 65 },
        { id: "reg_z_out", name: "zero_flag", width: 1, direction: "Out", offset_x: 170, offset_y: 85 }
      ],
      x: 380,
      y: 120,
      width: 170,
      height: 105,
      clock_domain: "clk",
      latency_cycles: 1
    }
  ];

  const buses: MicroarchBus[] = [
    {
      id: "bus_alu_reg",
      name: "next_calc[7:0]",
      source_node: "u_alu_core",
      source_port: "alu_res",
      target_node: "u_alu_regs",
      target_port: "reg_in",
      width: 8,
      is_datapath: true,
      wire_points: [[290, 160], [335, 160], [335, 160], [380, 160]],
      initial_value_hex: "0x00"
    }
  ];

  return {
    top_module: "alu_8bit",
    blocks,
    buses,
    control_wires: [],
    bounds: { min_x: 0, min_y: 0, max_x: 700, max_y: 350, width: 700, height: 350 }
  };
}

/**
 * Xilinx UltraScale+ DSP48E2 & RAMB36E2 MAC Accelerator Block Diagram
 */
function generateDspMacMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    // 1. Global Clock Buffer
    {
      id: "u_bufg",
      name: "u_bufg",
      label: "Global Clock Buffer (BUFG)",
      sublabel: "Low-Skew Clock Distribution Tree",
      category: "Peripheral",
      kind: {
        type: "Primitive",
        data: { name: "u_bufg", prim_type: "BUFG", description: "UltraScale+ Clock Buffer" }
      },
      inputs: [{ id: "bufg_i", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 0, offset_y: 30 }],
      outputs: [{ id: "bufg_o", name: "clk_g", width: 1, direction: "Out", is_clock: true, offset_x: 120, offset_y: 30 }],
      x: 50,
      y: 50,
      width: 120,
      height: 60,
      latency_cycles: 0
    },

    // 2. Control LUT
    {
      id: "u_lut_ctrl",
      name: "u_lut_ctrl",
      label: "6-Input Look-Up Table (LUT6_2)",
      sublabel: "Dual-Output Address & Enable Decoder",
      category: "Control",
      kind: {
        type: "Primitive",
        data: { name: "u_lut_ctrl", prim_type: "LUT6_2", description: "Control Decoder LUT" }
      },
      inputs: [{ id: "lut_addr", name: "addr[4:0]", width: 5, direction: "In", offset_x: 0, offset_y: 40 }],
      outputs: [
        { id: "lut_o5", name: "run_step", width: 1, direction: "Out", offset_x: 150, offset_y: 30 },
        { id: "lut_o6", name: "mac_active", width: 1, direction: "Out", offset_x: 150, offset_y: 60 }
      ],
      x: 230,
      y: 40,
      width: 150,
      height: 80,
      latency_cycles: 0
    },

    // 3. 36Kb Synchronous Block RAM
    {
      id: "u_bram",
      name: "u_bram",
      label: "36Kb True Dual-Port Block RAM",
      sublabel: "RAMB36E2 Synchronous Memory",
      category: "Memory",
      kind: {
        type: "Memory",
        data: {
          name: "u_bram",
          primitive_type: "RAMB36E2",
          capacity_bits: 36864,
          read_width: 32,
          write_width: 32,
          ports: ["Port A (Read)", "Port B (Write)"]
        }
      },
      inputs: [
        { id: "bram_addr", name: "addr[9:0]", width: 10, direction: "In", is_datapath: true, offset_x: 0, offset_y: 35 },
        { id: "bram_din", name: "din_coeff[15:0]", width: 16, direction: "In", is_datapath: true, offset_x: 0, offset_y: 75 }
      ],
      outputs: [
        { id: "bram_dout_a", name: "dout_a[15:0]", width: 16, direction: "Out", is_datapath: true, offset_x: 185, offset_y: 35 },
        { id: "bram_dout_b", name: "dout_b[17:0]", width: 18, direction: "Out", is_datapath: true, offset_x: 185, offset_y: 75 }
      ],
      x: 100,
      y: 200,
      width: 185,
      height: 110,
      clock_domain: "clk_g",
      latency_cycles: 1
    },

    // 4. UltraScale+ DSP48E2 MAC Slice
    {
      id: "u_dsp48",
      name: "u_dsp48",
      label: "DSP48E2 Multiply-Accumulate Engine",
      sublabel: "27×18 Two's Complement MAC Pipeline",
      category: "Datapath",
      kind: {
        type: "Primitive",
        data: { name: "u_dsp48", prim_type: "DSP48E2", description: "UltraScale+ DSP Slice" }
      },
      inputs: [
        { id: "dsp_a", name: "dout_a[15:0]", width: 16, direction: "In", is_datapath: true, offset_x: 0, offset_y: 35 },
        { id: "dsp_b", name: "dout_b[17:0]", width: 18, direction: "In", is_datapath: true, offset_x: 0, offset_y: 75 },
        { id: "dsp_ce", name: "run_step", width: 1, direction: "In", offset_x: 95, offset_y: 0 }
      ],
      outputs: [
        { id: "dsp_p", name: "p_out[47:0]", width: 48, direction: "Out", is_datapath: true, offset_x: 195, offset_y: 55 }
      ],
      x: 370,
      y: 195,
      width: 195,
      height: 120,
      clock_domain: "clk_g",
      latency_cycles: 2
    },

    // 5. Output Valid Register
    {
      id: "u_valid_ff",
      name: "u_valid_ff",
      label: "Pipeline Valid Register (FDRE)",
      sublabel: "Status Pipeline Register",
      category: "Datapath",
      kind: {
        type: "Primitive",
        data: { name: "u_valid_ff", prim_type: "FDRE", description: "D Flip-Flop with Enable & Reset" }
      },
      inputs: [{ id: "ff_d", name: "mac_active", width: 1, direction: "In", offset_x: 0, offset_y: 35 }],
      outputs: [{ id: "ff_q", name: "valid_out", width: 1, direction: "Out", offset_x: 140, offset_y: 35 }],
      x: 640,
      y: 220,
      width: 140,
      height: 70,
      clock_domain: "clk_g",
      latency_cycles: 1
    }
  ];

  const buses: MicroarchBus[] = [
    {
      id: "bus_bram_dsp_a",
      name: "dout_a[15:0]",
      source_node: "u_bram",
      source_port: "bram_dout_a",
      target_node: "u_dsp48",
      target_port: "dsp_a",
      width: 16,
      is_datapath: true,
      wire_points: [[285, 235], [325, 235], [325, 230], [370, 230]],
      initial_value_hex: "0x0000"
    },
    {
      id: "bus_bram_dsp_b",
      name: "dout_b[17:0]",
      source_node: "u_bram",
      source_port: "bram_dout_b",
      target_node: "u_dsp48",
      target_port: "dsp_b",
      width: 18,
      is_datapath: true,
      wire_points: [[285, 275], [325, 275], [325, 270], [370, 270]],
      initial_value_hex: "0x0000"
    }
  ];

  return {
    top_module: "dsp_bram_mac",
    blocks,
    buses,
    control_wires: [],
    bounds: { min_x: 0, min_y: 0, max_x: 880, max_y: 380, width: 880, height: 380 }
  };
}

/**
 * Synchronous Counter with Glitch Hazards Block Diagram
 */
function generateCounterMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    {
      id: "u_counter",
      name: "count",
      label: "8-bit Up/Down Synchronous Counter",
      sublabel: "Clocked Datapath Register",
      category: "Datapath",
      kind: {
        type: "DatapathReg",
        data: {
          name: "count",
          width: 8,
          reg_type: "Counter",
          step_behavior: "count <= up_down ? count + 1 : count - 1",
          clock_signal: "clk"
        }
      },
      inputs: [
        { id: "cnt_clk", name: "clk", width: 1, direction: "In", is_clock: true, offset_x: 20, offset_y: 85 },
        { id: "cnt_en", name: "enable", width: 1, direction: "In", offset_x: 0, offset_y: 35 },
        { id: "cnt_ud", name: "up_down", width: 1, direction: "In", offset_x: 0, offset_y: 65 }
      ],
      outputs: [
        { id: "cnt_out", name: "count[7:0]", width: 8, direction: "Out", is_datapath: true, offset_x: 180, offset_y: 40 },
        { id: "cnt_tc", name: "terminal_count", width: 1, direction: "Out", offset_x: 180, offset_y: 70 }
      ],
      x: 100,
      y: 100,
      width: 180,
      height: 95,
      clock_domain: "clk",
      latency_cycles: 1
    },
    {
      id: "u_hazard_tree",
      name: "hazard_logic",
      label: "Asymmetric Glitch Hazard Tree",
      sublabel: "Dual-Path XOR Static Hazard Detector",
      category: "Datapath",
      kind: {
        type: "Generic",
        data: { name: "hazard_logic", description: "Demonstrates zero-time delta cycle glitches" }
      },
      inputs: [
        { id: "haz_in", name: "count[1:0]", width: 2, direction: "In", is_datapath: true, offset_x: 0, offset_y: 40 }
      ],
      outputs: [
        { id: "haz_out", name: "glitch_hazard_wire", width: 1, direction: "Out", offset_x: 170, offset_y: 40 }
      ],
      x: 360,
      y: 100,
      width: 170,
      height: 85,
      latency_cycles: 0
    }
  ];

  return {
    top_module: "counter_glitch_demo",
    blocks,
    buses: [],
    control_wires: [],
    bounds: { min_x: 0, min_y: 0, max_x: 650, max_y: 300, width: 650, height: 300 }
  };
}

/**
 * Combinational Logic Circuit Block Diagram
 */
function generateLogicCircuitMicroarchGraph(): MicroarchGraph {
  const blocks: MacroBlock[] = [
    {
      id: "comb_logic_system",
      name: "logic_circuit",
      label: "Combinational Logic",
      sublabel: "F = ((~A & B) & C) | ~B",
      category: "Datapath",
      kind: {
        type: "Generic",
        data: { name: "logic_circuit", description: "Boolean logic system with intermediate nets w1–w4" }
      },
      inputs: [
        { id: "in_a", name: "A", width: 1, direction: "In", offset_x: 0, offset_y: 25 },
        { id: "in_b", name: "B", width: 1, direction: "In", offset_x: 0, offset_y: 50 },
        { id: "in_c", name: "C", width: 1, direction: "In", offset_x: 0, offset_y: 75 }
      ],
      outputs: [
        { id: "out_f", name: "F", width: 1, direction: "Out", offset_x: 260, offset_y: 50 }
      ],
      x: 120,
      y: 100,
      width: 260,
      height: 100,
      latency_cycles: 0
    }
  ];

  return {
    top_module: "logic_circuit",
    blocks,
    buses: [],
    control_wires: [],
    bounds: { min_x: 0, min_y: 0, max_x: 500, max_y: 300, width: 500, height: 300 }
  };
}
