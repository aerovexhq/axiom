/* tslint:disable */
/* eslint-disable */

/**
 * WebAssembly simulation kernel executing 100% in-browser.
 */
export class WasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compile Verilog / SystemVerilog source code into executable 4-state simulation circuit.
     */
    compile(source: string, top_module: string): any;
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
    constructor();
    /**
     * Step simulation by a single discrete delta cycle (zero time).
     */
    step_delta(): any;
    /**
     * Step simulation time forward by dt_ps picoseconds.
     */
    step_time(dt_ps: number): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmengine_free: (a: number, b: number) => void;
    readonly wasmengine_compile: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmengine_export_saif: (a: number) => [number, number, number, number];
    readonly wasmengine_export_vcd: (a: number) => [number, number, number, number];
    readonly wasmengine_force_signal: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly wasmengine_new: () => number;
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
