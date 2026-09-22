/* tslint:disable */
/* eslint-disable */

/**
 * WebAssembly simulation kernel executing 100% in-browser.
 */
export class WasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a dynamic temporal SVA assertion expression to the active simulation.
     */
    add_assertion(name: string, sva_expr: string, clock_net?: string | null, _reset_net?: string | null): string;
    apply_pipeline(verilog_source: string, top_module: string, cut_net: string, clock_name: string, reset_name?: string | null): any;
    /**
     * Compile Verilog / SystemVerilog source code into executable 4-state simulation circuit.
     */
    compile(source: string, top_module: string): any;
    /**
     * Query autocompletions for position at (line, column).
     */
    complete(source: string, line: number, column: number): any;
    /**
     * Query autocompletions for XDC constraints at (line, column).
     */
    complete_xdc(source: string, line: number, column: number): any;
    /**
     * Decode protocol transactions from request JSON payload.
     */
    decode_protocol(request_json: string): any;
    evaluate_ppa(verilog_source: string, xdc_source: string, top_module?: string | null, target_device?: string | null, target_clock_freq_mhz?: number | null, junction_temp_c?: number | null, core_voltage_v?: number | null, pdk?: string | null): any;
    /**
     * Exports standalone interactive HTML report.
     */
    export_html_report(source_name: string, source_code: string): string;
    /**
     * Exports standard LCOV (.info) format string.
     */
    export_lcov(source_path: string): string;
    /**
     * Export simulation switching activity as SAIF.
     */
    export_saif(): string;
    /**
     * Export simulation history as IEEE 1364 Value Change Dump (VCD).
     */
    export_vcd(): string;
    /**
     * Force a logic value onto a net.
     */
    force_signal(net_name: string, value_str: string): void;
    /**
     * Get active assertion verification report.
     */
    get_assertion_report(): any;
    /**
     * Get list of all assertion violations detected during simulation.
     */
    get_assertion_violations(): any;
    /**
     * Queries the live RTL code coverage report.
     */
    get_coverage(): any;
    /**
     * Query hover documentation for identifier/keyword at (line, column).
     */
    hover(source: string, line: number, column: number): any;
    /**
     * Query hover documentation for XDC constraint keyword at (line, column).
     */
    hover_xdc(source: string, line: number, column: number): any;
    /**
     * Run in-RAM static analysis linter on Verilog source code.
     */
    lint(source: string): any;
    /**
     * Run in-RAM static analysis linter on Memory file (.coe, .mem, .hex).
     */
    lint_mem(source: string, file_name: string): any;
    /**
     * Run in-RAM static analysis linter on VHDL IEEE 1076 source.
     */
    lint_vhdl(source: string): any;
    /**
     * Run in-RAM static analysis linter on Vivado XDC constraints.
     */
    lint_xdc(source: string): any;
    constructor();
    recommend_pipeline(verilog_source: string, xdc_source: string, top_module?: string | null): any;
    /**
     * Reset assertion counters and thread states.
     */
    reset_assertions(): void;
    /**
     * Resets live RTL code coverage counters.
     */
    reset_coverage(): void;
    /**
     * Run Static Timing Analysis (STA) on active circuit with XDC constraints.
     */
    run_sta(verilog_source: string, xdc_source: string, top_module?: string | null): any;
    /**
     * Scrub simulation to a target timestamp in picoseconds.
     */
    scrub_to_time(target_time_ps: number): any;
    /**
     * Sets static AST coverage points on active simulation.
     */
    set_coverage_points(source: string): void;
    /**
     * Rewind simulation by one discrete delta cycle.
     */
    step_back_delta(): any;
    /**
     * Rewind simulation physical time by dt_ps picoseconds.
     */
    step_back_time(dt_ps: number): any;
    /**
     * Step simulation by a single discrete delta cycle (zero time).
     */
    step_delta(): any;
    /**
     * Step simulation time forward by dt_ps picoseconds.
     */
    step_time(dt_ps: number): any;
}

/**
 * Standalone WebAssembly function to apply Silicon Copilot auto-pipelining refactoring.
 */
export function wasm_apply_pipeline(verilog_source: string, top_module: string, cut_net: string, clock_name: string, reset_name?: string | null): any;

/**
 * Standalone WebAssembly function to query completions without creating an engine instance.
 */
export function wasm_complete(source: string, line: number, column: number): any;

/**
 * Standalone WebAssembly function to query XDC completions without creating an engine instance.
 */
export function wasm_complete_xdc(source: string, line: number, column: number): any;

/**
 * Standalone WebAssembly function to decode protocol transactions from request JSON.
 */
export function wasm_decode_protocol(request_json: string): any;

/**
 * Standalone WebAssembly function to evaluate Power-Performance-Area (PPA) and silicon cost forecast.
 */
export function wasm_evaluate_ppa(verilog_source: string, xdc_source: string, top_module?: string | null, target_device?: string | null, target_clock_freq_mhz?: number | null, junction_temp_c?: number | null, core_voltage_v?: number | null, pdk?: string | null): any;

/**
 * Standalone WebAssembly function to generate coverage report for given source and simulated time.
 */
export function wasm_get_coverage(source: string, top_module?: string | null, sim_time_ps?: bigint | null): any;

/**
 * Standalone WebAssembly function to query hover info without creating an engine instance.
 */
export function wasm_hover(source: string, line: number, column: number): any;

/**
 * Standalone WebAssembly function to query XDC hover info without creating an engine instance.
 */
export function wasm_hover_xdc(source: string, line: number, column: number): any;

/**
 * Standalone WebAssembly function to lint Verilog source without creating an engine instance.
 */
export function wasm_lint(source: string): any;

/**
 * Standalone WebAssembly function to lint Memory initialization file without creating an engine instance.
 */
export function wasm_lint_mem(source: string, file_name: string): any;

/**
 * Standalone WebAssembly function to lint VHDL source without creating an engine instance.
 */
export function wasm_lint_vhdl(source: string): any;

/**
 * Standalone WebAssembly function to lint XDC constraints source without creating an engine instance.
 */
export function wasm_lint_xdc(source: string): any;

/**
 * Standalone WebAssembly function to perform multi-die netlist partitioning.
 */
export function wasm_partition_multidie(source: string, top_module?: string | null, device?: string | null, constraints_json?: string | null, enable_laguna?: boolean | null, tdm_ratio?: number | null): any;

/**
 * Standalone WebAssembly function to run Silicon Copilot timing slack auto-pipelining analysis.
 */
export function wasm_recommend_pipeline(verilog_source: string, xdc_source: string, top_module?: string | null): any;

/**
 * Standalone WebAssembly function to run Static Timing Analysis (STA).
 */
export function wasm_run_sta(verilog_source: string, xdc_source: string, top_module?: string | null): any;

/**
 * Standalone WebAssembly function to synthesize micro-architectural block diagram from Verilog source.
 */
export function wasm_synthesize_microarch(source: string, top_module?: string | null): any;

/**
 * Standalone WebAssembly function to verify SVA assertions on Verilog source.
 */
export function wasm_verify_assertions(source: string, top_module?: string | null, sim_time_ps?: bigint | null): any;

/**
 * Standalone WebAssembly function to synthesize HDL source into technology-mapped netlist.
 */
export function wasm_synthesize_netlist(source: string, top_module?: string | null, device?: string | null): any;

/**
 * Standalone WebAssembly function to export structural Verilog from synthesized netlist.
 */
export function wasm_export_synthesized_verilog(source: string, top_module?: string | null, device?: string | null): string;

/**
 * Standalone WebAssembly function to run Bounded Model Checking (BMC) and Formal Property Verification.
 */
export function wasm_run_formal(source: string, top_module?: string | null, max_depth?: number | null, engine_mode?: string | null, clock_name?: string | null, reset_name?: string | null): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmengine_free: (a: number, b: number) => void;
    readonly wasm_apply_pipeline: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number];
    readonly wasm_complete: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_complete_xdc: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_decode_protocol: (a: number, b: number) => [number, number, number];
    readonly wasm_evaluate_ppa: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => [number, number, number];
    readonly wasm_get_coverage: (a: number, b: number, c: number, d: number, e: number, f: bigint) => [number, number, number];
    readonly wasm_hover: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_hover_xdc: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_lint: (a: number, b: number) => [number, number, number];
    readonly wasm_lint_mem: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_lint_vhdl: (a: number, b: number) => [number, number, number];
    readonly wasm_lint_xdc: (a: number, b: number) => [number, number, number];
    readonly wasm_partition_multidie: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number];
    readonly wasm_recommend_pipeline: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly wasm_run_sta: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly wasm_synthesize_microarch: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_verify_assertions: (a: number, b: number, c: number, d: number, e: number, f: bigint) => [number, number, number];
    readonly wasmengine_add_assertion: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
    readonly wasmengine_apply_pipeline: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number, number];
    readonly wasmengine_compile: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_complete: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_complete_xdc: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_decode_protocol: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmengine_evaluate_ppa: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => [number, number, number];
    readonly wasmengine_export_html_report: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly wasmengine_export_lcov: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmengine_export_saif: (a: number) => [number, number, number, number];
    readonly wasmengine_export_vcd: (a: number) => [number, number, number, number];
    readonly wasmengine_force_signal: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly wasmengine_get_assertion_report: (a: number) => [number, number, number];
    readonly wasmengine_get_assertion_violations: (a: number) => [number, number, number];
    readonly wasmengine_get_coverage: (a: number) => [number, number, number];
    readonly wasmengine_hover: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_hover_xdc: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_lint: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmengine_lint_mem: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_lint_vhdl: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmengine_lint_xdc: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmengine_new: () => number;
    readonly wasmengine_recommend_pipeline: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly wasmengine_reset_assertions: (a: number) => [number, number];
    readonly wasmengine_reset_coverage: (a: number) => [number, number];
    readonly wasmengine_run_sta: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly wasmengine_scrub_to_time: (a: number, b: number) => [number, number, number];
    readonly wasmengine_set_coverage_points: (a: number, b: number, c: number) => [number, number];
    readonly wasmengine_step_back_delta: (a: number) => [number, number, number];
    readonly wasmengine_step_back_time: (a: number, b: number) => [number, number, number];
    readonly wasmengine_step_delta: (a: number) => [number, number, number];
    readonly wasmengine_step_time: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
