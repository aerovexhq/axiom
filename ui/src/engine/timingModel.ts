// Axiom EDA — Static Timing Analysis (STA), Slack Waterfall, CDC Matrix & Energy Treemap Model

export interface TimingConstraint {
  clockName: string;
  periodNs: number; // e.g. 10.0 ns (100 MHz)
  frequencyMhz: number;
  uncertaintyPs: number;
  inputDelayNs: number;
  outputDelayNs: number;
}

export interface PathSegment {
  name: string;
  type: "launch_clock" | "clock_to_out" | "logic_cell" | "interconnect" | "setup_window";
  delayPs: number;
  cumulativeDelayPs: number;
  instanceName: string;
  location?: string;
}

export interface TimingPath {
  id: string;
  startPoint: string;
  endPoint: string;
  clockDomain: string;
  slackPs: number; // Setup slack in ps
  requiredTimePs: number;
  arrivalTimePs: number;
  dataDelayPs: number;
  logicDelayPs: number;
  netDelayPs: number;
  logicLevels: number;
  segments: PathSegment[];
  status: "met" | "violated";
}

export interface SlackRadarSummary {
  clockPeriodPs: number;
  targetFrequencyMhz: number;
  maxOperatingFrequencyMhz: number;
  worstNegativeSlackPs: number; // WNS
  totalNegativeSlackPs: number; // TNS
  worstHoldSlackPs: number; // WHS
  failingPathsCount: number;
  totalPathsCount: number;
  histogramBins: Array<{ range: string; count: number; isViolating: boolean }>;
  criticalPath: TimingPath;
  allPaths: TimingPath[];
}

export interface CdcCrossing {
  id: string;
  sourceDomain: string;
  destDomain: string;
  sourceSignal: string;
  destSignal: string;
  ratio: string;
  kind: "synchronous" | "asynchronous" | "multicycle";
  protection: "none" | "2ff_synchronizer" | "fifo" | "handshake";
  status: "safe" | "warning" | "critical";
  message: string;
}

export interface EnergyTreemapNode {
  id: string;
  name: string;
  scope: string;
  category: "datapath" | "registers" | "clock" | "submodule" | "io";
  energyUj: number; // Microjoules
  percentage: number; // % of total
  switchingRateAlpha: number; // toggles per ns
  thermalColor: string;
  pdnDroopMv: number;
  children?: EnergyTreemapNode[];
}

// --------------------------------------------------------------------------
// 1. Static Timing Analysis (STA) Engine
// --------------------------------------------------------------------------

export function computeTimingAnalysis(topModule: string, clockPeriodNs = 10.0): SlackRadarSummary {
  const clockPeriodPs = Math.round(clockPeriodNs * 1000);
  const targetFrequencyMhz = Math.round(1000 / clockPeriodNs);

  const isAlu = topModule.includes("alu");
  const isCounter = topModule.includes("counter");

  let paths: TimingPath[] = [];

  if (isAlu) {
    paths = [
      {
        id: "path_1",
        startPoint: "in_a[7:0]",
        endPoint: "reg_result[7:0]/D",
        clockDomain: "clk",
        slackPs: 0, // will compute below
        requiredTimePs: clockPeriodPs - 50, // 50 ps setup
        arrivalTimePs: 0,
        dataDelayPs: 375,
        logicDelayPs: 235, // ADD + MUX
        netDelayPs: 140,
        logicLevels: 2,
        segments: [
          { name: "Clock Skew", type: "launch_clock", delayPs: 35, cumulativeDelayPs: 35, instanceName: "BUFG/clk" },
          { name: "Input Pad Delay", type: "interconnect", delayPs: 45, cumulativeDelayPs: 80, instanceName: "in_a[7:0]" },
          { name: "ADD (+)", type: "logic_cell", delayPs: 145, cumulativeDelayPs: 225, instanceName: "op_add" },
          { name: "Datapath Net", type: "interconnect", delayPs: 40, cumulativeDelayPs: 265, instanceName: "wire_add_mux" },
          { name: "MUX 8:1", type: "logic_cell", delayPs: 90, cumulativeDelayPs: 355, instanceName: "mux_alu" },
          { name: "Setup Window", type: "setup_window", delayPs: 50, cumulativeDelayPs: 405, instanceName: "reg_result/D" }
        ],
        status: "met"
      },
      {
        id: "path_2",
        startPoint: "in_b[7:0]",
        endPoint: "reg_result[7:0]/D",
        clockDomain: "clk",
        slackPs: 0,
        requiredTimePs: clockPeriodPs - 50,
        arrivalTimePs: 0,
        dataDelayPs: 385,
        logicDelayPs: 245, // SUB + MUX
        netDelayPs: 140,
        logicLevels: 2,
        segments: [
          { name: "Clock Skew", type: "launch_clock", delayPs: 35, cumulativeDelayPs: 35, instanceName: "BUFG/clk" },
          { name: "Input Pad Delay", type: "interconnect", delayPs: 45, cumulativeDelayPs: 80, instanceName: "in_b[7:0]" },
          { name: "SUB (-)", type: "logic_cell", delayPs: 155, cumulativeDelayPs: 235, instanceName: "op_sub" },
          { name: "Datapath Net", type: "interconnect", delayPs: 40, cumulativeDelayPs: 275, instanceName: "wire_sub_mux" },
          { name: "MUX 8:1", type: "logic_cell", delayPs: 90, cumulativeDelayPs: 365, instanceName: "mux_alu" },
          { name: "Setup Window", type: "setup_window", delayPs: 50, cumulativeDelayPs: 415, instanceName: "reg_result/D" }
        ],
        status: "met"
      },
      {
        id: "path_3",
        startPoint: "in_opcode[2:0]",
        endPoint: "reg_result[7:0]/D",
        clockDomain: "clk",
        slackPs: 0,
        requiredTimePs: clockPeriodPs - 50,
        arrivalTimePs: 0,
        dataDelayPs: 190,
        logicDelayPs: 110,
        netDelayPs: 80,
        logicLevels: 1,
        segments: [
          { name: "Input Pad Delay", type: "interconnect", delayPs: 45, cumulativeDelayPs: 45, instanceName: "in_opcode" },
          { name: "MUX Sel Decode", type: "logic_cell", delayPs: 90, cumulativeDelayPs: 135, instanceName: "mux_alu" },
          { name: "Setup Window", type: "setup_window", delayPs: 50, cumulativeDelayPs: 185, instanceName: "reg_result/D" }
        ],
        status: "met"
      },
      {
        id: "path_4",
        startPoint: "reg_result[7:0]/Q",
        endPoint: "out_zero_flag",
        clockDomain: "clk",
        slackPs: 0,
        requiredTimePs: clockPeriodPs,
        arrivalTimePs: 0,
        dataDelayPs: 140,
        logicDelayPs: 85,
        netDelayPs: 55,
        logicLevels: 1,
        segments: [
          { name: "Tco (Clk-to-Q)", type: "clock_to_out", delayPs: 60, cumulativeDelayPs: 60, instanceName: "reg_result" },
          { name: "EQ Detect", type: "logic_cell", delayPs: 45, cumulativeDelayPs: 105, instanceName: "cmp_zero" },
          { name: "Output Delay", type: "interconnect", delayPs: 35, cumulativeDelayPs: 140, instanceName: "out_zero_flag" }
        ],
        status: "met"
      }
    ];
  } else if (isCounter) {
    paths = [
      {
        id: "path_1",
        startPoint: "reg_count[7:0]/Q",
        endPoint: "reg_count[7:0]/D",
        clockDomain: "clk",
        slackPs: 0,
        requiredTimePs: clockPeriodPs - 50,
        arrivalTimePs: 0,
        dataDelayPs: 285,
        logicDelayPs: 190,
        netDelayPs: 95,
        logicLevels: 3,
        segments: [
          { name: "Tco (Clk-to-Q)", type: "clock_to_out", delayPs: 60, cumulativeDelayPs: 60, instanceName: "reg_count" },
          { name: "INC (+1)", type: "logic_cell", delayPs: 80, cumulativeDelayPs: 140, instanceName: "op_inc" },
          { name: "DIR MUX", type: "logic_cell", delayPs: 55, cumulativeDelayPs: 195, instanceName: "mux_dir" },
          { name: "EN MUX", type: "logic_cell", delayPs: 55, cumulativeDelayPs: 250, instanceName: "mux_en" },
          { name: "Setup Window", type: "setup_window", delayPs: 50, cumulativeDelayPs: 300, instanceName: "reg_count/D" }
        ],
        status: "met"
      },
      {
        id: "path_2",
        startPoint: "reg_count[0,1]/Q",
        endPoint: "out_glitch_hazard",
        clockDomain: "clk",
        slackPs: 0,
        requiredTimePs: clockPeriodPs,
        arrivalTimePs: 0,
        dataDelayPs: 235,
        logicDelayPs: 170,
        netDelayPs: 65,
        logicLevels: 2,
        segments: [
          { name: "Tco (Clk-to-Q)", type: "clock_to_out", delayPs: 60, cumulativeDelayPs: 60, instanceName: "reg_count" },
          { name: "XOR2 Path B", type: "logic_cell", delayPs: 70, cumulativeDelayPs: 130, instanceName: "gate_xor1" },
          { name: "XOR2 Hazard Gate", type: "logic_cell", delayPs: 60, cumulativeDelayPs: 190, instanceName: "gate_xor_hazard" },
          { name: "Output Pad", type: "interconnect", delayPs: 45, cumulativeDelayPs: 235, instanceName: "out_glitch" }
        ],
        status: "met"
      }
    ];
  } else {
    // SoC Hierarchy
    paths = [
      {
        id: "path_1",
        startPoint: "reg_accum[15:0]/Q",
        endPoint: "reg_accum[15:0]/D",
        clockDomain: "divided_clk",
        slackPs: 0,
        requiredTimePs: clockPeriodPs * 5 - 60,
        arrivalTimePs: 0,
        dataDelayPs: 310,
        logicDelayPs: 230,
        netDelayPs: 80,
        logicLevels: 2,
        segments: [
          { name: "Tco (Clk-to-Q)", type: "clock_to_out", delayPs: 70, cumulativeDelayPs: 70, instanceName: "reg_accum" },
          { name: "16-Bit Adder", type: "logic_cell", delayPs: 160, cumulativeDelayPs: 230, instanceName: "op_accum_add" },
          { name: "Interconnect Wire", type: "interconnect", delayPs: 40, cumulativeDelayPs: 270, instanceName: "wire_accum" },
          { name: "Setup Window", type: "setup_window", delayPs: 60, cumulativeDelayPs: 330, instanceName: "reg_accum/D" }
        ],
        status: "met"
      }
    ];
  }

  // Calculate slack and status for every path
  let worstSlack = Infinity;
  let totalNegSlack = 0;
  let failingCount = 0;

  for (const p of paths) {
    p.arrivalTimePs = p.segments[p.segments.length - 1].cumulativeDelayPs;
    p.slackPs = p.requiredTimePs - p.arrivalTimePs;
    if (p.slackPs < worstSlack) worstSlack = p.slackPs;
    if (p.slackPs < 0) {
      totalNegSlack += p.slackPs;
      failingCount++;
      p.status = "violated";
    } else {
      p.status = "met";
    }
  }

  // Max operating frequency: 1 / (T_clk - WNS)
  const maxDelay = paths[0] ? paths[0].arrivalTimePs : 500;
  const maxOperatingFrequencyMhz = Math.round(1000 / (maxDelay / 1000));

  // Build Slack Histogram Bins
  const histogramBins = [
    { range: "< -200ps", count: worstSlack < -200 ? 1 : 0, isViolating: true },
    { range: "-200 to 0ps", count: worstSlack >= -200 && worstSlack < 0 ? 1 : 0, isViolating: true },
    { range: "0 to +200ps", count: paths.filter((p) => p.slackPs >= 0 && p.slackPs < 200).length, isViolating: false },
    { range: "+200 to +500ps", count: paths.filter((p) => p.slackPs >= 200 && p.slackPs < 500).length, isViolating: false },
    { range: "> +500ps", count: paths.filter((p) => p.slackPs >= 500).length, isViolating: false }
  ];

  return {
    clockPeriodPs,
    targetFrequencyMhz,
    maxOperatingFrequencyMhz,
    worstNegativeSlackPs: worstSlack,
    totalNegativeSlackPs: totalNegSlack,
    worstHoldSlackPs: 280, // Safe positive hold margin
    failingPathsCount: failingCount,
    totalPathsCount: paths.length,
    histogramBins,
    criticalPath: paths[0],
    allPaths: paths
  };
}

// --------------------------------------------------------------------------
// 2. Clock Domain Crossing (CDC) Matrix Generator
// --------------------------------------------------------------------------

export function computeCdcMatrix(topModule: string): CdcCrossing[] {
  if (topModule.includes("soc_subsystem") || topModule.includes("hierarchy")) {
    return [
      {
        id: "cdc_1",
        sourceDomain: "sys_clk (100MHz)",
        destDomain: "sys_clk (100MHz)",
        sourceSignal: "sys_rst_n",
        destSignal: "u_div.rst_n",
        ratio: "1:1",
        kind: "synchronous",
        protection: "none",
        status: "safe",
        message: "Synchronous intra-domain interconnect."
      },
      {
        id: "cdc_2",
        sourceDomain: "sys_clk (100MHz)",
        destDomain: "divided_clk (20MHz)",
        sourceSignal: "data_in[7:0]",
        destSignal: "accumulator[15:0]",
        ratio: "5:1 (Integer Rational)",
        kind: "multicycle",
        protection: "2ff_synchronizer",
        status: "safe",
        message: "Source clock is integer multiple (5x). Phase-aligned edge transition detected."
      },
      {
        id: "cdc_3",
        sourceDomain: "divided_clk (20MHz)",
        destDomain: "sys_clk (100MHz)",
        sourceSignal: "u_div.clk_out",
        destSignal: "core_heartbeat",
        ratio: "1:5 (Fast Sampling)",
        kind: "synchronous",
        protection: "none",
        status: "safe",
        message: "Slow-to-fast domain transfer. Signal pulse width satisfies capture aperture."
      }
    ];
  }

  // Single Domain Default (ALU / Counter)
  return [
    {
      id: "cdc_1",
      sourceDomain: "clk (100MHz)",
      destDomain: "clk (100MHz)",
      sourceSignal: "a, b, opcode",
      destSignal: "result, carry_flag",
      ratio: "1:1",
      kind: "synchronous",
      protection: "none",
      status: "safe",
      message: "Synchronous single-clock domain design. Zero metastability hazard."
    }
  ];
}

// --------------------------------------------------------------------------
// 3. Hierarchical Dynamic Energy Treemap Generator
// --------------------------------------------------------------------------

export function computeEnergyTreemap(topModule: string, stateCurrentSimTimePs: number): EnergyTreemapNode {
  const isAlu = topModule.includes("alu");
  const isCounter = topModule.includes("counter");

  const totalTimeNs = Math.max(1, stateCurrentSimTimePs / 1000);

  if (isAlu) {
    const totalEnergy = 4.85 * totalTimeNs;
    return {
      id: "node_alu_top",
      name: "alu_8bit (Top)",
      scope: "top",
      category: "datapath",
      energyUj: totalEnergy,
      percentage: 100,
      switchingRateAlpha: 0.54,
      thermalColor: "#f97316", // Amber
      pdnDroopMv: 18.4,
      children: [
        {
          id: "node_alu_math",
          name: "Arithmetic Datapath (ADD / SUB / MUX)",
          scope: "top.math",
          category: "datapath",
          energyUj: totalEnergy * 0.56,
          percentage: 56,
          switchingRateAlpha: 0.68,
          thermalColor: "#ef4444", // Red (Hot)
          pdnDroopMv: 12.8
        },
        {
          id: "node_alu_regs",
          name: "State Registers (result[7:0] & flags)",
          scope: "top.regs",
          category: "registers",
          energyUj: totalEnergy * 0.28,
          percentage: 28,
          switchingRateAlpha: 0.42,
          thermalColor: "#f59e0b", // Amber
          pdnDroopMv: 4.2
        },
        {
          id: "node_alu_clk",
          name: "Clock & Reset Tree Network",
          scope: "top.clk",
          category: "clock",
          energyUj: totalEnergy * 0.16,
          percentage: 16,
          switchingRateAlpha: 1.0, // Toggles every cycle
          thermalColor: "#38bdf8", // Blue
          pdnDroopMv: 1.4
        }
      ]
    };
  } else if (isCounter) {
    const totalEnergy = 3.2 * totalTimeNs;
    return {
      id: "node_cnt_top",
      name: "counter_glitch_demo (Top)",
      scope: "top",
      category: "datapath",
      energyUj: totalEnergy,
      percentage: 100,
      switchingRateAlpha: 0.62,
      thermalColor: "#ef4444",
      pdnDroopMv: 24.6, // High droop due to glitch hazard!
      children: [
        {
          id: "node_cnt_reg",
          name: "Counter Register (count[7:0])",
          scope: "top.count",
          category: "registers",
          energyUj: totalEnergy * 0.48,
          percentage: 48,
          switchingRateAlpha: 0.55,
          thermalColor: "#f97316",
          pdnDroopMv: 8.5
        },
        {
          id: "node_cnt_glitch",
          name: "Glitch Hazard Logic (path_a ^ path_b)",
          scope: "top.glitch",
          category: "datapath",
          energyUj: totalEnergy * 0.32,
          percentage: 32,
          switchingRateAlpha: 0.88, // Spurious delta toggles
          thermalColor: "#dc2626", // Blazing Red
          pdnDroopMv: 13.2
        },
        {
          id: "node_cnt_clk",
          name: "Clock Network",
          scope: "top.clk",
          category: "clock",
          energyUj: totalEnergy * 0.20,
          percentage: 20,
          switchingRateAlpha: 1.0,
          thermalColor: "#38bdf8",
          pdnDroopMv: 2.9
        }
      ]
    };
  } else {
    const totalEnergy = 5.6 * totalTimeNs;
    return {
      id: "node_soc_top",
      name: "soc_subsystem_top",
      scope: "top",
      category: "submodule",
      energyUj: totalEnergy,
      percentage: 100,
      switchingRateAlpha: 0.45,
      thermalColor: "#10b981",
      pdnDroopMv: 14.1,
      children: [
        {
          id: "node_soc_div",
          name: "Clock Divider (u_div)",
          scope: "top.u_div",
          category: "submodule",
          energyUj: totalEnergy * 0.44,
          percentage: 44,
          switchingRateAlpha: 0.72,
          thermalColor: "#f97316",
          pdnDroopMv: 6.8
        },
        {
          id: "node_soc_accum",
          name: "Accumulator Datapath (16-bit)",
          scope: "top.accum",
          category: "datapath",
          energyUj: totalEnergy * 0.41,
          percentage: 41,
          switchingRateAlpha: 0.38,
          thermalColor: "#10b981",
          pdnDroopMv: 5.9
        },
        {
          id: "node_soc_clk",
          name: "PDN Supply Rail & Clocks",
          scope: "top.pdn",
          category: "clock",
          energyUj: totalEnergy * 0.15,
          percentage: 15,
          switchingRateAlpha: 1.0,
          thermalColor: "#38bdf8",
          pdnDroopMv: 1.4
        }
      ]
    };
  }
}
