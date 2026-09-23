// Axiom Visualizer Tab Bar — Responsive Tab Fitting with Dynamic 3-Dot Overflow
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import {
  Cpu,
  Boxes,
  Sliders,
  Activity,
  Clock,
  Layers,
  Gauge,
  Radio,
  ShieldCheck,
  LayoutGrid,
  Box,
  Workflow,
  MoreVertical,
  Check,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useTranslation } from "../i18n";

export interface VisualizerTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  title: string;
}

const ALL_VISUALIZER_TABS: VisualizerTabItem[] = [
  {
    id: "schematic",
    label: "Schematic",
    icon: <Cpu size={12} />,
    color: "var(--accent-cyan)",
    title: "IEEE Gate-Level Schematic DAG & Interactive Logic Graph"
  },
  {
    id: "fsm",
    label: "FSM",
    icon: <Workflow size={12} />,
    color: "var(--accent-purple, #a855f7)",
    title: "Finite State Machine Transition Bubble Graph & State Vectors"
  },
  {
    id: "package",
    label: "Package",
    icon: <Box size={12} />,
    color: "var(--accent-cyan)",
    title: "Silicon Package Pinout & BGA/QFP Ball Grid Array Mapping"
  },
  {
    id: "microarch",
    label: "Architecture",
    icon: <Boxes size={12} />,
    color: "var(--accent-purple, #a855f7)",
    title: "Microarchitecture Block Diagram & Register Datapath"
  },
  {
    id: "virtuallab",
    label: "Lab",
    icon: <Sliders size={12} />,
    color: "var(--accent-amber)",
    title: "Interactive Virtual Lab Rack (DIP switches, buttons, probes)"
  },
  {
    id: "waveform",
    label: "Waveforms",
    icon: <Activity size={12} />,
    color: "var(--accent-blue)",
    title: "Stratified IEEE 1800 Multi-Radix Waveform Traces"
  },
  {
    id: "timing",
    label: "Timing",
    icon: <Clock size={12} />,
    color: "var(--accent-purple)",
    title: "Static Timing Analysis & Dynamic Energy Treemap"
  },
  {
    id: "multidie",
    label: "Multi-Die",
    icon: <Layers size={12} />,
    color: "var(--accent-cyan, #06b6d4)",
    title: "Multi-FPGA Partitioning & Silicon Interposer Floorplan (SLRs, SLLs, Laguna Registers)"
  },
  {
    id: "ppa",
    label: "PPA",
    icon: <Gauge size={12} />,
    color: "var(--accent-purple, #a855f7)",
    title: "Live PPA Pareto Frontier & Multi-Part Silicon Cost Forecaster (Power, Performance, Area, ASIC)"
  },
  {
    id: "protocol",
    label: "Protocol",
    icon: <Radio size={12} />,
    color: "var(--accent-cyan)",
    title: "Live Hardware Protocol Analyzer & Wireshark PCAP Inspector (CAN, USB, Ethernet, UART, SPI, I2C, AXI)"
  },
  {
    id: "techmapping",
    label: "Tech Map",
    icon: <Cpu size={12} />,
    color: "var(--accent-purple, #a855f7)",
    title: "FPGA Technology Mapping, LUT Truth Tables, Primitive Synthesis & Structural Verilog Netlist"
  },
  {
    id: "formal",
    label: "Formal",
    icon: <ShieldCheck size={12} />,
    color: "var(--accent-blue, #388bfd)",
    title: "Formal Property Verification, Bounded Model Checking (BMC) & SVA Assertions"
  },
  {
    id: "floorplan",
    label: "Floorplan",
    icon: <LayoutGrid size={12} />,
    color: "var(--accent-green, #2ea043)",
    title: "Physical Silicon Floorplan & Gate Netlist Studio"
  }
];

// Approximate width per tab in pixels (icon + text + padding + gap)
function estimateTabWidth(label: string): number {
  return 38 + label.length * 7.5;
}

interface VisualizerTabBarProps {
  activeVisualizer: string;
  onSelectVisualizer: (viewId: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const VisualizerTabBar: React.FC<VisualizerTabBarProps> = ({
  activeVisualizer,
  onSelectVisualizer,
  isMaximized = false,
  onToggleMaximize
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Ordered list of tab IDs, starting from default layout
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    return ALL_VISUALIZER_TABS.map((tab) => tab.id);
  });

  // Observe container width changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  // Map of tab descriptors by ID
  const tabsById = useMemo(() => {
    const map = new Map<string, VisualizerTabItem>();
    for (const tab of ALL_VISUALIZER_TABS) {
      map.set(tab.id, tab);
    }
    return map;
  }, []);

  // Compute visible vs overflowing tabs based on containerWidth
  const { visibleTabs, overflowTabs } = useMemo(() => {
    // Actions on the right (maximize button: ~32px, 3-dots button: ~28px, padding/margin: ~16px)
    const rightReserve = onToggleMaximize ? 76 : 44;
    const availableWidth = Math.max(120, containerWidth - rightReserve);

    let currentWidth = 0;
    const visible: VisualizerTabItem[] = [];
    const overflow: VisualizerTabItem[] = [];

    // Ensure we have tabs mapped
    const currentOrderedTabs = orderedIds
      .map((id) => tabsById.get(id))
      .filter((tab): tab is VisualizerTabItem => tab !== undefined);

    for (let i = 0; i < currentOrderedTabs.length; i++) {
      const tab = currentOrderedTabs[i];
      const w = estimateTabWidth(tab.label);

      // We reserve space for the 3-dots button if there are subsequent items
      const neededWidth = currentWidth + w;
      const willHaveOverflow = i < currentOrderedTabs.length - 1;
      const maxAllowed = willHaveOverflow ? availableWidth - 28 : availableWidth;

      if (neededWidth <= maxAllowed || visible.length === 0) {
        visible.push(tab);
        currentWidth += w;
      } else {
        overflow.push(tab);
      }
    }

    return { visibleTabs: visible, overflowTabs: overflow };
  }, [containerWidth, orderedIds, tabsById, onToggleMaximize]);

  // If the activeVisualizer is currently in the overflow stack,
  // automatically promote it to replace the last visible tab item
  useLayoutEffect(() => {
    const isVisible = visibleTabs.some((t) => t.id === activeVisualizer);
    if (!isVisible && visibleTabs.length > 0) {
      setOrderedIds((prev) => {
        const activeIdx = prev.indexOf(activeVisualizer);
        if (activeIdx === -1) return prev;

        const lastVisibleIdx = visibleTabs.length - 1;
        const lastVisibleId = visibleTabs[lastVisibleIdx].id;
        const targetIdx = prev.indexOf(lastVisibleId);

        if (targetIdx === -1) return prev;

        const next = [...prev];
        // Swap positions
        next[targetIdx] = activeVisualizer;
        next[activeIdx] = lastVisibleId;
        return next;
      });
    }
  }, [activeVisualizer, visibleTabs]);

  // When user clicks an overflowing tab from the 3-dot dropdown:
  // Swap it with the last visible item and accumulate as needed
  const handleSelectOverflowTab = (tabId: string) => {
    setOrderedIds((prev) => {
      const activeIdx = prev.indexOf(tabId);
      if (activeIdx === -1) return prev;

      const lastVisibleIdx = Math.max(0, visibleTabs.length - 1);
      const lastVisibleId = visibleTabs[lastVisibleIdx]?.id;
      const targetIdx = lastVisibleId ? prev.indexOf(lastVisibleId) : 0;

      const next = [...prev];
      if (targetIdx !== -1 && activeIdx !== -1) {
        next[targetIdx] = tabId;
        next[activeIdx] = lastVisibleId;
      }
      return next;
    });

    onSelectVisualizer(tabId);
    setIsDropdownOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        height: 32,
        minHeight: 32,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px 0 10px",
        overflow: "hidden",
        position: "relative",
        userSelect: "none"
      }}
    >
      {/* Left: Visible Tabs List */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          minWidth: 0,
          flex: 1,
          overflow: "hidden"
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeVisualizer === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectVisualizer(tab.id)}
              title={tab.title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11.5,
                fontWeight: isActive ? 600 : 400,
                padding: "2px 7px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                color: isActive ? tab.color : "var(--text-muted)",
                border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.12s ease"
              }}
            >
              {tab.icon}
              <span style={{ whiteSpace: "nowrap" }}>{tab.label}</span>
            </button>
          );
        })}

        {/* 3-Dot Overflow Menu Button */}
        {overflowTabs.length > 0 && (
          <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              title={`${t("header.moreTabs")} (${overflowTabs.length})`}
              aria-label={t("header.moreTabs")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 22,
                borderRadius: "var(--radius-sm)",
                backgroundColor: isDropdownOpen
                  ? "rgba(6, 182, 212, 0.15)"
                  : "var(--bg-tertiary)",
                border: isDropdownOpen
                  ? "1px solid var(--accent-cyan)"
                  : "1px solid var(--border-subtle)",
                color: isDropdownOpen ? "var(--accent-cyan)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.12s ease",
                marginLeft: 2
              }}
            >
              <MoreVertical size={13} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 100,
                  minWidth: 190,
                  backgroundColor: "var(--bg-secondary)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                  padding: "4px 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1
                }}
              >
                <div
                  style={{
                    padding: "4px 10px 3px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    borderBottom: "1px solid var(--border-subtle)",
                    marginBottom: 3
                  }}
                >
                  {t("header.moreTabs")}
                </div>

                {overflowTabs.map((tab) => {
                  const isActive = activeVisualizer === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectOverflowTab(tab.id)}
                      title={tab.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "5px 10px",
                        backgroundColor: isActive ? "rgba(6, 182, 212, 0.1)" : "transparent",
                        border: "none",
                        color: isActive ? tab.color : "var(--text-secondary)",
                        fontSize: 11.5,
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        gap: 8,
                        transition: "background-color 0.1s ease"
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <span style={{ color: tab.color, display: "flex", alignItems: "center" }}>
                          {tab.icon}
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tab.label}
                        </span>
                      </div>
                      {isActive && <Check size={12} color="var(--accent-cyan)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions Strip (Maximize / Restore) */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 6 }}>
        {onToggleMaximize && (
          <button
            type="button"
            onClick={onToggleMaximize}
            title={isMaximized ? t("header.restore") : t("header.maximize")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 22,
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.12s ease"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {isMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        )}
      </div>
    </div>
  );
};
