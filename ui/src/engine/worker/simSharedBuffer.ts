// Axiom SharedArrayBuffer Telemetry & SimTime Ring Buffer
// Enables zero-copy, atomic 120 FPS synchronization between worker and UI thread.

export const SHARED_BUFFER_SIZE_BYTES = 128;

// Uint32 offsets (index in Int32Array / Uint32Array)
export const OFF_TIME_LOW = 0;       // 0..3 bytes: Lower 32 bits of SimTime (ps)
export const OFF_TIME_HIGH = 1;      // 4..7 bytes: Upper 32 bits of SimTime (ps)
export const OFF_DELTA_CYCLE = 2;    // 8..11 bytes: Current Delta cycle
export const OFF_IS_RUNNING = 3;     // 12..15 bytes: 1 if running, 0 if paused
export const OFF_GLITCH_COUNT = 4;   // 16..19 bytes: Cumulative glitch hazard count
export const OFF_EVENTS_EXEC = 5;    // 20..23 bytes: Cumulative events evaluated
export const OFF_SEQ_ID = 6;         // 24..27 bytes: Atomic sequence ID for consistency
export const OFF_RESERVED = 7;       // 28..31 bytes: Padding

// Float64 offsets (index in Float64Array, starting at byte 32 -> Float64 index 4)
export const OFF_F64_POWER_MW = 4;        // 32..39 bytes: Instantaneous power (mW)
export const OFF_F64_CURRENT_MA = 5;      // 40..47 bytes: PDN Rail current (mA)
export const OFF_F64_VOLTAGE_SAG_V = 6;   // 48..55 bytes: Inductive PDN sag (V)
export const OFF_F64_RAIL_VOLT_V = 7;     // 56..63 bytes: Rail voltage (V)

export function isSharedBufferSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof SharedArrayBuffer !== "undefined" &&
    typeof Atomics !== "undefined" &&
    typeof crossOriginIsolated !== "undefined" &&
    crossOriginIsolated === true
  );
}

export function createSharedSimBuffer(): SharedArrayBuffer | null {
  if (!isSharedBufferSupported()) {
    return null;
  }
  try {
    return new SharedArrayBuffer(SHARED_BUFFER_SIZE_BYTES);
  } catch (e) {
    console.warn("[SharedSimBuffer] SharedArrayBuffer creation failed:", e);
    return null;
  }
}

export class SharedSimBufferWriter {
  private u32View: Uint32Array;
  private i32View: Int32Array;
  private f64View: Float64Array;

  constructor(buffer: SharedArrayBuffer) {
    this.u32View = new Uint32Array(buffer);
    this.i32View = new Int32Array(buffer);
    this.f64View = new Float64Array(buffer);
  }

  public updateSnapshot(params: {
    timePs: number;
    delta: number;
    isRunning: boolean;
    glitchCount: number;
    eventsExecuted: number;
    powerMw: number;
    currentMa: number;
    voltageSagV: number;
    railVoltageV: number;
  }) {
    const timePs = Math.max(0, params.timePs);
    const low = (timePs >>> 0) & 0xffffffff;
    const high = Math.floor(timePs / 4294967296) >>> 0;

    // Increment sequence ID (odd during write)
    const prevSeq = Atomics.load(this.i32View, OFF_SEQ_ID);
    Atomics.store(this.i32View, OFF_SEQ_ID, prevSeq + 1);

    this.u32View[OFF_TIME_LOW] = low;
    this.u32View[OFF_TIME_HIGH] = high;
    this.u32View[OFF_DELTA_CYCLE] = params.delta;
    this.u32View[OFF_IS_RUNNING] = params.isRunning ? 1 : 0;
    this.u32View[OFF_GLITCH_COUNT] = params.glitchCount;
    this.u32View[OFF_EVENTS_EXEC] = params.eventsExecuted;

    this.f64View[OFF_F64_POWER_MW] = params.powerMw;
    this.f64View[OFF_F64_CURRENT_MA] = params.currentMa;
    this.f64View[OFF_F64_VOLTAGE_SAG_V] = params.voltageSagV;
    this.f64View[OFF_F64_RAIL_VOLT_V] = params.railVoltageV;

    // Complete sequence ID (even after write)
    Atomics.store(this.i32View, OFF_SEQ_ID, prevSeq + 2);
  }
}

export class SharedSimBufferReader {
  private u32View: Uint32Array;
  private i32View: Int32Array;
  private f64View: Float64Array;

  constructor(buffer: SharedArrayBuffer) {
    this.u32View = new Uint32Array(buffer);
    this.i32View = new Int32Array(buffer);
    this.f64View = new Float64Array(buffer);
  }

  public readSnapshot(): {
    timePs: number;
    delta: number;
    isRunning: boolean;
    glitchCount: number;
    eventsExecuted: number;
    powerMw: number;
    currentMa: number;
    voltageSagV: number;
    railVoltageV: number;
  } | null {
    const seq1 = Atomics.load(this.i32View, OFF_SEQ_ID);
    if (seq1 % 2 !== 0) {
      // In the middle of an atomic write, retry or skip
      return null;
    }

    const low = this.u32View[OFF_TIME_LOW];
    const high = this.u32View[OFF_TIME_HIGH];
    const delta = this.u32View[OFF_DELTA_CYCLE];
    const isRunning = this.u32View[OFF_IS_RUNNING] === 1;
    const glitchCount = this.u32View[OFF_GLITCH_COUNT];
    const eventsExecuted = this.u32View[OFF_EVENTS_EXEC];

    const powerMw = this.f64View[OFF_F64_POWER_MW];
    const currentMa = this.f64View[OFF_F64_CURRENT_MA];
    const voltageSagV = this.f64View[OFF_F64_VOLTAGE_SAG_V];
    const railVoltageV = this.f64View[OFF_F64_RAIL_VOLT_V];

    const seq2 = Atomics.load(this.i32View, OFF_SEQ_ID);
    if (seq1 !== seq2) {
      // Data changed during reading
      return null;
    }

    const timePs = high * 4294967296 + low;

    return {
      timePs,
      delta,
      isRunning,
      glitchCount,
      eventsExecuted,
      powerMw,
      currentMa,
      voltageSagV,
      railVoltageV,
    };
  }
}
