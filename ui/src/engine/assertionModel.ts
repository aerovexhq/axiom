// In-RAM Temporal Logic Assertion Radar Model (IEEE 1800 SVA / PSL Verification)

export type AssertionKind = "Assert" | "Assume" | "Cover";
export type ClockEdge = "Posedge" | "Negedge";
export type AssertionStatus = "Passing" | "Violated" | "InFlight" | "Vacuous" | "Inactive";

export interface AssertionDef {
  id: string;
  name: string;
  kind: AssertionKind;
  clock: string;
  edge: ClockEdge;
  source_text: string;
  line?: number;
  col?: number;
}

export interface AssertionStats {
  attempts: number;
  matches: number;
  passes: number;
  failures: number;
  vacuous: number;
  in_flight: number;
}

export interface AssertionViolation {
  assertion_id: string;
  assertion_name: string;
  source_text: string;
  line?: number;
  fail_time: number | { ps: number };
  start_time?: number | { ps: number };
  fail_cycle: number;
  start_cycle: number;
  message: string;
  signals: Record<string, string>;
}

export interface AssertionSummary {
  def: AssertionDef;
  stats: AssertionStats;
  violations: AssertionViolation[];
  status: AssertionStatus;
}

export interface AssertionReport {
  assertions: AssertionSummary[];
  total_assertions: number;
  total_passes: number;
  total_failures: number;
  total_vacuous: number;
  active_in_flight: number;
  overall_pass_rate_pct: number;
  recent_violations: AssertionViolation[];
}

/**
 * Extracts fail time in picoseconds from either numeric or SimTime object.
 */
export function getViolationTimePs(v: AssertionViolation): number {
  if (typeof v.fail_time === "number") {
    return v.fail_time;
  }
  if (v.fail_time && typeof v.fail_time === "object" && "ps" in v.fail_time) {
    return (v.fail_time as { ps: number }).ps;
  }
  return 0;
}

/**
 * Status visual badge configuration for radar rendering.
 */
export function getAssertionStatusBadge(status: AssertionStatus): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case "Passing":
      return { label: "PASS", color: "#3fb950", bg: "rgba(46, 160, 67, 0.15)", border: "rgba(46, 160, 67, 0.4)" };
    case "Violated":
      return { label: "FAIL", color: "#f85149", bg: "rgba(248, 81, 73, 0.15)", border: "rgba(248, 81, 73, 0.4)" };
    case "InFlight":
      return { label: "ACTIVE", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)", border: "rgba(88, 166, 255, 0.4)" };
    case "Vacuous":
      return { label: "VACUOUS", color: "#d29922", bg: "rgba(210, 153, 34, 0.15)", border: "rgba(210, 153, 34, 0.4)" };
    case "Inactive":
    default:
      return { label: "IDLE", color: "#8b949e", bg: "rgba(139, 148, 158, 0.15)", border: "rgba(139, 148, 158, 0.3)" };
  }
}
