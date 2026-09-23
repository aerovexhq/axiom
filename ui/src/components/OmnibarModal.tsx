import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Zap,
  Activity,
  Cpu,
  Sliders,
  Clock,
  LayoutGrid,
  Play,
  RotateCcw,
  Download,
  BookOpen,
  ArrowRight,
  Sparkles,
  X,
  GitCompare
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { SAMPLE_DESIGNS, SampleDesign } from "../engine/sampleDesigns";
import { useTranslation } from "../i18n/i18nContext";

interface OmnibarModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulationState;
  onSelectView: (view: "waveform" | "schematic" | "virtuallab" | "timing" | "split") => void;
  onSelectDesign: (design: SampleDesign) => void;
  onSelectSignal: (signalId: string) => void;
  onCompile: () => void;
}

interface OmnibarItem {
  id: string;
  category: "Actions" | "Views" | "Signals" | "Designs" | "Docs";
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const OmnibarModal: React.FC<OmnibarModalProps> = ({
  isOpen,
  onClose,
  state,
  onSelectView,
  onSelectDesign,
  onSelectSignal,
  onCompile
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build Comprehensive Command Palette Item List
  const allItems = useMemo<OmnibarItem[]>(() => {
    const items: OmnibarItem[] = [];

    // 1. Actions
    items.push({
      id: "act_step_1ns",
      category: "Actions",
      title: "Step Simulation (+1 ns / 1000 ps)",
      subtitle: "Advances physical simulation time by 1 clock cycle",
      shortcut: "Space",
      icon: <Play size={14} color="var(--accent-blue)" />,
      action: () => {
        engineBridge.tick(1000);
        onClose();
      }
    });

    items.push({
      id: "act_step_delta",
      category: "Actions",
      title: "Step Single Zero-Time Delta Cycle (step_delta)",
      subtitle: "Executes discrete IEEE 1800 delta cycle to expose combinational glitches",
      shortcut: "Alt+D",
      icon: <Zap size={14} color="var(--accent-amber)" />,
      action: () => {
        engineBridge.stepDelta();
        onClose();
      }
    });

    items.push({
      id: "act_reset",
      category: "Actions",
      title: "Reset Simulation (t = 0 ps)",
      subtitle: "Re-initializes in-RAM state arena and restarts simulation",
      shortcut: "Ctrl+R",
      icon: <RotateCcw size={14} color="#f43f5e" />,
      action: () => {
        engineBridge.reset();
        onClose();
      }
    });

    items.push({
      id: "act_compile",
      category: "Actions",
      title: "In-RAM JIT Recompile Circuit",
      subtitle: "Compiles Verilog AST directly into native machine code in RAM",
      shortcut: "Ctrl+B",
      icon: <Cpu size={14} color="var(--accent-cyan)" />,
      action: () => {
        onCompile();
        onClose();
      }
    });

    items.push({
      id: "act_vcd",
      category: "Actions",
      title: "Export IEEE 1364 Value Change Dump (VCD)",
      subtitle: "Dumps complete digital waveform trace file",
      icon: <Download size={14} color="var(--accent-emerald)" />,
      action: () => {
        const vcd = engineBridge.exportVcd();
        const blob = new Blob([vcd], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${state.topModule}.vcd`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
      }
    });

    items.push({
      id: "act_saif",
      category: "Actions",
      title: "Export SAIF 2.0 Switching Activity",
      subtitle: "100% interoperable toggle rate exchange for Vivado power tools",
      icon: <Download size={14} color="var(--accent-purple)" />,
      action: () => {
        const saif = engineBridge.exportSaif();
        const blob = new Blob([saif], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${state.topModule}.saif`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
      }
    });

    items.push({
      id: "act_golden_vcd",
      category: "Actions",
      title: "Golden Model VCD Waveform Diffing",
      subtitle: "Import golden IEEE 1364 VCD trace and highlight silicon mismatches",
      icon: <GitCompare size={14} color="var(--accent-cyan)" />,
      action: () => {
        onSelectView("waveform");
        window.dispatchEvent(new CustomEvent("axiom_open_vcd_import"));
        onClose();
      }
    });

    items.push({
      id: "act_stimulus_generator",
      category: "Actions",
      title: "Visual Stimulus & Testbench Generator",
      subtitle: "Draw waveform drives, clock/glitch wizards, constrained random verification suite",
      icon: <Zap size={14} color="var(--accent-cyan)" />,
      action: () => {
        onSelectView("waveform");
        window.dispatchEvent(new CustomEvent("axiom_open_stimulus_generator"));
        onClose();
      }
    });

    // 2. Views
    items.push({
      id: "view_waveform",
      category: "Views",
      title: "Switch View: Digital Waveform Viewer",
      subtitle: "Multi-radix buses, dual-cursor measurement, delta-cycle accordion",
      icon: <Activity size={14} color="var(--accent-blue)" />,
      action: () => {
        onSelectView("waveform");
        onClose();
      }
    });

    items.push({
      id: "view_schematic",
      category: "Views",
      title: "Switch View: Hardware Schematic DAG",
      subtitle: "Layered DAG layout, semantic LOD, 1-click critical logic cone slicer",
      icon: <Cpu size={14} color="var(--accent-cyan)" />,
      action: () => {
        onSelectView("schematic");
        onClose();
      }
    });

    items.push({
      id: "view_virtuallab",
      category: "Views",
      title: "Switch View: Virtual Lab Stimulus Rack",
      subtitle: "Interactive DIP switches, momentary buttons, dual 7-segment displays",
      icon: <Sliders size={14} color="var(--accent-amber)" />,
      action: () => {
        onSelectView("virtuallab");
        onClose();
      }
    });

    items.push({
      id: "view_timing",
      category: "Views",
      title: "Switch View: Timing Radar & Energy Treemap",
      subtitle: "STA slack waterfall, CDC verification matrix, dynamic silicon treemap",
      icon: <Clock size={14} color="var(--accent-purple)" />,
      action: () => {
        onSelectView("timing");
        onClose();
      }
    });

    items.push({
      id: "view_split",
      category: "Views",
      title: "Switch View: Split Studio (All-in-One)",
      subtitle: "HDL code + Waveforms + Schematic DAG + Virtual Lab simultaneous studio",
      icon: <LayoutGrid size={14} color="var(--accent-emerald)" />,
      action: () => {
        onSelectView("split");
        onClose();
      }
    });

    // 3. Signals / Nets (Fuzzy Search & Cross-probe)
    state.signals.forEach((sig) => {
      items.push({
        id: `sig_${sig.id}`,
        category: "Signals",
        title: `Net: ${sig.name}`,
        subtitle: `Scope: ${sig.fullName} | Width: ${sig.width} bit | Samples: ${sig.samples.length}`,
        icon: <Zap size={14} color={sig.isBus ? "var(--accent-cyan)" : "var(--accent-emerald)"} />,
        action: () => {
          onSelectSignal(sig.id);
          onClose();
        }
      });
    });

    // 4. Sample Designs
    SAMPLE_DESIGNS.forEach((des) => {
      items.push({
        id: `des_${des.id}`,
        category: "Designs",
        title: `Load Design: ${des.name}`,
        subtitle: des.description,
        icon: <Sparkles size={14} color="var(--accent-cyan)" />,
        action: () => {
          onSelectDesign(des);
          onClose();
        }
      });
    });

    // 5. Documentation
    items.push({
      id: "doc_inram",
      category: "Docs",
      title: "Docs: In-RAM Cranelift JIT Architecture",
      subtitle: "Direct compilation of Verilog to native machine code with zero disk IO",
      icon: <BookOpen size={14} color="var(--text-muted)" />,
      action: () => {
        window.open("https://axiom.aerovex.net/architecture/in-ram-jit", "_blank");
        onClose();
      }
    });

    items.push({
      id: "doc_power",
      category: "Docs",
      title: "Docs: Physics-Informed Power & Voltage Sag Modeling",
      subtitle: "Dynamic switching capacitance (P = 1/2 C V^2 f alpha) and PDN droop",
      icon: <BookOpen size={14} color="var(--text-muted)" />,
      action: () => {
        window.open("https://axiom.aerovex.net/architecture/power-pdn-telemetry", "_blank");
        onClose();
      }
    });

    return items;
  }, [state, onSelectView, onSelectDesign, onSelectSignal, onCompile, onClose]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 15);
    const lower = query.toLowerCase();
    return allItems
      .filter((item) => item.title.toLowerCase().includes(lower) || (item.subtitle && item.subtitle.toLowerCase().includes(lower)))
      .slice(0, 15);
  }, [allItems, query]);

  // Handle Keyboard Navigation (Up, Down, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((idx) => (idx + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((idx) => (idx - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 200
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 640,
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-medium)",
          borderRadius: 8,
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Search Input Box */}
        <div
          style={{
            height: 48,
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 10
          }}
        >
          <Search size={16} color="var(--accent-cyan)" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t.modals.omnibarPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 13,
              fontFamily: "var(--font-sans)"
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 2
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px" }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No commands or signals matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 6,
                    backgroundColor: isSelected ? "var(--bg-tertiary)" : "transparent",
                    cursor: "pointer",
                    transition: "background-color 0.1s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 4, borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                      {item.icon}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "var(--accent-cyan)" : "#fff" }}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        color: "var(--text-muted)",
                        textTransform: "uppercase"
                      }}
                    >
                      {item.category}
                    </span>

                    {item.shortcut && (
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          padding: "1px 5px",
                          borderRadius: 3,
                          backgroundColor: "var(--bg-primary)",
                          color: "var(--accent-cyan)",
                          border: "1px solid var(--border-subtle)"
                        }}
                      >
                        {item.shortcut}
                      </span>
                    )}

                    {isSelected && <ArrowRight size={12} color="var(--accent-cyan)" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div
          style={{
            height: 28,
            backgroundColor: "var(--bg-primary)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            fontSize: 10,
            color: "var(--text-muted)"
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>Esc Close</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span>Axiom Omnibar</span>
            <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>Ctrl+K</span>
          </div>
        </div>
      </div>
    </div>
  );
};
