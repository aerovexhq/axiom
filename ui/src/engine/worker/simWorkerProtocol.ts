// Axiom Standalone Web Worker Simulation Protocol
import type {
  TelemetryPoint,
  GlitchEvent
} from "../engineBridge";

export type WorkerCommandType =
  | "INIT"
  | "COMPILE"
  | "STEP_TIME"
  | "STEP_DELTA"
  | "START_PLAY"
  | "PAUSE"
  | "RESET"
  | "FORCE_SIGNAL"
  | "RELEASE_FORCE"
  | "EXPORT_VCD"
  | "EXPORT_SAIF"
  | "LINT"
  | "LINT_XDC"
  | "HOVER"
  | "COMPLETE"
  | "ATTACH_SHARED_BUFFER"
  | "PING";

export interface BaseWorkerRequest {
  id: number;
  type: WorkerCommandType;
}

export interface InitRequest extends BaseWorkerRequest {
  type: "INIT";
  wasmUrl: string;
}

export interface CompileRequest extends BaseWorkerRequest {
  type: "COMPILE";
  source: string;
  topModule: string;
}

export interface StepTimeRequest extends BaseWorkerRequest {
  type: "STEP_TIME";
  dtPs: number;
}

export interface StepDeltaRequest extends BaseWorkerRequest {
  type: "STEP_DELTA";
}

export interface StartPlayRequest extends BaseWorkerRequest {
  type: "START_PLAY";
  intervalMs?: number;
  stepPs?: number;
}

export interface PauseRequest extends BaseWorkerRequest {
  type: "PAUSE";
}

export interface ResetRequest extends BaseWorkerRequest {
  type: "RESET";
  topModule: string;
}

export interface ForceSignalRequest extends BaseWorkerRequest {
  type: "FORCE_SIGNAL";
  netName: string;
  valueStr: string;
}

export interface ReleaseForceRequest extends BaseWorkerRequest {
  type: "RELEASE_FORCE";
  netName: string;
}

export interface ExportVcdRequest extends BaseWorkerRequest {
  type: "EXPORT_VCD";
}

export interface ExportSaifRequest extends BaseWorkerRequest {
  type: "EXPORT_SAIF";
}

export interface LintRequest extends BaseWorkerRequest {
  type: "LINT";
  source: string;
}

export interface LintXdcRequest extends BaseWorkerRequest {
  type: "LINT_XDC";
  source: string;
}

export interface HoverRequest extends BaseWorkerRequest {
  type: "HOVER";
  source: string;
  line: number;
  col: number;
}

export interface CompleteRequest extends BaseWorkerRequest {
  type: "COMPLETE";
  source: string;
  line: number;
  col: number;
}

export interface AttachSharedBufferRequest extends BaseWorkerRequest {
  type: "ATTACH_SHARED_BUFFER";
  buffer: SharedArrayBuffer;
}

export interface PingRequest extends BaseWorkerRequest {
  type: "PING";
}

export type WorkerRequest =
  | InitRequest
  | CompileRequest
  | StepTimeRequest
  | StepDeltaRequest
  | StartPlayRequest
  | PauseRequest
  | ResetRequest
  | ForceSignalRequest
  | ReleaseForceRequest
  | ExportVcdRequest
  | ExportSaifRequest
  | LintRequest
  | LintXdcRequest
  | HoverRequest
  | CompleteRequest
  | AttachSharedBufferRequest
  | PingRequest;

export interface WorkerSuccessResponse {
  type: "RESPONSE";
  id: number;
  success: true;
  data?: any;
}

export interface WorkerErrorResponse {
  type: "RESPONSE";
  id: number;
  success: false;
  error: string;
}

export interface WorkerEventBatchMessage {
  type: "EVENT_BATCH";
  timePs: number;
  delta: number;
  isRunning?: boolean;
  signalValues: Array<[string, string]>;
  telemetry?: TelemetryPoint;
  glitches?: GlitchEvent[];
  eventsExecuted: number;
  glitchCount?: number;
  peakCurrentMa?: number;
  maxSagMv?: number;
}

export interface WorkerLogMessage {
  type: "LOG";
  message: string;
  level: "info" | "warn" | "error" | "event";
}

export interface WorkerPongMessage {
  type: "PONG";
  id: number;
  timestamp: number;
}

export type WorkerMessage =
  | WorkerSuccessResponse
  | WorkerErrorResponse
  | WorkerEventBatchMessage
  | WorkerLogMessage
  | WorkerPongMessage;
