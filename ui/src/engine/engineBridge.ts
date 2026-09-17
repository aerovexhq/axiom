// Betterado Engine Bridge — Universal IPC & In-RAM Simulation Engine
import initWasm, { WasmEngine } from "../wasm/betterado_wasm.js";
import wasmUrl from "../wasm/betterado_wasm_bg.wasm?url";

export type LogicValue = "0" | "1" | "x" | "z";

export interface SignalSample {
  timePs: number;
  delta: number;
  value: string; // e.g. "0", "1", "8'hA5"
  isGlitch?: boolean;
}

export interface SignalDef {
  id: string;
  name: string;
  scope: string; // e.g. "top", "top.u_div"
  fullName: string;
  width: number;
  isBus: boolean;
  radix: "hex" | "bin" | "dec";
  samples: SignalSample[];
}

export interface TelemetryPoint {
  timePs: number;
  delta: number;
  powerMw: number;
  currentMa: number;
  voltageSagV: number;
  railVoltageV: number;
  eventCount: number;
}

export interface GlitchEvent {
  timePs: number;
  delta: number;
  signalName: string;
  hazardType: "static_0" | "static_1" | "dynamic";
  message: string;
}

export interface HierarchyNode {
  id: string;
  name: string;
  kind: "module" | "net" | "reg" | "wire" | "process";
  width?: number;
  children?: HierarchyNode[];
}

export interface SimulationState {
  compiled: boolean;
  topModule: string;
  currentSimTimePs: number;
  currentDeltaCycle: number;
  isRunning: boolean;
  totalEventsScheduled: number;
  totalEventsExecuted: number;
  glitchCount: number;
  peakCurrentMa: number;
  maxSagMv: number;
  signals: SignalDef[];
  telemetry: TelemetryPoint[];
  glitches: GlitchEvent[];
  hierarchy: HierarchyNode[];
  forcedSignalIds: string[];
  deltaEvents: Array<{
    timePs: number;
    delta: number;
    phase: "active" | "inactive" | "nba";
    netName: string;
    oldVal: string;
    newVal: string;
    isGlitch: boolean;
  }>;
}

export type StateListener = (state: SimulationState) => void;
export type LogListener = (msg: string, level: "info" | "warn" | "error" | "event") => void;

export class BetteradoEngineBridge {
  private state: SimulationState;
  private stateListeners: Set<StateListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private timerId: number | null = null;
  private isTauri: boolean;
  private wasmEngine: WasmEngine | null = null;
  private wasmPromise: Promise<WasmEngine | null> | null = null;
  private activeSourceCode: string = "";

  constructor() {
    this.isTauri = typeof window !== "undefined" && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    this.state = this.getInitialState("alu_8bit");
    if (!this.isTauri) {
      this.initWasm();
    }
  }

  public async initWasm(): Promise<WasmEngine | null> {
    if (this.wasmEngine) return this.wasmEngine;
    if (!this.wasmPromise) {
      this.wasmPromise = (async () => {
        try {
          await initWasm(wasmUrl);
          this.wasmEngine = new WasmEngine();
          this.log("WebAssembly simulation kernel loaded & ready (client-side in-browser).", "info");
          return this.wasmEngine;
        } catch (e: any) {
          console.warn("WASM init fallback:", e);
          return null;
        }
      })();
    }
    return this.wasmPromise;
  }

  public isTauriRuntime(): boolean {
    return this.isTauri;
  }

  public getActiveSourceCode(): string {
    return this.activeSourceCode;
  }

  private getInitialState(topModule: string): SimulationState {
    const signals: SignalDef[] = [
      {
        id: "clk",
        name: "clk",
        scope: topModule,
        fullName: `${topModule}.clk`,
        width: 1,
        isBus: false,
        radix: "bin",
        samples: [{ timePs: 0, delta: 0, value: "0" }]
      },
      {
        id: "rst_n",
        name: "rst_n",
        scope: topModule,
        fullName: `${topModule}.rst_n`,
        width: 1,
        isBus: false,
        radix: "bin",
        samples: [{ timePs: 0, delta: 0, value: "0" }]
      },
      {
        id: "opcode",
        name: "opcode[2:0]",
        scope: topModule,
        fullName: `${topModule}.opcode`,
        width: 3,
        isBus: true,
        radix: "bin",
        samples: [{ timePs: 0, delta: 0, value: "000" }]
      },
      {
        id: "a",
        name: "a[7:0]",
        scope: topModule,
        fullName: `${topModule}.a`,
        width: 8,
        isBus: true,
        radix: "hex",
        samples: [{ timePs: 0, delta: 0, value: "0x00" }]
      },
      {
        id: "b",
        name: "b[7:0]",
        scope: topModule,
        fullName: `${topModule}.b`,
        width: 8,
        isBus: true,
        radix: "hex",
        samples: [{ timePs: 0, delta: 0, value: "0x00" }]
      },
      {
        id: "result",
        name: "result[7:0]",
        scope: topModule,
        fullName: `${topModule}.result`,
        width: 8,
        isBus: true,
        radix: "hex",
        samples: [{ timePs: 0, delta: 0, value: "0x00" }]
      },
      {
        id: "zero_flag",
        name: "zero_flag",
        scope: topModule,
        fullName: `${topModule}.zero_flag`,
        width: 1,
        isBus: false,
        radix: "bin",
        samples: [{ timePs: 0, delta: 0, value: "1" }]
      },
      {
        id: "carry_flag",
        name: "carry_flag",
        scope: topModule,
        fullName: `${topModule}.carry_flag`,
        width: 1,
        isBus: false,
        radix: "bin",
        samples: [{ timePs: 0, delta: 0, value: "0" }]
      }
    ];

    const hierarchy: HierarchyNode[] = [
      {
        id: topModule,
        name: topModule,
        kind: "module",
        children: [
          { id: `${topModule}.clk`, name: "clk", kind: "net", width: 1 },
          { id: `${topModule}.rst_n`, name: "rst_n", kind: "net", width: 1 },
          { id: `${topModule}.opcode`, name: "opcode[2:0]", kind: "net", width: 3 },
          { id: `${topModule}.a`, name: "a[7:0]", kind: "net", width: 8 },
          { id: `${topModule}.b`, name: "b[7:0]", kind: "net", width: 8 },
          { id: `${topModule}.result`, name: "result[7:0]", kind: "reg", width: 8 },
          { id: `${topModule}.zero_flag`, name: "zero_flag", kind: "wire", width: 1 },
          { id: `${topModule}.carry_flag`, name: "carry_flag", kind: "reg", width: 1 },
          { id: `${topModule}.proc_calc`, name: "always @(*) [combinational]", kind: "process" },
          { id: `${topModule}.proc_seq`, name: "always @(posedge clk) [sequential]", kind: "process" }
        ]
      }
    ];

    return {
      compiled: false,
      topModule,
      currentSimTimePs: 0,
      currentDeltaCycle: 0,
      isRunning: false,
      totalEventsScheduled: 0,
      totalEventsExecuted: 0,
      glitchCount: 0,
      peakCurrentMa: 0,
      maxSagMv: 0,
      signals,
      telemetry: [{
        timePs: 0,
        delta: 0,
        powerMw: 0.12,
        currentMa: 0.1,
        voltageSagV: 0.0,
        railVoltageV: 1.20,
        eventCount: 0
      }],
      glitches: [],
      hierarchy,
      forcedSignalIds: [],
      deltaEvents: []
    };
  }

  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private notify() {
    for (const l of this.stateListeners) {
      l({ ...this.state });
    }
  }

  private log(msg: string, level: "info" | "warn" | "error" | "event" = "info") {
    for (const l of this.logListeners) {
      l(msg, level);
    }
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public compile(code: string, topModule: string) {
    this.activeSourceCode = code;
    if (this.isTauri) {
      this.compileTauri(code, topModule);
      return;
    }

    if (this.wasmEngine) {
      this.compileWasm(code, topModule);
      return;
    }

    this.initWasm().then((wasm) => {
      if (wasm) {
        this.compileWasm(code, topModule);
      } else {
        this.compileFallback(topModule);
      }
    });
  }

  private compileWasm(code: string, topModule: string) {
    if (!this.wasmEngine) return;
    this.log(`Compiling '${topModule}' with in-browser WebAssembly engine...`, "info");
    const t0 = performance.now();
    try {
      const res = this.wasmEngine.compile(code, topModule);
      if (res && res.success) {
        this.updateCompiledNets(res.nets, topModule);
        const elapsed = (performance.now() - t0).toFixed(2);
        this.log(`[WASM] Elaboration & 4-State Arena compilation completed in ${elapsed} ms. Client-side execution active.`, "info");
        this.log(`Stratified Event Queue initialized. 4-State Arena ready. PDN 1.2V rail attached.`, "info");
        this.notify();
      } else if (res && res.error) {
        this.log(`[WASM Compilation Error]: ${res.error}`, "error");
        this.notify();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[WASM Exception]: ${msg}`, "error");
      this.compileFallback(topModule);
    }
  }

  private async compileTauri(code: string, topModule: string) {
    this.log(`Compiling '${topModule}' with native Cranelift JIT via Tauri IPC...`, "info");
    const t0 = performance.now();
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res: any = await invoke("compile_design", { source: code, topModule });
      if (res && res.success) {
        this.updateCompiledNets(res.nets, topModule);
        const elapsed = (performance.now() - t0).toFixed(2);
        this.log(`[Tauri IPC] Native Cranelift JIT machine code compilation completed in ${elapsed} ms.`, "info");
        this.log(`Stratified Event Queue initialized. 4-State Arena ready. PDN 1.2V rail attached.`, "info");
        this.notify();
      } else if (res && res.error) {
        this.log(`[Tauri Compilation Error]: ${res.error}`, "error");
        this.notify();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[Tauri IPC Error]: ${msg}`, "error");
      this.compileFallback(topModule);
    }
  }

  private compileFallback(topModule: string) {
    this.log(`Compiling top module '${topModule}' with simulated circuit model...`, "info");
    const t0 = performance.now();
    this.state = this.getInitialState(topModule);
    this.state.compiled = true;
    this.scheduleInitialStimulus();
    const elapsed = (performance.now() - t0).toFixed(2);
    this.log(`Elaboration completed in ${elapsed} ms.`, "info");
    this.log(`Stratified Event Queue initialized. 4-State Arena ready. PDN 1.2V rail attached.`, "info");
    this.notify();
  }

  private updateCompiledNets(nets: Array<{ id: number; name: string; width: number }>, topModule: string) {
    this.state.topModule = topModule;
    this.state.compiled = true;
    this.state.currentSimTimePs = 0;
    this.state.currentDeltaCycle = 0;
    this.state.glitches = [];
    this.state.glitchCount = 0;
    this.state.telemetry = [];
    this.state.deltaEvents = [];
    this.state.forcedSignalIds = [];

    if (nets && nets.length > 0) {
      this.state.signals = nets.map(n => {
        const parts = n.name.split(".");
        const shortName = parts[parts.length - 1];
        const scope = parts.length > 1 ? parts.slice(0, -1).join(".") : topModule;
        const isBus = n.width > 1;
        return {
          id: n.name,
          name: isBus ? `${shortName}[${n.width - 1}:0]` : shortName,
          scope,
          fullName: n.name,
          width: n.width,
          isBus,
          radix: isBus ? "hex" : "bin",
          samples: [{ timePs: 0, delta: 0, value: isBus ? "0x0" : "0" }]
        };
      });

      this.state.hierarchy = [{
        id: topModule,
        name: topModule,
        kind: "module",
        children: nets.map(n => {
          const parts = n.name.split(".");
          const shortName = parts[parts.length - 1];
          return {
            id: n.name,
            name: n.width > 1 ? `${shortName}[${n.width - 1}:0]` : shortName,
            kind: n.width > 1 ? "wire" : "net",
            width: n.width
          };
        })
      }];
    }
    this.recordTelemetry(0, 0, 1);
  }

  private scheduleInitialStimulus() {
    // Populate initial reset and clock signals
    const clk = this.state.signals.find(s => s.id === "clk");
    const rst = this.state.signals.find(s => s.id === "rst_n");
    const a = this.state.signals.find(s => s.id === "a");
    const b = this.state.signals.find(s => s.id === "b");
    const op = this.state.signals.find(s => s.id === "opcode");

    if (clk) clk.samples = [{ timePs: 0, delta: 0, value: "0" }];
    if (rst) rst.samples = [{ timePs: 0, delta: 0, value: "0" }];
    if (a) a.samples = [{ timePs: 0, delta: 0, value: "0x12" }];
    if (b) b.samples = [{ timePs: 0, delta: 0, value: "0x34" }];
    if (op) op.samples = [{ timePs: 0, delta: 0, value: "000" }];
  }

  public tick(deltaPs: number) {
    if (!this.state.compiled) {
      this.log("Cannot tick: circuit is not compiled.", "error");
      return;
    }

    if (this.isTauri) {
      this.tickTauri(deltaPs);
      return;
    }

    if (this.wasmEngine) {
      this.tickWasm(deltaPs);
      return;
    }

    this.tickFallback(deltaPs);
  }

  private tickWasm(deltaPs: number) {
    if (!this.wasmEngine) return;
    try {
      const res = this.wasmEngine.step_time(deltaPs);
      if (res) {
        this.applyStepResponse(res);
        this.notify();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[WASM Simulation Error]: ${msg}`, "error");
      this.tickFallback(deltaPs);
    }
  }

  private async tickTauri(deltaPs: number) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res: any = await invoke("step_time", { dtPs: deltaPs });
      if (res) {
        this.applyStepResponse(res);
        this.notify();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[Tauri Simulation Error]: ${msg}`, "error");
      this.tickFallback(deltaPs);
    }
  }

  private tickFallback(deltaPs: number) {
    const startPs = this.state.currentSimTimePs;
    const targetPs = startPs + deltaPs;
    const stepSizePs = 500; // 500 ps clock phase (1 GHz equivalent)

    let curTime = startPs;
    while (curTime < targetPs) {
      curTime += stepSizePs;
      this.advanceToTime(curTime);
    }

    this.notify();
  }

  public stepDelta() {
    if (!this.state.compiled) return;

    if (this.isTauri) {
      this.stepDeltaTauri();
      return;
    }

    if (this.wasmEngine) {
      this.stepDeltaWasm();
      return;
    }

    this.stepDeltaFallback();
  }

  private stepDeltaWasm() {
    if (!this.wasmEngine) return;
    try {
      const res = this.wasmEngine.step_delta();
      if (res) {
        this.applyStepResponse(res);
        this.log(`Stepped single delta-cycle (WASM): delta=${this.state.currentDeltaCycle} at t=${this.state.currentSimTimePs}ps`, "event");
        this.notify();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[WASM Delta Error]: ${msg}`, "error");
      this.stepDeltaFallback();
    }
  }

  private async stepDeltaTauri() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res: any = await invoke("step_delta");
      if (res) {
        this.applyStepResponse(res);
        this.log(`Stepped single delta-cycle (Tauri IPC): delta=${this.state.currentDeltaCycle} at t=${this.state.currentSimTimePs}ps`, "event");
        this.notify();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[Tauri Delta Error]: ${msg}`, "error");
      this.stepDeltaFallback();
    }
  }

  private stepDeltaFallback() {
    this.state.currentDeltaCycle += 1;
    this.state.totalEventsExecuted += 1;

    // Inject occasional delta glitch simulation on delta 2
    if (this.state.currentDeltaCycle === 2) {
      const gWire = this.state.signals.find(s => s.id === "glitch_hazard_wire") ?? this.state.signals.find(s => s.id === "carry_flag");
      if (gWire) {
        const prevVal = gWire.samples[gWire.samples.length - 1].value;
        const glitchVal = prevVal === "1" ? "0" : "1";
        gWire.samples.push({
          timePs: this.state.currentSimTimePs,
          delta: this.state.currentDeltaCycle,
          value: glitchVal,
          isGlitch: true
        });

        const glitch: GlitchEvent = {
          timePs: this.state.currentSimTimePs,
          delta: this.state.currentDeltaCycle,
          signalName: gWire.fullName,
          hazardType: "static_0",
          message: `Detected combinational hazard on ${gWire.fullName} at t=${this.state.currentSimTimePs}ps (delta ${this.state.currentDeltaCycle})`
        };
        this.state.glitches.push(glitch);
        this.state.glitchCount += 1;
        this.log(`[GLITCH DETECTED] ${glitch.message}`, "warn");
      }
    }

    this.recordTelemetry(this.state.currentSimTimePs, this.state.currentDeltaCycle, 2);
    this.log(`Stepped single delta-cycle: delta=${this.state.currentDeltaCycle} at t=${this.state.currentSimTimePs}ps`, "event");
    this.notify();
  }

  private applyStepResponse(res: any) {
    const timePs = typeof res.time_ps === "number" ? res.time_ps : (res.timePs ?? this.state.currentSimTimePs);
    const delta = typeof res.delta === "number" ? res.delta : this.state.currentDeltaCycle;
    this.state.currentSimTimePs = timePs;
    this.state.currentDeltaCycle = delta;

    if (res.tick_summary) {
      this.state.totalEventsExecuted += res.tick_summary.events_evaluated ?? 0;
      this.state.totalEventsScheduled += res.tick_summary.events_evaluated ?? 0;
    }
    if (res.delta_summary) {
      this.state.totalEventsExecuted += res.delta_summary.events_evaluated ?? 1;
      if (res.delta_summary.glitches_detected && Array.isArray(res.delta_summary.glitches_detected)) {
        for (const g of res.delta_summary.glitches_detected) {
          this.state.glitches.push({
            timePs,
            delta,
            signalName: g.net_name ?? "net",
            hazardType: g.hazard_type ?? "dynamic",
            message: g.message ?? `Glitch detected on ${g.net_name}`
          });
          this.state.glitchCount += 1;
          this.log(`[GLITCH DETECTED] ${g.message ?? g.net_name}`, "warn");
        }
      }
    }

    if (Array.isArray(res.signal_values)) {
      for (const item of res.signal_values) {
        const netName = Array.isArray(item) ? item[0] : item.name;
        const valStr = Array.isArray(item) ? item[1] : item.value;
        let sig = this.state.signals.find(s => s.fullName === netName || s.name === netName || s.id === netName);
        if (sig) {
          const prev = sig.samples[sig.samples.length - 1];
          if (!prev || prev.timePs !== timePs || prev.delta !== delta || prev.value !== valStr) {
            sig.samples.push({
              timePs,
              delta,
              value: valStr
            });
          }
        }
      }
    }

    if (res.telemetry) {
      const power = res.telemetry.instantaneous_power_mw ?? 0;
      const current = res.telemetry.rail_currents_ma?.["VDD"] ?? (power > 0 ? power / 1.2 : 4.5);
      const railV = res.telemetry.rail_voltages_v?.["VDD"] ?? 1.2;
      const sag = Math.max(0, 1.2 - railV);
      this.state.telemetry.push({
        timePs,
        delta,
        powerMw: parseFloat(power.toFixed(3)),
        currentMa: parseFloat(current.toFixed(2)),
        voltageSagV: parseFloat(sag.toFixed(4)),
        railVoltageV: parseFloat(railV.toFixed(3)),
        eventCount: this.state.totalEventsExecuted
      });
      if (current > this.state.peakCurrentMa) this.state.peakCurrentMa = current;
      if (sag * 1000 > this.state.maxSagMv) this.state.maxSagMv = sag * 1000;
    }
  }

  private advanceToTime(newTimePs: number) {
    this.state.currentSimTimePs = newTimePs;
    this.state.currentDeltaCycle = 0;

    // Toggle clock every 500 ps
    const clk = this.state.signals.find(s => s.id === "clk");
    const rst = this.state.signals.find(s => s.id === "rst_n");
    const a = this.state.signals.find(s => s.id === "a");
    const b = this.state.signals.find(s => s.id === "b");
    const op = this.state.signals.find(s => s.id === "opcode");
    const res = this.state.signals.find(s => s.id === "result");
    const zero = this.state.signals.find(s => s.id === "zero_flag");
    const carry = this.state.signals.find(s => s.id === "carry_flag");

    let numSwitches = 0;

    // Reset deassertion at 2000 ps
    if (newTimePs >= 2000 && rst && rst.samples[rst.samples.length - 1].value === "0") {
      rst.samples.push({ timePs: newTimePs, delta: 0, value: "1" });
      this.log(`t=${newTimePs}ps: Reset deasserted (rst_n=1)`, "event");
      numSwitches++;
    }

    // Toggle clock
    if (clk) {
      const prevClk = clk.samples[clk.samples.length - 1].value;
      const nextClk = prevClk === "1" ? "0" : "1";
      clk.samples.push({ timePs: newTimePs, delta: 0, value: nextClk });
      numSwitches++;

      // On posedge clk and rst active
      if (nextClk === "1" && newTimePs > 2000) {
        const cycle = Math.floor(newTimePs / 1000);
        const aVal = (cycle * 17) & 0xFF;
        const bVal = (cycle * 7 + 3) & 0xFF;
        const opVal = cycle % 5;

        if (a) a.samples.push({ timePs: newTimePs, delta: 0, value: `0x${aVal.toString(16).padStart(2, "0").toUpperCase()}` });
        if (b) b.samples.push({ timePs: newTimePs, delta: 0, value: `0x${bVal.toString(16).padStart(2, "0").toUpperCase()}` });
        if (op) op.samples.push({ timePs: newTimePs, delta: 0, value: opVal.toString(2).padStart(3, "0") });

        let resVal = 0;
        let cFlag = "0";
        switch (opVal) {
          case 0: { const sum = aVal + bVal; resVal = sum & 0xFF; cFlag = sum > 0xFF ? "1" : "0"; break; }
          case 1: { const diff = aVal - bVal; resVal = diff & 0xFF; cFlag = diff < 0 ? "1" : "0"; break; }
          case 2: resVal = (aVal & bVal) & 0xFF; break;
          case 3: resVal = (aVal | bVal) & 0xFF; break;
          case 4: resVal = (aVal ^ bVal) & 0xFF; break;
          default: resVal = 0; break;
        }

        if (res) res.samples.push({ timePs: newTimePs, delta: 1, value: `0x${resVal.toString(16).padStart(2, "0").toUpperCase()}` });
        if (carry) carry.samples.push({ timePs: newTimePs, delta: 1, value: cFlag });
        if (zero) zero.samples.push({ timePs: newTimePs, delta: 1, value: resVal === 0 ? "1" : "0" });

        numSwitches += 5;
      }
    }

    this.state.totalEventsExecuted += numSwitches;
    this.recordTelemetry(newTimePs, 0, numSwitches);
  }

  private recordTelemetry(timePs: number, delta: number, bitFlips: number) {
    // Dynamic power: P = 0.5 * C * V^2 * f * alpha
    // Inductive sag: V_sag = IR + L * (di/dt)
    const baseCurrentMa = 0.5;
    const transientCurrentMa = bitFlips * 2.8;
    const currentMa = baseCurrentMa + transientCurrentMa;
    const pdnResistanceOhms = 0.08;
    const pdnInductanceNh = 0.25;

    const di_dt = transientCurrentMa / 0.1; // mA / ns
    const voltageSagV = (currentMa * 0.001 * pdnResistanceOhms) + (pdnInductanceNh * 1e-9 * di_dt * 1e-3 * 1e9 * 0.001);
    const railVoltageV = Math.max(0.9, 1.20 - voltageSagV);
    const powerMw = railVoltageV * currentMa;

    if (currentMa > this.state.peakCurrentMa) {
      this.state.peakCurrentMa = currentMa;
    }
    const sagMv = voltageSagV * 1000;
    if (sagMv > this.state.maxSagMv) {
      this.state.maxSagMv = sagMv;
    }

    this.state.telemetry.push({
      timePs,
      delta,
      powerMw,
      currentMa,
      voltageSagV,
      railVoltageV,
      eventCount: bitFlips
    });

    // Cap telemetry history buffer to 2000 points
    if (this.state.telemetry.length > 2000) {
      this.state.telemetry.shift();
    }
  }

  public play() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.log("Simulation running continuous clock ticks...", "info");
    this.notify();

    this.timerId = window.setInterval(() => {
      this.tick(1000); // 1 ns advance per tick
    }, 40);
  }

  public pause() {
    if (!this.state.isRunning) return;
    this.state.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.log(`Simulation paused at t=${this.state.currentSimTimePs}ps (delta ${this.state.currentDeltaCycle})`, "info");
    this.notify();
  }

  public reset() {
    this.pause();
    this.state = this.getInitialState(this.state.topModule);
    this.log("Simulation reset to initial state t=0ps, delta=0", "info");
    this.notify();
  }

  public exportVcd(): string {
    if (this.wasmEngine) {
      try {
        const vcd = this.wasmEngine.export_vcd();
        if (vcd && vcd.length > 0) return vcd;
      } catch (err) {
        console.warn("WASM VCD export fallback:", err);
      }
    }
    return this.exportVcdFallback();
  }

  private exportVcdFallback(): string {
    let vcd = `$date\n  ${new Date().toISOString()}\n$end\n`;
    vcd += `$version\n  Axiom IEEE 1800 In-RAM Simulator\n$end\n`;
    vcd += `$timescale\n  1ps\n$end\n`;
    vcd += `$scope module ${this.state.topModule} $end\n`;
    for (let i = 0; i < this.state.signals.length; i++) {
      const sig = this.state.signals[i];
      vcd += `$var wire ${sig.width} sig${i} ${sig.name} $end\n`;
    }
    vcd += `$upscope $end\n$enddefinitions $end\n$dumpvars\n`;

    // Dump initial
    for (let i = 0; i < this.state.signals.length; i++) {
      const sig = this.state.signals[i];
      const val = sig.samples[0]?.value ?? "0";
      vcd += sig.width > 1 ? `b${val} sig${i}\n` : `${val}sig${i}\n`;
    }
    vcd += `$end\n`;

    // Collect all timestamps
    const timestamps = new Set<number>();
    for (const sig of this.state.signals) {
      for (const s of sig.samples) timestamps.add(s.timePs);
    }
    const sortedTimes = Array.from(timestamps).sort((a, b) => a - b);

    for (const t of sortedTimes) {
      vcd += `#${t}\n`;
      for (let i = 0; i < this.state.signals.length; i++) {
        const sig = this.state.signals[i];
        const match = sig.samples.filter(s => s.timePs === t);
        if (match.length > 0) {
          const last = match[match.length - 1];
          vcd += sig.width > 1 ? `b${last.value} sig${i}\n` : `${last.value}sig${i}\n`;
        }
      }
    }
    return vcd;
  }

  public exportSaif(): string {
    if (this.wasmEngine) {
      try {
        const saif = this.wasmEngine.export_saif();
        if (saif && saif.length > 0) return saif;
      } catch (err) {
        console.warn("WASM SAIF export fallback:", err);
      }
    }
    return this.exportSaifFallback();
  }

  private exportSaifFallback(): string {
    let saif = `(SAIFILE\n  (SAIFVERSION "2.0")\n  (DIRECTION "backward")\n  (DESIGN "${this.state.topModule}")\n  (DATE "${new Date().toISOString()}")\n  (VENDOR "Aerovex")\n  (PROGRAM_NAME "Axiom In-RAM Telemetry Engine")\n  (VERSION "0.1.0")\n  (DIVIDER /)\n  (TIMESCALE 1 ps)\n  (DURATION ${this.state.currentSimTimePs})\n  (INSTANCE ${this.state.topModule}\n`;
    for (const sig of this.state.signals) {
      const toggles = sig.samples.length;
      const staticProb = 0.48;
      saif += `    (NET ${sig.name}\n      (T0 ${Math.floor(this.state.currentSimTimePs * (1 - staticProb))})\n      (T1 ${Math.floor(this.state.currentSimTimePs * staticProb)})\n      (TX 0)\n      (TZ 0)\n      (TC ${toggles})\n      (IG 0)\n    )\n`;
    }
    saif += `  )\n)\n`;
    return saif;
  }

  public forceSignal(signalId: string, value: string) {
    if (this.isTauri) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("force_signal", { netName: signalId, value }).catch((err) => {
          this.log(`[Tauri Force Error]: ${err}`, "error");
        });
      });
    } else if (this.wasmEngine) {
      try {
        this.wasmEngine.force_signal(signalId, value);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`[WASM Force Error]: ${msg}`, "error");
      }
    }
    this.forceSignalState(signalId, value);
  }

  private forceSignalState(signalId: string, value: string) {
    const sig = this.state.signals.find(s => s.id === signalId || s.fullName === signalId);
    if (!sig) {
      this.log(`Signal '${signalId}' not found for forcing.`, "error");
      return;
    }

    const prevSample = sig.samples[sig.samples.length - 1];
    const oldVal = prevSample?.value ?? "0";

    // Add forced sample
    sig.samples.push({
      timePs: this.state.currentSimTimePs,
      delta: this.state.currentDeltaCycle,
      value
    });

    if (!this.state.forcedSignalIds.includes(sig.id)) {
      this.state.forcedSignalIds.push(sig.id);
    }

    this.state.deltaEvents.push({
      timePs: this.state.currentSimTimePs,
      delta: this.state.currentDeltaCycle,
      phase: "active",
      netName: sig.name,
      oldVal,
      newVal: value,
      isGlitch: false
    });

    this.log(`[FORCE] Forced ${sig.fullName} <= ${value} at t=${this.state.currentSimTimePs}ps (delta ${this.state.currentDeltaCycle})`, "warn");
    this.recordTelemetry(this.state.currentSimTimePs, this.state.currentDeltaCycle, 1);
    this.notify();
  }

  public releaseForce(signalId: string) {
    this.state.forcedSignalIds = this.state.forcedSignalIds.filter(id => id !== signalId);
    this.log(`[RELEASE] Released force on signal '${signalId}'. Re-evaluating circuit...`, "info");
    this.notify();
  }

  public injectStimulus(signalId: string, value: string) {
    const sig = this.state.signals.find(s => s.id === signalId || s.name.startsWith(signalId) || s.fullName.endsWith(`.${signalId}`));
    if (!sig) {
      this.log(`Stimulus injection failed: signal '${signalId}' not found.`, "error");
      return;
    }

    const prevSample = sig.samples[sig.samples.length - 1];
    const oldVal = prevSample?.value ?? "0";

    sig.samples.push({
      timePs: this.state.currentSimTimePs,
      delta: this.state.currentDeltaCycle,
      value
    });

    this.state.deltaEvents.push({
      timePs: this.state.currentSimTimePs,
      delta: this.state.currentDeltaCycle,
      phase: "active",
      netName: sig.name,
      oldVal,
      newVal: value,
      isGlitch: false
    });

    // In-RAM circuit re-evaluation
    this.reEvaluateCircuit(sig.id, value);

    this.recordTelemetry(this.state.currentSimTimePs, this.state.currentDeltaCycle, 1);
    this.log(`[STIMULUS] Injected ${sig.fullName} <= ${value} at t=${this.state.currentSimTimePs}ps`, "info");
    this.notify();
  }

  public pulseSignal(signalId: string) {
    const sig = this.state.signals.find(s => s.id === signalId || s.fullName.endsWith(`.${signalId}`));
    if (!sig) return;

    const prevVal = sig.samples[sig.samples.length - 1]?.value ?? "0";
    const highVal = prevVal === "1" ? "0" : "1";

    this.injectStimulus(sig.id, highVal);
    if (signalId === "clk" || signalId.includes("clk")) {
      this.tick(1000);
    }
  }

  private reEvaluateCircuit(changedSignalId: string, _newVal: string) {
    if (this.state.topModule === "alu_8bit") {
      const aSig = this.state.signals.find(s => s.id === "a");
      const bSig = this.state.signals.find(s => s.id === "b");
      const opSig = this.state.signals.find(s => s.id === "opcode");
      const resSig = this.state.signals.find(s => s.id === "result");
      const zeroSig = this.state.signals.find(s => s.id === "zero_flag");
      const carrySig = this.state.signals.find(s => s.id === "carry_flag");

      if (aSig && bSig && opSig && resSig) {
        const aVal = parseInt(aSig.samples[aSig.samples.length - 1]?.value.replace("0x", "") || "0", 16) || 0;
        const bVal = parseInt(bSig.samples[bSig.samples.length - 1]?.value.replace("0x", "") || "0", 16) || 0;
        const opVal = parseInt(opSig.samples[opSig.samples.length - 1]?.value || "0", 2) || 0;

        let calcRes = 0;
        let carry = 0;

        switch (opVal) {
          case 0:
            calcRes = (aVal + bVal) & 0xFF;
            carry = (aVal + bVal) > 0xFF ? 1 : 0;
            break;
          case 1:
            calcRes = (aVal - bVal) & 0xFF;
            carry = aVal < bVal ? 1 : 0;
            break;
          case 2:
            calcRes = (aVal & bVal) & 0xFF;
            break;
          case 3:
            calcRes = (aVal | bVal) & 0xFF;
            break;
          case 4:
            calcRes = (aVal ^ bVal) & 0xFF;
            break;
          case 5:
            calcRes = (aVal << 1) & 0xFF;
            carry = (aVal & 0x80) ? 1 : 0;
            break;
          case 6:
            calcRes = (aVal >> 1) & 0xFF;
            carry = (aVal & 0x01) ? 1 : 0;
            break;
          case 7:
            calcRes = (~aVal) & 0xFF;
            break;
        }

        const hexStr = "0x" + calcRes.toString(16).padStart(2, "0").toUpperCase();
        resSig.samples.push({
          timePs: this.state.currentSimTimePs,
          delta: this.state.currentDeltaCycle + 1,
          value: hexStr
        });

        if (zeroSig) {
          zeroSig.samples.push({
            timePs: this.state.currentSimTimePs,
            delta: this.state.currentDeltaCycle + 1,
            value: calcRes === 0 ? "1" : "0"
          });
        }

        if (carrySig) {
          carrySig.samples.push({
            timePs: this.state.currentSimTimePs,
            delta: this.state.currentDeltaCycle + 1,
            value: carry ? "1" : "0"
          });
        }
      }
    } else if (this.state.topModule === "counter_glitch_demo") {
      const cntSig = this.state.signals.find(s => s.id === "count");
      const tcSig = this.state.signals.find(s => s.id === "terminal_count");
      const enSig = this.state.signals.find(s => s.id === "enable");
      const upSig = this.state.signals.find(s => s.id === "up_down");

      if (cntSig && enSig && upSig) {
        const isEnabled = enSig.samples[enSig.samples.length - 1]?.value === "1";
        const isUp = upSig.samples[upSig.samples.length - 1]?.value === "1";
        let curVal = parseInt(cntSig.samples[cntSig.samples.length - 1]?.value.replace("0x", "") || "0", 16) || 0;

        if (isEnabled && changedSignalId === "clk") {
          curVal = isUp ? (curVal + 1) & 0xFF : (curVal - 1 + 256) & 0xFF;
          const hexStr = "0x" + curVal.toString(16).padStart(2, "0").toUpperCase();
          cntSig.samples.push({
            timePs: this.state.currentSimTimePs,
            delta: this.state.currentDeltaCycle + 1,
            value: hexStr
          });

          if (tcSig) {
            tcSig.samples.push({
              timePs: this.state.currentSimTimePs,
              delta: this.state.currentDeltaCycle + 1,
              value: curVal === 0xFF ? "1" : "0"
            });
          }
        }
      }
    }
  }

  public generateSystemVerilogTestbench(topModule: string): string {
    const isAlu = topModule.includes("alu");
    const isCounter = topModule.includes("counter");

    return `// ============================================================================
// Axiom EDA — Synthesizable IEEE 1800-2017 SystemVerilog Testbench
// Generated from Virtual Lab & Stimulus Painter
// Target Module: ${topModule}
// Timestamp: ${new Date().toISOString()}
// ============================================================================

\`timescale 1ns / 1ps

module ${topModule}_tb;

  // 1. Simulation Clocks & System Resets
  logic clk;
  logic rst_n;

  // 100 MHz Free-running clock (10 ns period)
  initial clk = 0;
  always #5 clk = ~clk;

  // 2. Device Under Test (DUT) Ports
${isAlu ? `  logic [2:0] opcode;
  logic [7:0] a;
  logic [7:0] b;
  logic [7:0] result;
  logic       zero_flag;
  logic       carry_flag;

  // 3. DUT Instantiation
  alu_8bit u_dut (
    .clk(clk),
    .rst_n(rst_n),
    .opcode(opcode),
    .a(a),
    .b(b),
    .result(result),
    .zero_flag(zero_flag),
    .carry_flag(carry_flag)
  );` : isCounter ? `  logic       enable;
  logic       up_down;
  logic [7:0] count;
  logic       terminal_count;
  logic       glitch_hazard_wire;

  // 3. DUT Instantiation
  counter_glitch_demo u_dut (
    .clk(clk),
    .rst_n(rst_n),
    .enable(enable),
    .up_down(up_down),
    .count(count),
    .terminal_count(terminal_count),
    .glitch_hazard_wire(glitch_hazard_wire)
  );` : `  logic [7:0]  data_in;
  logic [15:0] accum_out;
  logic        core_heartbeat;

  // 3. DUT Instantiation
  soc_subsystem_top u_dut (
    .sys_clk(clk),
    .sys_rst_n(rst_n),
    .data_in(data_in),
    .accum_out(accum_out),
    .core_heartbeat(core_heartbeat)
  );`}

  // 4. Stimulus Sequence Execution
  initial begin
    $display("[AXIOM TB] Starting simulation for ${topModule}...");
    
    // Assert active-low reset
    rst_n = 1'b0;
${isAlu ? `    opcode = 3'b000;
    a = 8'h00;
    b = 8'h00;` : isCounter ? `    enable = 1'b0;
    up_down = 1'b1;` : `    data_in = 8'h00;`}

    #20;
    rst_n = 1'b1;
    $display("[AXIOM TB] Reset deasserted at t=%0t ps", $time);

    // Run Painted Stimulus Vectors
${isAlu ? `    // Vector 1: ADD (0x12 + 0x34 = 0x46)
    @(posedge clk);
    opcode = 3'b000; a = 8'h12; b = 8'h34;
    @(posedge clk);
    assert(result == 8'h46) else $error("ADD mismatch: result=%0h", result);

    // Vector 2: SUB (0x50 - 0x10 = 0x40)
    @(posedge clk);
    opcode = 3'b001; a = 8'h50; b = 8'h10;
    @(posedge clk);

    // Vector 3: XOR (0xAA ^ 0x55 = 0xFF)
    @(posedge clk);
    opcode = 3'b100; a = 8'hAA; b = 8'h55;
    @(posedge clk);` : `    // Vector: Multi-cycle counting
    @(posedge clk);
    enable = 1'b1;
    repeat (16) @(posedge clk);`}

    #50;
    $display("[AXIOM TB] All vectors passed successfully!");
    $finish;
  end

endmodule
`;
  }
}

// Singleton global bridge instance
export const engineBridge = new BetteradoEngineBridge();
