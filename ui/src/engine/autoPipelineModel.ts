// Axiom EDA — Silicon Copilot: Real-Time Timing Slack Auto-Pipeliner & Logic Cone Slicing Model

import { TimingPath } from "./timingModel";

export interface PipelineCutCandidate {
  net_name: string;
  driver_cell: string;
  stage1_delay_ps: number;
  stage2_delay_ps: number;
  predicted_stage1_slack_ps: number;
  predicted_stage2_slack_ps: number;
  predicted_wns_ps: number;
  predicted_fmax_mhz: number;
  slack_gain_ps: number;
  fmax_gain_mhz: number;
  is_optimal: boolean;
}

export interface AutoPipelineRecommendation {
  path_id: string;
  startpoint: string;
  endpoint: string;
  clock_name: string;
  reset_name?: string | null;
  target_clock_period_ps: number;
  current_wns_ps: number;
  current_fmax_mhz: number;
  optimal_cut?: PipelineCutCandidate | null;
  candidates: PipelineCutCandidate[];
  refactored_code?: string | null;
  diff_preview?: string | null;
}

export interface PipelineRefactorResult {
  refactored_code: string;
  diff_preview: string;
}

/**
 * Extracts candidate cut net from a PathSegment label.
 */
function extractNetNameFromSegment(segName: string): string {
  const trimmed = segName.trim();
  if (trimmed.startsWith("Net (") && trimmed.endsWith(")")) {
    return trimmed.slice(5, -1).trim();
  }
  if (trimmed.startsWith("Cell (") && trimmed.endsWith(")")) {
    return trimmed.slice(6, -1).trim();
  }
  return trimmed;
}

/**
 * Client-side analytical auto-pipeline evaluator.
 * Works seamlessly with TimingPath from STA or TypeScript timing model.
 */
export function evaluateAutoPipelineFromPath(
  path: TimingPath,
  clockPeriodNs: number,
  sourceCode?: string
): AutoPipelineRecommendation {
  const periodPs = clockPeriodNs > 0 ? Math.round(clockPeriodNs * 1000) : 10000;
  const currentWns = path.slackPs;
  const critDelay = Math.max(periodPs - currentWns, 100);
  const currentFmaxMhz = Math.round((1_000_000 / critDelay) * 10) / 10;

  const totalDataDelay = Math.max(path.dataDelayPs, path.logicDelayPs + path.netDelayPs, 500);

  const tSetup = 45; // ps
  const tCo = 200;    // ps
  const tSkew = 100;  // ps

  const rawCandidates: Array<{ netName: string; driverCell: string; stage1Delay: number }> = [];

  let lastCell = path.startPoint || "launch_reg";
  if (path.segments && path.segments.length > 0) {
    for (const seg of path.segments) {
      if (seg.type === "logic_cell" || seg.type === "clock_to_out") {
        lastCell = seg.instanceName || seg.name;
      } else if (seg.type === "interconnect") {
        const netName = extractNetNameFromSegment(seg.name);
        if (netName && netName !== "clk" && !netName.includes("rst")) {
          rawCandidates.push({
            netName,
            driverCell: lastCell,
            stage1Delay: seg.cumulativeDelayPs || seg.delayPs
          });
        }
      }
    }
  }

  // If path segments didn't have explicit intermediate nets, synthesize logic stage candidates
  if (rawCandidates.length === 0) {
    const levels = Math.max(path.logicLevels || 3, 2);
    const step = totalDataDelay / levels;
    for (let i = 1; i < levels; i++) {
      rawCandidates.push({
        netName: `w_stage${i}`,
        driverCell: `cell_op${i}`,
        stage1Delay: Math.round(step * i)
      });
    }
  }

  let bestSlack = -Infinity;
  let bestIdx = -1;

  const candidates: PipelineCutCandidate[] = rawCandidates.map((c, idx) => {
    const stage2Delay = Math.max(totalDataDelay - c.stage1Delay, 0);

    // Stage 1: Launch FF -> Pipeline Register
    const arrStage1 = tSkew + c.stage1Delay;
    const reqStage1 = periodPs - tSetup;
    const stage1Slack = reqStage1 - arrStage1;

    // Stage 2: Pipeline Register -> Capture FF
    const arrStage2 = tCo + stage2Delay;
    const reqStage2 = periodPs - tSetup;
    const stage2Slack = reqStage2 - arrStage2;

    const predictedWns = Math.min(stage1Slack, stage2Slack);
    const maxStageDelay = Math.max(arrStage1 + tSetup, arrStage2 + tSetup);
    const predictedFmax = Math.round((1_000_000 / maxStageDelay) * 10) / 10;

    const slackGain = Math.round(predictedWns - currentWns);
    const fmaxGain = Math.round((predictedFmax - currentFmaxMhz) * 10) / 10;

    if (predictedWns > bestSlack) {
      bestSlack = predictedWns;
      bestIdx = idx;
    }

    return {
      net_name: c.netName,
      driver_cell: c.driverCell,
      stage1_delay_ps: Math.round(c.stage1Delay),
      stage2_delay_ps: Math.round(stage2Delay),
      predicted_stage1_slack_ps: Math.round(stage1Slack),
      predicted_stage2_slack_ps: Math.round(stage2Slack),
      predicted_wns_ps: Math.round(predictedWns),
      predicted_fmax_mhz: predictedFmax,
      slack_gain_ps: slackGain,
      fmax_gain_mhz: fmaxGain,
      is_optimal: false
    };
  });

  if (bestIdx >= 0 && candidates[bestIdx]) {
    candidates[bestIdx].is_optimal = true;
  }

  const optimalCut = bestIdx >= 0 ? candidates[bestIdx] : null;

  let refactoredCode: string | null = null;
  let diffPreview: string | null = null;

  if (optimalCut && sourceCode) {
    const ref = refactorVerilogPipeline(sourceCode, optimalCut.net_name, "clk", "rst_n");
    refactoredCode = ref.refactored_code;
    diffPreview = ref.diff_preview;
  }

  return {
    path_id: path.id,
    startpoint: path.startPoint,
    endpoint: path.endPoint,
    clock_name: path.clockDomain || "clk",
    reset_name: "rst_n",
    target_clock_period_ps: periodPs,
    current_wns_ps: currentWns,
    current_fmax_mhz: currentFmaxMhz,
    optimal_cut: optimalCut,
    candidates,
    refactored_code: refactoredCode,
    diff_preview: diffPreview
  };
}

/**
 * Pure TypeScript driver-shadow pipelining refactoring algorithm.
 */
export function refactorVerilogPipeline(
  source: string,
  cutNet: string,
  clockName = "clk",
  resetName = "rst_n"
): PipelineRefactorResult {
  const lines = source.split("\n");
  const newLines: string[] = [];
  let replaced = false;

  // Detect bit width of cutNet
  let widthStr = "";
  const netRegex = new RegExp(`(?:wire|reg|logic)\\s+(\\[[^\\]]+\\])\\s+[^;]*\\b${cutNet}\\b`);
  const match = source.match(netRegex);
  if (match && match[1]) {
    widthStr = match[1] + " ";
  }

  const isNegReset = resetName.endsWith("_n") || resetName.endsWith("_b");
  const resetSens = isNegReset ? ` or negedge ${resetName}` : ` or posedge ${resetName}`;
  const resetCond = isNegReset ? `!${resetName}` : resetName;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line declares cutNet as a wire
    if (
      (trimmed.startsWith("wire ") || trimmed.startsWith("reg ") || trimmed.startsWith("logic ")) &&
      new RegExp(`\\b${cutNet}\\b[;,]`).test(trimmed) &&
      !trimmed.includes("assign")
    ) {
      newLines.push(`    wire ${widthStr}${cutNet}_stage1;`);
      newLines.push(`    reg ${widthStr}${cutNet};`);
      continue;
    }

    // Check for continuous assign to cutNet
    const assignPattern = new RegExp(`^(\\s*)assign\\s+${cutNet}\\s*=(.*)$`);
    const assignMatch = line.match(assignPattern);

    if (!replaced && assignMatch) {
      const indent = assignMatch[1];
      const rhs = assignMatch[2];
      newLines.push(`${indent}assign ${cutNet}_stage1 =${rhs}`);
      newLines.push("");
      newLines.push(`${indent}// Silicon Copilot: Auto-pipelined register stage for timing closure`);
      newLines.push(`${indent}always @(posedge ${clockName}${resetSens}) begin`);
      newLines.push(`${indent}    if (${resetCond}) begin`);
      newLines.push(`${indent}        ${cutNet} <= '0;`);
      newLines.push(`${indent}    end else begin`);
      newLines.push(`${indent}        ${cutNet} <= ${cutNet}_stage1;`);
      newLines.push(`${indent}    end`);
      newLines.push(`${indent}end`);
      replaced = true;
    } else {
      newLines.push(line);
    }
  }

  if (!replaced) {
    // Append before endmodule
    const fallbackLines: string[] = [];
    let endmoduleFound = false;

    for (const line of newLines) {
      if (line.trim().startsWith("endmodule") && !endmoduleFound) {
        fallbackLines.push(`    // Silicon Copilot: Auto-pipelined register stage for timing closure`);
        fallbackLines.push(`    reg ${widthStr}${cutNet}_pipe_q;`);
        fallbackLines.push(`    always @(posedge ${clockName}${resetSens}) begin`);
        fallbackLines.push(`        if (${resetCond}) begin`);
        fallbackLines.push(`            ${cutNet}_pipe_q <= '0;`);
        fallbackLines.push(`        end else begin`);
        fallbackLines.push(`            ${cutNet}_pipe_q <= ${cutNet};`);
        fallbackLines.push(`        end`);
        fallbackLines.push(`    end\n`);
        fallbackLines.push(line);
        endmoduleFound = true;
      } else {
        fallbackLines.push(line);
      }
    }
    newLines.length = 0;
    newLines.push(...fallbackLines);
  }

  const refactoredCode = newLines.join("\n");
  const diffPreview = generateUnifiedDiff(source, refactoredCode, cutNet);

  return {
    refactored_code: refactoredCode,
    diff_preview: diffPreview
  };
}

function generateUnifiedDiff(original: string, refactored: string, targetNet: string): string {
  const origLines = original.split("\n");
  const refLines = refactored.split("\n");
  const n = origLines.length;
  const m = refLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (origLines[i] === refLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: string[] = [];
  diff.push(`--- original.v (unpipelined, critical net: ${targetNet})`);
  diff.push(`+++ refactored.v (Silicon Copilot auto-pipelined, +1 stage)`);
  diff.push("@@ -timing-closure @@");

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (origLines[i] === refLines[j]) {
      diff.push(` ${origLines[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push(`-${origLines[i]}`);
      i++;
    } else {
      diff.push(`+${refLines[j]}`);
      j++;
    }
  }

  while (i < n) {
    diff.push(`-${origLines[i]}`);
    i++;
  }

  while (j < m) {
    diff.push(`+${refLines[j]}`);
    j++;
  }

  return diff.join("\n");
}
