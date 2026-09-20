// Axiom EDA — Synthesized Gate-Level Circuit & Technology Mapping Model

export type FpgaFamily =
  | "Artix7"
  | "Kintex7"
  | "Virtex7"
  | "Zynq7000"
  | "UltraScalePlus"
  | "VirtualSilicon";

export interface SynthesizedPort {
  name: string;
  direction: "Input" | "Output" | "Inout";
  width: number;
  is_clock: boolean;
  is_reset: boolean;
}

export interface SynthesizedCell {
  id: string;
  name: string;
  kind: string; // "Lut1".."Lut6", "Lut6_2", "Fdre", "Fdce", "Carry4", "Carry8", "Ibuf", "Obuf", "Bufg", "Dsp48e2", "Ramb36e2"
  scope: string;
  ports: Record<string, string>; // Pin -> Net
  params: Record<string, number>; // e.g. "INIT" -> 0x40
  equation?: string;
  source_line?: number;
  delay_ps: number;
}

export interface SynthesizedNet {
  name: string;
  width: number;
  driver_cell?: string;
  driver_pin?: string;
  load_cells: [string, string][]; // [cell_id, pin_name]
  is_clock: boolean;
  is_reset: boolean;
}

export interface SynthesisStats {
  lut1_count: number;
  lut2_count: number;
  lut3_count: number;
  lut4_count: number;
  lut5_count: number;
  lut6_count: number;
  lut6_2_count: number;
  total_luts: number;

  fdre_count: number;
  fdce_count: number;
  total_ffs: number;

  carry4_count: number;
  carry8_count: number;
  total_carries: number;

  ibuf_count: number;
  obuf_count: number;
  bufg_count: number;
  total_iobs: number;

  dsp_count: number;
  bram_count: number;
  total_cells: number;

  target_lut_capacity: number;
  target_ff_capacity: number;
  lut_utilization_pct: number;
  ff_utilization_pct: number;

  logic_depth: number;
  estimated_delay_ps: number;
}

export interface SynthesizedCircuit {
  top_module: string;
  target_device: string;
  target_family: FpgaFamily;
  ports: SynthesizedPort[];
  cells: SynthesizedCell[];
  nets: SynthesizedNet[];
  stats: SynthesisStats;
  verilog_text?: string;
}

export interface SynthOptions {
  source?: string;
  topModule?: string;
  device?: string;
  designId?: string;
}

/**
 * Deterministic client-side fallback synthesis model for instant responsiveness.
 */
export function synthesizeClientFallback(
  designId: string,
  topModule: string = "logic_circuit",
  targetDevice: string = "xcku5p-ffvb676-2-e"
): SynthesizedCircuit {
  const isUsp = targetDevice.toLowerCase().includes("xcku") || targetDevice.toLowerCase().includes("xcvu");
  const family: FpgaFamily = isUsp ? "UltraScalePlus" : "Artix7";

  if (designId.includes("counter")) {
    return generateCounterSynthesizedCircuit(topModule, targetDevice, family);
  } else if (designId.includes("dsp") || designId.includes("bram") || designId.includes("mac")) {
    return generateDspMacSynthesizedCircuit(topModule, targetDevice, family);
  }

  // Default: logic_circuit
  return generateLogicCircuitSynthesizedCircuit(topModule, targetDevice, family);
}

function generateLogicCircuitSynthesizedCircuit(
  top: string,
  device: string,
  family: FpgaFamily
): SynthesizedCircuit {
  const ports: SynthesizedPort[] = [
    { name: "A", direction: "Input", width: 1, is_clock: false, is_reset: false },
    { name: "B", direction: "Input", width: 1, is_clock: false, is_reset: false },
    { name: "C", direction: "Input", width: 1, is_clock: false, is_reset: false },
    { name: "F", direction: "Output", width: 1, is_clock: false, is_reset: false },
  ];

  const cells: SynthesizedCell[] = [
    {
      id: "cell_ibuf_A",
      name: "ibuf_A",
      kind: "Ibuf",
      scope: "top",
      ports: { I: "A", O: "A_ibuf" },
      params: {},
      delay_ps: 350.0,
    },
    {
      id: "cell_ibuf_B",
      name: "ibuf_B",
      kind: "Ibuf",
      scope: "top",
      ports: { I: "B", O: "B_ibuf" },
      params: {},
      delay_ps: 350.0,
    },
    {
      id: "cell_ibuf_C",
      name: "ibuf_C",
      kind: "Ibuf",
      scope: "top",
      ports: { I: "C", O: "C_ibuf" },
      params: {},
      delay_ps: 350.0,
    },
    {
      id: "cell_lut_inv1",
      name: "lut_inv1",
      kind: "Lut1",
      scope: "top",
      ports: { I0: "A_ibuf", O: "w1" },
      params: { INIT: 0x1 },
      equation: "O = ~I0",
      delay_ps: 51.5,
    },
    {
      id: "cell_lut_and1",
      name: "lut_and1",
      kind: "Lut2",
      scope: "top",
      ports: { I0: "w1", I1: "B_ibuf", O: "w2" },
      params: { INIT: 0x8 },
      equation: "O = I0 & I1",
      delay_ps: 58.0,
    },
    {
      id: "cell_lut_and2",
      name: "lut_and2",
      kind: "Lut2",
      scope: "top",
      ports: { I0: "w2", I1: "C_ibuf", O: "w3" },
      params: { INIT: 0x8 },
      equation: "O = I0 & I1",
      delay_ps: 58.0,
    },
    {
      id: "cell_lut_inv2",
      name: "lut_inv2",
      kind: "Lut1",
      scope: "top",
      ports: { I0: "B_ibuf", O: "w4" },
      params: { INIT: 0x1 },
      equation: "O = ~I0",
      delay_ps: 51.5,
    },
    {
      id: "cell_lut_or1",
      name: "lut_or1",
      kind: "Lut2",
      scope: "top",
      ports: { I0: "w3", I1: "w4", O: "F_obuf" },
      params: { INIT: 0xE },
      equation: "O = I0 | I1",
      delay_ps: 58.0,
    },
    {
      id: "cell_obuf_F",
      name: "obuf_F",
      kind: "Obuf",
      scope: "top",
      ports: { I: "F_obuf", O: "F" },
      params: {},
      delay_ps: 650.0,
    },
  ];

  const nets: SynthesizedNet[] = [
    { name: "A", width: 1, load_cells: [["cell_ibuf_A", "I"]], is_clock: false, is_reset: false },
    { name: "B", width: 1, load_cells: [["cell_ibuf_B", "I"]], is_clock: false, is_reset: false },
    { name: "C", width: 1, load_cells: [["cell_ibuf_C", "I"]], is_clock: false, is_reset: false },
    { name: "A_ibuf", width: 1, driver_cell: "cell_ibuf_A", driver_pin: "O", load_cells: [["cell_lut_inv1", "I0"]], is_clock: false, is_reset: false },
    { name: "B_ibuf", width: 1, driver_cell: "cell_ibuf_B", driver_pin: "O", load_cells: [["cell_lut_and1", "I1"], ["cell_lut_inv2", "I0"]], is_clock: false, is_reset: false },
    { name: "C_ibuf", width: 1, driver_cell: "cell_ibuf_C", driver_pin: "O", load_cells: [["cell_lut_and2", "I1"]], is_clock: false, is_reset: false },
    { name: "w1", width: 1, driver_cell: "cell_lut_inv1", driver_pin: "O", load_cells: [["cell_lut_and1", "I0"]], is_clock: false, is_reset: false },
    { name: "w2", width: 1, driver_cell: "cell_lut_and1", driver_pin: "O", load_cells: [["cell_lut_and2", "I0"]], is_clock: false, is_reset: false },
    { name: "w3", width: 1, driver_cell: "cell_lut_and2", driver_pin: "O", load_cells: [["cell_lut_or1", "I0"]], is_clock: false, is_reset: false },
    { name: "w4", width: 1, driver_cell: "cell_lut_inv2", driver_pin: "O", load_cells: [["cell_lut_or1", "I1"]], is_clock: false, is_reset: false },
    { name: "F_obuf", width: 1, driver_cell: "cell_lut_or1", driver_pin: "O", load_cells: [["cell_obuf_F", "I"]], is_clock: false, is_reset: false },
    { name: "F", width: 1, driver_cell: "cell_obuf_F", driver_pin: "O", load_cells: [], is_clock: false, is_reset: false },
  ];

  const stats: SynthesisStats = {
    lut1_count: 2,
    lut2_count: 3,
    lut3_count: 0,
    lut4_count: 0,
    lut5_count: 0,
    lut6_count: 0,
    lut6_2_count: 0,
    total_luts: 5,
    fdre_count: 0,
    fdce_count: 0,
    total_ffs: 0,
    carry4_count: 0,
    carry8_count: 0,
    total_carries: 0,
    ibuf_count: 3,
    obuf_count: 1,
    bufg_count: 0,
    total_iobs: 4,
    dsp_count: 0,
    bram_count: 0,
    total_cells: 9,
    target_lut_capacity: family === "UltraScalePlus" ? 216960 : 63400,
    target_ff_capacity: family === "UltraScalePlus" ? 433920 : 126800,
    lut_utilization_pct: (5 / (family === "UltraScalePlus" ? 216960 : 63400)) * 100,
    ff_utilization_pct: 0.0,
    logic_depth: 3,
    estimated_delay_ps: 350 + (3 * 58) + 650,
  };

  return {
    top_module: top,
    target_device: device,
    target_family: family,
    ports,
    cells,
    nets,
    stats,
  };
}

function generateCounterSynthesizedCircuit(
  top: string,
  device: string,
  family: FpgaFamily
): SynthesizedCircuit {
  const ports: SynthesizedPort[] = [
    { name: "clk", direction: "Input", width: 1, is_clock: true, is_reset: false },
    { name: "rst_n", direction: "Input", width: 1, is_clock: false, is_reset: true },
    { name: "count", direction: "Output", width: 4, is_clock: false, is_reset: false },
  ];

  const cells: SynthesizedCell[] = [
    {
      id: "cell_ibuf_clk",
      name: "ibuf_clk",
      kind: "Ibuf",
      scope: "top",
      ports: { I: "clk", O: "clk_ibuf" },
      params: {},
      delay_ps: 350.0,
    },
    {
      id: "cell_bufg_clk",
      name: "bufg_clk",
      kind: "Bufg",
      scope: "top",
      ports: { I: "clk_ibuf", O: "clk_bufg" },
      params: {},
      delay_ps: 90.0,
    },
    {
      id: "cell_ibuf_rst_n",
      name: "ibuf_rst_n",
      kind: "Ibuf",
      scope: "top",
      ports: { I: "rst_n", O: "rst_n_ibuf" },
      params: {},
      delay_ps: 350.0,
    },
    // 4 Flip-Flops for 4-bit count
    {
      id: "cell_count_reg_0",
      name: "count_reg[0]",
      kind: "Fdce",
      scope: "top",
      ports: { C: "clk_bufg", CE: "1'b1", CLR: "rst_n_ibuf", D: "count_d[0]", Q: "count[0]" },
      params: { INIT: 0 },
      delay_ps: 95.0,
    },
    {
      id: "cell_count_reg_1",
      name: "count_reg[1]",
      kind: "Fdce",
      scope: "top",
      ports: { C: "clk_bufg", CE: "1'b1", CLR: "rst_n_ibuf", D: "count_d[1]", Q: "count[1]" },
      params: { INIT: 0 },
      delay_ps: 95.0,
    },
    {
      id: "cell_count_reg_2",
      name: "count_reg[2]",
      kind: "Fdce",
      scope: "top",
      ports: { C: "clk_bufg", CE: "1'b1", CLR: "rst_n_ibuf", D: "count_d[2]", Q: "count[2]" },
      params: { INIT: 0 },
      delay_ps: 95.0,
    },
    {
      id: "cell_count_reg_3",
      name: "count_reg[3]",
      kind: "Fdce",
      scope: "top",
      ports: { C: "clk_bufg", CE: "1'b1", CLR: "rst_n_ibuf", D: "count_d[3]", Q: "count[3]" },
      params: { INIT: 0 },
      delay_ps: 95.0,
    },
    // Incrementer LUTs
    {
      id: "cell_lut_inc_0",
      name: "lut_inc_0",
      kind: "Lut1",
      scope: "top",
      ports: { I0: "count[0]", O: "count_d[0]" },
      params: { INIT: 0x1 },
      equation: "O = ~I0",
      delay_ps: 51.5,
    },
    {
      id: "cell_lut_inc_1",
      name: "lut_inc_1",
      kind: "Lut2",
      scope: "top",
      ports: { I0: "count[0]", I1: "count[1]", O: "count_d[1]" },
      params: { INIT: 0x6 },
      equation: "O = I0 ^ I1",
      delay_ps: 58.0,
    },
    {
      id: "cell_lut_inc_2",
      name: "lut_inc_2",
      kind: "Lut3",
      scope: "top",
      ports: { I0: "count[0]", I1: "count[1]", I2: "count[2]", O: "count_d[2]" },
      params: { INIT: 0x78 },
      equation: "O = (I0 & I1) ^ I2",
      delay_ps: 64.5,
    },
    {
      id: "cell_lut_inc_3",
      name: "lut_inc_3",
      kind: "Lut4",
      scope: "top",
      ports: { I0: "count[0]", I1: "count[1]", I2: "count[2]", I3: "count[3]", O: "count_d[3]" },
      params: { INIT: 0x7F80 },
      equation: "O = (I0 & I1 & I2) ^ I3",
      delay_ps: 71.0,
    },
  ];

  const nets: SynthesizedNet[] = [
    { name: "clk", width: 1, load_cells: [["cell_ibuf_clk", "I"]], is_clock: true, is_reset: false },
    { name: "rst_n", width: 1, load_cells: [["cell_ibuf_rst_n", "I"]], is_clock: false, is_reset: true },
    { name: "clk_ibuf", width: 1, driver_cell: "cell_ibuf_clk", driver_pin: "O", load_cells: [["cell_bufg_clk", "I"]], is_clock: true, is_reset: false },
    { name: "clk_bufg", width: 1, driver_cell: "cell_bufg_clk", driver_pin: "O", load_cells: [["cell_count_reg_0", "C"], ["cell_count_reg_1", "C"], ["cell_count_reg_2", "C"], ["cell_count_reg_3", "C"]], is_clock: true, is_reset: false },
    { name: "rst_n_ibuf", width: 1, driver_cell: "cell_ibuf_rst_n", driver_pin: "O", load_cells: [["cell_count_reg_0", "CLR"]], is_clock: false, is_reset: true },
    { name: "count[0]", width: 1, driver_cell: "cell_count_reg_0", driver_pin: "Q", load_cells: [["cell_lut_inc_0", "I0"]], is_clock: false, is_reset: false },
    { name: "count[1]", width: 1, driver_cell: "cell_count_reg_1", driver_pin: "Q", load_cells: [["cell_lut_inc_1", "I1"]], is_clock: false, is_reset: false },
    { name: "count[2]", width: 1, driver_cell: "cell_count_reg_2", driver_pin: "Q", load_cells: [["cell_lut_inc_2", "I2"]], is_clock: false, is_reset: false },
    { name: "count[3]", width: 1, driver_cell: "cell_count_reg_3", driver_pin: "Q", load_cells: [["cell_lut_inc_3", "I3"]], is_clock: false, is_reset: false },
  ];

  const stats: SynthesisStats = {
    lut1_count: 1,
    lut2_count: 1,
    lut3_count: 1,
    lut4_count: 1,
    lut5_count: 0,
    lut6_count: 0,
    lut6_2_count: 0,
    total_luts: 4,
    fdre_count: 0,
    fdce_count: 4,
    total_ffs: 4,
    carry4_count: 0,
    carry8_count: 0,
    total_carries: 0,
    ibuf_count: 2,
    obuf_count: 4,
    bufg_count: 1,
    total_iobs: 7,
    dsp_count: 0,
    bram_count: 0,
    total_cells: 11,
    target_lut_capacity: family === "UltraScalePlus" ? 216960 : 63400,
    target_ff_capacity: family === "UltraScalePlus" ? 433920 : 126800,
    lut_utilization_pct: (4 / (family === "UltraScalePlus" ? 216960 : 63400)) * 100,
    ff_utilization_pct: (4 / (family === "UltraScalePlus" ? 433920 : 126800)) * 100,
    logic_depth: 2,
    estimated_delay_ps: 350 + (2 * 58) + 650,
  };

  return {
    top_module: top,
    target_device: device,
    target_family: family,
    ports,
    cells,
    nets,
    stats,
  };
}

function generateDspMacSynthesizedCircuit(
  top: string,
  device: string,
  family: FpgaFamily
): SynthesizedCircuit {
  const ports: SynthesizedPort[] = [
    { name: "clk", direction: "Input", width: 1, is_clock: true, is_reset: false },
    { name: "rst", direction: "Input", width: 1, is_clock: false, is_reset: true },
    { name: "en", direction: "Input", width: 1, is_clock: false, is_reset: false },
    { name: "p_out", direction: "Output", width: 48, is_clock: false, is_reset: false },
  ];

  const cells: SynthesizedCell[] = [
    {
      id: "cell_ibuf_clk",
      name: "ibuf_clk",
      kind: "Ibuf",
      scope: "top",
      ports: { I: "clk", O: "clk_ibuf" },
      params: {},
      delay_ps: 350.0,
    },
    {
      id: "cell_bufg_clk",
      name: "bufg_clk",
      kind: "Bufg",
      scope: "top",
      ports: { I: "clk_ibuf", O: "clk_bufg" },
      params: {},
      delay_ps: 90.0,
    },
    {
      id: "cell_bram_36k",
      name: "u_ramb36e2",
      kind: "Ramb36e2",
      scope: "top",
      ports: { CLKARDCLK: "clk_bufg", DOADO: "bram_dout" },
      params: {},
      delay_ps: 650.0,
    },
    {
      id: "cell_dsp48e2",
      name: "u_dsp48e2",
      kind: "Dsp48e2",
      scope: "top",
      ports: { CLK: "clk_bufg", A: "bram_dout", P: "p_out_int" },
      params: {},
      delay_ps: 850.0,
    },
    {
      id: "cell_lut_ctrl",
      name: "lut_ctrl",
      kind: "Lut3",
      scope: "top",
      ports: { I0: "rst", I1: "en", O: "mac_valid_d" },
      params: { INIT: 0x08 },
      equation: "O = ~I0 & I1",
      delay_ps: 64.5,
    },
    {
      id: "cell_ff_valid",
      name: "valid_reg",
      kind: "Fdre",
      scope: "top",
      ports: { C: "clk_bufg", D: "mac_valid_d", Q: "valid_out" },
      params: { INIT: 0 },
      delay_ps: 95.0,
    },
  ];

  const stats: SynthesisStats = {
    lut1_count: 0,
    lut2_count: 0,
    lut3_count: 1,
    lut4_count: 0,
    lut5_count: 0,
    lut6_count: 0,
    lut6_2_count: 0,
    total_luts: 1,
    fdre_count: 1,
    fdce_count: 0,
    total_ffs: 1,
    carry4_count: 0,
    carry8_count: 0,
    total_carries: 0,
    ibuf_count: 3,
    obuf_count: 49,
    bufg_count: 1,
    total_iobs: 53,
    dsp_count: 1,
    bram_count: 1,
    total_cells: 6,
    target_lut_capacity: family === "UltraScalePlus" ? 216960 : 63400,
    target_ff_capacity: family === "UltraScalePlus" ? 433920 : 126800,
    lut_utilization_pct: (1 / (family === "UltraScalePlus" ? 216960 : 63400)) * 100,
    ff_utilization_pct: (1 / (family === "UltraScalePlus" ? 433920 : 126800)) * 100,
    logic_depth: 2,
    estimated_delay_ps: 1200.0,
  };

  return {
    top_module: top,
    target_device: device,
    target_family: family,
    ports,
    cells,
    nets: [],
    stats,
  };
}
