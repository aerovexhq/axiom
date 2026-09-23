import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Axiom EDA",
  description: "Next-Generation In-RAM HDL Processor, Cranelift JIT Simulator & Silicon Telemetry Engine",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",

  markdown: {
    math: true
  },

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
    ["link", { rel: "shortcut icon", href: "/favicon.ico" }],
    ["link", { rel: "apple-touch-icon", href: "/logo.png" }],
    ["meta", { name: "theme-color", content: "#0d0f12" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Axiom EDA — High-Performance HDL Simulator" }],
    ["meta", { property: "og:description", content: "In-RAM Cranelift JIT compilation, manual delta-cycle stepping, and physics-informed silicon telemetry." }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    ["link", { href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap", rel: "stylesheet" }]
  ],

  themeConfig: {
    logo: {
      src: "/logo.svg",
      alt: "Axiom EDA Logo"
    },
    siteTitle: "Axiom EDA",

    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "Studio UI", link: "/ui/overview" },
      { text: "Verilog HDL", link: "/languages/verilog/overview" },
      {
        text: "Languages",
        items: [
          { text: "Verilog HDL (IEEE 1364)", link: "/languages/verilog/overview" },
          { text: "SystemVerilog (IEEE 1800)", link: "/languages/systemverilog/overview" },
          { text: "VHDL (IEEE 1076)", link: "/languages/vhdl/overview" },
          { text: "XDC Constraints", link: "/languages/xdc/overview" },
          { text: "Xilinx Primitives", link: "/languages/primitives/overview" }
        ]
      },
      { text: "Architecture", link: "/architecture/in-ram-jit" },
      { text: "Vivado Migration", link: "/vivado/migration" },
      { text: "CLI Reference", link: "/reference/cli" },
      { text: "Web Studio", link: "/studio/", target: "_blank" },
      {
        text: "v1.0.0",
        items: [
          { text: "Changelog", link: "https://github.com/aerovexsim/axiom/releases" },
          { text: "Aerovex Platform", link: "https://aerovex.net" }
        ]
      }
    ],

    sidebar: {
      "/ui/": [
        {
          text: "Axiom Studio Workspace",
          items: [
            { text: "Studio Overview & Shortcuts", link: "/ui/overview" },
            { text: "Projects & File Sets", link: "/ui/projects-lifecycle" },
            { text: "Security & Sandboxing", link: "/ui/security-sandbox" }
          ]
        },
        {
          text: "Core Design & Edit Views",
          items: [
            { text: "Monaco HDL Editor & LSP", link: "/ui/monaco-editor" },
            { text: "Schematic DAG Visualizer", link: "/ui/schematic-viewer" },
            { text: "Virtual Lab & Basys 3", link: "/ui/virtual-lab" }
          ]
        },
        {
          text: "Analysis & Telemetry Views",
          items: [
            { text: "Waveforms & Logic Analyzer", link: "/ui/waveform-viewer" },
            { text: "Timing Radar & STA", link: "/ui/timing-radar" },
            { text: "Silicon Telemetry & Energy", link: "/ui/telemetry-energy" }
          ]
        },
        {
          text: "Advanced Synthesis & Floorplanning",
          items: [
            { text: "Technology Mapping", link: "/ui/tech-mapping" },
            { text: "Silicon Floorplanning", link: "/ui/floorplanning" },
            { text: "Formal Verification (BMC)", link: "/ui/formal-verification" },
            { text: "Protocol Analyzer", link: "/ui/protocol-analyzer" },
            { text: "Microarchitecture & Multi-Die", link: "/ui/microarchitecture" }
          ]
        },
        {
          text: "Controls & Diagnostics",
          items: [
            { text: "Simulation Dock & Console", link: "/ui/simulation-dock" }
          ]
        }
      ],

      "/languages/verilog/": [
        {
          text: "Verilog HDL (IEEE 1364)",
          items: [
            { text: "Language Overview", link: "/languages/verilog/overview" },
            { text: "Data Types & Nets", link: "/languages/verilog/data-types-nets" },
            { text: "Operators & Expressions", link: "/languages/verilog/operators-expressions" },
            { text: "Continuous Assignments", link: "/languages/verilog/continuous-assigns" },
            { text: "Procedural Blocks & Timing", link: "/languages/verilog/procedural-blocks" },
            { text: "Control Flow Statements", link: "/languages/verilog/control-flow" },
            { text: "Modules & Hierarchy", link: "/languages/verilog/modules-hierarchy" },
            { text: "Tasks & Functions", link: "/languages/verilog/tasks-functions" },
            { text: "System Tasks & I/O", link: "/languages/verilog/system-tasks" },
            { text: "Static Linter Rules", link: "/languages/verilog/linter-diagnostics" }
          ]
        },
        {
          text: "Other Languages",
          items: [
            { text: "SystemVerilog (IEEE 1800)", link: "/languages/systemverilog/overview" },
            { text: "VHDL (IEEE 1076)", link: "/languages/vhdl/overview" },
            { text: "XDC Constraints", link: "/languages/xdc/overview" },
            { text: "Xilinx Primitives", link: "/languages/primitives/overview" }
          ]
        }
      ],

      "/languages/systemverilog/": [
        {
          text: "SystemVerilog (IEEE 1800)",
          items: [
            { text: "Language Overview", link: "/languages/systemverilog/overview" },
            { text: "Data Types & Declarations", link: "/languages/systemverilog/types-declarations" },
            { text: "Specialized Processes", link: "/languages/systemverilog/specialized-processes" },
            { text: "Interfaces & Packages", link: "/languages/systemverilog/interfaces-packages" },
            { text: "Assertions (SVA) & Formal", link: "/languages/systemverilog/assertions-sva" },
            { text: "Constrained Randomization", link: "/languages/systemverilog/constrained-random" }
          ]
        },
        {
          text: "Other Languages",
          items: [
            { text: "Verilog HDL (IEEE 1364)", link: "/languages/verilog/overview" },
            { text: "VHDL (IEEE 1076)", link: "/languages/vhdl/overview" },
            { text: "XDC Constraints", link: "/languages/xdc/overview" },
            { text: "Xilinx Primitives", link: "/languages/primitives/overview" }
          ]
        }
      ],

      "/languages/vhdl/": [
        {
          text: "VHDL (IEEE 1076)",
          items: [
            { text: "Language Overview", link: "/languages/vhdl/overview" },
            { text: "Entities & Architectures", link: "/languages/vhdl/entities-architectures" },
            { text: "Packages & Types", link: "/languages/vhdl/packages-types" },
            { text: "Concurrent & Sequential", link: "/languages/vhdl/concurrent-sequential" },
            { text: "VHDL Linter Diagnostics", link: "/languages/vhdl/linter-rules" }
          ]
        },
        {
          text: "Other Languages",
          items: [
            { text: "Verilog HDL (IEEE 1364)", link: "/languages/verilog/overview" },
            { text: "SystemVerilog (IEEE 1800)", link: "/languages/systemverilog/overview" },
            { text: "XDC Constraints", link: "/languages/xdc/overview" },
            { text: "Xilinx Primitives", link: "/languages/primitives/overview" }
          ]
        }
      ],

      "/languages/xdc/": [
        {
          text: "Xilinx Design Constraints (XDC)",
          items: [
            { text: "Constraints Architecture", link: "/languages/xdc/overview" },
            { text: "Physical Constraints", link: "/languages/xdc/physical-constraints" },
            { text: "Clock Constraints", link: "/languages/xdc/clock-constraints" },
            { text: "I/O Timing Constraints", link: "/languages/xdc/io-timing" },
            { text: "Timing Exceptions", link: "/languages/xdc/timing-exceptions" },
            { text: "Monaco XDC Language Server", link: "/languages/xdc/lsp-and-validation" }
          ]
        },
        {
          text: "Other Languages",
          items: [
            { text: "Verilog HDL (IEEE 1364)", link: "/languages/verilog/overview" },
            { text: "SystemVerilog (IEEE 1800)", link: "/languages/systemverilog/overview" },
            { text: "VHDL (IEEE 1076)", link: "/languages/vhdl/overview" },
            { text: "Xilinx Primitives", link: "/languages/primitives/overview" }
          ]
        }
      ],

      "/languages/primitives/": [
        {
          text: "Xilinx Primitive Library",
          items: [
            { text: "In-Engine Architecture", link: "/languages/primitives/overview" },
            { text: "CLB & Logic Cells", link: "/languages/primitives/clb-and-logic" },
            { text: "Clocking & I/O Buffers", link: "/languages/primitives/clocking-and-io" },
            { text: "DSP48 Arithmetic Slices", link: "/languages/primitives/dsp-slices" },
            { text: "Block RAM (RAMB)", link: "/languages/primitives/block-ram" }
          ]
        },
        {
          text: "Other Languages",
          items: [
            { text: "Verilog HDL (IEEE 1364)", link: "/languages/verilog/overview" },
            { text: "SystemVerilog (IEEE 1800)", link: "/languages/systemverilog/overview" },
            { text: "VHDL (IEEE 1076)", link: "/languages/vhdl/overview" },
            { text: "XDC Constraints", link: "/languages/xdc/overview" }
          ]
        }
      ],

      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction & Manifesto", link: "/guide/introduction" },
            { text: "Quickstart (60-Second Setup)", link: "/guide/quickstart" },
            { text: "Desktop & Web Architecture", link: "/guide/desktop-web" }
          ]
        }
      ],

      "/architecture/": [
        {
          text: "Core Architecture",
          items: [
            { text: "In-RAM Cranelift JIT", link: "/architecture/in-ram-jit" },
            { text: "4-State Logic State Arena", link: "/architecture/four-state-arena" },
            { text: "Stratified Event Scheduler", link: "/architecture/stratified-scheduler" },
            { text: "Physics Power & PDN Telemetry", link: "/architecture/power-pdn-telemetry" }
          ]
        }
      ],

      "/vivado/": [
        {
          text: "Vivado Design Suite Parity",
          items: [
            { text: "Migration from Vivado", link: "/vivado/migration" },
            { text: "SAIF & VCD Interoperability", link: "/vivado/saif-vcd-interop" },
            { text: "Feature Comparison Matrix", link: "/vivado/feature-matrix" }
          ]
        }
      ],

      "/reference/": [
        {
          text: "Reference Manual",
          items: [
            { text: "CLI Commands & Options", link: "/reference/cli" }
          ]
        }
      ]
    },

    search: {
      provider: "local"
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/aerovexsim/axiom" }
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright (c) 2026 Aerovex. Built with high-performance Rust & Cranelift."
    }
  }
});

