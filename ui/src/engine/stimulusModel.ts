// Axiom EDA — Visual Testbench Stimulus Generator & Constrained Random Verification Model
// Provides waveform timing evaluation, seed-repeatable PRNG, and IEEE 1364/1800 testbench synthesis.

import type { AxiomProject } from "./projectModel";
import type { SignalDef } from "./engineBridge";
import { engineBridge } from "./engineBridge";

export type StimulusSignalType =
  | "clock"
  | "reset"
  | "pulse_train"
  | "glitch"
  | "constrained_random"
  | "pattern"
  | "custom";

export type PatternKind = "ramp" | "alternating" | "walking" | "prbs";

export interface WaveformSegment {
  startTimePs: number;
  endTimePs: number;
  value: number | string;
  isGlitch?: boolean;
}

export interface ClockConfig {
  freqMhz: number;
  dutyCyclePercent: number; // 1..99
  phaseDelayPs: number;
  jitterPs: number;
}

export interface ResetConfig {
  activeLow: boolean;
  assertDelayPs: number;
  durationPs: number;
}

export interface PulseTrainConfig {
  highDurationPs: number;
  lowDurationPs: number;
  repeatCount: number;
  initialDelayPs: number;
}

export interface GlitchConfig {
  targetTimePs: number;
  glitchWidthPs: number;
  targetLevel: boolean;
}

export interface WeightRange {
  min: number;
  max: number;
  weight: number;
}

export interface ConstrainedRandomConfig {
  seed: number;
  minVal: number;
  maxVal: number;
  weights: WeightRange[];
  illegalValues: number[];
  samplePeriodPs: number;
}

export interface PatternConfig {
  kind: PatternKind;
  stepPeriodPs: number;
}

export interface StimulusTrack {
  id: string;
  name: string;
  direction: "input" | "output" | "inout";
  width: number;
  radix: "hex" | "bin" | "dec";
  type: StimulusSignalType;
  clock?: ClockConfig;
  reset?: ResetConfig;
  pulseTrain?: PulseTrainConfig;
  glitch?: GlitchConfig;
  random?: ConstrainedRandomConfig;
  pattern?: PatternConfig;
  customSegments?: WaveformSegment[];
}

export interface StimulusPlan {
  topModule: string;
  totalDurationPs: number;
  timeScalePs: number;
  tracks: StimulusTrack[];
}

// ----------------------------------------------------------------------------
// Deterministic Seed-Repeatable PRNG (XorShift64*)
// ----------------------------------------------------------------------------
export class PseudoRandomGenerator {
  private state: bigint;

  constructor(seed: number | bigint) {
    const s = BigInt(seed);
    this.state = s === 0n ? 0x853c49e6748fea9bn : s;
  }

  public nextBigInt(): bigint {
    let x = this.state;
    x ^= (x >> 12n) & 0xffffffffffffffffn;
    x ^= (x << 25n) & 0xffffffffffffffffn;
    x ^= (x >> 27n) & 0xffffffffffffffffn;
    this.state = x;
    return (x * 0x2545f4914f6cdd1dn) & 0xffffffffffffffffn;
  }

  public nextRange(min: number, max: number): number {
    if (min >= max) return min;
    const range = BigInt(max - min + 1);
    const raw = this.nextBigInt();
    const offset = Number(raw % range);
    return min + offset;
  }

  public nextConstrained(config: ConstrainedRandomConfig): number {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      let candidate = config.minVal;
      if (config.weights && config.weights.length > 0) {
        const totalWeight = config.weights.reduce((sum, w) => sum + w.weight, 0);
        if (totalWeight > 0) {
          const roll = this.nextRange(0, totalWeight - 1);
          let accum = 0;
          let chosen = config.weights[0];
          for (const w of config.weights) {
            accum += w.weight;
            if (roll < accum) {
              chosen = w;
              break;
            }
          }
          candidate = this.nextRange(chosen.min, chosen.max);
        } else {
          candidate = this.nextRange(config.minVal, config.maxVal);
        }
      } else {
        candidate = this.nextRange(config.minVal, config.maxVal);
      }

      if (!config.illegalValues || !config.illegalValues.includes(candidate)) {
        return candidate;
      }
    }

    // Fallback: search for first non-illegal value
    for (let v = config.minVal; v <= config.maxVal; v++) {
      if (!config.illegalValues || !config.illegalValues.includes(v)) {
        return v;
      }
    }
    return config.minVal;
  }
}

// ----------------------------------------------------------------------------
// Heuristic Signal Typing & Port Discovery
// ----------------------------------------------------------------------------

export function guessSignalRole(name: string, width: number): StimulusSignalType {
  const lower = name.toLowerCase();
  if (lower === "clk" || lower === "clock" || lower.includes("clk_") || lower.endsWith("_clk") || lower === "sys_clk") {
    return "clock";
  }
  if (lower === "rst" || lower === "rst_n" || lower === "reset" || lower === "reset_n" || lower.includes("rst_") || lower.endsWith("_rst")) {
    return "reset";
  }
  if (width > 1) {
    return "constrained_random";
  }
  return "pulse_train";
}

export function extractModulePorts(
  project: AxiomProject | null,
  topModule: string,
  compiledSignals?: SignalDef[]
): StimulusTrack[] {
  const tracks: StimulusTrack[] = [];
  const foundNames = new Set<string>();

  // 1. Try extracting from source code in project.files
  if (project) {
    const sources = project.files.filter((f) => f.fileSet === "sources_1" || f.name.endsWith(".v") || f.name.endsWith(".sv"));
    for (const file of sources) {
      const content = file.content;
      // Regex match module <name> ... ( ... );
      const modRegex = new RegExp(`module\\s+${topModule}\\b[\\s\\S]*?\\((([\\s\\S]*?))\\);`, "m");
      const match = modRegex.exec(content);
      if (match && match[1]) {
        const portStr = match[1];
        // Parse port declarations: e.g. input wire [7:0] a, input clk, output reg [7:0] result
        const portTokens = portStr.split(",").map((s) => s.trim());
        for (const pt of portTokens) {
          const isInput = /\binput\b/.test(pt);
          const isOutput = /\boutput\b/.test(pt);
          const isInout = /\binout\b/.test(pt);
          if (!isInput && !isOutput && !isInout) continue;

          const direction = isInput ? "input" : isOutput ? "output" : "inout";

          // Extract width [msb:lsb]
          let width = 1;
          const rangeMatch = /\[\s*(\d+)\s*:\s*(\d+)\s*\]/.exec(pt);
          if (rangeMatch) {
            const msb = parseInt(rangeMatch[1], 10);
            const lsb = parseInt(rangeMatch[2], 10);
            width = Math.abs(msb - lsb) + 1;
          }

          // Extract signal name (last identifier before any comments)
          const nameMatch = /([a-zA-Z_][a-zA-Z0-9_]*)\s*$/.exec(pt.replace(/\/\/.*$/, "").trim());
          if (nameMatch) {
            const name = nameMatch[1];
            if (!foundNames.has(name)) {
              foundNames.add(name);
              const type = guessSignalRole(name, width);
              tracks.push(createDefaultTrack(name, direction, width, type));
            }
          }
        }
      }
    }
  }

  // 2. If no ports found from AST, fall back to compiled signals from engineBridge
  if (tracks.length === 0 && compiledSignals && compiledSignals.length > 0) {
    for (const sig of compiledSignals) {
      if (!sig.name.startsWith("_") && !sig.name.includes(".") && !foundNames.has(sig.name)) {
        foundNames.add(sig.name);
        const type = guessSignalRole(sig.name, sig.width);
        tracks.push(createDefaultTrack(sig.name, "input", sig.width, type));
      }
    }
  }

  // 3. Fallback default template if nothing compiled or parsed yet
  if (tracks.length === 0) {
    tracks.push(createDefaultTrack("clk", "input", 1, "clock"));
    tracks.push(createDefaultTrack("rst_n", "input", 1, "reset"));
    tracks.push(createDefaultTrack("a", "input", 8, "constrained_random"));
    tracks.push(createDefaultTrack("b", "input", 8, "constrained_random"));
  }

  return tracks;
}

export function createDefaultTrack(
  name: string,
  direction: "input" | "output" | "inout",
  width: number,
  type: StimulusSignalType
): StimulusTrack {
  const maxVal = width >= 32 ? 0xffffffff : (1 << width) - 1;

  const track: StimulusTrack = {
    id: `track_${name}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    direction,
    width,
    radix: width > 1 ? "hex" : "bin",
    type,
    customSegments: []
  };

  switch (type) {
    case "clock":
      track.clock = {
        freqMhz: 100, // 10 ns period
        dutyCyclePercent: 50,
        phaseDelayPs: 0,
        jitterPs: 0
      };
      break;

    case "reset":
      track.reset = {
        activeLow: name.includes("_n") || name.endsWith("n") || name.includes("rst_b"),
        assertDelayPs: 0,
        durationPs: 20000 // 20 ns
      };
      break;

    case "pulse_train":
      track.pulseTrain = {
        highDurationPs: 5000,
        lowDurationPs: 15000,
        repeatCount: 16,
        initialDelayPs: 2000
      };
      break;

    case "glitch":
      track.glitch = {
        targetTimePs: 25000,
        glitchWidthPs: 250,
        targetLevel: true
      };
      break;

    case "constrained_random":
      track.random = {
        seed: 42,
        minVal: 0,
        maxVal,
        weights: [],
        illegalValues: [],
        samplePeriodPs: 10000 // 10 ns
      };
      break;

    case "pattern":
      track.pattern = {
        kind: "ramp",
        stepPeriodPs: 10000
      };
      break;

    case "custom":
      track.customSegments = [
        { startTimePs: 0, endTimePs: 10000, value: 0 },
        { startTimePs: 10000, endTimePs: 20000, value: maxVal }
      ];
      break;
  }

  return track;
}

// ----------------------------------------------------------------------------
// Discrete Waveform Segment Evaluation
// ----------------------------------------------------------------------------

export function evaluateTrackWaveform(track: StimulusTrack, totalDurationPs: number): WaveformSegment[] {
  const segments: WaveformSegment[] = [];

  switch (track.type) {
    case "clock": {
      const clk = track.clock ?? { freqMhz: 100, dutyCyclePercent: 50, phaseDelayPs: 0, jitterPs: 0 };
      const periodPs = clk.freqMhz > 0 ? Math.round(1000000 / clk.freqMhz) : 10000;
      const highPs = Math.max(1, Math.round((periodPs * clk.dutyCyclePercent) / 100));
      const lowPs = Math.max(1, periodPs - highPs);

      let t = clk.phaseDelayPs;
      if (t > 0) {
        segments.push({ startTimePs: 0, endTimePs: Math.min(t, totalDurationPs), value: 0 });
      }

      while (t < totalDurationPs) {
        // High phase
        const highEnd = Math.min(t + highPs, totalDurationPs);
        segments.push({ startTimePs: t, endTimePs: highEnd, value: 1 });
        t = highEnd;
        if (t >= totalDurationPs) break;

        // Low phase
        const lowEnd = Math.min(t + lowPs, totalDurationPs);
        segments.push({ startTimePs: t, endTimePs: lowEnd, value: 0 });
        t = lowEnd;
      }
      break;
    }

    case "reset": {
      const rst = track.reset ?? { activeLow: true, assertDelayPs: 0, durationPs: 20000 };
      const assertedVal = rst.activeLow ? 0 : 1;
      const deassertedVal = rst.activeLow ? 1 : 0;

      if (rst.assertDelayPs > 0) {
        segments.push({
          startTimePs: 0,
          endTimePs: Math.min(rst.assertDelayPs, totalDurationPs),
          value: deassertedVal
        });
      }

      const releaseTime = rst.assertDelayPs + rst.durationPs;
      if (releaseTime > rst.assertDelayPs) {
        segments.push({
          startTimePs: rst.assertDelayPs,
          endTimePs: Math.min(releaseTime, totalDurationPs),
          value: assertedVal
        });
      }

      if (releaseTime < totalDurationPs) {
        segments.push({
          startTimePs: releaseTime,
          endTimePs: totalDurationPs,
          value: deassertedVal
        });
      }
      break;
    }

    case "pulse_train": {
      const pt = track.pulseTrain ?? { highDurationPs: 5000, lowDurationPs: 15000, repeatCount: 16, initialDelayPs: 2000 };
      let t = 0;
      if (pt.initialDelayPs > 0) {
        segments.push({
          startTimePs: 0,
          endTimePs: Math.min(pt.initialDelayPs, totalDurationPs),
          value: 0
        });
        t = pt.initialDelayPs;
      }

      for (let i = 0; i < pt.repeatCount; i++) {
        if (t >= totalDurationPs) break;
        const highEnd = Math.min(t + pt.highDurationPs, totalDurationPs);
        segments.push({ startTimePs: t, endTimePs: highEnd, value: 1 });
        t = highEnd;
        if (t >= totalDurationPs) break;

        const lowEnd = Math.min(t + pt.lowDurationPs, totalDurationPs);
        segments.push({ startTimePs: t, endTimePs: lowEnd, value: 0 });
        t = lowEnd;
      }

      if (t < totalDurationPs) {
        segments.push({ startTimePs: t, endTimePs: totalDurationPs, value: 0 });
      }
      break;
    }

    case "glitch": {
      const g = track.glitch ?? { targetTimePs: 25000, glitchWidthPs: 250, targetLevel: true };
      const baseLevel = g.targetLevel ? 0 : 1;
      const glitchLevel = g.targetLevel ? 1 : 0;

      const tStart = Math.min(g.targetTimePs, totalDurationPs);
      const tEnd = Math.min(g.targetTimePs + g.glitchWidthPs, totalDurationPs);

      if (tStart > 0) {
        segments.push({ startTimePs: 0, endTimePs: tStart, value: baseLevel });
      }
      if (tEnd > tStart) {
        segments.push({ startTimePs: tStart, endTimePs: tEnd, value: glitchLevel, isGlitch: true });
      }
      if (tEnd < totalDurationPs) {
        segments.push({ startTimePs: tEnd, endTimePs: totalDurationPs, value: baseLevel });
      }
      break;
    }

    case "constrained_random": {
      const cfg = track.random ?? {
        seed: 42,
        minVal: 0,
        maxVal: (1 << track.width) - 1,
        weights: [],
        illegalValues: [],
        samplePeriodPs: 10000
      };
      const rng = new PseudoRandomGenerator(cfg.seed);
      let t = 0;
      while (t < totalDurationPs) {
        const val = rng.nextConstrained(cfg);
        const tNext = Math.min(t + cfg.samplePeriodPs, totalDurationPs);
        segments.push({ startTimePs: t, endTimePs: tNext, value: val });
        t = tNext;
      }
      break;
    }

    case "pattern": {
      const pat = track.pattern ?? { kind: "ramp", stepPeriodPs: 10000 };
      const maxVal = (1 << track.width) - 1;
      let t = 0;
      let cycle = 0;

      while (t < totalDurationPs) {
        let val = 0;
        if (pat.kind === "ramp") {
          val = cycle % (maxVal + 1);
        } else if (pat.kind === "alternating") {
          val = cycle % 2 === 0 ? 0xaa & maxVal : 0x55 & maxVal;
        } else if (pat.kind === "walking") {
          val = (1 << (cycle % track.width)) & maxVal;
        } else {
          // PRBS7
          val = (cycle * 37 + 13) % (maxVal + 1);
        }

        const tNext = Math.min(t + pat.stepPeriodPs, totalDurationPs);
        segments.push({ startTimePs: t, endTimePs: tNext, value: val });
        t = tNext;
        cycle++;
      }
      break;
    }

    case "custom": {
      if (track.customSegments && track.customSegments.length > 0) {
        for (const seg of track.customSegments) {
          if (seg.startTimePs < totalDurationPs) {
            segments.push({
              startTimePs: seg.startTimePs,
              endTimePs: Math.min(seg.endTimePs, totalDurationPs),
              value: seg.value
            });
          }
        }
      } else {
        segments.push({ startTimePs: 0, endTimePs: totalDurationPs, value: 0 });
      }
      break;
    }
  }

  // Ensure there are no unhandled time gaps
  if (segments.length === 0) {
    segments.push({ startTimePs: 0, endTimePs: totalDurationPs, value: 0 });
  }

  return segments;
}

// ----------------------------------------------------------------------------
// Synthesizable IEEE 1364/1800 Testbench Generator
// ----------------------------------------------------------------------------

export function generateVerilogTestbench(plan: StimulusPlan): string {
  const tbName = `tb_${plan.topModule}`;
  const inputTracks = plan.tracks.filter((t) => t.direction === "input");
  const outputTracks = plan.tracks.filter((t) => t.direction === "output");

  let code = "";
  code += "// ============================================================================\n";
  code += "// Axiom EDA — Synthesizable Testbench Harness\n";
  code += `// Target DUT: ${plan.topModule}\n`;
  code += `// Total Simulation Time: ${Math.round(plan.totalDurationPs / 1000)} ns\n`;
  code += `// Generated: ${new Date().toISOString()}\n`;
  code += "// ============================================================================\n\n";
  code += "`timescale 1ns / 1ps\n\n";
  code += `module ${tbName};\n\n`;

  code += "  // --------------------------------------------------------------------------\n";
  code += "  // 1. DUT Signals & Nets\n";
  code += "  // --------------------------------------------------------------------------\n";

  for (const t of inputTracks) {
    const widthStr = t.width > 1 ? `[${t.width - 1}:0] ` : "";
    code += `  reg  ${widthStr ? widthStr.padEnd(8) : "        "} ${t.name};\n`;
  }
  for (const t of outputTracks) {
    const widthStr = t.width > 1 ? `[${t.width - 1}:0] ` : "";
    code += `  wire ${widthStr ? widthStr.padEnd(8) : "        "} ${t.name};\n`;
  }
  code += "\n";

  // Clock generation
  const clockTrack = plan.tracks.find((t) => t.type === "clock");
  if (clockTrack) {
    const clk = clockTrack.clock ?? { freqMhz: 100, dutyCyclePercent: 50, phaseDelayPs: 0, jitterPs: 0 };
    const periodNs = Math.max(2, Math.round(1000 / clk.freqMhz));
    const halfPeriodNs = Math.max(1, Math.round(periodNs / 2));

    code += "  // --------------------------------------------------------------------------\n";
    code += `  // 2. Free-Running Clock (${clk.freqMhz} MHz)\n`;
    code += "  // --------------------------------------------------------------------------\n";
    code += `  initial ${clockTrack.name} = 0;\n`;
    code += `  always #${halfPeriodNs} ${clockTrack.name} = ~${clockTrack.name};\n\n`;
  }

  // DUT instantiation
  code += "  // --------------------------------------------------------------------------\n";
  code += "  // 3. Device Under Test (DUT) Instantiation\n";
  code += "  // --------------------------------------------------------------------------\n";
  code += `  ${plan.topModule} u_dut (\n`;
  const allTracks = [...inputTracks, ...outputTracks];
  allTracks.forEach((t, i) => {
    const comma = i + 1 < allTracks.length ? "," : "";
    code += `    .${t.name}(${t.name})${comma}\n`;
  });
  code += "  );\n\n";

  // Stimulus process
  code += "  // --------------------------------------------------------------------------\n";
  code += "  // 4. Stimulus Sequence & Waveform Dumping\n";
  code += "  // --------------------------------------------------------------------------\n";
  code += "  initial begin\n";
  code += `    $dumpfile("${tbName}.vcd");\n`;
  code += `    $dumpvars(0, ${tbName});\n\n`;

  // Initial drive
  code += "    // Initialize inputs\n";
  for (const t of inputTracks) {
    if (t.type !== "clock") {
      code += `    ${t.name} = 0;\n`;
    }
  }
  code += "\n";

  // Reset pulse
  const resetTrack = plan.tracks.find((t) => t.type === "reset");
  if (resetTrack) {
    const rst = resetTrack.reset ?? { activeLow: true, assertDelayPs: 0, durationPs: 20000 };
    const asserted = rst.activeLow ? 0 : 1;
    const deasserted = rst.activeLow ? 1 : 0;
    const durNs = Math.max(1, Math.round(rst.durationPs / 1000));

    code += "    // Assert reset\n";
    code += `    ${resetTrack.name} = ${asserted};\n`;
    code += `    #${durNs};\n`;
    code += `    ${resetTrack.name} = ${deasserted};\n`;
    code += "    #10;\n\n";
  }

  // Constrained random stimulus loops
  const randomTracks = plan.tracks.filter((t) => t.type === "constrained_random");
  if (randomTracks.length > 0) {
    code += "    // Constrained Random Vectors\n";
    code += "    repeat (32) begin\n";
    for (const rt of randomTracks) {
      const cfg = rt.random ?? { minVal: 0, maxVal: (1 << rt.width) - 1 };
      code += `      ${rt.name} = $urandom_range(${cfg.maxVal}, ${cfg.minVal});\n`;
    }
    code += "      #10;\n";
    code += "    end\n\n";
  }

  // Pattern tracks
  const patternTracks = plan.tracks.filter((t) => t.type === "pattern");
  if (patternTracks.length > 0) {
    code += "    // Deterministic Pattern Sequence\n";
    code += "    repeat (16) begin\n";
    for (const pt of patternTracks) {
      code += `      ${pt.name} = ${pt.name} + 1;\n`;
    }
    code += "      #10;\n";
    code += "    end\n\n";
  }

  const endNs = Math.max(50, Math.round(plan.totalDurationPs / 1000));
  code += `    #${endNs};\n`;
  code += '    $display("=================================================");\n';
  code += `    $display("Axiom Simulation: ${tbName} executed successfully.");\n`;
  code += '    $display("=================================================");\n';
  code += "    $finish;\n";
  code += "  end\n\n";
  code += "endmodule\n";

  return code;
}

// ----------------------------------------------------------------------------
// In-RAM Live Simulation Stimulus Applicator
// ----------------------------------------------------------------------------

export function applyStimulusToSimulation(plan: StimulusPlan, bridge: typeof engineBridge): void {
  const inputTracks = plan.tracks.filter((t) => t.direction === "input");
  if (inputTracks.length === 0) return;

  // Step in 1000 ps (1 ns) increments
  const stepPs = 1000;
  const totalSteps = Math.min(100, Math.round(plan.totalDurationPs / stepPs));

  // Pre-calculate waveforms for each track
  const trackWaves = inputTracks.map((t) => ({
    track: t,
    segments: evaluateTrackWaveform(t, plan.totalDurationPs)
  }));

  for (let s = 0; s < totalSteps; s++) {
    const currentT = s * stepPs;

    for (const tw of trackWaves) {
      // Find active segment at currentT
      const activeSeg = tw.segments.find(
        (seg) => currentT >= seg.startTimePs && currentT < seg.endTimePs
      );
      if (activeSeg) {
        let strVal = "0";
        if (typeof activeSeg.value === "number") {
          if (tw.track.width === 1) {
            strVal = activeSeg.value ? "1" : "0";
          } else if (tw.track.radix === "bin") {
            strVal = activeSeg.value.toString(2);
          } else {
            strVal = "0x" + activeSeg.value.toString(16);
          }
        } else {
          strVal = String(activeSeg.value);
        }
        bridge.injectStimulus(tw.track.name, strVal);
      }
    }

    bridge.tick(stepPs);
  }
}
