export interface Subsystem {
  id: string;
  name: string;
  domain: string;
  tierLabel: string;
  category: string;
  status: string;
  statusTone: 'emerald' | 'cyan' | 'amber' | 'indigo';
  tagline: string;
  metric: string;
  metricDetail: string;
  description: string;
  highlights: string[];
  tags: string[];
  docSectionId: string;
  architectureDetails: {
    pipelineDiagram: string;
    tradeoffs: { choice: string; why: string }[];
    codeSnippet: {
      language: string;
      title: string;
      code: string;
    };
  };
}

export const AXIOM_SUBSYSTEMS: Subsystem[] = [
  {
    id: 'cranelift_jit',
    name: 'Cranelift JIT Netlist Compiler',
    domain: 'jit',
    tierLabel: 'TIER 1 // COMPILER CORE',
    category: 'Silicon Compilation',
    status: 'OPTIMIZED',
    statusTone: 'amber',
    tagline: 'Direct in-RAM SystemVerilog netlist compilation to native machine code in sub-3ms.',
    metric: '2.81 ms',
    metricDetail: 'Mean Netlist-to-Native Machine Code JIT Compilation Latency',
    description: 'Axiom translates Verilog/SystemVerilog designs directly into high-throughput executable code in RAM, avoiding intermediate disk writes and slow external C++ compilers entirely.',
    highlights: [
      'Zero disk-write compilation cycle: eliminates makefiles and GCC/Clang subprocess spawning',
      'Instantaneous feedback loop for interactive hardware debugging and testing',
      'SIMD-accelerated bit-parallel evaluation using AVX-512 and ARM NEON registers'
    ],
    tags: ['Cranelift JIT', 'In-RAM Execution', 'Sub-3ms Compile', 'Zero Disk IO'],
    docSectionId: 'cranelift_jit_engine',
    architectureDetails: {
      pipelineDiagram: `SystemVerilog Source (.sv / .v)
           │
           ▼
[Elaboration & Hierarchy Binding] ── In-RAM Netlist Structure
           │
           ▼
[Axiom JIT Compilation Core] ── Native Target Optimization
           │
           ▼
[High-Throughput Simulation Runtime] (14.8M transitions/s)`,
      tradeoffs: [
        { choice: 'In-Memory JIT vs External C++ Compiler', why: 'Eliminates 100+ megabytes of intermediate files and reduces turn-around latency by over 100x.' },
        { choice: 'Native Machine Targets vs Bytecode VM', why: 'Executes directly on bare-metal CPU instruction pipelines for maximum transition throughput.' }
      ],
      codeSnippet: {
        language: 'python',
        title: 'Axiom High-Throughput Python Simulation API',
        code: `import axiom

# Load and compile SystemVerilog top-level design in RAM
session = axiom.Session(opt_level="performance")
sim = session.compile_design("rtl/riscv_core.sv", top="riscv_core")

# Drive reset and run simulation
sim.set_pin("rst_n", 0)
sim.step(cycles=5)
sim.set_pin("rst_n", 1)

sim.step(cycles=50000)
print(f"Simulation completed. Cycles: {sim.cycle_count}, PC: 0x{sim.get_pin('pc'):08x}")`
      }
    }
  },
  {
    id: 'cycle_kernel',
    name: '4-State Cycle-Accurate Kernel',
    domain: 'kernel',
    tierLabel: 'TIER 1 // DYNAMICS CORE',
    category: 'Digital Simulation',
    status: 'ACTIVE',
    statusTone: 'emerald',
    tagline: 'Deterministic cycle-accurate IEEE 1800 4-state logic evaluation at 14.8M transitions/s.',
    metric: '14.8M trans/s',
    metricDetail: 'Peak Cycle-Accurate 4-State Gate Transition Throughput',
    description: 'Implements bit-parallel 4-state digital logic (0, 1, X, Z) across multi-bit words, evaluating signal vectors simultaneously with cycle-accurate precision.',
    highlights: [
      'Full IEEE 1800 standard compliance for 4-state logic values: 0, 1, X, and Z',
      'Event-driven execution scheduling with zero race conditions across worker threads',
      'Predictable memory layout minimizing CPU cache misses during long regression runs'
    ],
    tags: ['4-State Logic', 'Bit-Parallel', 'Delta-Cycle', 'Zero Race'],
    docSectionId: 'cycle_accurate_kernel',
    architectureDetails: {
      pipelineDiagram: `Digital Stimulus & Pin Inputs
           │
           ▼
[4-State Simulation Kernel] ── IEEE 1800 Logic Resolution
           │
           ▼
[Delta-Cycle Event Dispatcher] ── Active / Inactive Event Queues
           │
           ▼
[Synchronous Register Latch] ── Clock Edge Transition Output`,
      tradeoffs: [
        { choice: '4-State Verification vs 2-State Binary', why: 'Detects uninitialized registers, clock-domain crossing bugs, and bus contention before silicon tape-out.' },
        { choice: 'Static Scheduling vs Dynamic Allocation', why: 'Guarantees zero heap allocation overhead during active clock cycles.' }
      ],
      codeSnippet: {
        language: 'verilog',
        title: 'SystemVerilog 4-State Testbench Interface',
        code: `module tb_bus_contention;
    logic clk = 0;
    wire [31:0] shared_bus;
    logic drive_a, drive_b;
    
    // Instantiate bus drivers
    bus_driver u_driver_a (.clk(clk), .en(drive_a), .bus(shared_bus));
    bus_driver u_driver_b (.clk(clk), .en(drive_b), .bus(shared_bus));
    
    // Axiom monitors and flags invalid X/Z bus conditions
    always @(posedge clk) begin
        if (drive_a && drive_b) begin
            $display("Axiom Kernel: Resolving bidirectional bus contention state");
        end
    end
endmodule`
      }
    }
  },
  {
    id: 'static_timing',
    name: 'Static Timing Analysis (STA)',
    domain: 'timing',
    tierLabel: 'TIER 2 // VERIFICATION',
    category: 'Timing Closure',
    status: 'ACTIVE',
    statusTone: 'cyan',
    tagline: 'Topological critical-path delay calculation and setup/hold timing margin checking.',
    metric: '0.00 ns slack',
    metricDetail: 'Sub-picosecond Precision Setup/Hold Violation Guarding',
    description: 'Graph-based Static Timing Analyzer calculating arrival times, required times, and slack margins across all flip-flop boundaries and asynchronous reset pins.',
    highlights: [
      'Topological netlist analysis with sub-linear traversal over combinational logic',
      'Liberty (.lib) format parser with Non-Linear Delay Model (NLDM) support',
      'Automated slack margin reporting and worst negative slack (WNS) path classification'
    ],
    tags: ['STA', 'Slack Margin', 'Liberty .lib', 'Setup/Hold Guard'],
    docSectionId: 'static_timing_analysis',
    architectureDetails: {
      pipelineDiagram: `Netlist Graph + Liberty (.lib) Cell Libraries
           │
           ▼
[Topological Path Traversal] ── Critical Combinational Cones
           │
           ▼
[Constraint Verification Engine] ── Setup & Hold Checking
           │
           ▼
[Timing Closure Report] ── Worst Negative Slack & Violation Details`,
      tradeoffs: [
        { choice: 'Integrated STA vs Separate EDA Standalone Tool', why: 'Allows instant timing violation feedback within the simulation workflow without exporting netlists.' },
        { choice: 'Standard Liberty (.lib) Support vs Custom Models', why: 'Guarantees seamless interoperability with standard foundry cell libraries.' }
      ],
      codeSnippet: {
        language: 'tcl',
        title: 'Axiom SDC Timing Constraints & Analysis',
        code: `# core_timing.sdc: Standard Design Constraints
create_clock -name core_clk -period 2.500 [get_ports clk]
set_input_delay  -clock core_clk -max 0.450 [get_ports rx_data[*]]
set_output_delay -clock core_clk -max 0.350 [get_ports tx_data[*]]

# Execute timing analysis in Axiom CLI:
# axiom sta rtl/soc_top.sv --lib tech/tsmc28.lib --sdc core_timing.sdc --report timing_summary.rpt`
      }
    }
  },
  {
    id: 'waveform_tracing',
    name: 'VCD & FST Waveform Engine',
    domain: 'waveform',
    tierLabel: 'TIER 2 // DIAGNOSTICS',
    category: 'Signal Observation',
    status: 'OPTIMIZED',
    statusTone: 'amber',
    tagline: 'Zero-overhead streaming signal dumps to compressed VCD and FST formats.',
    metric: '12.4x compression',
    metricDetail: 'FST Binary Stream Compression Ratio over Plaintext VCD',
    description: 'Real-time asynchronous waveform capture streaming signal transitions directly to memory buffers or disk with zero stall on worker simulation threads.',
    highlights: [
      'Fast Signal Trace (FST) multi-stream LZ4 compression with sub-microsecond flush',
      'Selective signal filtering: record only designated buses or top-level hierarchical ports',
      'Interactive WebAssembly waveform inspection integrated with Three.js canvas'
    ],
    tags: ['FST Binary', 'VCD Streaming', 'LZ4 Compress', 'Zero Stall'],
    docSectionId: 'waveform_tracing',
    architectureDetails: {
      pipelineDiagram: `Active Simulation Event Stream
           │
           ▼
[Asynchronous Signal Buffer] ── Lock-Free Event Queue
           │
           ▼
[Real-Time Stream Compressor] ── LZ4 Block Compression
           │
           ▼
[FST / VCD Waveform Output] ── Disk Storage / Live GUI Viewport`,
      tradeoffs: [
        { choice: 'Asynchronous Waveform Pipeline vs Synchronous Flush', why: 'Prevents I/O disk stalls from degrading active simulation step throughput.' },
        { choice: 'FST Format vs Plain VCD', why: 'Over 12x storage savings and instantaneous seek times in waveform viewers.' }
      ],
      codeSnippet: {
        language: 'yaml',
        title: 'Axiom Waveform Configuration File',
        code: `# axiom_waveform.yaml: Signal Recording Configuration
tracing:
  enabled: true
  format: fst
  output: "waveforms/cpu_benchmark.fst"
  compression: lz4
  scope:
    include:
      - "top.core.pc"
      - "top.core.registers.*"
      - "top.bus.axi_*"
    exclude:
      - "top.core.debug_internal_*"`
      }
    }
  },
  {
    id: 'silicon_studio',
    name: 'Interactive Silicon Studio',
    domain: 'studio',
    tierLabel: 'TIER 3 // STUDIO',
    category: 'Workstation Integration',
    status: 'ACTIVE',
    statusTone: 'emerald',
    tagline: 'Unified WebAssembly EDA canvas with live schematic inspection and interactive pin forcing.',
    metric: '60 FPS Canvas',
    metricDetail: 'Smooth Interactive Schematic Navigation & Waveform Scrubbing',
    description: 'Embedded hardware workbench allowing engineers to force pins, pause delta cycles, inspect internal register matrices, and run testbenches visually.',
    highlights: [
      'Live pin forcing: toggle clock, reset, and stimulus signals on-the-fly without recompile',
      'Hierarchical netlist tree viewer with dynamic fan-in and fan-out tracing',
      'Direct integration with Aerovex Workstation robotics flight-controller SITL bus'
    ],
    tags: ['Interactive EDA', 'Live Pin Forcing', 'Netlist Tree', 'SITL Bridge'],
    docSectionId: 'silicon_studio_guide',
    architectureDetails: {
      pipelineDiagram: `Operator Workspace & Interactive Controls
           │
           ▼
[Silicon Studio Client Engine] ── Real-Time State Inspector
           │
           ▼
[Axiom In-Memory Kernel] ── Lockstep Step Evaluation
           │
           ▼
[Interactive Schematic Viewport] ── 60 FPS Visual Topology`,
      tradeoffs: [
        { choice: 'Browser & Desktop In-Memory vs Remote Daemon', why: 'Enables responsive, offline-capable verification on edge workstations without network overhead.' },
        { choice: 'Interactive Pin Forcing vs Batch-Only Run', why: 'Allows engineers to rapidly isolate corner-case bugs in live hardware prototypes.' }
      ],
      codeSnippet: {
        language: 'typescript',
        title: 'Silicon Studio Client Pin Forcing API',
        code: `import { AxiomStudioClient } from '@aerovex/axiom-studio';

const client = new AxiomStudioClient();
await client.connect();

// Force pin state and step simulation
client.forcePin('top.rst_n', '1');
client.forcePin('top.enable', '1');
await client.stepCycles(100);

const busState = await client.readPin('top.data_out');
console.log('Observed Bus State:', busState);`
      }
    }
  }
];
