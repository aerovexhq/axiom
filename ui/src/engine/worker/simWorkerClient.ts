// Axiom Simulation Web Worker Client Coordinator
// Manages worker thread lifecycle, promise correlation, watchdog supervision, and SharedArrayBuffer synchronization.

import wasmUrl from "../../wasm/axiom_wasm_bg.wasm?url";
import {
  WorkerRequest,
  WorkerMessage,
  WorkerEventBatchMessage
} from "./simWorkerProtocol";
import {
  isSharedBufferSupported,
  createSharedSimBuffer,
  SharedSimBufferReader
} from "./simSharedBuffer";
import type { LspDiagnostic, HoverResult, CompletionItem } from "../engineBridge";

export type EventBatchCallback = (batch: WorkerEventBatchMessage) => void;
export type LogCallback = (msg: string, level: "info" | "warn" | "error" | "event") => void;

interface PendingRequest {
  resolve: (data: any) => void;
  reject: (err: any) => void;
  timer: any;
  command: string;
}

export class SimWorkerClient {
  private worker: Worker | null = null;
  private reqIdCounter = 1;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private isReadyPromise: Promise<boolean> | null = null;

  private sharedBuffer: SharedArrayBuffer | null = null;
  private sharedReader: SharedSimBufferReader | null = null;

  private eventBatchListeners: Set<EventBatchCallback> = new Set();
  private logListeners: Set<LogCallback> = new Set();

  private defaultTimeoutMs = 5000;
  private activeTopModule = "";
  private activeSource = "";

  constructor() {
    this.initWorker();
  }

  public isSupported(): boolean {
    return typeof window !== "undefined" && typeof Worker !== "undefined";
  }

  public isInitialized(): boolean {
    return this.worker !== null;
  }

  public init(): Promise<boolean> {
    return this.initWorker();
  }

  public hasSharedBuffer(): boolean {
    return this.sharedReader !== null;
  }

  public readSharedSnapshot() {
    return this.sharedReader ? this.sharedReader.readSnapshot() : null;
  }

  public onEventBatch(cb: EventBatchCallback): () => void {
    this.eventBatchListeners.add(cb);
    return () => this.eventBatchListeners.delete(cb);
  }

  public onLog(cb: LogCallback): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private initWorker(): Promise<boolean> {
    if (!this.isSupported()) {
      return Promise.resolve(false);
    }

    if (this.isReadyPromise) {
      return this.isReadyPromise;
    }

    this.isReadyPromise = new Promise<boolean>((resolve) => {
      try {
        this.worker = new Worker(new URL("./simWorker.ts", import.meta.url), {
          type: "module"
        });

        this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
          this.handleWorkerMessage(e.data);
        };

        this.worker.onerror = (err: ErrorEvent) => {
          console.error("[SimWorkerClient] Worker runtime error:", err);
          this.broadcastLog(`Simulation worker error: ${err.message}`, "error");
        };

        // Attach SharedArrayBuffer if supported by the browser environment
        if (isSharedBufferSupported()) {
          this.sharedBuffer = createSharedSimBuffer();
          if (this.sharedBuffer) {
            this.sharedReader = new SharedSimBufferReader(this.sharedBuffer);
            this.send({
              type: "ATTACH_SHARED_BUFFER",
              buffer: this.sharedBuffer
            } as any).catch((e) => {
              console.warn("[SimWorkerClient] Failed to attach SharedArrayBuffer:", e);
            });
          }
        }

        // Initialize WASM inside worker
        this.send({
          type: "INIT",
          wasmUrl
        } as any)
          .then(() => {
            resolve(true);
          })
          .catch((err) => {
            console.warn("[SimWorkerClient] Worker WASM init failed:", err);
            resolve(false);
          });
      } catch (e) {
        console.warn("[SimWorkerClient] Failed to spawn Web Worker:", e);
        resolve(false);
      }
    });

    return this.isReadyPromise;
  }

  public async compile(source: string, topModule: string): Promise<{
    success: boolean;
    top_module: string;
    nets: Array<{ id: number; name: string; width: number }>;
  }> {
    await this.initWorker();
    this.activeSource = source;
    this.activeTopModule = topModule;

    return this.send({
      type: "COMPILE",
      source,
      topModule
    } as any);
  }

  public async stepTime(dtPs: number): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "STEP_TIME",
      dtPs
    } as any);
  }

  public async stepDelta(): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "STEP_DELTA"
    } as any);
  }

  public async stepBackTime(dtPs: number): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "STEP_BACK_TIME",
      dtPs
    } as any);
  }

  public async stepBackDelta(): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "STEP_BACK_DELTA"
    } as any);
  }

  public async scrubToTime(targetTimePs: number): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "SCRUB_TO_TIME",
      targetTimePs
    } as any);
  }

  public async decodeProtocol(requestJson: string): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "DECODE_PROTOCOL",
      requestJson
    } as any);
  }

  public async startPlay(intervalMs = 30, stepPs = 1000): Promise<void> {
    await this.initWorker();
    return this.send({
      type: "START_PLAY",
      intervalMs,
      stepPs
    } as any);
  }

  public async pause(): Promise<void> {
    await this.initWorker();
    return this.send({
      type: "PAUSE"
    } as any);
  }

  public async reset(topModule: string): Promise<void> {
    await this.initWorker();
    return this.send({
      type: "RESET",
      topModule
    } as any);
  }

  public async forceSignal(netName: string, valueStr: string): Promise<void> {
    await this.initWorker();
    return this.send({
      type: "FORCE_SIGNAL",
      netName,
      valueStr
    } as any);
  }

  public async releaseForce(netName: string): Promise<void> {
    await this.initWorker();
    return this.send({
      type: "RELEASE_FORCE",
      netName
    } as any);
  }

  public async exportVcd(): Promise<string> {
    await this.initWorker();
    return this.send({
      type: "EXPORT_VCD"
    } as any);
  }

  public async exportSaif(): Promise<string> {
    await this.initWorker();
    return this.send({
      type: "EXPORT_SAIF"
    } as any);
  }

  public async lint(source: string): Promise<LspDiagnostic[]> {
    await this.initWorker();
    return this.send({
      type: "LINT",
      source
    } as any);
  }

  public async lintXdc(source: string): Promise<LspDiagnostic[]> {
    await this.initWorker();
    return this.send({
      type: "LINT_XDC",
      source
    } as any);
  }

  public async hover(source: string, line: number, col: number): Promise<HoverResult | null> {
    await this.initWorker();
    return this.send({
      type: "HOVER",
      source,
      line,
      col
    } as any);
  }

  public async complete(source: string, line: number, col: number): Promise<CompletionItem[]> {
    await this.initWorker();
    return this.send({
      type: "COMPLETE",
      source,
      line,
      col
    } as any);
  }

  public async runSta(verilogSource: string, xdcSource: string, topModule?: string): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "RUN_STA",
      verilogSource,
      xdcSource,
      topModule
    } as any);
  }

  public async recommendPipeline(
    verilogSource: string,
    xdcSource: string,
    topModule?: string
  ): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "RECOMMEND_PIPELINE",
      verilogSource,
      xdcSource,
      topModule
    } as any);
  }

  public async applyPipeline(
    verilogSource: string,
    topModule: string,
    cutNet: string,
    clockName: string,
    resetName?: string
  ): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "APPLY_PIPELINE",
      verilogSource,
      topModule,
      cutNet,
      clockName,
      resetName
    } as any);
  }

  public async synthesizeMicroarch(source: string, topModule?: string): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "SYNTHESIZE_MICROARCH",
      source,
      topModule
    } as any);
  }

  public async partitionMultiDie(
    source: string,
    topModule?: string,
    device?: string,
    constraints?: Record<string, string>,
    enableLaguna?: boolean,
    tdmRatio?: number
  ): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "PARTITION_MULTIDIE",
      source,
      topModule,
      device,
      constraints,
      enableLaguna,
      tdmRatio
    } as any);
  }

  public async evaluatePpa(options: {
    verilogSource: string;
    xdcSource?: string;
    topModule?: string;
    targetDevice?: string;
    targetClockFreqMhz?: number;
    junctionTempC?: number;
    coreVoltageV?: number;
    pdk?: string;
  }): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "EVALUATE_PPA",
      ...options
    } as any);
  }

  public async getCoverage(): Promise<any> {
    await this.initWorker();
    return this.send({
      type: "GET_COVERAGE"
    } as any);
  }

  public async resetCoverage(): Promise<void> {
    await this.initWorker();
    return this.send({
      type: "RESET_COVERAGE"
    } as any);
  }

  public async exportLcov(sourcePath: string): Promise<string> {
    await this.initWorker();
    return this.send({
      type: "EXPORT_LCOV",
      sourcePath
    } as any);
  }

  public async exportHtmlReport(sourceName: string, sourceCode: string): Promise<string> {
    await this.initWorker();
    return this.send({
      type: "EXPORT_HTML_REPORT",
      sourceName,
      sourceCode
    } as any);
  }

  private send<T = any>(req: Omit<WorkerRequest, "id">, customTimeout?: number): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error("Worker is not available"));
    }

    const id = this.reqIdCounter++;
    const fullReq = { ...req, id } as WorkerRequest;

    return new Promise<T>((resolve, reject) => {
      const timeoutMs = customTimeout ?? this.defaultTimeoutMs;
      const timer = setTimeout(() => {
        this.handleTimeout(id, req.type);
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer,
        command: req.type
      });

      try {
        this.worker!.postMessage(fullReq);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  private handleWorkerMessage(msg: WorkerMessage) {
    if (!msg) return;

    if (msg.type === "RESPONSE") {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if (msg.success) {
          pending.resolve(msg.data);
        } else {
          pending.reject(new Error(msg.error));
        }
      }
      return;
    }

    if (msg.type === "EVENT_BATCH") {
      for (const listener of this.eventBatchListeners) {
        listener(msg);
      }
      return;
    }

    if (msg.type === "LOG") {
      this.broadcastLog(msg.message, msg.level);
      return;
    }

    if (msg.type === "PONG") {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        pending.resolve(msg.timestamp);
      }
      return;
    }
  }

  private handleTimeout(id: number, command: string) {
    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    this.pendingRequests.delete(id);
    const err = new Error(
      `Simulation worker timeout on '${command}' (possible infinite delta loop or oscillation hazard). Worker sandbox resetting...`
    );
    pending.reject(err);
    this.broadcastLog(`[Watchdog] ${err.message}`, "error");

    // Supervisor: Terminate hanging worker and respawn
    this.respawnWorker();
  }

  private respawnWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }

    // Cancel all remaining pending requests
    for (const [_id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error("Worker terminated due to watchdog reset"));
    }
    this.pendingRequests.clear();
    this.isReadyPromise = null;

    this.broadcastLog("Respawning clean simulation Web Worker sandbox...", "warn");
    this.initWorker().then(() => {
      // Recompile active design if available
      if (this.activeSource && this.activeTopModule) {
        this.compile(this.activeSource, this.activeTopModule).catch(() => {});
      }
    });
  }

  private broadcastLog(message: string, level: "info" | "warn" | "error" | "event") {
    for (const listener of this.logListeners) {
      listener(message, level);
    }
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.eventBatchListeners.clear();
    this.logListeners.clear();
  }
}

// Export singleton instance
export const simWorkerClient = new SimWorkerClient();
