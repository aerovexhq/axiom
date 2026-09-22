/**
 * Axiom Formal Property Verification (FPV) & Bounded Model Checking (BMC) Model.
 * Provides TypeScript definitions, trace waveform injection, and SVA assertion templates.
 */

import { engineBridge } from "./engineBridge";

export type FormalGoalKind = "Assert" | "Assume" | "Cover";

export type FormalResultStatus =
  | "Proven"
  | "Falsified"
  | "Covered"
  | "Vacuous"
  | "Unreached"
  | "Inconclusive";

export type FormalEngineKind = "bmc" | "k_induction";

export interface FormalTraceStep {
  cycle: number;
  time_ps: number;
  signals: Record<string, string>;
}

export interface CounterexampleTrace {
  goal_id: string;
  goal_name: string;
  cycle_index: number;
  message: string;
  steps: FormalTraceStep[];
}

export interface FormalGoal {
  id: string;
  name: string;
  kind: FormalGoalKind;
  status: FormalResultStatus;
  source_text: string;
  line?: number;
  col?: number;
  depth_reached: number;
  trace?: CounterexampleTrace;
  note?: string;
}

export interface FormalReport {
  goals: FormalGoal[];
  total_goals: number;
  proven_count: number;
  falsified_count: number;
  covered_count: number;
  vacuous_count: number;
  unreached_count: number;
  inconclusive_count: number;
  max_depth: number;
  execution_time_ms: number;
  top_module: string;
}

export interface FormalConfig {
  max_depth: number;
  engine: FormalEngineKind;
  clock_name?: string;
  reset_name?: string;
}

export interface SvaTemplateItem {
  id: string;
  title: string;
  category: "safety" | "liveness" | "fsm" | "handshake" | "structural";
  snippet: string;
  description: string;
}

/**
 * Standard SystemVerilog SVA templates for common hardware verification patterns.
 */
export const SVA_TEMPLATES: SvaTemplateItem[] = [
  {
    id: "range_bound",
    title: "Arithmetic Range Bound",
    category: "safety",
    snippet: "p_range: assert property (@(posedge clk) (count <= 4'd10));",
    description: "Verifies that an arithmetic counter or accumulator never overflows its legal boundary.",
  },
  {
    id: "mutex_onehot",
    title: "Mutual Exclusion ($onehot0)",
    category: "safety",
    snippet: "p_mutex: assert property (@(posedge clk) $onehot0({grant_a, grant_b, grant_c}));",
    description: "Guarantees that at most one grant or select signal is asserted simultaneously.",
  },
  {
    id: "req_ack_handshake",
    title: "Request-Acknowledge Handshake",
    category: "handshake",
    snippet: "p_handshake: assert property (@(posedge clk) req |-> ##[1:4] ack);",
    description: "Demands that when a request pulse occurs, an acknowledge arrives within 1 to 4 cycles.",
  },
  {
    id: "data_stability",
    title: "Payload Stability During Stall",
    category: "handshake",
    snippet: "p_stable_data: assert property (@(posedge clk) (valid && !ready) |=> $stable(data));",
    description: "Ensures stream data words do not mutate while backpressure/ready is held low.",
  },
  {
    id: "fsm_valid_state",
    title: "FSM State Legality",
    category: "fsm",
    snippet: "p_fsm_legal: assert property (@(posedge clk) (state == 2'b00 || state == 2'b01 || state == 2'b10));",
    description: "Proves that a state register never latches into an illegal or unmapped binary state.",
  },
  {
    id: "cover_target_state",
    title: "Witness FSM Active State",
    category: "structural",
    snippet: "c_active_state: cover property (@(posedge clk) (state == 2'b10 && out_valid));",
    description: "Witnesses a reachable path executing the core processing state and producing valid output.",
  },
  {
    id: "assume_reset_init",
    title: "Environmental Reset Assumption",
    category: "structural",
    snippet: "a_env_reset: assume property (@(posedge clk) !rst_n |=> ##1 rst_n);",
    description: "Constrains the formal verification environment to release reset cleanly after assertion.",
  },
];

/**
 * Executes Formal Property Verification and Bounded Model Checking.
 */
export async function runFormalVerification(
  source: string,
  topModule?: string,
  maxDepth: number = 20,
  engine: FormalEngineKind = "bmc",
  clockName?: string,
  resetName?: string
): Promise<FormalReport> {
  return engineBridge.runFormalVerification(source, topModule, maxDepth, engine, clockName, resetName);
}

/**
 * Injects a counterexample or witness trace into the Waveform Viewer session.
 * Converts formal trace step valuations into chronological signal history.
 */
export function injectTraceToWaveform(
  trace: CounterexampleTrace,
  _topModule: string = "top"
): { signalCount: number; cycleCount: number } {
  if (!trace.steps || trace.steps.length === 0) {
    return { signalCount: 0, cycleCount: 0 };
  }

  const signalNames = new Set<string>();
  for (const step of trace.steps) {
    for (const key of Object.keys(step.signals)) {
      signalNames.add(key);
    }
  }

  const stepPeriodPs = 10000;
  const historyUpdates: Record<string, Array<{ timePs: number; value: string }>> = {};

  for (const sig of signalNames) {
    historyUpdates[sig] = [];
    let lastVal: string | null = null;

    for (const step of trace.steps) {
      const rawVal = step.signals[sig] ?? "0";
      const cleanVal = formatSignalValueCompact(rawVal);
      const time = step.cycle * stepPeriodPs;

      if (cleanVal !== lastVal) {
        historyUpdates[sig].push({ timePs: time, value: cleanVal });
        lastVal = cleanVal;
      }
    }
  }

  engineBridge.injectFormalTrace(trace.goal_name, historyUpdates, trace.steps.length * stepPeriodPs);

  return {
    signalCount: signalNames.size,
    cycleCount: trace.steps.length,
  };
}

/**
 * Formats a raw signal debug string like "LogicVector { width: 4, values: [10], masks: [0] }"
 * into a clean hex/binary representation like "'h0a" or "10".
 */
export function formatSignalValueCompact(raw: string): string {
  if (!raw) return "0";
  if (!raw.includes("LogicVector")) return raw;

  const valMatch = raw.match(/values:\s*\[(\d+)\]/);
  const widthMatch = raw.match(/width:\s*(\d+)/);
  const maskMatch = raw.match(/masks:\s*\[(\d+)\]/);

  if (maskMatch && maskMatch[1] !== "0") {
    return "X";
  }

  if (valMatch && widthMatch) {
    const val = parseInt(valMatch[1], 10);
    const width = parseInt(widthMatch[1], 10);
    if (width === 1) {
      return val === 1 ? "1" : "0";
    }
    const hex = val.toString(16).toUpperCase();
    const padLen = Math.ceil(width / 4);
    return `'h${hex.padStart(padLen, "0")}`;
  }

  return raw;
}

/**
 * Fallback empty report for uninitialized sessions.
 */
export function getFormalReportFallback(topModule: string = "top", maxDepth: number = 20): FormalReport {
  return {
    goals: [],
    total_goals: 0,
    proven_count: 0,
    falsified_count: 0,
    covered_count: 0,
    vacuous_count: 0,
    unreached_count: 0,
    inconclusive_count: 0,
    max_depth: maxDepth,
    execution_time_ms: 0,
    top_module: topModule,
  };
}
