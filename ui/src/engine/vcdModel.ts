import { SignalDef } from "./engineBridge";

export interface VcdSample {
  timePs: number;
  value: string;
}

export interface VcdSignal {
  id: string;
  name: string;
  fullName: string;
  scope: string;
  width: number;
  varType: string;
  samples: VcdSample[];
}

export interface ParsedVcd {
  date?: string;
  version?: string;
  timescaleStr?: string;
  timescalePs: number;
  signals: VcdSignal[];
  endTimePs: number;
}

export interface WaveformMismatch {
  signalId: string;
  signalName: string;
  startTimePs: number;
  endTimePs: number;
  axiomValue: string;
  goldenValue: string;
}

export interface SignalDiffStats {
  signalName: string;
  matchPercentage: number;
  mismatches: WaveformMismatch[];
}

export interface GoldenDiffReport {
  overallMatchPercentage: number;
  totalMismatches: number;
  comparedSignals: number;
  signalMismatches: Map<string, WaveformMismatch[]>; // Keyed by signal id or name
  allMismatches: WaveformMismatch[];
  goldenVcd: ParsedVcd;
}

/**
 * Parse a VCD timescale string (e.g. "1ns", "10 ps", "100fs") into picoseconds.
 */
export function parseTimescale(raw: string): { timescalePs: number; display: string } {
  const cleaned = raw.trim();
  let numStr = "";
  let unitStr = "";

  for (const ch of cleaned) {
    if (ch >= "0" && ch <= "9") {
      if (!unitStr) numStr += ch;
    } else if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
      unitStr += ch;
    }
  }

  const num = parseInt(numStr, 10) || 1;
  const unit = unitStr.toLowerCase();

  let psPerUnit = 1000; // default 1ns
  switch (unit) {
    case "s":
      psPerUnit = 1_000_000_000_000;
      break;
    case "ms":
      psPerUnit = 1_000_000_000;
      break;
    case "us":
      psPerUnit = 1_000_000;
      break;
    case "ns":
      psPerUnit = 1000;
      break;
    case "ps":
      psPerUnit = 1;
      break;
    case "fs":
      psPerUnit = 1;
      break;
    default:
      psPerUnit = 1000;
  }

  const timescalePs = Math.max(1, num * psPerUnit);
  return { timescalePs, display: `${num}${unit || "ns"}` };
}

/**
 * High-performance streaming VCD text parser.
 */
export function parseVcdText(content: string): ParsedVcd {
  let date: string | undefined;
  let version: string | undefined;
  let timescaleStr: string | undefined;
  let timescalePs = 1000; // Default 1ns = 1000ps
  const scopeStack: string[] = [];
  const idToIndex = new Map<string, number>();
  const signals: VcdSignal[] = [];

  let currentTimeUnits = 0;
  let maxTimePs = 0;

  const lines = content.split(/\r?\n/);
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx].trim();
    idx++;

    if (!line) continue;

    // 1. Header Directives
    if (line.startsWith("$date")) {
      const dParts: string[] = [];
      while (idx < lines.length && !lines[idx].includes("$end")) {
        dParts.push(lines[idx].trim());
        idx++;
      }
      if (idx < lines.length) idx++;
      date = dParts.join(" ");
      continue;
    }

    if (line.startsWith("$version")) {
      const vParts: string[] = [];
      while (idx < lines.length && !lines[idx].includes("$end")) {
        vParts.push(lines[idx].trim());
        idx++;
      }
      if (idx < lines.length) idx++;
      version = vParts.join(" ");
      continue;
    }

    if (line.startsWith("$timescale")) {
      let tsRaw = "";
      if (line.includes("$end")) {
        tsRaw = line.replace("$timescale", "").replace("$end", "").trim();
      } else {
        const parts: string[] = [];
        while (idx < lines.length && !lines[idx].includes("$end")) {
          parts.push(lines[idx].trim());
          idx++;
        }
        if (idx < lines.length) idx++;
        tsRaw = parts.join(" ");
      }
      const parsedTs = parseTimescale(tsRaw);
      timescalePs = parsedTs.timescalePs;
      timescaleStr = parsedTs.display;
      continue;
    }

    // 2. Hierarchy Scope
    if (line.startsWith("$scope")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        scopeStack.push(parts[2]);
      }
      continue;
    }

    if (line.startsWith("$upscope")) {
      scopeStack.pop();
      continue;
    }

    // 3. Variable Declaration: e.g. "$var wire 1 ! clk $end"
    if (line.startsWith("$var")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const varType = parts[1];
        const width = parseInt(parts[2], 10) || 1;
        const id = parts[3];
        const name = parts[4];

        const scope = scopeStack.length === 0 ? "top" : scopeStack.join(".");
        const fullName = `${scope}.${name}`;
        const sigIdx = signals.length;

        signals.push({
          id,
          name,
          fullName,
          scope,
          width,
          varType,
          samples: []
        });

        idToIndex.set(id, sigIdx);
      }
      continue;
    }

    if (line.startsWith("$enddefinitions")) {
      continue;
    }

    // 4. Timestamp Advance: e.g. "#1000"
    if (line.startsWith("#")) {
      const rest = line.substring(1).trim();
      const t = parseInt(rest, 10);
      if (!isNaN(t)) {
        currentTimeUnits = t;
        const ps = currentTimeUnits * timescalePs;
        if (ps > maxTimePs) {
          maxTimePs = ps;
        }
      }
      continue;
    }

    // 5. Value Changes
    const firstChar = line[0];
    if (
      (firstChar === "0" ||
        firstChar === "1" ||
        firstChar === "x" ||
        firstChar === "X" ||
        firstChar === "z" ||
        firstChar === "Z") &&
      line.length > 1 &&
      !line.startsWith("$dump")
    ) {
      // Scalar value change
      const valChar = firstChar.toLowerCase();
      const ident = line.substring(1).trim();
      const sigIdx = idToIndex.get(ident);
      if (sigIdx !== undefined) {
        const timePs = currentTimeUnits * timescalePs;
        signals[sigIdx].samples.push({
          timePs,
          value: valChar
        });
      }
      continue;
    }

    if ((firstChar === "b" || firstChar === "B") && line.length > 1) {
      // Vector value change: "b101001 !"
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const bits = parts[0].substring(1).trim();
        const ident = parts[1].trim();
        const sigIdx = idToIndex.get(ident);
        if (sigIdx !== undefined) {
          const timePs = currentTimeUnits * timescalePs;
          signals[sigIdx].samples.push({
            timePs,
            value: bits
          });
        }
      }
      continue;
    }
  }

  return {
    date,
    version,
    timescaleStr,
    timescalePs,
    signals,
    endTimePs: maxTimePs
  };
}

/**
 * Normalizes a value for comparison (stripping 8'h..., leading zeros).
 */
export function normalizeLogicValue(val: string, width: number): string {
  if (!val) return "x";
  let lower = val.toLowerCase().trim();

  if (lower.includes("'h")) {
    const hex = lower.split("'h")[1];
    const dec = parseInt(hex, 16);
    if (!isNaN(dec)) {
      lower = dec.toString(2);
    }
  } else if (lower.includes("'b")) {
    lower = lower.split("'b")[1];
  } else if (lower.includes("'d")) {
    const dec = parseInt(lower.split("'d")[1], 10);
    if (!isNaN(dec)) {
      lower = dec.toString(2);
    }
  }

  if (width === 1) {
    if (lower === "1" || lower.endsWith("1")) return "1";
    if (lower === "0" || lower.endsWith("0")) return "0";
    if (lower === "z") return "z";
    return "x";
  }

  // Vector: strip leading zeros, fallback to 0
  const unpadded = lower.replace(/^0+/, "");
  return unpadded === "" ? "0" : unpadded;
}

/**
 * Compares active simulation signals against an imported golden VCD.
 */
export function computeWaveformDiff(
  simSignals: SignalDef[],
  goldenVcd: ParsedVcd,
  signalMap?: Map<string, string> // maps simSignalId -> goldenSignalId
): GoldenDiffReport {
  const mismatches: WaveformMismatch[] = [];
  const signalMismatches = new Map<string, WaveformMismatch[]>();

  let totalDurationPs = 0;
  let totalMismatchDurationPs = 0;
  let comparedCount = 0;

  // Build index of golden signals by id, name, and fullName
  const goldenById = new Map<string, VcdSignal>();
  const goldenByName = new Map<string, VcdSignal>();
  for (const g of goldenVcd.signals) {
    goldenById.set(g.id, g);
    goldenByName.set(g.name, g);
    goldenByName.set(g.fullName, g);
  }

  for (const sim of simSignals) {
    // 1. Find matching golden signal
    let golden: VcdSignal | undefined;
    if (signalMap && signalMap.has(sim.id)) {
      const gId = signalMap.get(sim.id)!;
      golden = goldenById.get(gId) || goldenByName.get(gId);
    } else {
      golden = goldenByName.get(sim.fullName) || goldenByName.get(sim.name);
    }

    if (!golden) continue;
    comparedCount++;

    if (sim.samples.length === 0 && golden.samples.length === 0) continue;

    // Collect all timestamps
    const timeSet = new Set<number>();
    for (const s of sim.samples) timeSet.add(s.timePs);
    for (const s of golden.samples) timeSet.add(s.timePs);

    const timestamps = Array.from(timeSet).sort((a, b) => a - b);
    if (timestamps.length === 0) continue;

    const maxT = timestamps[timestamps.length - 1];
    totalDurationPs = Math.max(totalDurationPs, maxT);

    const sigMismatches: WaveformMismatch[] = [];
    let activeMismatch: { startT: number; sVal: string; gVal: string } | null = null;

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      const nextT = i + 1 < timestamps.length ? timestamps[i + 1] : t + 1000;

      // Find sim value at time t (last sample <= t)
      let sVal = "x";
      for (let j = sim.samples.length - 1; j >= 0; j--) {
        if (sim.samples[j].timePs <= t) {
          sVal = sim.samples[j].value;
          break;
        }
      }

      // Find golden value at time t
      let gVal = "x";
      for (let j = golden.samples.length - 1; j >= 0; j--) {
        if (golden.samples[j].timePs <= t) {
          gVal = golden.samples[j].value;
          break;
        }
      }

      const normSim = normalizeLogicValue(sVal, sim.width);
      const normGold = normalizeLogicValue(gVal, golden.width);

      const isDiff = normSim !== normGold;

      if (isDiff) {
        const dt = nextT - t;
        totalMismatchDurationPs += dt;

        if (activeMismatch) {
          if (activeMismatch.sVal !== normSim || activeMismatch.gVal !== normGold) {
            // Close old mismatch and start new
            const mm: WaveformMismatch = {
              signalId: sim.id,
              signalName: sim.name,
              startTimePs: activeMismatch.startT,
              endTimePs: t,
              axiomValue: activeMismatch.sVal,
              goldenValue: activeMismatch.gVal
            };
            mismatches.push(mm);
            sigMismatches.push(mm);
            activeMismatch = { startT: t, sVal: normSim, gVal: normGold };
          }
        } else {
          activeMismatch = { startT: t, sVal: normSim, gVal: normGold };
        }
      } else if (activeMismatch) {
        const mm: WaveformMismatch = {
          signalId: sim.id,
          signalName: sim.name,
          startTimePs: activeMismatch.startT,
          endTimePs: t,
          axiomValue: activeMismatch.sVal,
          goldenValue: activeMismatch.gVal
        };
        mismatches.push(mm);
        sigMismatches.push(mm);
        activeMismatch = null;
      }
    }

    if (activeMismatch) {
      const mm: WaveformMismatch = {
        signalId: sim.id,
        signalName: sim.name,
        startTimePs: activeMismatch.startT,
        endTimePs: maxT,
        axiomValue: activeMismatch.sVal,
        goldenValue: activeMismatch.gVal
      };
      mismatches.push(mm);
      sigMismatches.push(mm);
    }

    if (sigMismatches.length > 0) {
      signalMismatches.set(sim.id, sigMismatches);
      signalMismatches.set(sim.name, sigMismatches);
    }
  }

  const matchRatio =
    totalDurationPs === 0 || comparedCount === 0
      ? 1
      : Math.max(0, (totalDurationPs - totalMismatchDurationPs) / totalDurationPs);

  const overallMatchPercentage = Math.round(matchRatio * 1000) / 10;

  return {
    overallMatchPercentage,
    totalMismatches: mismatches.length,
    comparedSignals: comparedCount,
    signalMismatches,
    allMismatches: mismatches,
    goldenVcd
  };
}

/**
 * Generates an authentic sample golden VCD from the active simulation traces,
 * optionally injecting a small fault for interactive comparison testing.
 */
export function generateSampleGoldenVcd(
  topModule: string,
  simSignals: SignalDef[],
  injectFault = false
): string {
  let vcd = `$date\n   ${new Date().toISOString()}\n$end\n`;
  vcd += `$version\n   Vivado Simulator (xsim) / Axiom Golden Model 2026.1\n$end\n`;
  vcd += `$timescale\n   1ps\n$end\n`;
  vcd += `$scope module ${topModule || "top"} $end\n`;

  for (let i = 0; i < simSignals.length; i++) {
    const s = simSignals[i];
    vcd += `$var wire ${s.width} g${i} ${s.name} $end\n`;
  }
  vcd += `$upscope $end\n$enddefinitions $end\n`;

  // Collect all timestamps
  const timeSet = new Set<number>();
  timeSet.add(0);
  for (const s of simSignals) {
    for (const sample of s.samples) {
      timeSet.add(sample.timePs);
    }
  }
  const timestamps = Array.from(timeSet).sort((a, b) => a - b);

  vcd += `#0\n$dumpvars\n`;
  for (let i = 0; i < simSignals.length; i++) {
    const s = simSignals[i];
    const initial = s.samples[0]?.value ?? (s.width > 1 ? "00000000" : "0");
    const cleanVal = normalizeLogicValue(initial, s.width);
    if (s.width === 1) {
      vcd += `${cleanVal}g${i}\n`;
    } else {
      vcd += `b${cleanVal} g${i}\n`;
    }
  }
  vcd += `$end\n`;

  // Dump changes
  for (let tIdx = 1; tIdx < timestamps.length; tIdx++) {
    const t = timestamps[tIdx];
    vcd += `#${t}\n`;

    for (let i = 0; i < simSignals.length; i++) {
      const s = simSignals[i];
      const matchSample = s.samples.find((sample) => sample.timePs === t);
      if (matchSample) {
        let val = normalizeLogicValue(matchSample.value, s.width);

        // Inject fault at ~50% timestamp on the first output signal for demonstration
        if (injectFault && tIdx === Math.floor(timestamps.length / 2) && i === simSignals.length - 1) {
          val = val === "1" ? "0" : "1";
        }

        if (s.width === 1) {
          vcd += `${val}g${i}\n`;
        } else {
          vcd += `b${val} g${i}\n`;
        }
      }
    }
  }

  return vcd;
}
