// Axiom EDA — Multi-FPGA Partitioning & Silicon Interposer Simulation Model

export type DieKind = "SlrDie" | "StandaloneFpga" | "AsicChiplet";
export type InterconnectKind = "Sll" | "Laguna" | "PcbTrace" | "TdmSerDes";

export interface DieResourceBudget {
  logic_cells: number;
  bram_36k: number;
  dsp_slices: number;
}

export interface DieInfo {
  id: string;
  name: string;
  kind: DieKind;
  index: number;
  budget: DieResourceBudget;
}

export interface DieBoundary {
  id: string;
  die_a: string;
  die_b: string;
  max_tracks: number;
  interconnect_kind: InterconnectKind;
  propagation_delay_ps: number;
  capacitance_per_track_ff: number;
}

export interface MultiDieDevice {
  id: string;
  name: string;
  family: string;
  dies: DieInfo[];
  boundaries: DieBoundary[];
}

export interface CutNet {
  net_name: string;
  bit_width: number;
  driver_module: string;
  driver_die: string;
  load_module: string;
  load_die: string;
  boundary_id: string;
  required_tracks: number;
  latency_cycles: number;
  is_laguna_pipelined: boolean;
  estimated_delay_ps: number;
}

export interface BoundaryUtilization {
  boundary_id: string;
  die_a: string;
  die_b: string;
  tracks_used: number;
  tracks_capacity: number;
  utilization_pct: number;
  is_overflow: boolean;
}

export interface DieUtilization {
  die_id: string;
  assigned_modules: string[];
  logic_cells_used: number;
  logic_cells_capacity: number;
  logic_cells_pct: number;
  brams_used: number;
  brams_capacity: number;
  dsps_used: number;
  dsps_capacity: number;
}

export interface PartitionResult {
  device: MultiDieDevice;
  die_utilization: DieUtilization[];
  boundary_utilization: BoundaryUtilization[];
  cut_nets: CutNet[];
  total_cut_nets: number;
  total_tracks_used: number;
  interposer_power_mw: number;
  has_overflow: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Hardware Catalog Presets
// ---------------------------------------------------------------------------

export const VU9P_DEVICE: MultiDieDevice = {
  id: "xcvu9p-flgb2104-2-e",
  name: "Virtex UltraScale+ VU9P (3 SLRs)",
  family: "UltraScale+ SSIT",
  dies: [
    {
      id: "SLR0",
      name: "Super Logic Region 0 (Bottom)",
      kind: "SlrDie",
      index: 0,
      budget: { logic_cells: 862_000, bram_36k: 720, dsp_slices: 2_280 }
    },
    {
      id: "SLR1",
      name: "Super Logic Region 1 (Middle)",
      kind: "SlrDie",
      index: 1,
      budget: { logic_cells: 862_000, bram_36k: 720, dsp_slices: 2_280 }
    },
    {
      id: "SLR2",
      name: "Super Logic Region 2 (Top)",
      kind: "SlrDie",
      index: 2,
      budget: { logic_cells: 862_000, bram_36k: 720, dsp_slices: 2_280 }
    }
  ],
  boundaries: [
    {
      id: "b_slr0_slr1",
      die_a: "SLR0",
      die_b: "SLR1",
      max_tracks: 1_440,
      interconnect_kind: "Sll",
      propagation_delay_ps: 1_500,
      capacitance_per_track_ff: 2_500
    },
    {
      id: "b_slr1_slr2",
      die_a: "SLR1",
      die_b: "SLR2",
      max_tracks: 1_440,
      interconnect_kind: "Sll",
      propagation_delay_ps: 1_500,
      capacitance_per_track_ff: 2_500
    }
  ]
};

export const VU13P_DEVICE: MultiDieDevice = {
  id: "xcvu13p-fhgb2104-2-e",
  name: "Virtex UltraScale+ VU13P (4 SLRs)",
  family: "UltraScale+ SSIT",
  dies: [
    {
      id: "SLR0",
      name: "Super Logic Region 0",
      kind: "SlrDie",
      index: 0,
      budget: { logic_cells: 945_000, bram_36k: 912, dsp_slices: 3_072 }
    },
    {
      id: "SLR1",
      name: "Super Logic Region 1",
      kind: "SlrDie",
      index: 1,
      budget: { logic_cells: 945_000, bram_36k: 912, dsp_slices: 3_072 }
    },
    {
      id: "SLR2",
      name: "Super Logic Region 2",
      kind: "SlrDie",
      index: 2,
      budget: { logic_cells: 945_000, bram_36k: 912, dsp_slices: 3_072 }
    },
    {
      id: "SLR3",
      name: "Super Logic Region 3",
      kind: "SlrDie",
      index: 3,
      budget: { logic_cells: 945_000, bram_36k: 912, dsp_slices: 3_072 }
    }
  ],
  boundaries: [
    {
      id: "b_slr0_slr1",
      die_a: "SLR0",
      die_b: "SLR1",
      max_tracks: 1_440,
      interconnect_kind: "Sll",
      propagation_delay_ps: 1_500,
      capacitance_per_track_ff: 2_500
    },
    {
      id: "b_slr1_slr2",
      die_a: "SLR1",
      die_b: "SLR2",
      max_tracks: 1_440,
      interconnect_kind: "Sll",
      propagation_delay_ps: 1_500,
      capacitance_per_track_ff: 2_500
    },
    {
      id: "b_slr2_slr3",
      die_a: "SLR2",
      die_b: "SLR3",
      max_tracks: 1_440,
      interconnect_kind: "Sll",
      propagation_delay_ps: 1_500,
      capacitance_per_track_ff: 2_500
    }
  ]
};

export const DUAL_VU9P_DEVICE: MultiDieDevice = {
  id: "dual-vu9p-prototyping",
  name: "Dual-VU9P Prototyping Board (2 FPGAs)",
  family: "Multi-FPGA Prototyping",
  dies: [
    {
      id: "FPGA_A",
      name: "Primary Prototyping FPGA (VU9P A)",
      kind: "StandaloneFpga",
      index: 0,
      budget: { logic_cells: 2_586_000, bram_36k: 2_160, dsp_slices: 6_840 }
    },
    {
      id: "FPGA_B",
      name: "Secondary Prototyping FPGA (VU9P B)",
      kind: "StandaloneFpga",
      index: 1,
      budget: { logic_cells: 2_586_000, bram_36k: 2_160, dsp_slices: 6_840 }
    }
  ],
  boundaries: [
    {
      id: "b_fpgaA_fpgaB",
      die_a: "FPGA_A",
      die_b: "FPGA_B",
      max_tracks: 256,
      interconnect_kind: "PcbTrace",
      propagation_delay_ps: 4_500,
      capacitance_per_track_ff: 12_000
    }
  ]
};

export const MULTI_DIE_PRESETS: MultiDieDevice[] = [
  VU9P_DEVICE,
  VU13P_DEVICE,
  DUAL_VU9P_DEVICE
];

// ---------------------------------------------------------------------------
// Deterministic Multi-Die Synthesizers
// ---------------------------------------------------------------------------

export function synthesizeMultiDiePartition(
  activeDesignId: string,
  targetDeviceId: string = "xcvu9p-flgb2104-2-e",
  enableLaguna: boolean = false,
  tdmRatio: number = 1
): PartitionResult {
  const device =
    MULTI_DIE_PRESETS.find((d) => d.id.toLowerCase() === targetDeviceId.toLowerCase()) ||
    VU9P_DEVICE;

  const id = activeDesignId.toLowerCase();

  if (id.includes("riscv")) {
    return generateRiscvPartition(device, enableLaguna, tdmRatio);
  } else if (id.includes("dsp") || id.includes("bram") || id.includes("mac")) {
    return generateDspMacPartition(device, enableLaguna, tdmRatio);
  }
  return generateGenericPartition(device, enableLaguna, tdmRatio);
}

function generateRiscvPartition(
  device: MultiDieDevice,
  enableLaguna: boolean,
  tdmRatio: number
): PartitionResult {
  const isDual = device.dies.length === 2;
  const die0 = device.dies[0].id;
  const die1 = device.dies[1].id;
  const die2 = isDual ? die1 : device.dies[2].id;

  const die_utilization: DieUtilization[] = device.dies.map((d, idx) => {
    if (idx === 0) {
      return {
        die_id: d.id,
        assigned_modules: ["u_fetch", "u_decoder"],
        logic_cells_used: 400,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(400 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 1,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 0,
        dsps_capacity: d.budget.dsp_slices
      };
    } else if (idx === 1) {
      return {
        die_id: d.id,
        assigned_modules: ["u_regfile", "u_alu"],
        logic_cells_used: 1192,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(1192 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 0,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 2,
        dsps_capacity: d.budget.dsp_slices
      };
    } else {
      return {
        die_id: d.id,
        assigned_modules: ["u_dmem", "u_wb"],
        logic_cells_used: 175,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(175 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 2,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 0,
        dsps_capacity: d.budget.dsp_slices
      };
    }
  });

  const rawCutNets = [
    { name: "instr_bus[31:0]", width: 32, drv: "u_fetch", dDie: die0, ld: "u_decoder", lDie: die0 },
    { name: "rs1_addr[4:0]", width: 5, drv: "u_decoder", dDie: die0, ld: "u_regfile", lDie: die1 },
    { name: "rs2_addr[4:0]", width: 5, drv: "u_decoder", dDie: die0, ld: "u_regfile", lDie: die1 },
    { name: "imm_val[31:0]", width: 32, drv: "u_decoder", dDie: die0, ld: "u_alu", lDie: die1 },
    { name: "alu_result[31:0]", width: 32, drv: "u_alu", dDie: die1, ld: "u_dmem", lDie: die2 },
    { name: "dmem_dout[31:0]", width: 32, drv: "u_dmem", dDie: die2, ld: "u_wb", lDie: die2 },
    { name: "wb_data[31:0]", width: 32, drv: "u_wb", dDie: die2, ld: "u_regfile", lDie: die1 }
  ];

  const cut_nets: CutNet[] = [];
  const tracksByBoundary: Record<string, number> = {};

  rawCutNets.forEach((cn) => {
    if (cn.dDie !== cn.lDie) {
      const boundary =
        device.boundaries.find(
          (b) =>
            (b.die_a === cn.dDie && b.die_b === cn.lDie) ||
            (b.die_a === cn.lDie && b.die_b === cn.dDie)
        ) || device.boundaries[0];

      const rawTracks = cn.width;
      const tracks = tdmRatio > 1 ? Math.max(1, Math.ceil(rawTracks / tdmRatio)) : rawTracks;
      tracksByBoundary[boundary.id] = (tracksByBoundary[boundary.id] || 0) + tracks;

      cut_nets.push({
        net_name: cn.name,
        bit_width: cn.width,
        driver_module: cn.drv,
        driver_die: cn.dDie,
        load_module: cn.ld,
        load_die: cn.lDie,
        boundary_id: boundary.id,
        required_tracks: tracks,
        latency_cycles: enableLaguna ? 1 : tdmRatio > 1 ? tdmRatio : 0,
        is_laguna_pipelined: enableLaguna,
        estimated_delay_ps: enableLaguna ? 350 : boundary.propagation_delay_ps
      });
    }
  });

  const boundary_utilization: BoundaryUtilization[] = device.boundaries.map((b) => {
    const used = tracksByBoundary[b.id] || 0;
    const pct = +(used / b.max_tracks * 100).toFixed(2);
    return {
      boundary_id: b.id,
      die_a: b.die_a,
      die_b: b.die_b,
      tracks_used: used,
      tracks_capacity: b.max_tracks,
      utilization_pct: pct,
      is_overflow: used > b.max_tracks
    };
  });

  const total_tracks_used = Object.values(tracksByBoundary).reduce((a, b) => a + b, 0);
  const interposer_power_mw = +(total_tracks_used * 0.0406).toFixed(3);

  return {
    device,
    die_utilization,
    boundary_utilization,
    cut_nets,
    total_cut_nets: cut_nets.length,
    total_tracks_used,
    interposer_power_mw,
    has_overflow: boundary_utilization.some((b) => b.is_overflow),
    warnings: []
  };
}

function generateDspMacPartition(
  device: MultiDieDevice,
  enableLaguna: boolean,
  tdmRatio: number
): PartitionResult {
  const isDual = device.dies.length === 2;
  const die0 = device.dies[0].id;
  const die1 = device.dies[1].id;
  const die2 = isDual ? die1 : device.dies[2].id;

  const die_utilization: DieUtilization[] = device.dies.map((d, idx) => {
    if (idx === 0) {
      return {
        die_id: d.id,
        assigned_modules: ["u_clocking", "u_control"],
        logic_cells_used: 58,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(58 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 0,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 0,
        dsps_capacity: d.budget.dsp_slices
      };
    } else if (idx === 1) {
      return {
        die_id: d.id,
        assigned_modules: ["u_bram", "u_dsp"],
        logic_cells_used: 184,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(184 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 1,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 1,
        dsps_capacity: d.budget.dsp_slices
      };
    } else {
      return {
        die_id: d.id,
        assigned_modules: ["u_pipeline"],
        logic_cells_used: 96,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(96 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 0,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 0,
        dsps_capacity: d.budget.dsp_slices
      };
    }
  });

  const rawCutNets = [
    { name: "ctrl_to_bram[5:0]", width: 6, drv: "u_control", dDie: die0, ld: "u_bram", lDie: die1 },
    { name: "bram_dout[35:0]", width: 36, drv: "u_bram", dDie: die1, ld: "u_dsp", lDie: die1 },
    { name: "dsp_p_out[47:0]", width: 48, drv: "u_dsp", dDie: die1, ld: "u_pipeline", lDie: die2 },
    { name: "pipe_valid", width: 1, drv: "u_pipeline", dDie: die2, ld: "u_control", lDie: die0 }
  ];

  const cut_nets: CutNet[] = [];
  const tracksByBoundary: Record<string, number> = {};

  rawCutNets.forEach((cn) => {
    if (cn.dDie !== cn.lDie) {
      const boundary =
        device.boundaries.find(
          (b) =>
            (b.die_a === cn.dDie && b.die_b === cn.lDie) ||
            (b.die_a === cn.lDie && b.die_b === cn.dDie)
        ) || device.boundaries[0];

      const rawTracks = cn.width;
      const tracks = tdmRatio > 1 ? Math.max(1, Math.ceil(rawTracks / tdmRatio)) : rawTracks;
      tracksByBoundary[boundary.id] = (tracksByBoundary[boundary.id] || 0) + tracks;

      cut_nets.push({
        net_name: cn.name,
        bit_width: cn.width,
        driver_module: cn.drv,
        driver_die: cn.dDie,
        load_module: cn.ld,
        load_die: cn.lDie,
        boundary_id: boundary.id,
        required_tracks: tracks,
        latency_cycles: enableLaguna ? 1 : tdmRatio > 1 ? tdmRatio : 0,
        is_laguna_pipelined: enableLaguna,
        estimated_delay_ps: enableLaguna ? 350 : boundary.propagation_delay_ps
      });
    }
  });

  const boundary_utilization: BoundaryUtilization[] = device.boundaries.map((b) => {
    const used = tracksByBoundary[b.id] || 0;
    const pct = +(used / b.max_tracks * 100).toFixed(2);
    return {
      boundary_id: b.id,
      die_a: b.die_a,
      die_b: b.die_b,
      tracks_used: used,
      tracks_capacity: b.max_tracks,
      utilization_pct: pct,
      is_overflow: used > b.max_tracks
    };
  });

  const total_tracks_used = Object.values(tracksByBoundary).reduce((a, b) => a + b, 0);
  const interposer_power_mw = +(total_tracks_used * 0.0406).toFixed(3);

  return {
    device,
    die_utilization,
    boundary_utilization,
    cut_nets,
    total_cut_nets: cut_nets.length,
    total_tracks_used,
    interposer_power_mw,
    has_overflow: boundary_utilization.some((b) => b.is_overflow),
    warnings: []
  };
}

function generateGenericPartition(
  device: MultiDieDevice,
  enableLaguna: boolean,
  tdmRatio: number
): PartitionResult {
  const die0 = device.dies[0].id;
  const die1 = device.dies[1].id;

  const die_utilization: DieUtilization[] = device.dies.map((d, idx) => {
    if (idx === 0) {
      return {
        die_id: d.id,
        assigned_modules: ["u_core"],
        logic_cells_used: 450,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(450 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 1,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 1,
        dsps_capacity: d.budget.dsp_slices
      };
    } else if (idx === 1) {
      return {
        die_id: d.id,
        assigned_modules: ["u_periph"],
        logic_cells_used: 210,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: +(210 / d.budget.logic_cells * 100).toFixed(2),
        brams_used: 0,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 0,
        dsps_capacity: d.budget.dsp_slices
      };
    } else {
      return {
        die_id: d.id,
        assigned_modules: [],
        logic_cells_used: 0,
        logic_cells_capacity: d.budget.logic_cells,
        logic_cells_pct: 0,
        brams_used: 0,
        brams_capacity: d.budget.bram_36k,
        dsps_used: 0,
        dsps_capacity: d.budget.dsp_slices
      };
    }
  });

  const boundary = device.boundaries[0];
  const rawTracks = 17;
  const tracks = tdmRatio > 1 ? Math.max(1, Math.ceil(rawTracks / tdmRatio)) : rawTracks;

  const cut_nets: CutNet[] = [
    {
      net_name: "data_bus[15:0]",
      bit_width: 16,
      driver_module: "u_core",
      driver_die: die0,
      load_module: "u_periph",
      load_die: die1,
      boundary_id: boundary.id,
      required_tracks: Math.ceil(16 / tdmRatio),
      latency_cycles: enableLaguna ? 1 : tdmRatio > 1 ? tdmRatio : 0,
      is_laguna_pipelined: enableLaguna,
      estimated_delay_ps: enableLaguna ? 350 : boundary.propagation_delay_ps
    },
    {
      net_name: "ack_signal",
      bit_width: 1,
      driver_module: "u_periph",
      driver_die: die1,
      load_module: "u_core",
      load_die: die0,
      boundary_id: boundary.id,
      required_tracks: 1,
      latency_cycles: enableLaguna ? 1 : tdmRatio > 1 ? tdmRatio : 0,
      is_laguna_pipelined: enableLaguna,
      estimated_delay_ps: enableLaguna ? 350 : boundary.propagation_delay_ps
    }
  ];

  const boundary_utilization: BoundaryUtilization[] = device.boundaries.map((b, idx) => {
    const used = idx === 0 ? tracks : 0;
    const pct = +(used / b.max_tracks * 100).toFixed(2);
    return {
      boundary_id: b.id,
      die_a: b.die_a,
      die_b: b.die_b,
      tracks_used: used,
      tracks_capacity: b.max_tracks,
      utilization_pct: pct,
      is_overflow: used > b.max_tracks
    };
  });

  return {
    device,
    die_utilization,
    boundary_utilization,
    cut_nets,
    total_cut_nets: cut_nets.length,
    total_tracks_used: tracks,
    interposer_power_mw: +(tracks * 0.0406).toFixed(3),
    has_overflow: false,
    warnings: []
  };
}
