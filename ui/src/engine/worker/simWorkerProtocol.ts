// Axiom Standalone Web Worker Simulation Protocol
import type {
  TelemetryPoint,
  GlitchEvent
} from "../engineBridge";
import type { AssertionViolation } from "../assertionModel";
export type { AssertionViolation, AssertionReport } from "../assertionModel";

export type WorkerCommandType =
  | "INIT"
  | "COMPILE"
  | "STEP_TIME"
  | "STEP_DELTA"
  | "STEP_BACK_TIME"
  | "STEP_BACK_DELTA"
  | "SCRUB_TO_TIME"
  | "DECODE_PROTOCOL"
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
  | "RUN_STA"
  | "RECOMMEND_PIPELINE"
  | "APPLY_PIPELINE"
  | "SYNTHESIZE_MICROARCH"
  | "PARTITION_MULTIDIE"
  | "EVALUATE_PPA"
  | "GET_COVERAGE"
  | "RESET_COVERAGE"
  | "EXPORT_LCOV"
  | "EXPORT_HTML_REPORT"
  | "ADD_ASSERTION"
  | "GET_ASSERTION_REPORT"
  | "GET_ASSERTION_VIOLATIONS"
  | "RESET_ASSERTIONS"
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

export interface StepBackTimeRequest extends BaseWorkerRequest {
  type: "STEP_BACK_TIME";
  dtPs: number;
}

export interface StepBackDeltaRequest extends BaseWorkerRequest {
  type: "STEP_BACK_DELTA";
}

export interface ScrubToTimeRequest extends BaseWorkerRequest {
  type: "SCRUB_TO_TIME";
  targetTimePs: number;
}

export interface DecodeProtocolRequestMessage extends BaseWorkerRequest {
  type: "DECODE_PROTOCOL";
  requestJson: string;
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

export interface RunStaRequest extends BaseWorkerRequest {
  type: "RUN_STA";
  verilogSource: string;
  xdcSource: string;
  topModule?: string;
}

export interface RecommendPipelineRequest extends BaseWorkerRequest {
  type: "RECOMMEND_PIPELINE";
  verilogSource: string;
  xdcSource: string;
  topModule?: string;
}

export interface ApplyPipelineRequest extends BaseWorkerRequest {
  type: "APPLY_PIPELINE";
  verilogSource: string;
  topModule: string;
  cutNet: string;
  clockName: string;
  resetName?: string;
}

export interface SynthesizeMicroarchRequest extends BaseWorkerRequest {
  type: "SYNTHESIZE_MICROARCH";
  source: string;
  topModule?: string;
}

export interface PartitionMultiDieRequest extends BaseWorkerRequest {
  type: "PARTITION_MULTIDIE";
  source: string;
  topModule?: string;
  device?: string;
  constraints?: Record<string, string>;
  enableLaguna?: boolean;
  tdmRatio?: number;
}

export interface EvaluatePpaRequest extends BaseWorkerRequest {
  type: "EVALUATE_PPA";
  verilogSource: string;
  xdcSource?: string;
  topModule?: string;
  targetDevice?: string;
  targetClockFreqMhz?: number;
  junctionTempC?: number;
  coreVoltageV?: number;
  pdk?: string;
}

export interface GetCoverageRequest extends BaseWorkerRequest {
  type: "GET_COVERAGE";
}

export interface ResetCoverageRequest extends BaseWorkerRequest {
  type: "RESET_COVERAGE";
}

export interface ExportLcovRequest extends BaseWorkerRequest {
  type: "EXPORT_LCOV";
  sourcePath: string;
}

export interface ExportHtmlReportRequest extends BaseWorkerRequest {
  type: "EXPORT_HTML_REPORT";
  sourceName: string;
  sourceCode: string;
}

export interface AddAssertionRequest extends BaseWorkerRequest {
  type: "ADD_ASSERTION";
  name: string;
  svaExpr: string;
  clockNet?: string;
  resetNet?: string;
}

export interface GetAssertionReportRequest extends BaseWorkerRequest {
  type: "GET_ASSERTION_REPORT";
}

export interface GetAssertionViolationsRequest extends BaseWorkerRequest {
  type: "GET_ASSERTION_VIOLATIONS";
}

export interface ResetAssertionsRequest extends BaseWorkerRequest {
  type: "RESET_ASSERTIONS";
}

export type LineCoverageStatus = "Covered" | "Partial" | "Uncovered" | "NonExecutable";

export interface LineCoverageInfo {
  line: number;
  hits: number;
  status: LineCoverageStatus;
  branch_true?: number | null;
  branch_false?: number | null;
  snippet?: string | null;
}

export interface FsmCoverageData {
  fsm_name: string;
  state_hits: Record<string, number>;
  transition_hits: Record<string, number>;
  total_states: number;
  total_transitions: number;
}

export interface CoverageReport {
  statement_total: number;
  statement_hit: number;
  statement_pct: number;
  branch_total: number;
  branch_covered: number;
  branch_partial: number;
  branch_pct: number;
  toggle_total: number;
  toggle_covered: number;
  toggle_pct: number;
  fsm_state_total: number;
  fsm_state_hit: number;
  fsm_state_pct: number;
  fsm_transition_total: number;
  fsm_transition_hit: number;
  fsm_transition_pct: number;
  overall_pct: number;
  lines: LineCoverageInfo[];
  fsm_details: Record<string, FsmCoverageData>;
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
  | StepBackTimeRequest
  | StepBackDeltaRequest
  | ScrubToTimeRequest
  | DecodeProtocolRequestMessage
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
  | RunStaRequest
  | RecommendPipelineRequest
  | ApplyPipelineRequest
  | SynthesizeMicroarchRequest
  | PartitionMultiDieRequest
  | EvaluatePpaRequest
  | GetCoverageRequest
  | ResetCoverageRequest
  | ExportLcovRequest
  | ExportHtmlReportRequest
  | AddAssertionRequest
  | GetAssertionReportRequest
  | GetAssertionViolationsRequest
  | ResetAssertionsRequest
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
  assertionViolations?: AssertionViolation[];
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
