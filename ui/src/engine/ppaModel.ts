// Axiom EDA — Live Power-Performance-Area (PPA) & Silicon Cost Model

export interface PpaMetrics {
  // Area Metrics
  lut_count: number;
  ff_count: number;
  bram_36k_count: number;
  bram_18k_count: number;
  dsp_slice_count: number;
  total_equivalent_logic_cells: number;
  asic_gate_count: number;
  asic_core_area_um2: number;
  asic_die_area_mm2: number;

  // Performance Metrics
  fmax_mhz: number;
  clock_period_ps: number;
  critical_path_delay_ps: number;
  worst_negative_slack_ps: number;
  total_negative_slack_ps: number;
  logic_depth: number;
  latency_cycles: number;

  // Power Metrics
  dynamic_power_mw: number;
  static_power_mw: number;
  total_power_mw: number;
  energy_per_cycle_pj: number;
  junction_temperature_c: number;

  // Figure of Merit
  fom_score: number;
}

export interface FpgaDeviceProfile {
  id: string;
  name: string;
  family: string;
  lut_capacity: number;
  ff_capacity: number;
  bram_capacity: number;
  dsp_capacity: number;
  io_pin_count: number;
  speed_grade: string;
  reference_cost_usd: number;
}

export type FpgaFitStatus = "Fits" | "ExceedsCapacity";

export interface FpgaFitEvaluation {
  profile: FpgaDeviceProfile;
  status: FpgaFitStatus;
  lut_utilization_pct: number;
  ff_utilization_pct: number;
  bram_utilization_pct: number;
  dsp_utilization_pct: number;
  max_utilization_pct: number;
  bottleneck_resource: string;
  estimated_cost_usd: number;
  cost_delta_vs_target: number;
  is_current_target: boolean;
  is_recommended: boolean;
}

export interface AsicForecast {
  pdk_name: string;
  technology_node_nm: number;
  gate_count: number;
  core_area_um2: number;
  routing_overhead_factor: number;
  die_area_mm2: number;
  die_width_mm: number;
  die_height_mm: number;
  pad_ring_io_count: number;
  estimated_mpw_shuttle_cost_usd: number;
  estimated_mask_set_cost_usd: number;
}

export interface ParetoPoint {
  freq_mhz: number;
  power_mw: number;
  energy_pj: number;
  area_score: number;
  slack_ps: number;
  fom: number;
}

export interface PpaOptions {
  target_device?: string;
  target_clock_freq_mhz?: number;
  junction_temp_c?: number;
  core_voltage_v?: number;
  switching_activity_alpha?: number;
  pdk?: string;
}

export interface PpaReport {
  top_module: string;
  metrics: PpaMetrics;
  fpga_evaluations: FpgaFitEvaluation[];
  recommended_device_id?: string;
  asic_forecast: AsicForecast;
  pareto_curve: ParetoPoint[];
  optimization_suggestions: string[];
}

export const STANDARD_FPGA_CATALOG: FpgaDeviceProfile[] = [
  {
    id: "xc7a100tcsg324-1",
    name: "Artix-7 XC7A100T",
    family: "Artix-7",
    lut_capacity: 63400,
    ff_capacity: 126800,
    bram_capacity: 135,
    dsp_capacity: 240,
    io_pin_count: 210,
    speed_grade: "-1",
    reference_cost_usd: 85.00,
  },
  {
    id: "xc7z020clg484-1",
    name: "Zynq-7000 XC7Z020",
    family: "Zynq-7000",
    lut_capacity: 53200,
    ff_capacity: 106400,
    bram_capacity: 140,
    dsp_capacity: 220,
    io_pin_count: 200,
    speed_grade: "-1",
    reference_cost_usd: 95.00,
  },
  {
    id: "xc7k325tffg900-2",
    name: "Kintex-7 XC7K325T",
    family: "Kintex-7",
    lut_capacity: 203800,
    ff_capacity: 407600,
    bram_capacity: 445,
    dsp_capacity: 840,
    io_pin_count: 500,
    speed_grade: "-2",
    reference_cost_usd: 450.00,
  },
  {
    id: "xc7vx415tffg1158-1",
    name: "Virtex-7 XC7VX415T",
    family: "Virtex-7",
    lut_capacity: 257600,
    ff_capacity: 515200,
    bram_capacity: 880,
    dsp_capacity: 2160,
    io_pin_count: 350,
    speed_grade: "-1",
    reference_cost_usd: 1200.00,
  },
  {
    id: "xcku5p-ffvb676-2-e",
    name: "Kintex UltraScale+ XCKU5P",
    family: "Kintex UltraScale+",
    lut_capacity: 216960,
    ff_capacity: 433920,
    bram_capacity: 480,
    dsp_capacity: 1824,
    io_pin_count: 400,
    speed_grade: "-2",
    reference_cost_usd: 650.00,
  },
  {
    id: "xcvu9p-flga2104-2-e",
    name: "Virtex UltraScale+ XCVU9P",
    family: "Virtex UltraScale+",
    lut_capacity: 1182240,
    ff_capacity: 2364480,
    bram_capacity: 2160,
    dsp_capacity: 6840,
    io_pin_count: 832,
    speed_grade: "-2",
    reference_cost_usd: 4800.00,
  },
];

/// Fallback client-side evaluator for pure browser mode when Web Worker or WASM is unavailable.
export function evaluateClientFallbackPpa(
  topModuleOrSource: string,
  optionsOrLutCount?: PpaOptions | number,
  ffCount: number = 32,
  bramCount: number = 0,
  dspCount: number = 0,
  fmaxMhz: number = 185.5,
  criticalDelayPs: number = 5390,
  wnsPs: number = 4610,
  explicitOptions?: PpaOptions
): PpaReport {
  let lutCount = 24;
  let options = explicitOptions;

  if (typeof optionsOrLutCount === "object") {
    options = optionsOrLutCount;
    const src = topModuleOrSource;
    const hasDsp = /DSP48|mult|\*/.test(src);
    const hasBram = /RAMB|bram|memory|reg\s*\[\d+:\d+\]\s*\w+\s*\[\d+:\d+\]/.test(src);
    dspCount = hasDsp ? 1 : 0;
    bramCount = hasBram ? 1 : 0;
    ffCount = Math.max(8, (src.match(/always\s*@\s*\(\s*posedge/g) || []).length * 8 || 16);
    lutCount = Math.max(12, (src.match(/assign|LUT\d|\bif\b|\bcase\b/g) || []).length * 4 || 24);
    fmaxMhz = 210.0;
    criticalDelayPs = 4760;
    wnsPs = 5240;
  } else if (typeof optionsOrLutCount === "number") {
    lutCount = optionsOrLutCount;
  }

  const topModule = topModuleOrSource.length < 64 && !topModuleOrSource.includes(";") ? topModuleOrSource : "top";
  const targetDevId = options?.target_device ?? "xcku5p-ffvb676-2-e";
  const junctionTemp = options?.junction_temp_c ?? 25.0;
  const vdd = options?.core_voltage_v ?? 0.95;
  const alpha = options?.switching_activity_alpha ?? 0.125;
  const targetFreq = options?.target_clock_freq_mhz ?? Math.min(fmaxMhz, 250.0);

  const totalCells = Math.max(1, lutCount + ffCount + bramCount * 360 + dspCount * 120);

  // Dynamic & Static Power
  const capPf = Math.max(0.5, totalCells * 0.045);
  const dynPowerMw = 0.5 * (capPf * 1e-12) * (vdd * vdd) * (targetFreq * 1e6) * alpha * 1000.0 * Math.max(1.0, Math.sqrt(lutCount));
  const baseStaticMw = 18.5 + totalCells * 0.002;
  const tempScale = Math.pow(2.0, (junctionTemp - 25.0) / 15.0);
  const staticPowerMw = baseStaticMw * tempScale * (vdd / 0.95);
  const totalPowerMw = dynPowerMw + staticPowerMw;
  const energyPj = targetFreq > 0 ? (totalPowerMw * 1e-3) / (targetFreq * 1e6) * 1e12 : 0;

  // ASIC 130nm estimation
  const gateCount = lutCount * 5 + ffCount * 8 + dspCount * 1500 + bramCount * 48000;
  const coreAreaUm2 = gateCount * 10.8 * 1.40;
  const coreAreaMm2 = coreAreaUm2 / 1e6;
  const dimMm = Math.max(1.0, Math.sqrt(coreAreaMm2) + 0.30);
  const dieAreaMm2 = dimMm * dimMm;

  // Figure of Merit
  const normArea = Math.max(0.1, totalCells / 1000.0);
  const fom = fmaxMhz / (Math.max(0.001, totalPowerMw * 1e-3) * normArea);

  const metrics: PpaMetrics = {
    lut_count: lutCount,
    ff_count: ffCount,
    bram_36k_count: bramCount,
    bram_18k_count: 0,
    dsp_slice_count: dspCount,
    total_equivalent_logic_cells: totalCells,
    asic_gate_count: gateCount,
    asic_core_area_um2: coreAreaUm2,
    asic_die_area_mm2: dieAreaMm2,
    fmax_mhz: fmaxMhz,
    clock_period_ps: targetFreq > 0 ? 1_000_000 / targetFreq : 10000,
    critical_path_delay_ps: criticalDelayPs,
    worst_negative_slack_ps: wnsPs,
    total_negative_slack_ps: Math.min(0, wnsPs),
    logic_depth: Math.max(1, Math.round(criticalDelayPs / 450)),
    latency_cycles: 1,
    dynamic_power_mw: dynPowerMw,
    static_power_mw: staticPowerMw,
    total_power_mw: totalPowerMw,
    energy_per_cycle_pj: energyPj,
    junction_temperature_c: junctionTemp,
    fom_score: fom,
  };

  const targetProfile = STANDARD_FPGA_CATALOG.find((p) => p.id === targetDevId);
  const targetCost = targetProfile?.reference_cost_usd ?? 650.0;

  let recommendedId: string | undefined = undefined;
  let minCost = Infinity;

  const evaluations: FpgaFitEvaluation[] = STANDARD_FPGA_CATALOG.map((profile) => {
    const lutPct = (lutCount / profile.lut_capacity) * 100.0;
    const ffPct = (ffCount / profile.ff_capacity) * 100.0;
    const bramPct = profile.bram_capacity > 0 ? (bramCount / profile.bram_capacity) * 100.0 : 0;
    const dspPct = profile.dsp_capacity > 0 ? (dspCount / profile.dsp_capacity) * 100.0 : 0;
    const maxPct = Math.max(lutPct, ffPct, bramPct, dspPct);
    const fits = maxPct <= 100.0;

    let bottleneck = "LUT Logic";
    if (maxPct === ffPct) bottleneck = "Flip-Flops";
    else if (maxPct === bramPct) bottleneck = "Block RAM";
    else if (maxPct === dspPct) bottleneck = "DSP Slices";

    if (fits && profile.reference_cost_usd < minCost) {
      minCost = profile.reference_cost_usd;
      recommendedId = profile.id;
    }

    return {
      profile,
      status: fits ? "Fits" : "ExceedsCapacity",
      lut_utilization_pct: lutPct,
      ff_utilization_pct: ffPct,
      bram_utilization_pct: bramPct,
      dsp_utilization_pct: dspPct,
      max_utilization_pct: maxPct,
      bottleneck_resource: bottleneck,
      estimated_cost_usd: profile.reference_cost_usd,
      cost_delta_vs_target: profile.reference_cost_usd - targetCost,
      is_current_target: profile.id === targetDevId,
      is_recommended: false,
    };
  });

  for (const ev of evaluations) {
    if (ev.profile.id === recommendedId) {
      ev.is_recommended = true;
    }
  }

  // Pareto curve (11 steps)
  const paretoCurve: ParetoPoint[] = [];
  const baseF = Math.max(20, fmaxMhz);
  const minF = Math.max(10, baseF * 0.4);
  const maxF = baseF * 1.6;
  const stepF = (maxF - minF) / 10;

  for (let i = 0; i <= 10; i++) {
    const f = minF + stepF * i;
    const pDyn = 0.5 * (capPf * 1e-12) * (vdd * vdd) * (f * 1e6) * alpha * 1000.0 * Math.max(1.0, Math.sqrt(lutCount));
    const pTot = pDyn + staticPowerMw;
    const pPeriod = 1_000_000 / f;
    const pSlack = pPeriod - criticalDelayPs;
    paretoCurve.push({
      freq_mhz: f,
      power_mw: pTot,
      energy_pj: (pTot * 1e-3) / (f * 1e6) * 1e12,
      area_score: normArea,
      slack_ps: pSlack,
      fom: f / (Math.max(0.001, pTot * 1e-3) * normArea),
    });
  }

  const suggestions: string[] = [];
  if (wnsPs < 0) {
    suggestions.push(`Timing violation detected (WNS: ${wnsPs.toFixed(1)} ps). Auto-pipelining recommended for +50-100% Fmax.`);
  }
  if (recommendedId && recommendedId !== targetDevId) {
    const rec = evaluations.find((e) => e.profile.id === recommendedId);
    if (rec && rec.cost_delta_vs_target < 0) {
      suggestions.push(`BOM Cost Optimization: Device fits on '${rec.profile.name}' saving $${Math.abs(rec.cost_delta_vs_target).toFixed(2)} per unit.`);
    }
  }
  if (staticPowerMw > dynPowerMw * 1.5) {
    suggestions.push("Static leakage dominates active power. Consider low-power sleep gating or lowering Vdd.");
  }

  return {
    top_module: topModule,
    metrics,
    fpga_evaluations: evaluations,
    recommended_device_id: recommendedId,
    asic_forecast: {
      pdk_name: "SkyWater 130nm (sky130_fd_sc_hd)",
      technology_node_nm: 130,
      gate_count: gateCount,
      core_area_um2: coreAreaUm2,
      routing_overhead_factor: 1.40,
      die_area_mm2: dieAreaMm2,
      die_width_mm: dimMm,
      die_height_mm: dimMm,
      pad_ring_io_count: Math.round(dimMm * 2 * 8),
      estimated_mpw_shuttle_cost_usd: 9750,
      estimated_mask_set_cost_usd: 185000,
    },
    pareto_curve: paretoCurve,
    optimization_suggestions: suggestions,
  };
}
