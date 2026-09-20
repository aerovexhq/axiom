// Axiom Standalone Web Worker Simulation Kernel
// Runs 100% off the main UI thread with autonomous background clocking and SharedArrayBuffer synchronization.

import initWasm, { WasmEngine } from "../../wasm/axiom_wasm.js";
import * as wasmModule from "../../wasm/axiom_wasm.js";
import {
  WorkerRequest,
  WorkerMessage,
  WorkerEventBatchMessage
} from "./simWorkerProtocol";
import { SharedSimBufferWriter } from "./simSharedBuffer";

interface SignalMeta {
  id: string;
  name: string;
  fullName: string;
  width: number;
  lastVal: string;
}

class SimWorkerKernel {
  private wasmEngine: WasmEngine | null = null;
  private sharedWriter: SharedSimBufferWriter | null = null;

  private compiled = false;
  private topModule = "";
  private currentSimTimePs = 0;
  private currentDeltaCycle = 0;
  private isRunning = false;
  private glitchCount = 0;
  private totalEventsExecuted = 0;

  private signals: Map<string, SignalMeta> = new Map();
  private forcedSignals: Map<string, string> = new Map();

  private playIntervalId: any = null;
  private lastPostTimestamp = 0;

  // Cached telemetry for continuous playback
  private latestTelemetry = {
    powerMw: 0.12,
    currentMa: 0.1,
    voltageSagV: 0.0,
    railVoltageV: 1.2,
    eventCount: 0
  };

  public async init(wasmUrl: string) {
    try {
      await initWasm(wasmUrl);
      this.wasmEngine = new WasmEngine();
      this.postLog("WebAssembly simulation kernel initialized in dedicated Web Worker.", "info");
      return true;
    } catch (e: any) {
      this.postLog(`Failed to initialize WASM in Web Worker: ${e?.message ?? e}`, "error");
      throw e;
    }
  }

  public attachSharedBuffer(buffer: SharedArrayBuffer) {
    this.sharedWriter = new SharedSimBufferWriter(buffer);
    this.syncSharedBuffer();
    this.postLog("SharedArrayBuffer attached to Simulation Web Worker. Zero-copy sync active.", "info");
  }

  public compile(source: string, topModule: string) {
    if (!this.wasmEngine) {
      throw new Error("WASM engine not initialized in worker");
    }

    this.pause();
    this.topModule = topModule;
    this.currentSimTimePs = 0;
    this.currentDeltaCycle = 0;
    this.glitchCount = 0;
    this.totalEventsExecuted = 0;
    this.signals.clear();
    this.forcedSignals.clear();

    const result = this.wasmEngine.compile(source, topModule) as {
      success: boolean;
      top_module: string;
      nets: Array<{ id: number; name: string; width: number }>;
      error?: string;
    };

    if (result && result.success) {
      this.compiled = true;
      if (result.nets) {
        for (const net of result.nets) {
          this.signals.set(net.name, {
            id: net.name,
            name: net.name,
            fullName: net.name,
            width: net.width,
            lastVal: net.width > 1 ? "0x0" : "0"
          });
        }
      }
      this.syncSharedBuffer();
      return result;
    } else {
      this.compiled = false;
      throw new Error(result?.error ?? "Compilation failed in worker");
    }
  }

  public stepTime(dtPs: number) {
    if (!this.wasmEngine || !this.compiled) {
      throw new Error("Cannot step time: circuit is not compiled");
    }

    this.applyAutomaticClockAndReset();

    const response = this.wasmEngine.step_time(dtPs) as any;
    if (!response) {
      throw new Error("No response from step_time");
    }

    this.processStepResponse(response);
    return response;
  }

  public stepDelta() {
    if (!this.wasmEngine || !this.compiled) {
      throw new Error("Cannot step delta: circuit is not compiled");
    }

    const response = this.wasmEngine.step_delta() as any;
    if (!response) {
      throw new Error("No response from step_delta");
    }

    this.processStepResponse(response);
    return response;
  }

  public stepBackDelta() {
    if (!this.wasmEngine || !this.compiled) {
      throw new Error("Cannot step back delta: circuit is not compiled");
    }

    const response = (this.wasmEngine as any).step_back_delta?.() as any;
    if (!response) {
      throw new Error("No response from step_back_delta");
    }

    this.processStepResponse(response);
    return response;
  }

  public stepBackTime(dtPs: number) {
    if (!this.wasmEngine || !this.compiled) {
      throw new Error("Cannot step back time: circuit is not compiled");
    }

    const response = (this.wasmEngine as any).step_back_time?.(dtPs) as any;
    if (!response) {
      throw new Error("No response from step_back_time");
    }

    this.processStepResponse(response);
    return response;
  }

  public scrubToTime(targetTimePs: number) {
    if (!this.wasmEngine || !this.compiled) {
      throw new Error("Cannot scrub to time: circuit is not compiled");
    }

    const response = (this.wasmEngine as any).scrub_to_time?.(targetTimePs) as any;
    if (!response) {
      throw new Error("No response from scrub_to_time");
    }

    this.processStepResponse(response);
    return response;
  }

  public decodeProtocol(requestJson: string) {
    if (typeof (wasmModule as any)?.wasm_decode_protocol === "function") {
      return (wasmModule as any).wasm_decode_protocol(requestJson);
    }
    if (this.wasmEngine && typeof (this.wasmEngine as any).decode_protocol === "function") {
      return (this.wasmEngine as any).decode_protocol(requestJson);
    }
    throw new Error("WASM protocol decoder not available in worker");
  }

  public startPlay(intervalMs = 30, stepPs = 1000) {
    if (this.isRunning) return;
    if (!this.compiled) {
      throw new Error("Cannot play: circuit is not compiled");
    }

    this.isRunning = true;
    this.syncSharedBuffer();
    this.postLog("Worker autonomous simulation running...", "info");

    this.playIntervalId = setInterval(() => {
      if (!this.isRunning || !this.wasmEngine) return;

      try {
        this.applyAutomaticClockAndReset();
        const res = this.wasmEngine.step_time(stepPs) as any;
        if (res) {
          this.processStepResponse(res);

          const now = performance.now();
          // Throttle event batch broadcasts to ~60 FPS (16ms)
          if (now - this.lastPostTimestamp >= 16) {
            this.broadcastBatch(res);
            this.lastPostTimestamp = now;
          }
        }
      } catch (err: any) {
        this.pause();
        this.postLog(`[Worker Runtime Error]: ${err?.message ?? err}`, "error");
      }
    }, intervalMs);
  }

  public pause() {
    if (this.playIntervalId !== null) {
      clearInterval(this.playIntervalId);
      this.playIntervalId = null;
    }
    this.isRunning = false;
    this.syncSharedBuffer();
    this.postLog(`Simulation paused at t=${this.currentSimTimePs}ps (delta ${this.currentDeltaCycle})`, "info");
  }

  public reset(topModule: string) {
    this.pause();
    this.topModule = topModule;
    this.currentSimTimePs = 0;
    this.currentDeltaCycle = 0;
    this.glitchCount = 0;
    this.totalEventsExecuted = 0;
    this.forcedSignals.clear();

    for (const [key, meta] of this.signals.entries()) {
      meta.lastVal = meta.width > 1 ? "0x0" : "0";
      this.signals.set(key, meta);
    }

    this.syncSharedBuffer();
    this.postLog("Worker simulation rewound to t=0ps", "info");
  }

  public forceSignal(netName: string, valueStr: string) {
    if (!this.wasmEngine) return;
    this.forcedSignals.set(netName, valueStr);
    this.wasmEngine.force_signal(netName, valueStr);

    const sig = this.signals.get(netName);
    if (sig) {
      sig.lastVal = valueStr;
      this.signals.set(netName, sig);
    }
  }

  public releaseForce(netName: string) {
    this.forcedSignals.delete(netName);
  }

  public exportVcd(): string {
    if (!this.wasmEngine) return "";
    return this.wasmEngine.export_vcd();
  }

  public exportSaif(): string {
    if (!this.wasmEngine) return "";
    return this.wasmEngine.export_saif();
  }

  public lint(source: string) {
    if (!this.wasmEngine) return [];
    return this.wasmEngine.lint(source);
  }

  public lintXdc(source: string) {
    if (!this.wasmEngine) return [];
    if (typeof (this.wasmEngine as any).lint_xdc === "function") {
      return (this.wasmEngine as any).lint_xdc(source);
    }
    return [];
  }

  public hover(source: string, line: number, col: number) {
    if (!this.wasmEngine) return null;
    return this.wasmEngine.hover(source, line, col);
  }

  public complete(source: string, line: number, col: number) {
    if (!this.wasmEngine) return [];
    return this.wasmEngine.complete(source, line, col);
  }

  // --- Helpers ---

  private applyAutomaticClockAndReset() {
    if (!this.wasmEngine) return;

    // Auto-toggle clock signal
    const clkName = this.findSignalName(["clk", "sys_clk"]);
    if (clkName && !this.forcedSignals.has(clkName)) {
      const sig = this.signals.get(clkName);
      const cur = sig?.lastVal ?? "0";
      const next = cur === "1" ? "0" : "1";
      try {
        this.wasmEngine.force_signal(clkName, next);
        if (sig) sig.lastVal = next;
      } catch {}
    }

    // Auto-deassert active-low reset after 2,000 ps (2 ns)
    if (this.currentSimTimePs >= 2000) {
      const rstName = this.findSignalName(["rst_n", "sys_rst_n"]);
      if (rstName && !this.forcedSignals.has(rstName)) {
        const sig = this.signals.get(rstName);
        if (sig && sig.lastVal === "0") {
          try {
            this.wasmEngine.force_signal(rstName, "1");
            sig.lastVal = "1";
          } catch {}
        }
      }
    }
  }

  private findSignalName(candidates: string[]): string | undefined {
    for (const [key] of this.signals) {
      const lower = key.toLowerCase();
      const parts = lower.split(".");
      const short = parts[parts.length - 1];
      if (candidates.includes(short) || candidates.includes(lower)) {
        return key;
      }
    }
    return undefined;
  }

  private processStepResponse(response: any) {
    const timePs = typeof response.time_ps === "number" ? response.time_ps : this.currentSimTimePs;
    const delta = typeof response.delta === "number" ? response.delta : this.currentDeltaCycle;

    this.currentSimTimePs = timePs;
    this.currentDeltaCycle = delta;

    if (response.tick_summary?.events_evaluated) {
      this.totalEventsExecuted += response.tick_summary.events_evaluated;
    }
    if (response.delta_summary?.events_evaluated) {
      this.totalEventsExecuted += response.delta_summary.events_evaluated;
    }

    if (Array.isArray(response.signal_values)) {
      for (const item of response.signal_values) {
        const netName = Array.isArray(item) ? item[0] : item.name;
        const val = Array.isArray(item) ? item[1] : item.value;
        const sig = this.signals.get(netName);
        if (sig) {
          sig.lastVal = val;
        }
      }
    }

    if (response.telemetry) {
      const t = response.telemetry;
      const powerMw = t.instantaneous_power_mw ?? 0;
      const railV = t.rail_voltages_v?.VDD ?? 1.2;
      const sagV = Math.max(0, 1.2 - railV);
      const currentMa = t.rail_currents_ma?.VDD ?? (powerMw > 0 ? powerMw / 1.2 : 0.1);

      this.latestTelemetry = {
        powerMw: parseFloat(powerMw.toFixed(3)),
        currentMa: parseFloat(currentMa.toFixed(2)),
        voltageSagV: parseFloat(sagV.toFixed(4)),
        railVoltageV: parseFloat(railV.toFixed(3)),
        eventCount: this.totalEventsExecuted
      };
    }

    if (response.delta_summary?.glitches_detected) {
      this.glitchCount += response.delta_summary.glitches_detected.length;
    }

    this.syncSharedBuffer();
  }

  public getTopModule(): string {
    return this.topModule;
  }

  public getCoverage(): any {
    if (!this.wasmEngine) throw new Error("WASM engine not initialized");
    return (this.wasmEngine as any).get_coverage();
  }

  public resetCoverage(): void {
    if (!this.wasmEngine) throw new Error("WASM engine not initialized");
    (this.wasmEngine as any).reset_coverage();
  }

  public exportLcov(sourcePath: string): string {
    if (!this.wasmEngine) throw new Error("WASM engine not initialized");
    return (this.wasmEngine as any).export_lcov(sourcePath);
  }

  public exportHtmlReport(sourceName: string, sourceCode: string): string {
    if (!this.wasmEngine) throw new Error("WASM engine not initialized");
    return (this.wasmEngine as any).export_html_report(sourceName, sourceCode);
  }

  private broadcastBatch(response: any) {
    const batch: WorkerEventBatchMessage = {
      type: "EVENT_BATCH",
      timePs: this.currentSimTimePs,
      delta: this.currentDeltaCycle,
      isRunning: this.isRunning,
      signalValues: response.signal_values ?? [],
      telemetry: {
        timePs: this.currentSimTimePs,
        delta: this.currentDeltaCycle,
        ...this.latestTelemetry
      },
      eventsExecuted: this.totalEventsExecuted,
      glitchCount: this.glitchCount,
      peakCurrentMa: this.latestTelemetry.currentMa,
      maxSagMv: this.latestTelemetry.voltageSagV * 1000
    };

    self.postMessage(batch);
  }

  private syncSharedBuffer() {
    if (!this.sharedWriter) return;

    this.sharedWriter.updateSnapshot({
      timePs: this.currentSimTimePs,
      delta: this.currentDeltaCycle,
      isRunning: this.isRunning,
      glitchCount: this.glitchCount,
      eventsExecuted: this.totalEventsExecuted,
      powerMw: this.latestTelemetry.powerMw,
      currentMa: this.latestTelemetry.currentMa,
      voltageSagV: this.latestTelemetry.voltageSagV,
      railVoltageV: this.latestTelemetry.railVoltageV
    });
  }

  private postLog(message: string, level: "info" | "warn" | "error" | "event" = "info") {
    self.postMessage({
      type: "LOG",
      message,
      level
    } as WorkerMessage);
  }
}

// Instantiate kernel in Web Worker
const kernel = new SimWorkerKernel();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || typeof req.id !== "number") return;

  try {
    switch (req.type) {
      case "INIT": {
        await kernel.init(req.wasmUrl);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "ATTACH_SHARED_BUFFER": {
        kernel.attachSharedBuffer(req.buffer);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "COMPILE": {
        const result = kernel.compile(req.source, req.topModule);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "STEP_TIME": {
        const result = kernel.stepTime(req.dtPs);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "STEP_DELTA": {
        const result = kernel.stepDelta();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "STEP_BACK_DELTA": {
        const result = kernel.stepBackDelta();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "STEP_BACK_TIME": {
        const result = kernel.stepBackTime(req.dtPs);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "SCRUB_TO_TIME": {
        const result = kernel.scrubToTime(req.targetTimePs);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "DECODE_PROTOCOL": {
        const result = kernel.decodeProtocol(req.requestJson);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "START_PLAY": {
        kernel.startPlay(req.intervalMs, req.stepPs);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "PAUSE": {
        kernel.pause();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "RESET": {
        kernel.reset(req.topModule);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "FORCE_SIGNAL": {
        kernel.forceSignal(req.netName, req.valueStr);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "RELEASE_FORCE": {
        kernel.releaseForce(req.netName);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "EXPORT_VCD": {
        const data = kernel.exportVcd();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data });
        break;
      }

      case "EXPORT_SAIF": {
        const data = kernel.exportSaif();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data });
        break;
      }

      case "LINT": {
        const diags = kernel.lint(req.source);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: diags });
        break;
      }

      case "LINT_XDC": {
        const diags = kernel.lintXdc(req.source);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: diags });
        break;
      }

      case "HOVER": {
        const result = kernel.hover(req.source, req.line, req.col);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "COMPLETE": {
        const result = kernel.complete(req.source, req.line, req.col);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "RUN_STA": {
        let result: any = null;
        if (typeof (kernel as any).run_sta === "function") {
          result = (kernel as any).run_sta(req.verilogSource, req.xdcSource, req.topModule);
        }
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "RECOMMEND_PIPELINE": {
        let result: any = null;
        if (typeof (kernel as any).recommend_pipeline === "function") {
          result = (kernel as any).recommend_pipeline(req.verilogSource, req.xdcSource, req.topModule);
        } else if (typeof (wasmModule as any).wasm_recommend_pipeline === "function") {
          result = (wasmModule as any).wasm_recommend_pipeline(req.verilogSource, req.xdcSource, req.topModule);
        }
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "APPLY_PIPELINE": {
        let result: any = null;
        if (typeof (kernel as any).apply_pipeline === "function") {
          result = (kernel as any).apply_pipeline(
            req.verilogSource,
            req.topModule,
            req.cutNet,
            req.clockName,
            req.resetName
          );
        } else if (typeof (wasmModule as any).wasm_apply_pipeline === "function") {
          result = (wasmModule as any).wasm_apply_pipeline(
            req.verilogSource,
            req.topModule,
            req.cutNet,
            req.clockName,
            req.resetName
          );
        }
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "SYNTHESIZE_MICROARCH": {
        let result: any = null;
        if (typeof (kernel as any).wasm_synthesize_microarch === "function") {
          result = (kernel as any).wasm_synthesize_microarch(req.source, req.topModule);
        }
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "PARTITION_MULTIDIE": {
        let result: any = null;
        if (typeof (kernel as any).wasm_partition_multidie === "function") {
          const constraintsJson = req.constraints ? JSON.stringify(req.constraints) : null;
          result = (kernel as any).wasm_partition_multidie(
            req.source,
            req.topModule,
            req.device,
            constraintsJson,
            req.enableLaguna,
            req.tdmRatio
          );
        }
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "EVALUATE_PPA": {
        let result: any = null;
        if (typeof (wasmModule as any).wasm_evaluate_ppa === "function") {
          result = (wasmModule as any).wasm_evaluate_ppa(
            req.verilogSource,
            req.xdcSource ?? "",
            req.topModule ?? null,
            req.targetDevice ?? null,
            req.targetClockFreqMhz ?? null,
            req.junctionTempC ?? null,
            req.coreVoltageV ?? null,
            req.pdk ?? null
          );
        }
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data: result });
        break;
      }

      case "GET_COVERAGE": {
        const data = kernel.getCoverage();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data });
        break;
      }

      case "RESET_COVERAGE": {
        kernel.resetCoverage();
        self.postMessage({ type: "RESPONSE", id: req.id, success: true });
        break;
      }

      case "EXPORT_LCOV": {
        const data = kernel.exportLcov(req.sourcePath);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data });
        break;
      }

      case "EXPORT_HTML_REPORT": {
        const data = kernel.exportHtmlReport(req.sourceName, req.sourceCode);
        self.postMessage({ type: "RESPONSE", id: req.id, success: true, data });
        break;
      }

      case "PING": {
        self.postMessage({ type: "PONG", id: req.id, timestamp: Date.now() });
        break;
      }

      default:
        self.postMessage({
          type: "RESPONSE",
          id: (req as any).id,
          success: false,
          error: `Unhandled worker request type: ${(req as any).type}`
        });
        break;
    }
  } catch (err: any) {
    self.postMessage({
      type: "RESPONSE",
      id: req.id,
      success: false,
      error: err?.message ?? String(err)
    });
  }
};
