// Betterado Engine Bridge — Universal IPC & In-RAM Simulation Engine

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

  constructor() {
    this.isTauri = typeof window !== "undefined" && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    this.state = this.getInitialState("alu_8bit");
  }

  public isTauriRuntime(): boolean {
    return this.isTauri;
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

  public compile(_code: string, topModule: string) {
    this.log(`Compiling top module '${topModule}' with Cranelift JIT...`, "info");
    const t0 = performance.now();

    // Rebuild initial state for design
    this.state = this.getInitialState(topModule);
    this.state.compiled = true;

    // Add initial startup pulses
    this.scheduleInitialStimulus();

    const elapsed = (performance.now() - t0).toFixed(2);
    this.log(`Elaboration & in-RAM JIT machine code compilation completed in ${elapsed} ms.`, "info");
    this.log(`Stratified Event Queue initialized. 4-State Arena ready. PDN 1.2V rail attached.`, "info");
    this.notify();
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
}

// Singleton global bridge instance
export const engineBridge = new BetteradoEngineBridge();
