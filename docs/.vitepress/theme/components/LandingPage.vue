<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

interface BenchmarkItem {
  label: string;
  value: string;
  unit: string;
  baseline: string;
}

interface CodeSnippet {
  language: string;
  filename: string;
  code: string;
}

interface ArchitectureDetails {
  pipelineAscii: string;
  benchmarks: BenchmarkItem[];
  tradeOffs: string;
  codeSnippet: CodeSnippet;
  stack: string[];
}

interface Subsystem {
  id: string;
  name: string;
  tierLabel: string;
  category: string;
  tagline: string;
  status: string;
  statusTone: "primary" | "emerald" | "cyan" | "amber";
  metric: string;
  metricDetail: string;
  description: string;
  highlights: string[];
  docLink: string;
  architectureDetails: ArchitectureDetails;
}

const SUBSYSTEMS: Subsystem[] = [
  {
    id: "cranelift-jit",
    name: "Cranelift JIT Compiler",
    tierLabel: "Tier 1 // Core JIT Backend",
    category: "Machine Code Compilation",
    tagline: "Sub-millisecond In-RAM machine code lowering via Cranelift backend",
    status: "NATIVE CODEGEN",
    statusTone: "primary",
    metric: "2.81 MS JIT COMPILE",
    metricDetail: "Direct x86-64 & AArch64 machine code generation with zero intermediary C++",
    description: "Eliminates traditional minutes-long EDA elaboration phases. Compiles behavioral Verilog AST and netlist graphs directly into native CPU execution blocks in RAM, bypassing GCC/Clang link steps and generating zero intermediate disk files.",
    highlights: [
      "Direct lowering from Axiom High-Level IR to Cranelift SSA machine instructions",
      "Zero intermediate disk serialization (0 byte compilation artifact overhead)",
      "Dynamic hot-patching of combinational sensitivity trees during runtime",
      "Native vector instruction utilization (AVX-512 and ARM Neon) for word evaluation"
    ],
    docLink: "/architecture/in-ram-jit",
    architectureDetails: {
      pipelineAscii: `[Verilog / SystemVerilog AST]
             │
             ▼
[Axiom High-Level IR (HIR)]
             │
             ▼
[Cranelift SSA Lowering Pass]
             │
     ┌───────┴───────┐
     ▼               ▼
[AVX-512 Vector] [ARM Neon Core]
     │               │
     └───────┬───────┘
             ▼ (In-RAM Instruction Buffer)
[Direct Native CPU Execution Blocks]`,
      benchmarks: [
        { label: "Elaboration Time", value: "2.81", unit: "ms", baseline: "30.0 s Vivado xelab" },
        { label: "Intermediate Disk Writes", value: "0", unit: "bytes", baseline: "450 MB Verilator C++" },
        { label: "Instruction Cache Footprint", value: "1.4", unit: "MB L2 cache", baseline: "48 MB GCC shared obj" },
        { label: "Hot-Patch Recompile", value: "180", unit: "µs", baseline: "Full relink required" }
      ],
      tradeOffs: "Cranelift produces machine code in microseconds by prioritizing compilation speed over micro-architectural peep-hole optimizations. For HDL simulation, instantaneous turnaround provides orders-of-magnitude higher developer productivity than LLVM -O3.",
      codeSnippet: {
        language: "verilog",
        filename: "flight_telemetry_filter.v",
        code: `// Axiom In-RAM Cranelift JIT Interface
module telemetry_filter #(
    parameter integer WIDTH = 32
) (
    input  wire                 clk,
    input  wire                 rst_n,
    input  wire [WIDTH-1:0]     raw_telemetry_in,
    output reg  [WIDTH-1:0]     filtered_out
);
    // Directly lowered to Cranelift SSA basic blocks in memory
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            filtered_out <= {WIDTH{1'b0}};
        else
            filtered_out <= (raw_telemetry_in ^ 32'hA5A5_5A5A);
    end
endmodule`
      },
      stack: ["Rust 1.80+", "Cranelift SSA", "AVX-512", "ARM Neon", "Zero-Copy"]
    }
  },
  {
    id: "cycle-kernel",
    name: "4-State Cycle-Accurate Kernel",
    tierLabel: "Tier 1 // Simulation Kernel",
    category: "Discrete Event Scheduler",
    tagline: "High-throughput stratified discrete-event simulation kernel",
    status: "CYCLE ACCURATE",
    statusTone: "emerald",
    metric: "14.8M TRANSITIONS/S",
    metricDetail: "4-state (0, 1, X, Z) bit-parallel evaluation across hierarchical netlists",
    description: "High-density stratified event queue with discrete delta-cycle evaluation. Unveils subtle zero-time combinational glitches and race conditions obscured by traditional simulator scheduling shortcuts.",
    highlights: [
      "IEEE 1364/1800 stratified event queue (Active, Inactive, NBA, Postponed)",
      "Deterministic delta-cycle stepping API with inspectable intermediate states",
      "Two-level bit-parallel logic storage with SIMD bitwise evaluators",
      "Zero lock-contention event fanout across multi-threaded workers"
    ],
    docLink: "/architecture/four-state-arena",
    architectureDetails: {
      pipelineAscii: `[Time Slot Scheduler (t = t₀)]
             │
             ├──► [Active Queue: Continuous Assignments & Gates]
             │           │
             │           ▼ (Zero-Time δ Loop)
             ├──► [Inactive Queue: #0 Procedural Delays]
             │           │
             │           ▼
             ├──► [NBA Queue: Non-Blocking Assignments (<=)]
             │           │
             │           ▼ (State Commit)
             └──► [Postponed Queue: $monitor & Waveform Strobe]
                         │
                         ▼
             [Next Simulation Time Step (t = t₀ + Δt)]`,
      benchmarks: [
        { label: "Signal Transitions", value: "14.8M", unit: "events/s", baseline: "1.2M Icarus Verilog" },
        { label: "Delta Cycle Step Latency", value: "68", unit: "ns / δ-cycle", baseline: "Uninspectable" },
        { label: "Peak Memory Consumption", value: "32", unit: "MB heap", baseline: "2.4 GB ModelSim" },
        { label: "Race Condition Visibility", value: "100", unit: "% zero-time traps", baseline: "Silent corruption" }
      ],
      tradeOffs: "Unlike 2-state compiled simulators that coerce unknown states to zero, Axiom preserves strict 4-state IEEE semantics (0, 1, X, Z) using SIMD bit-split registers (Value and Mask vectors) while maintaining 14.8M transitions/s throughput.",
      codeSnippet: {
        language: "rust",
        filename: "kernel_delta_step.rs",
        code: `// Axiom Discrete-Event Kernel Step API
use axiom_core::kernel::{SimulationKernel, StepResult, TimeSlot};

pub fn step_simulation_delta(kernel: &mut SimulationKernel) -> StepResult {
    // Process discrete zero-time delta cycle without advancing simulation time
    let events_evaluated = kernel.eval_active_delta_queue()?;
    kernel.commit_nonblocking_assignments()?;

    StepResult {
        current_time_fs: kernel.current_time(),
        delta_cycle_index: kernel.current_delta(),
        events_processed: events_evaluated,
    }
}`
      },
      stack: ["Safe Rust", "Bit-Parallel Logic", "Stratified Queue", "Delta Stepper"]
    }
  },
  {
    id: "static-timing",
    name: "Static Timing Analysis (STA)",
    tierLabel: "Tier 2 // Timing Engine",
    category: "Static Timing & Slack Engine",
    tagline: "Graph-based setup/hold static timing analysis and critical path extraction",
    status: "PICOSECOND SLACK",
    statusTone: "amber",
    metric: "<12 PS RESOLUTION",
    metricDetail: "Topological DAG timing traversal with cell delay and interconnect RC models",
    description: "Real-time static timing analyzer computing worst-case arrival times, required times, and timing slack across all register-to-register paths. Identifies setup and hold violations without running test vectors.",
    highlights: [
      "Topological Directed Acyclic Graph (DAG) critical path extraction",
      "Liberty (.lib) lookup table interpolation for cell propagation delays",
      "Elmore RC interconnect delay modeling with parasitic extraction",
      "Interactive slack histogram with live critical path net highlighting"
    ],
    docLink: "/ui/timing-radar",
    architectureDetails: {
      pipelineAscii: `[Synthesized Netlist Graph (DAG)]  [Liberty .lib & SDC Constraints]
               │                                │
               └───────────────┬────────────────┘
                               ▼
            [Topological Breadth-First Sorter]
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [Forward Arrival Time (AT)]    [Backward Required Time (RT)]
               │                               │
               └───────────────┬───────────────┘
                               ▼
               [Slack Calculation: S = RT - AT]
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [Setup Slack (T_clk - T_cq)]    [Hold Slack (T_cq - T_hold)]`,
      benchmarks: [
        { label: "Timing Graph Traversal", value: "3.4", unit: "ms / 100k gates", baseline: "18.2 s Vivado report_timing" },
        { label: "Slack Calculation Precision", value: "<12", unit: "picoseconds", baseline: "100 ps standard" },
        { label: "Liberty Interpolation", value: "1.2M", unit: "lookups/sec", baseline: "80k OpenSTA" },
        { label: "Critical Path Extracted", value: "Top 500", unit: "paths sorted", baseline: "Top 10 default" }
      ],
      tradeOffs: "Axiom integrates incremental STA directly into the in-memory netlist, enabling real-time slack calculation as designers edit code, rather than requiring an offline 5-minute synthesis run.",
      codeSnippet: {
        language: "rust",
        filename: "timing_analyzer.rs",
        code: `// Axiom Incremental Static Timing Analyzer
use axiom_sta::{TimingGraph, LibertyLibrary, SdcConstraints};

pub fn analyze_critical_paths(graph: &TimingGraph, lib: &LibertyLibrary, sdc: &SdcConstraints) {
    let arrival_times = graph.compute_forward_arrival(lib);
    let required_times = graph.compute_backward_required(sdc);
    let slack_report = graph.calculate_slack(&arrival_times, &required_times);

    assert!(slack_report.worst_negative_slack_ps >= 0, "Timing violation detected!");
}`
      },
      stack: ["Rust", "Liberty .lib Parser", "SDC Engine", "Elmore RC", "DAG Traversal"]
    }
  },
  {
    id: "waveform-tracing",
    name: "VCD/FST Waveform Tracing",
    tierLabel: "Tier 2 // Telemetry Engine",
    category: "Signal Serialization",
    tagline: "High-bandwidth zero-copy waveform recording and interactive canvas scrubbing",
    status: "ZERO-COPY BUFFER",
    statusTone: "cyan",
    metric: "840 MB/S STREAM",
    metricDetail: "Lock-free shared memory ring buffer streaming to IEEE 1364 VCD and FST",
    description: "In-memory circular telemetry stream logging millions of signal transitions with sub-nanosecond timestamp resolution. Powers high-density canvas waveform scrubbing with instant seek.",
    highlights: [
      "Lock-free POSIX shared memory ring buffer with zero serialization copies",
      "IEEE 1364 VCD and compact Fast Signal Trace (FST) output drivers",
      "Virtualized WebGL/Canvas rendering viewport with 60+ FPS zoom and pan",
      "Real-time bus protocol decoding for AXI4, SPI, UART, and I2C"
    ],
    docLink: "/ui/waveform-viewer",
    architectureDetails: {
      pipelineAscii: `[Stratified Event Evaluator Core]
               │
               ▼ (Zero-Copy Pointer Emit)
[POSIX SHM Seqlock Ring Buffer]
               │
       ┌───────┴───────┐
       ▼               ▼
[FST Stream Engine] [Canvas 60 FPS Viewport]
       │               │
       ▼               ▼
[Disk / Dev SHM]    [Instant Sub-ns Scrubbing]`,
      benchmarks: [
        { label: "Waveform Stream Bandwidth", value: "840", unit: "MB/sec in-RAM", baseline: "45 MB/s disk VCD" },
        { label: "FST Compression Ratio", value: "18.4x", unit: "vs uncompressed VCD", baseline: "1.0x raw" },
        { label: "Canvas Viewport Scrub", value: "60", unit: "FPS locked", baseline: "12 FPS GTKWave" },
        { label: "Trace Depth Capacity", value: "2.0B", unit: "transitions ring", baseline: "100M disk limit" }
      ],
      tradeOffs: "Traditional VCD dumps serialize ASCII characters to magnetic disk or SSD, causing massive I/O stalls during simulation. Axiom writes packed binary delta packets directly into an in-RAM Seqlock buffer, streaming to the browser canvas without blocking CPU worker threads.",
      codeSnippet: {
        language: "rust",
        filename: "shm_trace_writer.rs",
        code: `// Axiom In-RAM Waveform Streamer
use axiom_trace::{ShmRingBuffer, FstWriter, SignalChange};

pub fn record_transition(shm: &mut ShmRingBuffer, signal_id: u32, timestamp_fs: u64, new_val: u64) {
    let packet = SignalChange::new(signal_id, timestamp_fs, new_val);
    shm.push_nonblocking(&packet);
}`
      },
      stack: ["Rust", "POSIX SHM", "FST 2.0", "IEEE 1364 VCD", "Canvas 2D/WebGL"]
    }
  },
  {
    id: "silicon-studio",
    name: "Interactive Silicon Studio",
    tierLabel: "Tier 3 // Cockpit Suite",
    category: "EDA Graphical Workstation",
    tagline: "Comprehensive silicon engineering cockpit in browser and desktop",
    status: "WASM & TAURI 2.0",
    statusTone: "primary",
    metric: "60 FPS VIEWPORT",
    metricDetail: "Hardware-accelerated schematic rendering and live hardware-in-the-loop virtual lab",
    description: "Modern EDA graphical workbench featuring Monaco HDL editor with LSP, interactive netlist schematic viewer, virtual FPGA development board (Basys 3 / Nexys A7), and live analog power telemetry.",
    highlights: [
      "Full-featured Monaco editor with Verilog/SystemVerilog LSP diagnostics",
      "Hierarchical SVG/Canvas schematic graph extraction with net highlighting",
      "Virtual FPGA lab with interactive switches, seven-segment displays, and LEDs",
      "Cross-platform deployment via Tauri 2.0 native binary and WASM web app"
    ],
    docLink: "/ui/overview",
    architectureDetails: {
      pipelineAscii: `[Monaco Editor + HDL LSP]
            │
            ▼ (Incremental Parse)
[In-Browser WASM Kernel & JIT Host]
            │
    ┌───────┴───────────────────────┐
    ▼                               ▼
[Interactive Schematic View] [Virtual FPGA Lab View]
    │                               │
    ▼                               ▼
[SVG Netlist Inspector]      [Switches, 7-Seg, LEDs]`,
      benchmarks: [
        { label: "Schematic Render FPS", value: "60", unit: "FPS WebGL/SVG", baseline: "Static PNG Vivado" },
        { label: "WASM Bundle Footprint", value: "4.8", unit: "MB compiled", baseline: "100 GB Vivado Monolith" },
        { label: "LSP Diagnostic Latency", value: "<16", unit: "ms keystroke", baseline: "1,200 ms eclipse" },
        { label: "Virtual Lab Refresh", value: "100", unit: "Hz display sync", baseline: "N/A" }
      ],
      tradeOffs: "Unlike closed-source vendor tools requiring 100 GB installations on RedHat Linux, Axiom Silicon Studio operates both as an ultra-lean <50 MB native desktop app (Tauri 2.0) and a zero-install browser environment using WebAssembly.",
      codeSnippet: {
        language: "typescript",
        filename: "VirtualLabController.ts",
        code: `// Axiom Silicon Studio Virtual FPGA Lab Bindings
import { VirtualBasys3, AxiomWasmSim } from "@aerovex/axiom-studio";

const lab = new VirtualBasys3("#virtual-fpga-canvas");
const sim = await AxiomWasmSim.loadDesign("cpu_core.v");

lab.onSwitchToggle((swIndex, state) => {
    sim.setPinState(\`sw[\${swIndex}]\`, state);
    sim.stepCycle();
    lab.updateSevenSegment(sim.getBusState("seg[6:0]"));
});`
      },
      stack: ["React 19", "Tauri 2.0", "WebAssembly", "Monaco Editor", "WebGL"]
    }
  }
];

const ECOSYSTEM_LINKS = [
  {
    name: "Aerovex Platform",
    category: "Central Intelligence & Simulation",
    desc: "Unified operations portal, multi-world physics & fleet management",
    url: "https://aerovex.net",
    slug: "aerovex.net"
  },
  {
    name: "Axiom",
    category: "Silicon HDL & JIT",
    desc: "In-RAM Verilog/SystemVerilog simulator & Cranelift JIT",
    url: "https://axiom.aerovex.net",
    slug: "axiom",
    isActive: true
  },
  {
    name: "Phonon",
    category: "Semiconductor TCAD",
    desc: "Universal electro-thermal SPICE & 4.2K Cryo-CMOS simulator",
    url: "https://phonon.aerovex.net",
    slug: "phonon"
  },
  {
    name: "Atoma",
    category: "Quantum & Molecular CAD",
    desc: "3D atomistic studio, 14 Bravais lattices & Dirac cones",
    url: "https://atoma.aerovex.net",
    slug: "atoma"
  },
  {
    name: "Sonon",
    category: "Acoustic DSP",
    desc: "Rotor noise notch filtering (>86 dB) & articulatory speech",
    url: "https://sonon.aerovex.net",
    slug: "sonon"
  },
  {
    name: "Vexel Language",
    category: "Systems Compiler",
    desc: "Statically-typed language with LLVM 18 & non-lexical lifetimes",
    url: "https://vexel.aerovex.net",
    slug: "vexel"
  },
  {
    name: "Appify",
    category: "Desktop Bundler",
    desc: "Modern web-to-native desktop application bundler (Tauri 2.0)",
    url: "https://appify.aerovex.net",
    slug: "appify"
  }
];

const BENCHMARKS_MATRIX = [
  {
    metric: "End-to-End Compilation Turnaround",
    axiom: "2.81 ms (In-RAM JIT)",
    verilator: "34.8 s (GCC -O3)",
    vcs: "42.5 s (VCS Elab)",
    xcelium: "48.2 s (Xcelium)",
    highlight: true
  },
  {
    metric: "Simulation Event Throughput",
    axiom: "14.8M transitions/s",
    verilator: "18.2M trans/s (2-State)",
    vcs: "12.5M trans/s",
    xcelium: "11.8M trans/s",
    highlight: false
  },
  {
    metric: "Logic State Representation",
    axiom: "Full 4-State (0, 1, X, Z)",
    verilator: "2-State Only (Coerces X/Z)",
    vcs: "Full 4-State",
    xcelium: "Full 4-State",
    highlight: true
  },
  {
    metric: "Zero-Time Delta Introspection",
    axiom: "Discrete delta-stepping API",
    verilator: "Black-box zero-time collapse",
    vcs: "Limited batching",
    xcelium: "Limited batching",
    highlight: true
  },
  {
    metric: "Intermediate Disk Writes",
    axiom: "0 Bytes (100% In-RAM)",
    verilator: "450 MB (C++ Object Files)",
    vcs: "1.2 GB (Binary Snapshots)",
    xcelium: "1.8 GB (Snapshots)",
    highlight: true
  },
  {
    metric: "Dynamic Physical Power Telemetry",
    axiom: "Real-time P = 0.5·C·V²·f·α + PDN Droop",
    verilator: "None (Static post-sim)",
    vcs: "Offline SAIF File Dump",
    xcelium: "Offline SAIF File Dump",
    highlight: true
  },
  {
    metric: "Peak Memory Consumption",
    axiom: "32 MB (In-Memory Ring)",
    verilator: "380 MB",
    vcs: "2.4 GB",
    xcelium: "3.1 GB",
    highlight: false
  },
  {
    metric: "Interactive Graphical Studio",
    axiom: "Built-in 60 FPS WebGL / WASM",
    verilator: "External GTKWave Only",
    vcs: "Commercial X11 Suite",
    xcelium: "Commercial X11 Suite",
    highlight: false
  },
  {
    metric: "Installation Package Footprint",
    axiom: "<50 MB Standalone Native Binary",
    verilator: "~120 MB + GCC Toolchain",
    vcs: "45+ GB Monolithic Suite",
    xcelium: "65+ GB Monolithic Suite",
    highlight: true
  }
];

const PIPELINE_TABS = [
  {
    key: "verilog",
    label: "Verilog Source",
    filename: "dsp_accumulator.v",
    code: `// IEEE 1364 Verilog Accumulator with Saturation
module dsp_accumulator #(
    parameter integer WIDTH = 32
) (
    input  wire                 clk,
    input  wire                 rst_n,
    input  wire                 valid_in,
    input  wire [WIDTH-1:0]     data_in,
    output reg  [WIDTH-1:0]     acc_out,
    output reg                  overflow
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            acc_out  <= {WIDTH{1'b0}};
            overflow <= 1'b0;
        end else if (valid_in) begin
            {overflow, acc_out} <= acc_out + data_in;
        end
    end
endmodule`
  },
  {
    key: "hir",
    label: "Axiom Netlist IR",
    filename: "dsp_accumulator.air",
    code: `;; Axiom High-Level Netlist Intermediate Representation (HIR)
module @dsp_accumulator<WIDTH: i32 = 32> {
  sig %clk : bit [input, clk_domain(clk_0)]
  sig %rst_n : bit [input, async_reset]
  sig %valid_in : bit [input]
  sig %data_in : bit[32] [input]
  sig %acc_out : bit[32] [output, reg]
  sig %overflow : bit [output, reg]

  block @always_ff_0 sensitivity(posedge %clk, negedge %rst_n) {
    br_if (not %rst_n) @reset_path, @active_path

  @reset_path:
    store %acc_out, 32'h00000000
    store %overflow, 1'b0
    ret

  @active_path:
    br_if %valid_in @eval_add, @idle

  @eval_add:
    %sum = add_extended.33 %acc_out, %data_in
    nba %acc_out, %sum[31:0]
    nba %overflow, %sum[32]
    ret

  @idle:
    ret
  }
}`
  },
  {
    key: "rust",
    label: "Rust Driver API",
    filename: "sim_driver.rs",
    code: `//! Axiom In-RAM HDL Simulation Execution Driver
use axiom_core::{SimulatorBuilder, SignalValue, TimeUnits};

fn main() -> Result<(), Box<dyn std.error::Error>> {
    // Instantiate in-memory simulator with Cranelift JIT backend
    let mut sim = SimulatorBuilder::new()
        .load_verilog("dsp_accumulator.v")?
        .top_module("dsp_accumulator")
        .timescale(1, TimeUnits::Nanoseconds)
        .enable_shm_ring_buffer("/dev/shm/axiom_trace_0")
        .build_jit()?;

    // Reset sequence with delta-cycle verification
    sim.set_wire("rst_n", SignalValue::Zero)?;
    sim.step_delta()?;
    sim.set_wire("rst_n", SignalValue::One)?;

    // Stream 100,000 clock pulses at 100 MHz
    for cycle in 0..100_000 {
        sim.step_clock("clk", 10 /* ns period */)?;
    }

    println!("Simulation finished cleanly. Transitions: {}", sim.transition_count());
    Ok(())
}`
  }
];

const ecosystemOpen = ref(false);
const mobileMenuOpen = ref(false);
const selectedSubsystem = ref<Subsystem | null>(null);
const activeFilter = ref<string>("all");
const activePipelineTab = ref<string>("verilog");
const copiedCode = ref<boolean>(false);
const installTab = ref<"bash" | "powershell">("bash");
const copiedInstall = ref<boolean>(false);

const filteredSubsystems = computed(() => {
  if (activeFilter.value === "all") return SUBSYSTEMS;
  if (activeFilter.value === "engine") {
    return SUBSYSTEMS.filter(s => s.tierLabel.includes("Tier 1"));
  }
  if (activeFilter.value === "telemetry") {
    return SUBSYSTEMS.filter(s => s.tierLabel.includes("Tier 2"));
  }
  if (activeFilter.value === "cockpit") {
    return SUBSYSTEMS.filter(s => s.tierLabel.includes("Tier 3"));
  }
  return SUBSYSTEMS;
});

const activePipelineContent = computed(() => {
  return PIPELINE_TABS.find(t => t.key === activePipelineTab.value) || PIPELINE_TABS[0];
});

function handleCardMouseMove(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement | null;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  target.style.setProperty("--mouse-x", `${x}px`);
  target.style.setProperty("--mouse-y", `${y}px`);
  target.style.setProperty("--spotlight-opacity", "1");
}

function handleCardMouseLeave(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement | null;
  if (!target) return;
  target.style.setProperty("--spotlight-opacity", "0");
}

function openArchitectureModal(subsystem: Subsystem) {
  selectedSubsystem.value = subsystem;
  if (typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
  }
}

function closeArchitectureModal() {
  selectedSubsystem.value = null;
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}

function copyModalCode() {
  if (!selectedSubsystem.value) return;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(selectedSubsystem.value.architectureDetails.codeSnippet.code);
    copiedCode.value = true;
    setTimeout(() => { copiedCode.value = false; }, 2000);
  }
}

function copyPipelineCode() {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(activePipelineContent.value.code);
    copiedCode.value = true;
    setTimeout(() => { copiedCode.value = false; }, 2000);
  }
}

function copyInstallCommand(cmd: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(cmd);
    copiedInstall.value = true;
    setTimeout(() => { copiedInstall.value = false; }, 2000);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (selectedSubsystem.value) {
      closeArchitectureModal();
    }
    if (ecosystemOpen.value) {
      ecosystemOpen.value = false;
    }
    if (mobileMenuOpen.value) {
      mobileMenuOpen.value = false;
    }
  }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleKeyDown);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  }
});
</script>

<template>
  <div class="nx-landing-root">
    <!-- Ambient Canvas Glow & Micro-Grid -->
    <div class="nx-ambient-glow" aria-hidden="true"></div>

    <!-- Fixed Blur Navbar -->
    <header class="nx-fixed-navbar">
      <div class="nx-nav-container">
        <!-- Brand Mark -->
        <a href="/" class="nx-nav-brand">
          <img src="/logo.svg" alt="Axiom" class="nx-brand-logo-img" />
          <span class="nx-brand-text">Axiom<span class="nx-brand-dot">.</span></span>
          <span class="nx-brand-pill">IN-RAM HDL</span>
          <span class="nx-telemetry-dot" title="Telemetry Synchronized: 400 Hz"></span>
        </a>

        <!-- Desktop Navigation Items -->
        <nav class="nx-nav-links">
          <!-- Ecosystem Dropdown -->
          <div class="nx-ecosystem-wrap">
            <button
              type="button"
              class="nx-ecosystem-btn"
              :class="{ 'nx-ecosystem-btn-open': ecosystemOpen }"
              @click="ecosystemOpen = !ecosystemOpen"
              aria-haspopup="true"
              :aria-expanded="ecosystemOpen"
            >
              <span>Ecosystem</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="nx-chevron" :class="{ 'nx-chevron-up': ecosystemOpen }">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <!-- Dropdown Panel -->
            <transition name="nx-drop-fade">
              <div v-if="ecosystemOpen" class="nx-ecosystem-panel" @click.stop>
                <div class="nx-ecosystem-panel-header">
                  <span class="nx-ecosystem-panel-title">Aerovex Architecture</span>
                  <span class="nx-ecosystem-panel-domain">*.aerovex.net</span>
                </div>
                <div class="nx-ecosystem-list">
                  <a
                    v-for="item in ECOSYSTEM_LINKS"
                    :key="item.slug"
                    :href="item.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="nx-ecosystem-item"
                    :class="{ 'nx-ecosystem-item-active': item.isActive }"
                    @click="ecosystemOpen = false"
                  >
                    <div class="nx-ecosystem-item-info">
                      <div class="nx-ecosystem-item-title-row">
                        <span class="nx-ecosystem-item-name">{{ item.name }}</span>
                        <span v-if="item.isActive" class="nx-ecosystem-active-tag">Active</span>
                        <span v-else class="nx-ecosystem-cat-tag">{{ item.category }}</span>
                      </div>
                      <div class="nx-ecosystem-item-desc">{{ item.desc }}</div>
                    </div>
                    <div class="nx-ecosystem-slug-pill">
                      <span>{{ item.slug }}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>
                  </a>
                </div>
              </div>
            </transition>
          </div>

          <a href="#subsystems" class="nx-nav-link">Subsystems</a>
          <a href="#pipeline" class="nx-nav-link">Pipeline</a>
          <a href="#benchmarks" class="nx-nav-link">Benchmarks</a>
          <a href="#releases" class="nx-nav-link">Install</a>
        </nav>

        <!-- Right Action CTAs -->
        <div class="nx-nav-actions">
          <a href="/studio/" target="_blank" rel="noopener noreferrer" class="nx-btn-studio">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Launch Studio</span>
          </a>
          <a href="/guide/quickstart" class="nx-btn-docs">
            <span>Docs</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          <!-- Mobile Hamburger Button -->
          <button
            type="button"
            class="nx-hamburger-btn"
            @click="mobileMenuOpen = !mobileMenuOpen"
            aria-label="Toggle Navigation Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div v-if="mobileMenuOpen" class="nx-mobile-menu">
        <a href="#subsystems" class="nx-mobile-link" @click="mobileMenuOpen = false">Subsystems</a>
        <a href="#pipeline" class="nx-mobile-link" @click="mobileMenuOpen = false">Pipeline</a>
        <a href="#benchmarks" class="nx-mobile-link" @click="mobileMenuOpen = false">Benchmarks</a>
        <a href="#releases" class="nx-mobile-link" @click="mobileMenuOpen = false">Installation</a>
        <a href="/guide/quickstart" class="nx-mobile-link" @click="mobileMenuOpen = false">Documentation</a>
        <a href="/studio/" target="_blank" rel="noopener noreferrer" class="nx-mobile-link nx-mobile-link-accent" @click="mobileMenuOpen = false">Launch Web Studio</a>
      </div>
    </header>

    <!-- HERO SECTION -->
    <section class="nx-hero-section">
      <div class="nx-hero-grid">
        <div class="nx-hero-lead-col">
          <!-- Live Status Badge -->
          <div class="nx-hero-status-badge">
            <span class="nx-status-pulse"></span>
            <span>HIGH-PERFORMANCE IN-RAM HDL SIMULATOR</span>
          </div>

          <!-- Headline -->
          <h1 class="nx-hero-headline">
            Cycle-Accurate Silicon Simulation at the
            <span class="nx-headline-accent">Speed of Memory.</span>
          </h1>

          <!-- Elevator Pitch -->
          <p class="nx-hero-pitch">
            High-throughput SystemVerilog 2017 and IEEE 1364 Verilog simulation engine in pure Rust. Compiles HDL AST directly into bare-metal Cranelift machine instructions in RAM, eliminating disk compilation bottlenecks, providing discrete zero-time delta cycle stepping, and real-time physical power telemetry.
          </p>

          <!-- Primary CTAs -->
          <div class="nx-hero-ctas">
            <a href="/guide/quickstart" class="nx-hero-btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>Explore Documentation</span>
            </a>

            <a href="/studio/" target="_blank" rel="noopener noreferrer" class="nx-hero-btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Launch Web Studio</span>
            </a>

            <a href="#subsystems" class="nx-hero-btn-ghost">
              <span>Inspect Architecture</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>

          <!-- Live Empirical Metrics Ticker -->
          <div class="nx-hero-ticker">
            <div class="nx-ticker-item">
              <span class="nx-ticker-val">2.81ms JIT compile</span>
              <span class="nx-ticker-lbl">Sub-millisecond elaboration</span>
            </div>
            <div class="nx-ticker-item">
              <span class="nx-ticker-val">14.8M transitions/s</span>
              <span class="nx-ticker-lbl">Cycle-accurate throughput</span>
            </div>
            <div class="nx-ticker-item">
              <span class="nx-ticker-val">0 byte disk writes</span>
              <span class="nx-ticker-lbl">100% In-memory execution</span>
            </div>
            <div class="nx-ticker-item">
              <span class="nx-ticker-val">100% SV 2017 core</span>
              <span class="nx-ticker-lbl">IEEE standard conformance</span>
            </div>
          </div>
        </div>

        <!-- Hardware Frame Simulation Viewport -->
        <div class="nx-hero-viewport-frame">
          <div class="nx-frame-topbar">
            <div class="nx-frame-dots">
              <span class="nx-dot nx-dot-red"></span>
              <span class="nx-dot nx-dot-yellow"></span>
              <span class="nx-dot nx-dot-green"></span>
            </div>
            <div class="nx-frame-title">
              AXIOM IN-RAM SIMULATOR // CRANELIFT JIT ENGINE
            </div>
            <div class="nx-frame-telemetry">
              <span class="nx-telemetry-dot"></span>
              <span>14.8M TRANSITIONS/S LOCK</span>
            </div>
          </div>

          <div class="nx-frame-body">
            <!-- Simulated Signal Waveform Monitor -->
            <div class="nx-sim-monitor">
              <div class="nx-monitor-header">
                <span class="nx-monitor-tag">SIMULATION TIME: 428.500 ns</span>
                <span class="nx-monitor-status">DELTA_CYCLE = 0 (STABLE)</span>
              </div>

              <!-- Signal Rows -->
              <div class="nx-signals-stream">
                <div class="nx-signal-row">
                  <span class="nx-sig-name">clk_100mhz</span>
                  <div class="nx-sig-wave">
                    <svg class="nx-sig-svg" viewBox="0 0 380 18" fill="none">
                      <path d="M0 16 H20 V2 H40 V16 H60 V2 H80 V16 H100 V2 H120 V16 H140 V2 H160 V16 H180 V2 H200 V16 H220 V2 H240 V16 H260 V2 H280 V16 H300 V2 H320 V16 H340 V2 H360 V16 H380" stroke="#38bdf8" stroke-width="1.8" />
                    </svg>
                  </div>
                  <span class="nx-sig-state nx-sig-cyan">100 MHz</span>
                </div>

                <div class="nx-signal-row">
                  <span class="nx-sig-name">rst_n</span>
                  <div class="nx-sig-wave">
                    <svg class="nx-sig-svg" viewBox="0 0 380 18" fill="none">
                      <path d="M0 16 H30 V2 H380" stroke="#10b981" stroke-width="1.8" />
                    </svg>
                  </div>
                  <span class="nx-sig-state nx-sig-emerald">1'b1</span>
                </div>

                <div class="nx-signal-row">
                  <span class="nx-sig-name">instruction_pc[31:0]</span>
                  <div class="nx-sig-wave">
                    <div class="nx-bus-bar">
                      <span class="nx-bus-segment">0x0040_0180</span>
                      <span class="nx-bus-segment">0x0040_0184</span>
                      <span class="nx-bus-segment">0x0040_0188</span>
                    </div>
                  </div>
                  <span class="nx-sig-state nx-sig-amber">RV64GC</span>
                </div>

                <div class="nx-signal-row">
                  <span class="nx-sig-name">alu_result[63:0]</span>
                  <div class="nx-sig-wave">
                    <div class="nx-bus-bar">
                      <span class="nx-bus-segment">0x0000_0000</span>
                      <span class="nx-bus-segment">0xDEAD_BEEF</span>
                      <span class="nx-bus-segment">0xCAFE_0001</span>
                    </div>
                  </div>
                  <span class="nx-sig-state nx-sig-lavender">64-BIT</span>
                </div>

                <div class="nx-signal-row">
                  <span class="nx-sig-name">delta_glitch_detect</span>
                  <div class="nx-sig-wave">
                    <svg class="nx-sig-svg" viewBox="0 0 380 18" fill="none">
                      <path d="M0 16 H380" stroke="#10b981" stroke-width="1.8" />
                    </svg>
                  </div>
                  <span class="nx-sig-state nx-sig-emerald">0 RACES</span>
                </div>

                <div class="nx-signal-row">
                  <span class="nx-sig-name">pdn_power_telemetry</span>
                  <div class="nx-sig-wave">
                    <div class="nx-power-graph-bar">
                      <div class="nx-power-level" style="width: 48%;"></div>
                    </div>
                  </div>
                  <span class="nx-sig-state nx-sig-amber">14.2 mW</span>
                </div>
              </div>

              <!-- Viewport Footer HUD Pills -->
              <div class="nx-viewport-hud">
                <span class="nx-hud-pill nx-hud-pill-active">CRANELIFT JIT // 2.81 MS</span>
                <span class="nx-hud-pill">DELTA-STEP INTROSPECTION</span>
                <span class="nx-hud-pill nx-hud-pill-active">POSIX SHM RING-BUFFER</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- BENTO GRID SECTION (5 SUBSYSTEM CARDS) -->
    <section id="subsystems" class="nx-section nx-bento-section">
      <div class="nx-section-header">
        <div class="nx-section-eyebrow">01 // HARDWARE ARCHITECTURE SUBSYSTEMS</div>
        <h2 class="nx-section-title">Engineered for Zero-Overhead Silicon Simulation</h2>
        <p class="nx-section-lead">
          Five deeply decoupled subsystems engineered in safe Rust, Cranelift JIT, and lock-free memory architectures for deterministic EDA workflows.
        </p>

        <!-- Domain Filter Bar -->
        <div class="nx-filter-bar">
          <button
            type="button"
            class="nx-filter-tab"
            :class="{ 'nx-filter-tab-active': activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            <span>All Subsystems</span>
            <span class="nx-filter-count">5</span>
          </button>
          <button
            type="button"
            class="nx-filter-tab"
            :class="{ 'nx-filter-tab-active': activeFilter === 'engine' }"
            @click="activeFilter = 'engine'"
          >
            <span>Core Engines</span>
            <span class="nx-filter-count">2</span>
          </button>
          <button
            type="button"
            class="nx-filter-tab"
            :class="{ 'nx-filter-tab-active': activeFilter === 'telemetry' }"
            @click="activeFilter = 'telemetry'"
          >
            <span>Timing &amp; Telemetry</span>
            <span class="nx-filter-count">2</span>
          </button>
          <button
            type="button"
            class="nx-filter-tab"
            :class="{ 'nx-filter-tab-active': activeFilter === 'cockpit' }"
            @click="activeFilter = 'cockpit'"
          >
            <span>Cockpit Suite</span>
            <span class="nx-filter-count">1</span>
          </button>
        </div>
      </div>

      <!-- 2-Column Balanced Bento Grid with Radial Mouse-Tracking Spotlight -->
      <div class="nx-bento-grid-2col">
        <div
          v-for="sub in filteredSubsystems"
          :key="sub.id"
          class="nx-spotlight-card nx-bento-card"
          :class="{ 'nx-bento-card-wide': sub.id === 'silicon-studio' }"
          @mousemove="handleCardMouseMove"
          @mouseleave="handleCardMouseLeave"
        >
          <!-- Card Header -->
          <div class="nx-card-header">
            <div class="nx-card-meta">
              <span class="nx-card-tier">{{ sub.tierLabel }}</span>
              <span class="nx-card-category">{{ sub.category }}</span>
            </div>
            <div class="nx-card-status" :class="`nx-status-${sub.statusTone}`">
              <span class="nx-status-dot"></span>
              <span>{{ sub.status }}</span>
            </div>
          </div>

          <!-- Card Body -->
          <div class="nx-card-body">
            <h3 class="nx-card-name">{{ sub.name }}</h3>
            <p class="nx-card-tagline">{{ sub.tagline }}</p>

            <!-- Empirical Benchmark Metric Well -->
            <div class="nx-card-metric-box">
              <div class="nx-metric-number">{{ sub.metric }}</div>
              <div class="nx-metric-detail">{{ sub.metricDetail }}</div>
            </div>

            <p class="nx-card-desc">{{ sub.description }}</p>

            <!-- Highlights List -->
            <ul class="nx-card-highlights">
              <li v-for="(hl, idx) in sub.highlights" :key="idx" class="nx-highlight-item">
                <span class="nx-hl-bullet"></span>
                <span>{{ hl }}</span>
              </li>
            </ul>
          </div>

          <!-- Card Footer -->
          <div class="nx-card-footer">
            <button
              type="button"
              class="nx-btn-inspect"
              @click="openArchitectureModal(sub)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Inspect Architecture</span>
            </button>

            <a :href="sub.docLink" class="nx-btn-doclink">
              <span>Documentation</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ARCHITECTURE & PIPELINE SHOWCASE SECTION -->
    <section id="pipeline" class="nx-section nx-pipeline-section">
      <div class="nx-section-header">
        <div class="nx-section-eyebrow">02 // DATAFLOW &amp; EXECUTION PIPELINE</div>
        <h2 class="nx-section-title">From Verilog AST to Direct CPU Execution</h2>
        <p class="nx-section-lead">
          Axiom completely eliminates GCC/Clang recompilation cycles by implementing a unified four-stage pipeline direct to memory.
        </p>
      </div>

      <!-- 4-Stage Visual Execution Pipeline -->
      <div class="nx-pipeline-stages-grid">
        <div class="nx-stage-card">
          <div class="nx-stage-number">01</div>
          <div class="nx-stage-title">HDL AST &amp; Elaboration</div>
          <div class="nx-stage-desc">
            Zero-allocation parser ingesting IEEE 1364 Verilog and SystemVerilog 2017 constructs into an annotated Abstract Syntax Tree in sub-millisecond time.
          </div>
          <div class="nx-stage-tag">AST Parser // &lt;0.5 ms</div>
        </div>

        <div class="nx-stage-card">
          <div class="nx-stage-number">02</div>
          <div class="nx-stage-title">Netlist IR &amp; Stratification</div>
          <div class="nx-stage-desc">
            Lowers AST into a flattened hierarchical DAG. Partitions combinational and sequential evaluations into stratified Active, Inactive, and NBA queues.
          </div>
          <div class="nx-stage-tag">Stratified Graph // Zero-Copy</div>
        </div>

        <div class="nx-stage-card">
          <div class="nx-stage-number">03</div>
          <div class="nx-stage-title">Cranelift JIT Lowering</div>
          <div class="nx-stage-desc">
            Translates Axiom HIR directly into Cranelift Single Static Assignment (SSA) blocks, emitting native x86-64 and AArch64 binary code in RAM.
          </div>
          <div class="nx-stage-tag">Cranelift SSA // 2.81 ms</div>
        </div>

        <div class="nx-stage-card">
          <div class="nx-stage-number">04</div>
          <div class="nx-stage-title">In-RAM Execution &amp; Telemetry</div>
          <div class="nx-stage-desc">
            Direct CPU execution at 14.8M transitions/s. Pushes binary delta packets to lock-free POSIX shared memory Seqlock buffers for 60 FPS viewport rendering.
          </div>
          <div class="nx-stage-tag">14.8M trans/s // POSIX SHM</div>
        </div>
      </div>

      <!-- Interactive Code Showcase Tabs -->
      <div class="nx-code-showcase-box">
        <div class="nx-code-topbar">
          <div class="nx-code-tabs">
            <button
              v-for="tab in PIPELINE_TABS"
              :key="tab.key"
              type="button"
              class="nx-code-tab"
              :class="{ 'nx-code-tab-active': activePipelineTab === tab.key }"
              @click="activePipelineTab = tab.key"
            >
              <span>{{ tab.label }}</span>
            </button>
          </div>

          <div class="nx-code-actions">
            <span class="nx-code-filename">{{ activePipelineContent.filename }}</span>
            <button type="button" class="nx-copy-btn" @click="copyPipelineCode">
              <svg v-if="!copiedCode" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{{ copiedCode ? 'Copied' : 'Copy Code' }}</span>
            </button>
          </div>
        </div>

        <pre class="nx-code-viewport"><code>{{ activePipelineContent.code }}</code></pre>
      </div>
    </section>

    <!-- BENCHMARK COMPARISON MATRIX TABLE SECTION -->
    <section id="benchmarks" class="nx-section nx-matrix-section">
      <div class="nx-section-header">
        <div class="nx-section-eyebrow">03 // EMPIRICAL BENCHMARKS</div>
        <h2 class="nx-section-title">Axiom vs. Industry Standard Simulators</h2>
        <p class="nx-section-lead">
          Head-to-head empirical matrix comparing compilation latency, event throughput, memory footprint, and interactive debugging against legacy EDA suites.
        </p>
      </div>

      <div class="nx-matrix-table-wrap">
        <table class="nx-matrix-table">
          <thead>
            <tr>
              <th class="nx-th-metric">Benchmark &amp; Capability</th>
              <th class="nx-th-axiom">
                <div class="nx-axiom-header-cell">
                  <span class="nx-telemetry-dot"></span>
                  <span>Axiom EDA</span>
                </div>
              </th>
              <th>Verilator 5.028</th>
              <th>Synopsys VCS 2023</th>
              <th>Cadence Xcelium 23</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in BENCHMARKS_MATRIX"
              :key="idx"
              :class="{ 'nx-row-highlight': row.highlight }"
            >
              <td class="nx-td-metric">{{ row.metric }}</td>
              <td class="nx-td-axiom">{{ row.axiom }}</td>
              <td class="nx-td-std">{{ row.verilator }}</td>
              <td class="nx-td-std">{{ row.vcs }}</td>
              <td class="nx-td-std">{{ row.xcelium }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- DOWNLOADS & SINGLE-LINE INSTALL SECTION -->
    <section id="releases" class="nx-section nx-releases-section">
      <div class="nx-section-header">
        <div class="nx-section-eyebrow">04 // RELEASES &amp; DISTRIBUTION</div>
        <h2 class="nx-section-title">Universal Fast One-Line Installer</h2>
        <p class="nx-section-lead">
          Install the standalone native Axiom EDA binary in seconds without 100+ GB monolithic installer bloat.
        </p>
      </div>

      <div class="nx-install-card">
        <div class="nx-install-tabs">
          <button
            type="button"
            class="nx-install-tab"
            :class="{ 'nx-install-tab-active': installTab === 'bash' }"
            @click="installTab = 'bash'"
          >
            <span>Linux &amp; macOS (Bash)</span>
          </button>
          <button
            type="button"
            class="nx-install-tab"
            :class="{ 'nx-install-tab-active': installTab === 'powershell' }"
            @click="installTab = 'powershell'"
          >
            <span>Windows (PowerShell)</span>
          </button>
        </div>

        <div class="nx-install-body">
          <div v-if="installTab === 'bash'" class="nx-install-cmd-row">
            <code class="nx-install-code">curl -fsSL https://axiom.aerovex.net/install.sh | bash</code>
            <button
              type="button"
              class="nx-copy-install-btn"
              @click="copyInstallCommand('curl -fsSL https://axiom.aerovex.net/install.sh | bash')"
            >
              <svg v-if="!copiedInstall" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{{ copiedInstall ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>

          <div v-else class="nx-install-cmd-row">
            <code class="nx-install-code">irm https://axiom.aerovex.net/install.ps1 | iex</code>
            <button
              type="button"
              class="nx-copy-install-btn"
              @click="copyInstallCommand('irm https://axiom.aerovex.net/install.ps1 | iex')"
            >
              <svg v-if="!copiedInstall" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{{ copiedInstall ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>

          <div class="nx-install-footer">
            <span class="nx-install-note">Auto-detects CPU architecture (x86_64, aarch64) and verifies SHA-256 release checksums.</span>
            <a href="https://github.com/aerovexhq/axiom/releases" target="_blank" rel="noopener noreferrer" class="nx-install-link">
              <span>View GitHub Releases</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- UNIFIED FOOTER DIRECTORY -->
    <footer class="nx-unified-footer">
      <div class="nx-footer-container">
        <div class="nx-footer-grid">
          <!-- Brand & Mission Column -->
          <div class="nx-footer-col nx-footer-col-brand">
            <div class="nx-footer-brand-title">
              <img src="/logo.svg" alt="Axiom" class="nx-footer-logo-img" />
              <span>Axiom<span class="nx-brand-dot">.</span></span>
            </div>
            <p class="nx-footer-tagline">
              Next-generation in-RAM hardware description language simulation platform. Compiles IEEE 1364 Verilog and SystemVerilog constructs directly into native machine code with Cranelift JIT, eliminating legacy EDA compilation bottlenecks.
            </p>
            <div class="nx-footer-status-pill">
              <span class="nx-telemetry-dot"></span>
              <span>ALL SYSTEMS NOMINAL // 400 HZ CRANELIFT JIT</span>
            </div>
          </div>

          <!-- Column 1: Core Engines -->
          <div class="nx-footer-col">
            <div class="nx-footer-heading">Tier 1 Core Engines</div>
            <ul class="nx-footer-links">
              <li><a href="https://axiom.aerovex.net">Axiom HDL &amp; JIT</a></li>
              <li><a href="https://aerovex.net#chronos">Chronos Multi-World</a></li>
              <li><a href="https://aerovex.net#kestrel">Kestrel RT Avionics</a></li>
              <li><a href="https://phonon.aerovex.net" target="_blank" rel="noopener noreferrer">Phonon SPICE &amp; TCAD</a></li>
              <li><a href="https://atoma.aerovex.net" target="_blank" rel="noopener noreferrer">Atoma Quantum CAD</a></li>
              <li><a href="https://sonon.aerovex.net" target="_blank" rel="noopener noreferrer">Sonon Acoustic DSP</a></li>
            </ul>
          </div>

          <!-- Column 2: Documentation -->
          <div class="nx-footer-col">
            <div class="nx-footer-heading">Documentation</div>
            <ul class="nx-footer-links">
              <li><a href="/guide/quickstart">Quickstart Installation</a></li>
              <li><a href="/ui/overview">Studio Workspace UI</a></li>
              <li><a href="/languages/verilog/overview">Verilog HDL Reference</a></li>
              <li><a href="/languages/systemverilog/overview">SystemVerilog (IEEE 1800)</a></li>
              <li><a href="/architecture/in-ram-jit">In-RAM Cranelift Architecture</a></li>
              <li><a href="/vivado/migration">Vivado Migration Guide</a></li>
              <li><a href="/reference/cli">CLI Command Reference</a></li>
            </ul>
          </div>

          <!-- Column 3: Studio & Tools -->
          <div class="nx-footer-col">
            <div class="nx-footer-heading">Studio &amp; Tools</div>
            <ul class="nx-footer-links">
              <li><a href="/studio/" target="_blank" rel="noopener noreferrer">Interactive Web Studio</a></li>
              <li><a href="/ui/waveform-viewer">Canvas Waveform Viewer</a></li>
              <li><a href="/ui/timing-radar">Static Timing Radar</a></li>
              <li><a href="/ui/telemetry-energy">Physics Energy Telemetry</a></li>
              <li><a href="/ui/virtual-lab">Virtual FPGA Development Lab</a></li>
              <li><a href="/vivado/saif-vcd-interop">SAIF / VCD Interoperability</a></li>
            </ul>
          </div>

          <!-- Column 4: Platform & Ecosystem -->
          <div class="nx-footer-col">
            <div class="nx-footer-heading">Platform &amp; Network</div>
            <ul class="nx-footer-links">
              <li><a href="https://aerovex.net" target="_blank" rel="noopener noreferrer">Aerovex Ecosystem</a></li>
              <li><a href="https://vexel.aerovex.net" target="_blank" rel="noopener noreferrer">Vexel Systems Language</a></li>
              <li><a href="https://appify.aerovex.net" target="_blank" rel="noopener noreferrer">Appify Bundler</a></li>
              <li><a href="https://github.com/aerovexhq/axiom" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
              <li><a href="https://github.com/aerovexhq/axiom/releases" target="_blank" rel="noopener noreferrer">Release Downloads</a></li>
            </ul>
          </div>
        </div>

        <div class="nx-footer-bottom-bar">
          <div class="nx-footer-copy">
            &copy; 2026 Aerovex Corporation. All rights reserved. Built with safe Rust &amp; Cranelift.
          </div>
          <div class="nx-footer-security">
            CANONICAL NETWORK: *.AEROVEX.NET // AES-GCM-128
          </div>
        </div>
      </div>
    </footer>

    <!-- INTERACTIVE ARCHITECTURE MODAL -->
    <transition name="nx-modal-fade">
      <div
        v-if="selectedSubsystem"
        class="nx-modal-overlay"
        @click.self="closeArchitectureModal"
        role="dialog"
        aria-modal="true"
      >
        <div class="nx-modal-dialog">
          <!-- Close Button -->
          <button
            type="button"
            class="nx-modal-close-btn"
            @click="closeArchitectureModal"
            aria-label="Close Architecture Modal"
          >
            &times;
          </button>

          <!-- Modal Header -->
          <div class="nx-modal-header">
            <div class="nx-modal-tags">
              <span class="nx-modal-tier-tag">{{ selectedSubsystem.tierLabel }}</span>
              <span class="nx-modal-cat-tag">{{ selectedSubsystem.category }}</span>
              <span class="nx-modal-status-tag">{{ selectedSubsystem.status }}</span>
            </div>
            <h2 class="nx-modal-title">{{ selectedSubsystem.name }}</h2>
            <p class="nx-modal-tagline">{{ selectedSubsystem.tagline }}</p>

            <div class="nx-modal-stack">
              <span
                v-for="(tech, idx) in selectedSubsystem.architectureDetails.stack"
                :key="idx"
                class="nx-tech-chip"
              >
                {{ tech }}
              </span>
            </div>
          </div>

          <!-- Section 01: Execution Pipeline -->
          <div class="nx-modal-section">
            <div class="nx-modal-section-title">01 // Dataflow &amp; Netlist Execution Pipeline</div>
            <div class="nx-modal-pipeline-box">
              <pre class="nx-pipeline-ascii"><code>{{ selectedSubsystem.architectureDetails.pipelineAscii }}</code></pre>
            </div>
          </div>

          <!-- Section 02: Empirical Benchmarks Matrix -->
          <div class="nx-modal-section">
            <div class="nx-modal-section-title">02 // Empirical Benchmark Matrix</div>
            <div class="nx-modal-table-wrap">
              <table class="nx-modal-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Measured Value</th>
                    <th>Unit</th>
                    <th>Industry Baseline</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(b, idx) in selectedSubsystem.architectureDetails.benchmarks" :key="idx">
                    <td class="nx-modal-td-metric">{{ b.label }}</td>
                    <td class="nx-modal-td-val">{{ b.value }}</td>
                    <td>{{ b.unit }}</td>
                    <td class="nx-modal-td-baseline">{{ b.baseline }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 03: Systems Trade-offs -->
          <div class="nx-modal-section">
            <div class="nx-modal-section-title">03 // Systems Engineering Formulation &amp; Trade-Offs</div>
            <div class="nx-modal-tradeoffs-box">
              <p>{{ selectedSubsystem.architectureDetails.tradeOffs }}</p>
            </div>
          </div>

          <!-- Section 04: Implementation Code Snippet -->
          <div class="nx-modal-section">
            <div class="nx-modal-section-title">04 // Core Implementation Interface</div>
            <div class="nx-modal-code-wrap">
              <div class="nx-modal-code-topbar">
                <span class="nx-modal-code-filename">{{ selectedSubsystem.architectureDetails.codeSnippet.filename }}</span>
                <button type="button" class="nx-copy-btn" @click="copyModalCode">
                  <svg v-if="!copiedCode" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{{ copiedCode ? 'Copied' : 'Copy Code' }}</span>
                </button>
              </div>
              <pre class="nx-modal-code-pre"><code>{{ selectedSubsystem.architectureDetails.codeSnippet.code }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Scoped styles specific to LandingPage layout */
.nx-landing-root {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-canvas, #08090a);
  color: var(--text-primary, #f7f8f8);
  overflow-x: hidden;
}

/* Ambient Canvas Glow & Micro-Grid */
.nx-ambient-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 720px;
  background:
    radial-gradient(ellipse 70% 45% at 50% -10%, rgba(94, 106, 210, 0.14) 0%, rgba(245, 158, 11, 0.04) 40%, rgba(8, 9, 10, 0) 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.nx-ambient-glow::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 80%);
  opacity: 0.55;
}

/* Fixed Blur Navbar */
.nx-fixed-navbar {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: rgba(8, 9, 10, 0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
  display: flex;
  align-items: center;
}

.nx-nav-container {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nx-nav-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  color: var(--text-primary, #f7f8f8);
}

.nx-brand-logo-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 2px 8px rgba(0, 242, 254, 0.2);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.nx-nav-brand:hover .nx-brand-logo-img {
  transform: scale(1.05);
  border-color: rgba(0, 242, 254, 0.4);
}

.nx-footer-logo-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.nx-brand-text {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.035em;
  color: #ffffff;
}

.nx-brand-dot {
  color: #f59e0b;
}

.nx-brand-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(94, 106, 210, 0.12);
  border: 1px solid rgba(94, 106, 210, 0.28);
  color: #717cf0;
}

.nx-telemetry-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.nx-nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nx-nav-link {
  font-family: 'Inter', sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary, #a1a1aa);
  text-decoration: none;
  transition: color 0.15s ease;
}

.nx-nav-link:hover {
  color: #ffffff;
}

/* Ecosystem Dropdown */
.nx-ecosystem-wrap {
  position: relative;
}

.nx-ecosystem-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 6px 12px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #a1a1aa);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.nx-ecosystem-btn:hover,
.nx-ecosystem-btn-open {
  background: #15171a;
  border-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.nx-chevron {
  transition: transform 0.2s ease;
}

.nx-chevron-up {
  transform: rotate(180deg);
}

.nx-ecosystem-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: 360px;
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  z-index: 150;
}

.nx-ecosystem-panel-header {
  padding: 12px 16px;
  background: #08090a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nx-ecosystem-panel-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #717cf0;
}

.nx-ecosystem-panel-domain {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted, #71717a);
}

.nx-ecosystem-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 380px;
  overflow-y: auto;
}

.nx-ecosystem-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.nx-ecosystem-item:hover {
  background: #15171a;
}

.nx-ecosystem-item-active {
  background: rgba(94, 106, 210, 0.08);
  border: 1px solid rgba(94, 106, 210, 0.2);
}

.nx-ecosystem-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nx-ecosystem-item-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nx-ecosystem-item-name {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.nx-ecosystem-active-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #10b981;
  padding: 1px 5px;
  border-radius: 4px;
}

.nx-ecosystem-cat-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--text-muted, #71717a);
}

.nx-ecosystem-item-desc {
  font-size: 11.5px;
  color: var(--text-secondary, #a1a1aa);
  max-width: 230px;
  line-height: 1.35;
}

.nx-ecosystem-slug-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
  padding: 3px 6px;
  border-radius: 4px;
}

.nx-nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nx-btn-studio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #15171a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-family: 'Inter', sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.nx-btn-studio:hover {
  background: #1c1e22;
  border-color: rgba(245, 158, 11, 0.5);
  color: #f59e0b;
}

.nx-btn-docs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  color: #000000;
  font-family: 'Inter', sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 6px;
  text-decoration: none;
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.nx-btn-docs:hover {
  background: #eaeaea;
  transform: translateY(-1px);
}

.nx-hamburger-btn {
  display: none;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #ffffff;
  padding: 6px;
  cursor: pointer;
}

.nx-mobile-menu {
  display: flex;
  flex-direction: column;
  padding: 16px 32px;
  background: #0f1012;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 12px;
}

.nx-mobile-link {
  font-size: 14px;
  color: var(--text-secondary, #a1a1aa);
  text-decoration: none;
  font-weight: 500;
}

.nx-mobile-link-accent {
  color: #717cf0;
  font-weight: 600;
}

/* HERO SECTION */
.nx-hero-section {
  position: relative;
  z-index: 1;
  padding: 72px 32px 84px;
  max-width: 1320px;
  margin: 0 auto;
}

.nx-hero-grid {
  display: grid;
  grid-template-columns: 1.15fr 1.05fr;
  gap: 56px;
  align-items: center;
}

.nx-hero-lead-col {
  display: flex;
  flex-direction: column;
}

.nx-hero-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: #717cf0;
  background: rgba(94, 106, 210, 0.08);
  border: 1px solid rgba(94, 106, 210, 0.25);
  padding: 4px 12px;
  border-radius: 9999px;
  width: fit-content;
  margin-bottom: 20px;
}

.nx-status-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.nx-hero-headline {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: clamp(34px, 3.8vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.035em;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 18px 0;
}

.nx-headline-accent {
  background: linear-gradient(135deg, #ffffff 25%, #717cf0 70%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nx-hero-pitch {
  font-size: 15.5px;
  line-height: 1.65;
  color: var(--text-secondary, #a1a1aa);
  letter-spacing: -0.01em;
  max-width: 580px;
  margin: 0 0 32px 0;
}

.nx-hero-ctas {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 38px;
}

.nx-hero-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  color: #000000;
  font-family: 'Inter', sans-serif;
  font-size: 13.5px;
  font-weight: 600;
  padding: 11px 22px;
  border-radius: 6px;
  text-decoration: none;
  box-shadow: 0 0 24px rgba(255, 255, 255, 0.15);
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.nx-hero-btn-primary:hover {
  background: #eaeaea;
  transform: translateY(-1px);
}

.nx-hero-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #15171a;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  padding: 11px 20px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.nx-hero-btn-secondary:hover {
  background: #1c1e22;
  border-color: rgba(245, 158, 11, 0.5);
}

.nx-hero-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--text-secondary, #a1a1aa);
  font-family: 'Inter', sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  padding: 11px 16px;
  border-radius: 6px;
  text-decoration: none;
  transition: color 0.15s ease;
}

.nx-hero-btn-ghost:hover {
  color: #ffffff;
}

.nx-hero-ticker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.nx-ticker-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nx-ticker-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15.5px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.4px;
}

.nx-ticker-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  text-transform: uppercase;
  color: var(--text-muted, #71717a);
  letter-spacing: 0.6px;
}

/* Hero Hardware Frame Viewport */
.nx-hero-viewport-frame {
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 24px 72px rgba(0, 0, 0, 0.85), 0 0 45px rgba(94, 106, 210, 0.12);
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
}

.nx-hero-viewport-frame:hover {
  border-color: rgba(94, 106, 210, 0.4);
  transform: translateY(-2px);
}

.nx-frame-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #08090a;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nx-frame-dots {
  display: flex;
  gap: 6px;
}

.nx-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.nx-dot-red { background: #ef4444; }
.nx-dot-yellow { background: #f59e0b; }
.nx-dot-green { background: #10b981; }

.nx-frame-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--text-secondary, #a1a1aa);
  letter-spacing: 0.8px;
  font-weight: 500;
}

.nx-frame-telemetry {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #10b981;
}

.nx-frame-body {
  padding: 16px;
  background: #0a0b0d;
}

.nx-sim-monitor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nx-monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted, #71717a);
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.nx-monitor-status {
  color: #10b981;
  font-weight: 600;
}

.nx-signals-stream {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.nx-signal-row {
  display: grid;
  grid-template-columns: 140px 1fr 75px;
  align-items: center;
  gap: 12px;
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 6px 10px;
}

.nx-sig-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary, #a1a1aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nx-sig-wave {
  display: flex;
  align-items: center;
  width: 100%;
  height: 18px;
}

.nx-sig-svg {
  width: 100%;
  height: 18px;
}

.nx-bus-bar {
  display: flex;
  width: 100%;
  gap: 4px;
}

.nx-bus-segment {
  flex: 1;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: #f59e0b;
  text-align: center;
  padding: 1px 0;
}

.nx-power-graph-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
  overflow: hidden;
}

.nx-power-level {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #f59e0b);
  border-radius: 9999px;
}

.nx-sig-state {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  text-align: right;
}

.nx-sig-cyan { color: #38bdf8; }
.nx-sig-emerald { color: #10b981; }
.nx-sig-amber { color: #f59e0b; }
.nx-sig-lavender { color: #717cf0; }

.nx-viewport-hud {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.nx-hud-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-muted, #71717a);
}

.nx-hud-pill-active {
  background: rgba(94, 106, 210, 0.12);
  border-color: rgba(94, 106, 210, 0.3);
  color: #717cf0;
}

/* SECTION COMMONS */
.nx-section {
  position: relative;
  z-index: 1;
  padding: 88px 32px;
  max-width: 1320px;
  margin: 0 auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.nx-section-header {
  margin-bottom: 44px;
}

.nx-section-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #717cf0;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.nx-section-title {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: clamp(26px, 3.2vw, 40px);
  font-weight: 700;
  letter-spacing: -0.035em;
  color: #ffffff;
  line-height: 1.15;
  margin: 0 0 14px 0;
}

.nx-section-lead {
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--text-secondary, #a1a1aa);
  max-width: 720px;
  margin: 0;
}

/* BENTO GRID */
.nx-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 28px;
}

.nx-filter-tab {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 6px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #a1a1aa);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.nx-filter-tab:hover {
  background: #15171a;
  border-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.nx-filter-tab-active {
  background: #15171a;
  border-color: #5e6ad2;
  color: #ffffff;
  box-shadow: 0 0 16px rgba(94, 106, 210, 0.2);
}

.nx-filter-count {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted, #71717a);
}

.nx-filter-tab-active .nx-filter-count {
  background: rgba(94, 106, 210, 0.25);
  color: #ffffff;
}

.nx-bento-grid-2col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

/* Spotlight Card Base */
.nx-spotlight-card {
  position: relative;
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.nx-spotlight-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    500px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
    rgba(94, 106, 210, 0.07),
    transparent 65%
  );
  opacity: var(--spotlight-opacity, 0);
  transition: opacity 0.25s ease;
  pointer-events: none;
  z-index: 1;
}

.nx-spotlight-card::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
    rgba(94, 106, 210, 0.45),
    rgba(245, 158, 11, 0.2) 30%,
    transparent 60%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: var(--spotlight-opacity, 0);
  transition: opacity 0.25s ease;
  pointer-events: none;
  z-index: 2;
}

.nx-spotlight-card:hover {
  border-color: rgba(255, 255, 255, 0.16);
  transform: translateY(-2px);
  background-color: #15171a;
}

.nx-bento-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px;
}

.nx-bento-card-wide {
  grid-column: span 2;
}

.nx-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  position: relative;
  z-index: 3;
}

.nx-card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nx-card-tier {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #717cf0;
}

.nx-card-category {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted, #71717a);
}

.nx-card-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.nx-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.nx-status-primary {
  background: rgba(94, 106, 210, 0.12);
  border: 1px solid rgba(94, 106, 210, 0.3);
  color: #717cf0;
}
.nx-status-primary .nx-status-dot { background: #717cf0; }

.nx-status-emerald {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.nx-status-emerald .nx-status-dot { background: #10b981; }

.nx-status-cyan {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
}
.nx-status-cyan .nx-status-dot { background: #38bdf8; }

.nx-status-amber {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}
.nx-status-amber .nx-status-dot { background: #f59e0b; }

.nx-card-body {
  position: relative;
  z-index: 3;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nx-card-name {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 4px 0;
}

.nx-card-tagline {
  font-size: 13.5px;
  color: var(--text-secondary, #a1a1aa);
  margin: 0 0 16px 0;
  line-height: 1.45;
}

.nx-card-metric-box {
  background: #15171a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nx-metric-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.nx-metric-detail {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted, #71717a);
  line-height: 1.4;
}

.nx-card-desc {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-secondary, #a1a1aa);
  margin: 0 0 18px 0;
}

.nx-card-highlights {
  list-style: none;
  padding: 0;
  margin: 0 0 24px 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.nx-highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary, #a1a1aa);
  line-height: 1.45;
}

.nx-hl-bullet {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #5e6ad2;
  margin-top: 7px;
  flex-shrink: 0;
}

.nx-card-footer {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.nx-btn-inspect {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 7px 13px;
  color: var(--text-secondary, #a1a1aa);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.nx-btn-inspect:hover {
  background: #15171a;
  border-color: rgba(94, 106, 210, 0.4);
  color: #ffffff;
}

.nx-btn-doclink {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #38bdf8;
  text-decoration: none;
  transition: color 0.15s ease;
}

.nx-btn-doclink:hover {
  color: #ffffff;
}

/* PIPELINE SHOWCASE */
.nx-pipeline-stages-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.nx-stage-card {
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.nx-stage-card:hover {
  border-color: rgba(94, 106, 210, 0.35);
  transform: translateY(-2px);
}

.nx-stage-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: #717cf0;
  margin-bottom: 8px;
}

.nx-stage-title {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
}

.nx-stage-desc {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary, #a1a1aa);
  margin-bottom: 16px;
  flex: 1;
}

.nx-stage-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted, #71717a);
  padding: 4px 8px;
  background: #15171a;
  border-radius: 4px;
  width: fit-content;
}

.nx-code-showcase-box {
  background: #0a0b0d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.nx-code-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0f1012;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.nx-code-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nx-code-tab {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 5px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-secondary, #a1a1aa);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nx-code-tab:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.04);
}

.nx-code-tab-active {
  background: #15171a;
  border-color: rgba(94, 106, 210, 0.4);
  color: #ffffff;
}

.nx-code-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nx-code-filename {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted, #71717a);
}

.nx-copy-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 4px 10px;
  color: var(--text-secondary, #a1a1aa);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.nx-copy-btn:hover {
  background: #15171a;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.16);
}

.nx-code-viewport {
  margin: 0;
  padding: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.6;
  color: #e4e4e7;
  overflow-x: auto;
}

/* BENCHMARK COMPARISON MATRIX */
.nx-matrix-table-wrap {
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow-x: auto;
}

.nx-matrix-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.nx-matrix-table th {
  background: #08090a;
  padding: 14px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: var(--text-secondary, #a1a1aa);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-transform: uppercase;
}

.nx-matrix-table td {
  padding: 13px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a1a1aa);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.nx-row-highlight {
  background: rgba(94, 106, 210, 0.03);
}

.nx-td-metric {
  font-family: 'Inter', sans-serif !important;
  font-weight: 600;
  color: #ffffff !important;
  font-size: 13px !important;
  min-width: 220px;
}

.nx-axiom-header-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ffffff;
}

.nx-th-axiom {
  background: rgba(94, 106, 210, 0.1) !important;
  color: #ffffff !important;
  border-left: 1px solid rgba(94, 106, 210, 0.3) !important;
  border-right: 1px solid rgba(94, 106, 210, 0.3) !important;
}

.nx-td-axiom {
  background: rgba(94, 106, 210, 0.06);
  border-left: 1px solid rgba(94, 106, 210, 0.25);
  border-right: 1px solid rgba(94, 106, 210, 0.25);
  color: #ffffff;
  font-weight: 700;
}

.nx-td-std {
  color: var(--text-muted, #71717a);
}

/* RELEASES & INSTALL SECTION */
.nx-install-card {
  background: #0f1012;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.nx-install-tabs {
  display: flex;
  align-items: center;
  background: #08090a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px 12px;
  gap: 6px;
}

.nx-install-tab {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 7px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #a1a1aa);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nx-install-tab:hover {
  color: #ffffff;
}

.nx-install-tab-active {
  background: #15171a;
  border-color: rgba(94, 106, 210, 0.4);
  color: #ffffff;
}

.nx-install-body {
  padding: 24px;
}

.nx-install-cmd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #08090a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 14px 18px;
  gap: 16px;
  overflow-x: auto;
}

.nx-install-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: #f59e0b;
  white-space: nowrap;
}

.nx-copy-install-btn {
  background: #15171a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 6px 12px;
  color: #ffffff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.nx-copy-install-btn:hover {
  background: #1c1e22;
  border-color: rgba(255, 255, 255, 0.2);
}

.nx-install-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  flex-wrap: wrap;
  gap: 12px;
}

.nx-install-note {
  font-size: 12px;
  color: var(--text-muted, #71717a);
}

.nx-install-link {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #38bdf8;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.nx-install-link:hover {
  color: #ffffff;
}

/* UNIFIED FOOTER DIRECTORY */
.nx-unified-footer {
  background: #08090a;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 80px 32px 48px;
  position: relative;
  z-index: 1;
}

.nx-footer-container {
  max-width: 1320px;
  margin: 0 auto;
}

.nx-footer-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 56px;
}

.nx-footer-col-brand {
  display: flex;
  flex-direction: column;
}

.nx-footer-brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.035em;
  margin-bottom: 14px;
}

.nx-footer-tagline {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #a1a1aa);
  margin-bottom: 20px;
}

.nx-footer-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #10b981;
  width: fit-content;
}

.nx-footer-heading {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #ffffff;
  margin-bottom: 16px;
}

.nx-footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nx-footer-links a {
  font-size: 13px;
  color: var(--text-secondary, #a1a1aa);
  text-decoration: none;
  transition: color 0.15s ease;
}

.nx-footer-links a:hover {
  color: #ffffff;
}

.nx-footer-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-wrap: wrap;
  gap: 16px;
}

.nx-footer-copy {
  font-size: 12.5px;
  color: var(--text-muted, #71717a);
}

.nx-footer-security {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted, #71717a);
  letter-spacing: 0.6px;
}

/* INTERACTIVE ARCHITECTURE MODAL */
.nx-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(8, 9, 10, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.nx-modal-dialog {
  background: #111316;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  box-shadow: 0 32px 96px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.06);
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 32px;
  position: relative;
}

.nx-modal-close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: #15171a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary, #a1a1aa);
  font-size: 20px;
  line-height: 1;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.nx-modal-close-btn:hover {
  background: #1c1e22;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.nx-modal-header {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nx-modal-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.nx-modal-tier-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-weight: 700;
  color: #717cf0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.nx-modal-cat-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-muted, #71717a);
}

.nx-modal-status-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.nx-modal-title {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.035em;
  color: #ffffff;
  margin: 0 0 6px 0;
}

.nx-modal-tagline {
  font-size: 14.5px;
  color: var(--text-secondary, #a1a1aa);
  margin: 0 0 16px 0;
}

.nx-modal-stack {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.nx-tech-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: #15171a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, #a1a1aa);
}

.nx-modal-section {
  margin-bottom: 28px;
}

.nx-modal-section-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #717cf0;
  margin-bottom: 12px;
}

.nx-modal-pipeline-box {
  background: #08090a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 18px;
  overflow-x: auto;
}

.nx-pipeline-ascii {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  color: #38bdf8;
}

.nx-modal-table-wrap {
  background: #08090a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow-x: auto;
}

.nx-modal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.nx-modal-table th {
  background: #0f1012;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-secondary, #a1a1aa);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.nx-modal-table td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary, #a1a1aa);
}

.nx-modal-td-metric {
  color: #ffffff !important;
  font-weight: 600;
}

.nx-modal-td-val {
  color: #10b981;
  font-weight: 700;
}

.nx-modal-td-baseline {
  color: var(--text-muted, #71717a);
}

.nx-modal-tradeoffs-box {
  background: #08090a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px 18px;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-secondary, #a1a1aa);
}

.nx-modal-code-wrap {
  background: #08090a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

.nx-modal-code-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0f1012;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 14px;
}

.nx-modal-code-filename {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted, #71717a);
}

.nx-modal-code-pre {
  margin: 0;
  padding: 16px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.55;
  color: #e4e4e7;
  overflow-x: auto;
}

/* MODAL TRANSITIONS */
.nx-modal-fade-enter-active,
.nx-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.nx-modal-fade-enter-from,
.nx-modal-fade-leave-to {
  opacity: 0;
}

.nx-drop-fade-enter-active,
.nx-drop-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.nx-drop-fade-enter-from,
.nx-drop-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* RESPONSIVE LAYOUT */
@media (max-width: 1100px) {
  .nx-hero-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .nx-pipeline-stages-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .nx-footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
}

@media (max-width: 820px) {
  .nx-nav-links {
    display: none;
  }
  .nx-hamburger-btn {
    display: inline-flex;
  }
  .nx-bento-grid-2col {
    grid-template-columns: 1fr;
  }
  .nx-bento-card-wide {
    grid-column: span 1;
  }
  .nx-hero-ticker {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
  .nx-pipeline-stages-grid {
    grid-template-columns: 1fr;
  }
  .nx-footer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
