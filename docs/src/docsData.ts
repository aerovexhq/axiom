export interface DocSectionContent {
  title: string;
  badge: string;
  description: string;
  verilogCode?: string;
  svCode?: string;
  cppCode?: string;
  callout?: {
    type: 'note' | 'tip' | 'warning' | 'spec';
    title: string;
    text: string;
  };
  specs?: { param: string; val: string; note: string }[];
  steps?: { title: string; desc: string; cmd?: string }[];
}

export interface DocSection {
  id: string;
  title: string;
  badge: string;
  content: DocSectionContent;
}

export interface DocCategory {
  id: string;
  title: string;
  badge: string;
  sections: DocSection[];
}

export const AXIOM_DOC_TREE: DocCategory[] = [
  {
    id: 'getting_started',
    title: '1. Getting Started',
    badge: 'CORE',
    sections: [
      {
        id: 'why_axiom',
        title: 'Why Axiom',
        badge: 'OVERVIEW',
        content: {
          title: 'High-Performance In-RAM HDL Simulator',
          badge: 'ARCHITECTURE',
          description: 'Axiom is an enterprise-grade digital silicon simulation engine engineered for instant turnaround in hardware development, eliminating the multi-second compiler penalties of traditional simulators like Verilator and VCS.',
          callout: {
            type: 'spec',
            title: 'In-RAM Architectural Invariant',
            text: 'Axiom compiles SystemVerilog netlists directly into Cranelift IR and executes machine code pointers in memory, strictly bypassing intermediate disk I/O and external C++ compiler toolchains.'
          },
          specs: [
            { param: 'JIT Compilation Latency', val: '2.81 ms (Mean)', note: 'Direct CLIF lowering in RAM' },
            { param: 'Logic State Model', val: 'IEEE 1800 4-State (0, 1, X, Z)', note: 'Bit-parallel dual 64-bit vectors' },
            { param: 'Memory Overhead', val: '0 Byte Disk Writes', note: 'All netlists, symbols, and code in RAM' },
            { param: 'Host Architectures', val: 'x86_64 (AVX-512) & aarch64 (NEON)', note: 'Bare-metal Cranelift JIT targets' }
          ],
          verilogCode: `// Axiom Hello Silicon: 8-bit Synchronous Accumulator
module accumulator (
    input  wire       clk,
    input  wire       rst_n,
    input  wire [7:0] in_data,
    input  wire       in_valid,
    output reg  [7:0] out_accum
);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            out_accum <= 8'h00;
        end else if (in_valid) begin
            out_accum <= out_accum + in_data;
        end
    end

endmodule`,
          svCode: `// SystemVerilog 2017 Interface and Assertions
interface BusInterface(input logic clk);
    logic [7:0] data;
    logic       valid;
    logic       ready;

    modport Master (input clk, ready, output data, valid);
    modport Slave  (input clk, data, valid, output ready);

    assert property (@(posedge clk) valid |-> ##[1:5] ready)
        else $error("Protocol Violation: Slave failed to assert ready within 5 cycles");
endinterface`,
          cppCode: `// C++ Testbench Driving Axiom In-Memory Kernel
#include <axiom/axiom.hpp>
#include <cassert>

int main() {
    axiom::Context ctx;
    auto circuit = ctx.load_verilog("accumulator.v");
    auto sim = circuit.compile_jit();

    sim.set_pin("rst_n", 0);
    sim.step_cycle(2);
    sim.set_pin("rst_n", 1);

    sim.set_pin("in_valid", 1);
    sim.set_pin("in_data", 42);
    sim.step_cycle(1);

    assert(sim.get_pin("out_accum") == 42);
    return 0;
}`
        }
      },
      {
        id: 'installation',
        title: 'Installation & Toolchain',
        badge: 'SETUP',
        content: {
          title: 'Installing the Axiom EDA Toolchain',
          badge: 'BINARIES',
          description: 'Axiom is distributed as a single statically-linked native executable with zero external runtime dependencies, alongside C-ABI headers and Rust crates.',
          steps: [
            { title: 'Download via Universal Installer', desc: 'Auto-detects CPU target and configures PATH.', cmd: 'curl -fsSL https://axiom.aerovex.net/install.sh | bash' },
            { title: 'Verify Native Installation', desc: 'Prints JIT compiler targets and SIMD features.', cmd: 'axiom --version --features' },
            { title: 'Run Sanity Testbench', desc: 'Simulates sample RISC-V ALU in 2.8ms.', cmd: 'axiom sim examples/alu.sv --cycles 1000' }
          ]
        }
      }
    ]
  },
  {
    id: 'hdl_syntax',
    title: '2. SystemVerilog Syntax & Semantics',
    badge: 'HDL',
    sections: [
      {
        id: 'four_state_logic',
        title: '4-State Bit-Parallel Semantics',
        badge: 'SEMANTICS',
        content: {
          title: 'IEEE 1800 4-State Digital Logic',
          badge: 'BIT-PARALLEL',
          description: 'Axiom models 0, 1, X (Unknown), and Z (High Impedance) using paired 64-bit integer bitmasks, enabling 64 independent signal nets to be evaluated in a single clock cycle with zero conditional branching.',
          callout: {
            type: 'tip',
            title: 'SIMD Acceleration',
            text: 'When targeting AVX-512, Axiom bundles eight 64-bit words into a single 512-bit vector, evaluating 512 logic gates simultaneously per machine instruction.'
          },
          specs: [
            { param: 'State Packing', val: 'V (Value) bit + U (Unknown) bit', note: '2 bits per logical wire' },
            { param: '0 Logic Level', val: 'V = 0, U = 0', note: 'Deterministic Low' },
            { param: '1 Logic Level', val: 'V = 1, U = 0', note: 'Deterministic High' },
            { param: 'X Logic Level', val: 'V = 0, U = 1', note: 'Unknown Contention / Uninitialized' },
            { param: 'Z Logic Level', val: 'V = 1, U = 1', note: 'High-Impedance Floating' }
          ],
          verilogCode: `// 4-State Resolution on Tri-State Bus
module tristate_bus (
    input  wire       enable_a,
    input  wire [7:0] data_a,
    input  wire       enable_b,
    input  wire [7:0] data_b,
    inout  wire [7:0] shared_bus
);
    // If both enable_a and enable_b are high, Axiom resolves shared_bus to 8'hxx
    assign shared_bus = enable_a ? data_a : 8'hzz;
    assign shared_bus = enable_b ? data_b : 8'hzz;
endmodule`,
          svCode: `// Axiom Assertion: Detect Bus Contention
module bus_guard (
    input logic clk,
    input logic [7:0] bus_state
);
    // Assert no high-Z or unknown states on clock edge
    always_ff @(posedge clk) begin
        assert (!$isunknown(bus_state))
            else $warning("Axiom STA: Unknown X/Z detected on bus at cycle %0t", $time);
    end
endmodule`
        }
      }
    ]
  },
  {
    id: 'cranelift_jit',
    title: '3. Cranelift JIT Architecture',
    badge: 'JIT',
    sections: [
      {
        id: 'clif_lowering',
        title: 'In-RAM Netlist Lowering',
        badge: 'CLIF IR',
        content: {
          title: 'Direct AST to Cranelift Intermediate Representation',
          badge: 'PIPELINE',
          description: 'Axiom avoids generating intermediary C++ code. The elaborated netlist is converted into SSA basic blocks using Cranelift IR (CLIF), which is compiled directly to native machine code in microseconds.',
          callout: {
            type: 'spec',
            title: 'Compilation Benchmark',
            text: 'A 50,000-gate RISC-V core netlist compiles to executable native machine code in 2.81 milliseconds, whereas Verilator requires 4.82 seconds.'
          },
          specs: [
            { param: 'IR Representation', val: 'Cranelift CLIF SSA', note: 'Strict single static assignment' },
            { param: 'Optimization Level', val: 'Speed and Size', note: 'Dead-wire & constant propagation' },
            { param: 'Linkage Mode', val: 'In-Memory Function Pointers', note: 'No disk binary emission' }
          ]
        }
      }
    ]
  },
  {
    id: 'timing_waveform',
    title: '4. Timing & Waveforms',
    badge: 'DIAGNOSTICS',
    sections: [
      {
        id: 'sta_engine',
        title: 'Static Timing Analysis (STA)',
        badge: 'TIMING',
        content: {
          title: 'Topological Critical Path Slack Calculation',
          badge: 'STA',
          description: 'Integrated Static Timing Analysis calculates arrival times, required times, and slack margins across all flip-flop registers, guaranteeing setup and hold time compliance before FPGA or ASIC tape-out.',
          specs: [
            { param: 'Timing Model', val: 'Liberty (.lib) NLDM Table Interpolation', note: 'Industry standard cell delay' },
            { param: 'Delay Precision', val: 'Sub-picosecond (0.001 ps)', note: '64-bit IEEE float tracking' },
            { param: 'Slack Output', val: 'Setup Slack & Hold Slack', note: 'Identifies worst negative slack (WNS)' }
          ]
        }
      },
      {
        id: 'fst_streaming',
        title: 'Fast Signal Trace (FST) Engine',
        badge: 'FST / VCD',
        content: {
          title: 'High-Throughput Binary Waveform Streaming',
          badge: 'LZ4 COMPRESSION',
          description: 'Streams signal delta events into an in-memory lock-free SPSC ring buffer, compressing traces in real-time with LZ4 for a 12.4x reduction in storage size compared to standard VCD.',
          specs: [
            { param: 'Compression Ratio', val: '12.4x over plain VCD', note: 'LZ4 multi-stream block codec' },
            { param: 'Trace Latency', val: 'Sub-microsecond flush', note: 'Dedicated lock-free worker thread' },
            { param: 'Viewer Compatibility', val: 'GTKWave, Surfer, Axiom Studio', note: 'Standard FST binary format' }
          ]
        }
      }
    ]
  },
  {
    id: 'cli_api',
    title: '5. CLI & API Reference',
    badge: 'REFERENCE',
    sections: [
      {
        id: 'cli_reference',
        title: 'Axiom CLI Commands',
        badge: 'COMMAND LINE',
        content: {
          title: 'Axiom Command Line Interface',
          badge: 'CLI',
          description: 'Complete operational reference for compiling, elaborating, simulating, and generating waveforms using the native axiom binary.',
          steps: [
            { title: 'Interactive Simulation', desc: 'Simulate with live waveform dumping.', cmd: 'axiom sim rtl/top.sv --fst out.fst --cycles 50000' },
            { title: 'Static Timing Analysis', desc: 'Compute timing slack using Liberty library.', cmd: 'axiom sta rtl/top.sv --lib tech/tsmc28.lib --clock clk=500MHz' },
            { title: 'AST & Netlist Dump', desc: 'Export elaborated in-RAM netlist structure to JSON.', cmd: 'axiom dump rtl/top.sv --format json --output netlist.json' }
          ]
        }
      }
    ]
  }
];
