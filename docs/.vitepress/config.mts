import { defineConfig } from "vitepress";
import { LOCALES_DATA, getNav, getSidebar } from "./locales";

export default defineConfig({
  title: "Axiom EDA",
  description: "Next-Generation In-RAM HDL Processor, Cranelift JIT Simulator & Silicon Telemetry Engine",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",

  locales: {
    root: {
      label: LOCALES_DATA.en.label,
      lang: LOCALES_DATA.en.lang,
      description: LOCALES_DATA.en.description,
      themeConfig: {
        nav: getNav(""),
        sidebar: getSidebar(""),
        outline: {
          label: LOCALES_DATA.en.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.en.docFooterPrev,
          next: LOCALES_DATA.en.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.en.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.en.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.en.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.en.returnToTopLabel
      }
    },
    tr: {
      label: LOCALES_DATA.tr.label,
      lang: LOCALES_DATA.tr.lang,
      link: "/tr/",
      description: LOCALES_DATA.tr.description,
      themeConfig: {
        nav: getNav("/tr", "tr"),
        sidebar: getSidebar("/tr", "tr"),
        outline: {
          label: LOCALES_DATA.tr.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.tr.docFooterPrev,
          next: LOCALES_DATA.tr.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.tr.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.tr.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.tr.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.tr.returnToTopLabel
      }
    },
    de: {
      label: LOCALES_DATA.de.label,
      lang: LOCALES_DATA.de.lang,
      link: "/de/",
      description: LOCALES_DATA.de.description,
      themeConfig: {
        nav: getNav("/de", "de"),
        sidebar: getSidebar("/de", "de"),
        outline: {
          label: LOCALES_DATA.de.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.de.docFooterPrev,
          next: LOCALES_DATA.de.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.de.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.de.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.de.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.de.returnToTopLabel
      }
    },
    ja: {
      label: LOCALES_DATA.ja.label,
      lang: LOCALES_DATA.ja.lang,
      link: "/ja/",
      description: LOCALES_DATA.ja.description,
      themeConfig: {
        nav: getNav("/ja", "ja"),
        sidebar: getSidebar("/ja", "ja"),
        outline: {
          label: LOCALES_DATA.ja.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.ja.docFooterPrev,
          next: LOCALES_DATA.ja.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.ja.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.ja.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.ja.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.ja.returnToTopLabel
      }
    },
    zh: {
      label: LOCALES_DATA.zh.label,
      lang: LOCALES_DATA.zh.lang,
      link: "/zh/",
      description: LOCALES_DATA.zh.description,
      themeConfig: {
        nav: getNav("/zh", "zh"),
        sidebar: getSidebar("/zh", "zh"),
        outline: {
          label: LOCALES_DATA.zh.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.zh.docFooterPrev,
          next: LOCALES_DATA.zh.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.zh.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.zh.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.zh.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.zh.returnToTopLabel
      }
    },
    es: {
      label: LOCALES_DATA.es.label,
      lang: LOCALES_DATA.es.lang,
      link: "/es/",
      description: LOCALES_DATA.es.description,
      themeConfig: {
        nav: getNav("/es", "es"),
        sidebar: getSidebar("/es", "es"),
        outline: {
          label: LOCALES_DATA.es.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.es.docFooterPrev,
          next: LOCALES_DATA.es.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.es.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.es.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.es.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.es.returnToTopLabel
      }
    },
    fr: {
      label: LOCALES_DATA.fr.label,
      lang: LOCALES_DATA.fr.lang,
      link: "/fr/",
      description: LOCALES_DATA.fr.description,
      themeConfig: {
        nav: getNav("/fr", "fr"),
        sidebar: getSidebar("/fr", "fr"),
        outline: {
          label: LOCALES_DATA.fr.outlineTitle
        },
        docFooter: {
          prev: LOCALES_DATA.fr.docFooterPrev,
          next: LOCALES_DATA.fr.docFooterNext
        },
        lastUpdated: {
          text: LOCALES_DATA.fr.lastUpdatedText
        },
        darkModeSwitchLabel: LOCALES_DATA.fr.darkModeSwitchLabel,
        sidebarMenuLabel: LOCALES_DATA.fr.sidebarMenuLabel,
        returnToTopLabel: LOCALES_DATA.fr.returnToTopLabel
      }
    }
  },

  markdown: {
    math: true
  },

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
    ["link", { rel: "shortcut icon", href: "/favicon.ico" }],
    ["link", { rel: "apple-touch-icon", href: "/logo.png" }],
    ["meta", { name: "theme-color", content: "#0d0f12" }],
    ["meta", { name: "color-scheme", content: "dark" }],
    ["meta", { name: "author", content: "Aerovex Simulation & Computing" }],
    ["meta", { name: "robots", content: "index, follow" }],
    ["meta", { name: "keywords", content: "EDA, HDL, Verilog, SystemVerilog, VHDL, FPGA, Vivado, Rust, Cranelift, JIT, Simulation, Digital Design, Static Timing Analysis, Waveform Viewer, Basys 3, Nexys A7, Aerovex" }],
    ["meta", { name: "application-name", content: "Axiom EDA" }],
    ["meta", { name: "apple-mobile-web-app-title", content: "Axiom EDA" }],
    ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
    ["meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }],
    ["meta", { name: "mobile-web-app-capable", content: "yes" }],
    ["meta", { name: "msapplication-TileColor", content: "#0d0f12" }],

    // Open Graph / Facebook
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Axiom EDA" }],
    ["meta", { property: "og:url", content: "https://axiom.aerovex.net/" }],
    ["meta", { property: "og:title", content: "Axiom EDA — Aerospace-Grade In-RAM HDL Simulator & Studio" }],
    ["meta", { property: "og:description", content: "High-performance Rust remake of Vivado: In-RAM Cranelift JIT compilation, stratified event queue, manual delta-cycle introspection, and physics-informed silicon telemetry." }],
    ["meta", { property: "og:image", content: "https://axiom.aerovex.net/logo.png" }],
    ["meta", { property: "og:image:width", content: "512" }],
    ["meta", { property: "og:image:height", content: "512" }],
    ["meta", { property: "og:image:alt", content: "Axiom EDA - High-Performance Silicon HDL Engine" }],
    ["meta", { property: "og:locale", content: "en_US" }],

    // Twitter / X Cards
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:site", content: "@aerovex" }],
    ["meta", { name: "twitter:creator", content: "@aerovex" }],
    ["meta", { name: "twitter:title", content: "Axiom EDA — Aerospace-Grade In-RAM HDL Simulator & Studio" }],
    ["meta", { name: "twitter:description", content: "High-performance Rust remake of Vivado: In-RAM Cranelift JIT compilation, stratified delta-cycle introspection, and physics-informed silicon telemetry." }],
    ["meta", { name: "twitter:image", content: "https://axiom.aerovex.net/logo.png" }],
    ["meta", { name: "twitter:image:alt", content: "Axiom EDA - High-Performance Silicon HDL Engine" }],

    // Typography
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

