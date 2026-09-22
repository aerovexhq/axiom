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

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction & Manifesto", link: "/guide/introduction" },
          { text: "Quickstart (60-Second Setup)", link: "/guide/quickstart" },
          { text: "Desktop & Web Architecture", link: "/guide/desktop-web" }
        ]
      },
      {
        text: "Core Architecture",
        items: [
          { text: "In-RAM Cranelift JIT", link: "/architecture/in-ram-jit" },
          { text: "4-State Logic State Arena", link: "/architecture/four-state-arena" },
          { text: "Stratified Event Scheduler", link: "/architecture/stratified-scheduler" },
          { text: "Physics Power & PDN Telemetry", link: "/architecture/power-pdn-telemetry" }
        ]
      },
      {
        text: "Vivado Design Suite Parity",
        items: [
          { text: "Migration from Vivado", link: "/vivado/migration" },
          { text: "SAIF & VCD Interoperability", link: "/vivado/saif-vcd-interop" },
          { text: "Feature Comparison Matrix", link: "/vivado/feature-matrix" }
        ]
      },
      {
        text: "Reference Manual",
        items: [
          { text: "CLI Commands & Options", link: "/reference/cli" }
        ]
      }
    ],

    search: {
      provider: "local"
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/aerovexsim/axiom" }
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Aerovex. Built with high-performance Rust & Cranelift."
    }
  }
});
