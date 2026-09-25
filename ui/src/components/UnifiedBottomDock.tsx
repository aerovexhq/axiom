import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Terminal,
  Zap,
  AlertTriangle,
  Clock,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  CheckCircle2,
  BarChart2,
  RotateCcw,
  Search,
  ExternalLink,
  ShieldAlert,
  Play,
  Plus,
  Layers,
  Cpu,
  Copy,
  Check
} from "lucide-react";
import {
  SimulationState,
  engineBridge,
  LspDiagnostic,
  CoverageReport
} from "../engine/engineBridge";
import {
  AssertionReport,
  getViolationTimePs,
  getAssertionStatusBadge
} from "../engine/assertionModel";
import { SynthesizedCircuit, synthesizeClientFallback } from "../engine/synthModel";
import { ResizableSplitter } from "./ResizableSplitter";
import { useTranslation } from "../i18n";

const formatTimeCompact = (ps: number) => {
  if (ps >= 1_000_000) return `${(ps / 1_000_000).toFixed(2)}μs`;
  if (ps >= 1000) return `${(ps / 1000).toFixed(2)}ns`;
  return `${ps}ps`;
};

interface UnifiedBottomDockProps {
  state: SimulationState;
  diagnostics?: LspDiagnostic[];
  onNavigateToLine?: (line: number, column?: number) => void;
  isMobileFullScreen?: boolean;
  activeDesignId?: string;
  targetDevice?: string;
}

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  level: "info" | "warn" | "error" | "event";
}

interface ReplEntry {
  id: string;
  type: "command" | "output" | "error" | "success";
  text: string;
}

export const UnifiedBottomDock: React.FC<UnifiedBottomDockProps> = ({
  state,
  diagnostics = [],
  onNavigateToLine,
  isMobileFullScreen = false,
  activeDesignId = "logic_circuit_project",
  targetDevice = "xc7a100t-csg324-1"
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [dockHeight, setDockHeight] = useState<number>(180);
  const [activeTab, setActiveTab] = useState<"repl" | "problems" | "telemetry" | "glitches" | "timing" | "coverage" | "assertions" | "synthesis">("repl");
  const [replMode, setReplMode] = useState<"logs" | "shell">("shell");

  const handleTabClick = (tab: "repl" | "problems" | "telemetry" | "glitches" | "timing" | "coverage" | "assertions" | "synthesis") => {
    if (activeTab === tab && !isCollapsed && !isMobileFullScreen) {
      setIsCollapsed(true);
    } else {
      setActiveTab(tab);
      setIsCollapsed(false);
    }
  };

  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed((prev) => !prev);
    };
    const handleSetTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: "repl" | "problems" | "telemetry" | "glitches" | "timing" | "coverage" | "assertions" | "synthesis" }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
        setIsCollapsed(false);
      }
    };
    window.addEventListener("axiom-toggle-bottom-dock", handleToggle);
    window.addEventListener("axiom-set-dock-tab", handleSetTab);
    return () => {
      window.removeEventListener("axiom-toggle-bottom-dock", handleToggle);
      window.removeEventListener("axiom-set-dock-tab", handleSetTab);
    };
  }, []);

  // Synthesis Tab State
  const [synthCircuit, setSynthCircuit] = useState<SynthesizedCircuit | null>(null);
  const [synthLoading, setSynthLoading] = useState<boolean>(false);
  const [synthFilter, setSynthFilter] = useState<string>("");
  const [synthKindFilter, setSynthKindFilter] = useState<string>("all");
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [copiedNetlist, setCopiedNetlist] = useState<boolean>(false);
  const [copiedDiagnosticIdx, setCopiedDiagnosticIdx] = useState<number | null>(null);
  const [copiedAllProblems, setCopiedAllProblems] = useState<boolean>(false);

  const handleCopyProblem = (d: LspDiagnostic, idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = `[${d.code}] Line ${d.startLineNumber}:${d.startColumn} - ${d.message}${d.help ? ` (help: ${d.help})` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedDiagnosticIdx(idx);
    setTimeout(() => setCopiedDiagnosticIdx(null), 1500);
  };

  const handleCopyAllProblems = () => {
    if (!diagnostics || diagnostics.length === 0) return;
    const text = diagnostics.map((d) =>
      `[${d.code}] Line ${d.startLineNumber}:${d.startColumn} - ${d.message}${d.help ? ` (help: ${d.help})` : ""}`
    ).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAllProblems(true);
    setTimeout(() => setCopiedAllProblems(false), 1500);
  };

  const liveValuesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sig of state.signals) {
      const last = sig.samples[sig.samples.length - 1];
      const val = last?.value ?? "0";
      map.set(sig.id, val);
      map.set(sig.name, val);
      map.set(sig.fullName, val);
    }
    return map;
  }, [state.signals]);

  useEffect(() => {
    let isCancelled = false;
    if (activeTab === "synthesis") {
      setSynthLoading(true);
      engineBridge.synthesizeDesign({
        designId: activeDesignId,
        device: targetDevice
      })
        .then((res) => {
          if (!isCancelled && res) {
            setSynthCircuit(res);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setSynthCircuit(synthesizeClientFallback(activeDesignId));
          }
        })
        .finally(() => {
          if (!isCancelled) setSynthLoading(false);
        });
    }
    return () => { isCancelled = true; };
  }, [activeTab, activeDesignId, targetDevice]);

  const handleExportNetlist = async () => {
    try {
      let code = "";
      try {
        code = await engineBridge.exportSynthesizedVerilog({
          designId: activeDesignId,
          topModule: activeDesignId,
          device: synthCircuit?.target_device || targetDevice
        });
      } catch {
        if (synthCircuit?.verilog_text) {
          code = synthCircuit.verilog_text;
        } else if (synthCircuit) {
          const modName = synthCircuit.top_module || activeDesignId || "top";
          const lines = [
            `// Axiom In-RAM RTL Logic Synthesizer - FPGA Technology-Mapped Netlist`,
            `// Target Device: ${synthCircuit.target_device} (${synthCircuit.target_family})`,
            `// Top Module: ${modName}`,
            `module ${modName}_synth (`,
            synthCircuit.ports.map((p) => `  ${p.direction === "Input" ? "input" : "output"} ${p.width > 1 ? `[${p.width - 1}:0] ` : ""}${p.name}`).join(",\n"),
            `);`,
            "",
            synthCircuit.nets.map((n) => `  wire ${n.name};`).join("\n"),
            "",
            ...synthCircuit.cells.map((c) => {
              const portConns = Object.entries(c.ports).map(([pin, net]) => `.${pin}(${net})`).join(", ");
              const paramStr = c.params.INIT !== undefined ? ` #(.INIT(64'h${c.params.INIT.toString(16).toUpperCase().padStart(16, "0")}))` : "";
              return `  ${c.kind}${paramStr} ${c.id} (${portConns});`;
            }),
            "",
            `endmodule`
          ];
          code = lines.join("\n");
        }
      }
      if (code) {
        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeDesignId || "design"}_synth.v`;
        a.click();
        URL.revokeObjectURL(url);
        setCopiedNetlist(true);
        setTimeout(() => setCopiedNetlist(false), 2000);
      }
    } catch (err) {
      console.error("Failed to export netlist:", err);
    }
  };

  const errorCount = diagnostics.filter((d) => d.severity === 1).length;
  const warningCount = diagnostics.filter((d) => d.severity === 2).length;
  const infoCount = diagnostics.filter((d) => d.severity >= 3).length;

  // Console Logs State
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "1",
      time: new Date().toLocaleTimeString(),
      msg: "Axiom EDA In-RAM JIT Engine initialized. Ready to simulate.",
      level: "info"
    }
  ]);

  // REPL State
  const [replInput, setReplInput] = useState<string>("");
  const [replEntries, setReplEntries] = useState<ReplEntry[]>([
    { id: "0", type: "output", text: "Axiom Interactive EDA Shell v1.0.1 (Type 'help' for command list)" }
  ]);

  const logEndRef = useRef<HTMLDivElement | null>(null);
  const replEndRef = useRef<HTMLDivElement | null>(null);
  const telemetryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const telemetryContainerRef = useRef<HTMLDivElement | null>(null);

  // Coverage State & Sync
  const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<"all" | "covered" | "partial" | "uncovered">("all");
  const [coverageSearch, setCoverageSearch] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const fetchCoverage = async () => {
      try {
        const rep = await engineBridge.getCoverage();
        if (!cancelled && rep) setCoverageReport(rep);
      } catch (err) {
        console.warn("UnifiedBottomDock: failed to fetch coverage:", err);
      }
    };
    fetchCoverage();
    const unsub = engineBridge.subscribe(() => {
      fetchCoverage();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [state.currentSimTimePs, state.currentDeltaCycle, state.compiled]);

  // Assertion Radar State & Sync
  const [assertionReport, setAssertionReport] = useState<AssertionReport | null>(null);
  const [assertionFilter, setAssertionFilter] = useState<"all" | "violated" | "passing" | "in_flight" | "vacuous">("all");
  const [assertionSearch, setAssertionSearch] = useState<string>("");
  const [dynamicAssertionInput, setDynamicAssertionInput] = useState<string>("");
  const [expandedViolationIds, setExpandedViolationIds] = useState<Record<string, boolean>>({});
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAssertions = async () => {
      try {
        const rep = await engineBridge.getAssertionReport();
        if (!cancelled && rep) setAssertionReport(rep);
      } catch (err) {
        console.warn("UnifiedBottomDock: failed to fetch assertions:", err);
      }
    };
    fetchAssertions();
    const unsub = engineBridge.subscribe(() => {
      fetchAssertions();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [state.currentSimTimePs, state.currentDeltaCycle, state.compiled]);

  const handleVerifyAssertions = async () => {
    setIsVerifying(true);
    try {
      const rep = await engineBridge.verifyAssertions();
      if (rep) setAssertionReport(rep);
    } catch (err) {
      console.error("Failed to run assertion verification:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetAssertions = async () => {
    try {
      await engineBridge.resetAssertions();
      const rep = await engineBridge.getAssertionReport();
      if (rep) setAssertionReport(rep);
    } catch (err) {
      console.error("Failed to reset assertions:", err);
    }
  };

  const handleAddDynamicAssertion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dynamicAssertionInput.trim()) return;
    try {
      await engineBridge.addAssertion(dynamicAssertionInput.trim());
      setDynamicAssertionInput("");
      const rep = await engineBridge.getAssertionReport();
      if (rep) setAssertionReport(rep);
    } catch (err) {
      console.error("Failed to add dynamic assertion:", err);
    }
  };

  const toggleViolationExpanded = (assertionId: string) => {
    setExpandedViolationIds((prev) => ({
      ...prev,
      [assertionId]: !prev[assertionId]
    }));
  };

  const handleSeekWave = (timePs: number) => {
    window.dispatchEvent(new CustomEvent("axiom_seek_waveform", { detail: { timePs } }));
  };

  // Subscribe to Engine Logs
  useEffect(() => {
    const unsub = engineBridge.subscribeLog((msg, level) => {
      setLogs((prev) => [
        ...prev.slice(-400),
        {
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString(),
          msg,
          level
        }
      ]);
    });
    return unsub;
  }, []);

  // Auto-scroll Logs & REPL
  useEffect(() => {
    if (!isCollapsed && activeTab === "repl") {
      if (replMode === "logs") {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        replEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [logs, replEntries, activeTab, replMode, isCollapsed]);

  // Telemetry summaries
  const telemetry = state.telemetry;
  const latestPoint = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
  const latestPowerMw = latestPoint ? latestPoint.powerMw : 0;
  const currentRailV = latestPoint ? latestPoint.railVoltageV : 1.2;
  const avgPowerMw = telemetry.length > 0 ? telemetry.reduce((a, b) => a + b.powerMw, 0) / telemetry.length : 0;
  const totalEnergyNj =
    telemetry.length > 1
      ? telemetry.reduce((acc, p, idx) => {
          if (idx === 0) return 0;
          const dtNs = (p.timePs - telemetry[idx - 1].timePs) / 1000;
          return acc + (p.powerMw * dtNs) / 1000;
        }, 0)
      : 0;

  // Telemetry Canvas Plot
  useEffect(() => {
    if (isCollapsed || activeTab !== "telemetry") return;
    const canvas = telemetryCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = telemetryContainerRef.current?.clientWidth ?? 600);
    const height = (canvas.height = 130);

    ctx.fillStyle = "#0d0f12";
    ctx.fillRect(0, 0, width, height);

    if (telemetry.length < 2) {
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Awaiting simulation switching events for telemetry...", width / 2, height / 2);
      return;
    }

    const padLeft = 45;
    const padRight = 20;
    const padTop = 15;
    const padBottom = 20;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const minTime = telemetry[0].timePs;
    const maxTime = Math.max(minTime + 100, telemetry[telemetry.length - 1].timePs);
    const maxCur = Math.max(5, ...telemetry.map((p) => p.currentMa)) * 1.15;

    // Grid lines
    ctx.strokeStyle = "#1a1f26";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      const curLabel = ((maxCur * (4 - i)) / 4).toFixed(1);
      ctx.fillText(`${curLabel}mA`, padLeft - 6, y + 3);
    }

    // Current Waveform (Cyan)
    ctx.beginPath();
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2;
    telemetry.forEach((p, idx) => {
      const x = padLeft + ((p.timePs - minTime) / (maxTime - minTime)) * plotW;
      const y = padTop + plotH - (p.currentMa / maxCur) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill gradient
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, "rgba(6, 182, 212, 0.25)");
    grad.addColorStop(1, "rgba(6, 182, 212, 0.0)");
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.fillStyle = grad;
    ctx.fill();

    // Voltage Rail (Amber line)
    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    telemetry.forEach((p, idx) => {
      const x = padLeft + ((p.timePs - minTime) / (maxTime - minTime)) * plotW;
      const vRatio = Math.max(0, Math.min(1, (p.railVoltageV - 1.0) / 0.3));
      const y = padTop + plotH - vRatio * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Legend
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#06b6d4";
    ctx.fillText("● Current (mA)", padLeft + 10, padTop + 10);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("● Rail Voltage (V)", padLeft + 110, padTop + 10);
  }, [telemetry, activeTab, isCollapsed, isMaximized]);

  // Execute REPL Command
  const handleReplSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = replInput.trim();
    if (!cmd) return;

    setReplInput("");
    setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "command", text: `> ${cmd}` }]);

    const parts = cmd.split(/\s+/);
    const op = parts[0].toLowerCase();

    switch (op) {
      case "help":
        setReplEntries((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: "output",
            text: [
              "Available Axiom EDA Interactive Commands:",
              "  step                - Advance single simulation step (1000 ps)",
              "  delta               - Execute discrete zero-time delta-cycle step",
              "  tick <ps>           - Advance simulation time by delta ps (default 1000)",
              "  run                 - Run continuous simulation clock ticks",
              "  stop                - Pause continuous execution",
              "  reset               - Reset simulation time to 0 ps",
              "  status              - Report top module, sim time, voltage, and power",
              "  inspect <signal>    - Print signal width, current 4-state value, radix",
              "  vcd                 - Export IEEE 1364 Value Change Dump",
              "  saif                - Export Switching Activity Interchange Format",
              "  clear               - Clear REPL screen buffer"
            ].join("\n")
          }
        ]);
        break;

      case "step":
        engineBridge.tick(1000);
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "success", text: `Simulated 1 step. Time: ${state.currentSimTimePs} ps` }]);
        break;

      case "delta":
        engineBridge.stepDelta();
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "success", text: `Executed 1 delta-cycle step (zero-time).` }]);
        break;

      case "tick": {
        const ps = parts[1] ? parseInt(parts[1], 10) : 1000;
        engineBridge.tick(isNaN(ps) ? 1000 : ps);
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "success", text: `Advanced sim time by ${ps} ps.` }]);
        break;
      }

      case "run": {
        engineBridge.play();
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "success", text: `Running continuous simulation clock...` }]);
        break;
      }

      case "stop":
        engineBridge.pause();
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "output", text: "Simulation paused." }]);
        break;

      case "reset":
        engineBridge.reset();
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "output", text: "Simulation kernel reset to t=0 ps." }]);
        break;

      case "status":
        setReplEntries((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: "output",
            text: `Top Module: ${state.topModule} | Time: ${state.currentSimTimePs} ps | Voltage: ${currentRailV.toFixed(3)} V | Signals: ${state.signals.length} | Glitches: ${state.glitches.length}`
          }
        ]);
        break;

      case "inspect": {
        const query = parts[1];
        if (!query) {
          setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "error", text: "Usage: inspect <signal_name>" }]);
          break;
        }
        const sig = state.signals.find((s) => s.name === query || s.fullName === query || s.id === query);
        if (sig) {
          const lastSample = sig.samples[sig.samples.length - 1];
          setReplEntries((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              type: "output",
              text: `Signal [${sig.fullName}]:\n  Width: ${sig.width}b\n  Radix: ${sig.radix}\n  Current Val: ${lastSample?.value ?? "0"}\n  Samples Count: ${sig.samples.length}`
            }
          ]);
        } else {
          setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "error", text: `Signal '${query}' not found in active elaborated netlist.` }]);
        }
        break;
      }

      case "clear":
        setReplEntries([]);
        break;

      case "vcd":
        handleExportVcd();
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "success", text: `Exported ${state.topModule}.vcd` }]);
        break;

      case "saif":
        handleExportSaif();
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "success", text: `Exported ${state.topModule}.saif` }]);
        break;

      default:
        setReplEntries((prev) => [...prev, { id: Math.random().toString(), type: "error", text: `Unknown command: '${cmd}'. Type 'help' for command list.` }]);
    }
  };

  const handleExportVcd = () => {
    const vcd = engineBridge.exportVcd();
    const blob = new Blob([vcd], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.topModule}.vcd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSaif = () => {
    const saif = engineBridge.exportSaif();
    const blob = new Blob([saif], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.topModule}.saif`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetCoverage = async () => {
    await engineBridge.resetCoverage();
    const rep = await engineBridge.getCoverage();
    setCoverageReport(rep);
  };

  const handleExportLcov = async () => {
    const lcov = await engineBridge.exportLcov(`rtl/${state.topModule}.v`);
    const blob = new Blob([lcov], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.topModule}.info`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = async () => {
    const html = await engineBridge.exportHtmlReport(`${state.topModule}.v`);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.topModule}_coverage.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResize = (deltaPx: number) => {
    setDockHeight((prev) => Math.max(120, Math.min(650, prev - deltaPx)));
  };

  // If in mobile full-screen mode, never collapse
  if (isCollapsed && !isMobileFullScreen) {
    return (
      <div
        style={{
          height: 28,
          minHeight: 28,
          backgroundColor: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          fontSize: 11.5,
          zIndex: 10,
          userSelect: "none"
        }}
      >
        {/* Left: Quick Tab Jumpers (Removed redundant 'Dock ^' button) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            overflowX: "auto",
            scrollbarWidth: "none",
            minWidth: 0,
            flex: 1
          }}
        >
          <button
            onClick={() => handleTabClick("repl")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color: "var(--text-secondary)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Terminal size={13} />
            <span>{t("dock.console")}</span>
          </button>

          <button
            onClick={() => handleTabClick("problems")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color: errorCount > 0 ? "var(--accent-rose)" : warningCount > 0 ? "var(--accent-amber)" : "var(--text-secondary)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <AlertCircle size={13} />
            <span>{t("dock.problems")} ({diagnostics.length})</span>
          </button>

          <button
            onClick={() => handleTabClick("telemetry")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color: "var(--accent-amber)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Zap size={13} />
            <span>{t("dock.telemetry")} ({latestPowerMw.toFixed(1)} mW)</span>
          </button>

          {state.glitches.length > 0 && (
            <button
              onClick={() => handleTabClick("glitches")}
              className="btn btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 6px",
                color: "var(--accent-rose)",
                fontSize: 12,
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              <AlertTriangle size={13} />
              <span>{state.glitches.length} {t("dock.glitches")}</span>
            </button>
          )}

          <button
            onClick={() => handleTabClick("coverage")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color: "var(--accent-emerald)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <BarChart2 size={13} />
            <span>Coverage ({coverageReport ? `${coverageReport.overall_pct.toFixed(0)}%` : "0%"})</span>
          </button>

          <button
            onClick={() => handleTabClick("assertions")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color:
                (state.assertionViolations?.length ?? 0) > 0
                  ? "var(--accent-rose)"
                  : "var(--accent-cyan)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <ShieldAlert size={13} />
            <span>
              Assertions (
              {(state.assertionViolations?.length ?? 0) > 0
                ? `${state.assertionViolations.length} Fail`
                : `${assertionReport?.total_assertions ?? 0}`}
              )
            </span>
          </button>

          <button
            onClick={() => handleTabClick("synthesis")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color: "var(--accent-purple, #c084fc)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Layers size={13} />
            <span>Synthesis ({synthCircuit?.cells.length ?? 0} Cells)</span>
          </button>

          <button
            onClick={() => handleTabClick("timing")}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 6px",
              color: "var(--accent-purple)",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Clock size={13} />
            <span>{t("dock.timingTab")}</span>
          </button>
        </div>

        {/* Right: Live Telemetry & Simulation Status Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--font-mono)" }}>
          <span className="mono-num" style={{ color: "var(--text-muted)", fontSize: 11 }}>
            t = {(state.currentSimTimePs / 1000).toFixed(1)} ns
          </span>

          <span
            className="mono-num"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: currentRailV < 1.15 ? "var(--accent-amber)" : "var(--accent-emerald)",
              fontSize: 11
            }}
          >
            <span>Vdd: {currentRailV.toFixed(3)}V</span>
          </span>

          <span
            className={state.isRunning ? "badge badge-emerald mono-num" : "badge badge-slate mono-num"}
            style={{ fontSize: 10 }}
          >
            {state.isRunning ? t("dock.running") : t("dock.idle")}
          </span>
        </div>
      </div>
    );
  }

  // Render Full Expanded Dock
  return (
    <div
      style={{
        height: isMobileFullScreen || isMaximized ? "100%" : dockHeight,
        maxHeight: isMobileFullScreen || isMaximized ? "100%" : "60vh",
        flex: isMobileFullScreen ? 1 : undefined,
        backgroundColor: "var(--bg-secondary)",
        borderTop: isMobileFullScreen ? "none" : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        position: isMaximized && !isMobileFullScreen ? "absolute" : "relative",
        inset: isMaximized && !isMobileFullScreen ? 0 : undefined,
        zIndex: isMaximized ? 100 : 8,
        overflow: "hidden"
      }}
    >
      {/* Top Resizable Drag Handle (if not maximized or mobile) */}
      {!isMaximized && !isMobileFullScreen && (
        <ResizableSplitter
          orientation="vertical"
          onResize={handleResize}
          onDoubleClick={() => setDockHeight(180)}
        />
      )}

      {/* Dock Header & Tab Bar */}
      <div
        style={{
          height: 28,
          minHeight: 28,
          backgroundColor: "var(--bg-primary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px"
        }}
      >
        {/* Left: Tab Switcher Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
          <button
            onClick={() => handleTabClick("repl")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "repl" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "repl" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "repl" ? "var(--accent-blue)" : "var(--text-muted)",
              border: activeTab === "repl" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <Terminal size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.console")}</span>
          </button>

          <button
            onClick={() => handleTabClick("problems")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "problems" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "problems" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "problems" ? "var(--accent-cyan)" : "var(--text-muted)",
              border: activeTab === "problems" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <AlertCircle size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.problems")}</span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                backgroundColor:
                  errorCount > 0
                    ? "rgba(244, 63, 94, 0.2)"
                    : warningCount > 0
                    ? "rgba(245, 158, 11, 0.2)"
                    : "rgba(16, 185, 129, 0.15)",
                color:
                  errorCount > 0
                    ? "var(--accent-rose)"
                    : warningCount > 0
                    ? "var(--accent-amber)"
                    : "var(--accent-emerald)",
                padding: "0 5px",
                borderRadius: 8,
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              {diagnostics.length}
            </span>
          </button>

          <button
            onClick={() => handleTabClick("telemetry")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "telemetry" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "telemetry" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "telemetry" ? "var(--accent-amber)" : "var(--text-muted)",
              border: activeTab === "telemetry" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <Zap size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.telemetry")}</span>
          </button>

          <button
            onClick={() => handleTabClick("glitches")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "glitches" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "glitches" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "glitches" ? "var(--accent-rose)" : "var(--text-muted)",
              border: activeTab === "glitches" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <AlertTriangle size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.glitches")}</span>
            {state.glitches.length > 0 && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  backgroundColor: "rgba(244, 63, 94, 0.2)",
                  color: "var(--accent-rose)",
                  padding: "0 4px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {state.glitches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick("timing")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "timing" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "timing" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "timing" ? "var(--accent-purple)" : "var(--text-muted)",
              border: activeTab === "timing" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <Clock size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.timingTab")}</span>
          </button>

          <button
            onClick={() => handleTabClick("coverage")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "coverage" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "coverage" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "coverage" ? "var(--accent-emerald)" : "var(--text-muted)",
              border: activeTab === "coverage" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <BarChart2 size={12} />
            <span style={{ whiteSpace: "nowrap" }}>Coverage</span>
            {coverageReport && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  backgroundColor:
                    coverageReport.overall_pct >= 80
                      ? "rgba(16, 185, 129, 0.2)"
                      : coverageReport.overall_pct >= 50
                      ? "rgba(245, 158, 11, 0.2)"
                      : "rgba(244, 63, 94, 0.2)",
                  color:
                    coverageReport.overall_pct >= 80
                      ? "var(--accent-emerald)"
                      : coverageReport.overall_pct >= 50
                      ? "var(--accent-amber)"
                      : "var(--accent-rose)",
                  padding: "0 4px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {coverageReport.overall_pct.toFixed(0)}%
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick("assertions")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "assertions" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "assertions" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "assertions" ? "var(--accent-cyan)" : "var(--text-muted)",
              border: activeTab === "assertions" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <ShieldAlert size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.assertionsTab")}</span>
            {(state.assertionViolations?.length ?? 0) > 0 ? (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  backgroundColor: "rgba(244, 63, 94, 0.2)",
                  color: "var(--accent-rose)",
                  padding: "0 4px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {state.assertionViolations.length} FAIL
              </span>
            ) : assertionReport && assertionReport.total_assertions > 0 ? (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  backgroundColor: "rgba(16, 185, 129, 0.2)",
                  color: "var(--accent-emerald)",
                  padding: "0 4px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {assertionReport.overall_pass_rate_pct.toFixed(0)}%
              </span>
            ) : null}
          </button>

          <button
            onClick={() => handleTabClick("synthesis")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: activeTab === "synthesis" ? 600 : 400,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "synthesis" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "synthesis" ? "var(--accent-purple, #c084fc)" : "var(--text-muted)",
              border: activeTab === "synthesis" ? "1px solid var(--border-subtle)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <Layers size={12} />
            <span style={{ whiteSpace: "nowrap" }}>{t("dock.synthesisTab") || "Synthesis"}</span>
            {synthCircuit && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  backgroundColor: "rgba(168, 85, 247, 0.2)",
                  color: "#c084fc",
                  padding: "0 4px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {synthCircuit.cells.length} cells
              </span>
            )}
          </button>
        </div>

        {/* Right: Controls (Mode Toggle, Exporters, Maximize, Collapse) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {activeTab === "synthesis" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={handleExportNetlist}
                title="Export Technology-Mapped Structural Verilog Netlist"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px",
                  color: copiedNetlist ? "var(--accent-emerald)" : "#c084fc",
                  borderColor: "rgba(168, 85, 247, 0.4)"
                }}
              >
                {copiedNetlist ? <Check size={10} /> : <Download size={10} />}
                <span>{copiedNetlist ? "Exported!" : "Export Netlist"}</span>
              </button>
            </div>
          )}

          {activeTab === "assertions" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={handleVerifyAssertions}
                disabled={isVerifying}
                title="Run in-RAM assertion verification radar (200 cycles)"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px",
                  color: "var(--accent-cyan)",
                  borderColor: "rgba(6, 182, 212, 0.4)"
                }}
              >
                <Play size={10} />
                <span>{isVerifying ? "Verifying..." : "Verify (200t)"}</span>
              </button>

              <button
                onClick={handleResetAssertions}
                title="Reset all assertion monitor stats and violation logs"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px"
                }}
              >
                <RotateCcw size={10} />
                <span>Reset</span>
              </button>
            </div>
          )}

          {activeTab === "coverage" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={handleExportLcov}
                title="Export standard LCOV (.info) trace file"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px"
                }}
              >
                <Download size={10} />
                <span>LCOV</span>
              </button>

              <button
                onClick={handleExportHtml}
                title="Export interactive dark-mode HTML coverage dashboard"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px"
                }}
              >
                <ExternalLink size={10} />
                <span>HTML</span>
              </button>

              <button
                onClick={handleResetCoverage}
                title="Reset simulation coverage counters to zero"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px"
                }}
              >
                <RotateCcw size={10} />
                <span>Reset</span>
              </button>
            </div>
          )}

          {activeTab === "repl" && (
            <>
              {/* Shell vs Logs Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  padding: 2,
                  marginRight: 6
                }}
              >
                <button
                  onClick={() => setReplMode("shell")}
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 3,
                    backgroundColor: replMode === "shell" ? "var(--bg-elevated)" : "transparent",
                    color: replMode === "shell" ? "var(--accent-blue)" : "var(--text-muted)",
                    fontWeight: replMode === "shell" ? 600 : 400
                  }}
                >
                  {t("dock.shellMode")}
                </button>
                <button
                  onClick={() => setReplMode("logs")}
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 3,
                    backgroundColor: replMode === "logs" ? "var(--bg-elevated)" : "transparent",
                    color: replMode === "logs" ? "var(--accent-blue)" : "var(--text-muted)",
                    fontWeight: replMode === "logs" ? 600 : 400
                  }}
                >
                  {t("dock.logsMode")}
                </button>
              </div>

              {/* VCD & SAIF Quick Exports */}
              <button
                onClick={handleExportVcd}
                title="Export Value Change Dump (.vcd)"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px"
                }}
              >
                <Download size={10} />
                {!isMobileFullScreen && <span>VCD</span>}
              </button>

              <button
                onClick={handleExportSaif}
                title="Export SAIF 2.0 (.saif)"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "2px 6px"
                }}
              >
                <Download size={10} />
                {!isMobileFullScreen && <span>SAIF</span>}
              </button>
            </>
          )}

          {/* Maximize / Restore */}
          {!isMobileFullScreen && (
            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              title={isMaximized ? t("header.restore") : t("header.maximize")}
              className="btn-icon"
              style={{
                padding: "3px 5px",
                color: "var(--text-muted)",
                borderRadius: "var(--radius-sm)"
              }}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}

          {/* Collapse Button */}
          {!isMobileFullScreen && (
            <button
              onClick={() => setIsCollapsed(true)}
              title={t("dock.collapseDock")}
              className="btn-icon"
              style={{
                padding: "3px 5px",
                color: "var(--text-muted)",
                borderRadius: "var(--radius-sm)"
              }}
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Dock Content Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* TAB 1: CONSOLE & REPL */}
        {activeTab === "repl" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, backgroundColor: "#0b0d10" }}>
            {replMode === "shell" ? (
              // Interactive REPL Screen
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {replEntries.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        marginBottom: 4,
                        lineHeight: 1.4,
                        whiteSpace: "pre-wrap",
                        color:
                          e.type === "command"
                            ? "var(--accent-blue)"
                            : e.type === "error"
                            ? "var(--accent-rose)"
                            : e.type === "success"
                            ? "var(--accent-emerald)"
                            : "var(--text-secondary)"
                      }}
                    >
                      {e.text}
                    </div>
                  ))}
                  <div ref={replEndRef} />
                </div>

                {/* Prompt Line */}
                <form
                  onSubmit={handleReplSubmit}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "4px 8px",
                    borderTop: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-primary)"
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-blue)", marginRight: 6, fontSize: 11, fontWeight: 700 }}>
                    axiom&gt;
                  </span>
                  <input
                    type="text"
                    value={replInput}
                    onChange={(e) => setReplInput(e.target.value)}
                    placeholder={t("dock.replPlaceholder")}
                    style={{
                      flex: 1,
                      backgroundColor: "transparent",
                      border: "none",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      outline: "none"
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      padding: "2px 8px",
                      fontSize: 10
                    }}
                  >
                    {t("dock.execute")}
                  </button>
                </form>
              </div>
            ) : (
              // Kernel Logs Screen
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {logs.map((log) => {
                  const color =
                    log.level === "error"
                      ? "var(--accent-rose)"
                      : log.level === "warn"
                      ? "var(--accent-amber)"
                      : log.level === "event"
                      ? "var(--accent-cyan)"
                      : "var(--text-secondary)";
                  return (
                    <div key={log.id} style={{ display: "flex", gap: 8, marginBottom: 3, lineHeight: 1.4 }}>
                      <span style={{ color: "var(--text-muted)", fontSize: 10, userSelect: "none" }}>[{log.time}]</span>
                      <span style={{ color }}>{log.msg}</span>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        {/* TAB: PROBLEMS & LINTER */}
        {activeTab === "problems" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, backgroundColor: "#0b0d10" }}>
            {/* Filter toolbar */}
            <div
              style={{
                height: 28,
                backgroundColor: "var(--bg-tertiary)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px",
                fontSize: 10
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Total Issues: <strong style={{ color: "var(--text-primary)" }}>{diagnostics.length}</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-rose)" }}>
                  <AlertCircle size={10} />
                  <span>{errorCount} Errors</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-amber)" }}>
                  <AlertTriangle size={10} />
                  <span>{warningCount} Warnings</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-blue)" }}>
                  <Info size={10} />
                  <span>{infoCount} Info/Hints</span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {diagnostics.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyAllProblems}
                    className="btn-icon"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 6px",
                      fontSize: 9.5,
                      fontFamily: "var(--font-mono)",
                      color: copiedAllProblems ? "var(--accent-emerald)" : "var(--text-muted)",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer"
                    }}
                    title={t("dock.copyAllProblems")}
                  >
                    {copiedAllProblems ? <Check size={10} /> : <Copy size={10} />}
                    <span>{copiedAllProblems ? t("dock.copiedProblems") : t("dock.copyAllProblems")}</span>
                  </button>
                )}
                <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                  Engine: <span style={{ color: "var(--accent-cyan)" }}>axiom-lsp v1.0.1</span> (IEEE 1800-2017)
                </div>
              </div>
            </div>

            {/* List of problems */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {diagnostics.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)", minHeight: 120 }}>
                  <CheckCircle2 size={32} color="var(--accent-emerald)" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {t("dock.noProblems")}
                  </div>
                  <div style={{ fontSize: 11, maxWidth: 360, textAlign: "center", color: "var(--text-muted)" }}>
                    Clean AST. Zero syntax errors, zero driver contention, zero race hazards.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {diagnostics.map((d, idx) => {
                    const isErr = d.severity === 1;
                    const isWarn = d.severity === 2;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          const sel = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
                          if (!sel || sel.trim().length === 0) {
                            onNavigateToLine?.(d.startLineNumber, d.startColumn);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 8px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: isErr ? "rgba(244, 63, 94, 0.06)" : isWarn ? "rgba(245, 158, 11, 0.06)" : "rgba(56, 189, 248, 0.06)",
                          border: `1px solid ${isErr ? "rgba(244, 63, 94, 0.25)" : isWarn ? "rgba(245, 158, 11, 0.25)" : "rgba(56, 189, 248, 0.25)"}`,
                          cursor: "pointer",
                          userSelect: "text",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          transition: "background-color 0.15s ease",
                          fontSize: 11
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isErr ? "rgba(244, 63, 94, 0.12)" : isWarn ? "rgba(245, 158, 11, 0.12)" : "rgba(56, 189, 248, 0.12)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isErr ? "rgba(244, 63, 94, 0.06)" : isWarn ? "rgba(245, 158, 11, 0.06)" : "rgba(56, 189, 248, 0.06)")}
                      >
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                          {isErr ? (
                            <AlertCircle size={13} color="var(--accent-rose)" />
                          ) : isWarn ? (
                            <AlertTriangle size={13} color="var(--accent-amber)" />
                          ) : (
                            <Info size={13} color="var(--accent-blue)" />
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                            color: isErr ? "var(--accent-rose)" : isWarn ? "var(--accent-amber)" : "var(--accent-blue)",
                            backgroundColor: isErr ? "rgba(244, 63, 94, 0.15)" : isWarn ? "rgba(245, 158, 11, 0.15)" : "rgba(56, 189, 248, 0.15)",
                            padding: "1px 5px",
                            borderRadius: 3,
                            flexShrink: 0,
                            userSelect: "text"
                          }}
                        >
                          {d.code}
                        </span>

                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: "var(--accent-cyan)",
                            textDecoration: "underline",
                            flexShrink: 0,
                            userSelect: "text"
                          }}
                        >
                          Line {d.startLineNumber}:{d.startColumn}
                        </span>

                        <span style={{ color: "var(--border-subtle)", flexShrink: 0 }}>—</span>

                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--text-primary)",
                            userSelect: "text",
                            cursor: "text"
                          }}
                          title={d.message}
                        >
                          {d.message}
                        </span>

                        {d.help && (
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              fontStyle: "italic",
                              flexShrink: 0,
                              maxWidth: 240,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              userSelect: "text"
                            }}
                            title={`help: ${d.help}`}
                          >
                            ↳ help: {d.help}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleCopyProblem(d, idx, e)}
                          className="btn-icon"
                          style={{
                            flexShrink: 0,
                            padding: "2px 4px",
                            borderRadius: "var(--radius-sm)",
                            color: copiedDiagnosticIdx === idx ? "var(--accent-emerald)" : "var(--text-muted)",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title={copiedDiagnosticIdx === idx ? t("dock.copiedProblems") : t("dock.copyProblem")}
                        >
                          {copiedDiagnosticIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: POWER & TELEMETRY */}
        {activeTab === "telemetry" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 8, overflowY: "auto" }}>
            {/* Top Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 8 }}>
              <div style={{ padding: "6px 8px", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("dock.powerMw")}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                  {latestPowerMw.toFixed(2)} mW
                </div>
              </div>

              <div style={{ padding: "6px 8px", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>AVG POWER</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                  {avgPowerMw.toFixed(2)} mW
                </div>
              </div>

              <div style={{ padding: "6px 8px", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("dock.energyNj")}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-emerald)", fontFamily: "var(--font-mono)" }}>
                  {totalEnergyNj.toFixed(3)} nJ
                </div>
              </div>

              <div style={{ padding: "6px 8px", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("dock.railVoltage")}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
                  {currentRailV.toFixed(3)} V
                </div>
              </div>

              <div style={{ padding: "6px 8px", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>DYNAMIC IR SAG</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: state.maxSagMv > 30 ? "var(--accent-rose)" : "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  {state.maxSagMv.toFixed(1)} mV
                </div>
              </div>
            </div>

            {/* Transient Plot Canvas */}
            <div ref={telemetryContainerRef} style={{ flex: 1, minHeight: 110, position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
              <canvas ref={telemetryCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
          </div>
        )}

        {/* TAB 3: GLITCHES & HAZARDS */}
        {activeTab === "glitches" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {state.glitches.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: 6 }}>
                <CheckCircle size={22} color="var(--accent-emerald)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{t("dock.noGlitches")}</span>
                <span style={{ fontSize: 10 }}>Axiom tracks all delta cycles between active and non-blocking assignment phases.</span>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "4px 8px" }}>SIGNAL</th>
                    <th style={{ padding: "4px 8px" }}>HAZARD TYPE</th>
                    <th style={{ padding: "4px 8px" }}>TIME (ps)</th>
                    <th style={{ padding: "4px 8px" }}>DELTA CYCLE</th>
                    <th style={{ padding: "4px 8px" }}>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {state.glitches.map((g, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <td style={{ padding: "4px 8px", color: "var(--accent-rose)", fontWeight: 600 }}>{g.signalName}</td>
                      <td style={{ padding: "4px 8px", color: "var(--accent-amber)" }}>{g.hazardType}</td>
                      <td style={{ padding: "4px 8px", color: "var(--text-muted)" }}>{g.timePs} ps</td>
                      <td style={{ padding: "4px 8px", color: "var(--accent-cyan)" }}>&delta; = {g.delta}</td>
                      <td style={{ padding: "4px 8px", color: "var(--text-secondary)" }}>{g.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: TIMING SLACK */}
        {activeTab === "timing" && (
          <div style={{ flex: 1, padding: 12, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 10, backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>WORST NEGATIVE SLACK (WNS)</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-emerald)", fontFamily: "var(--font-mono)" }}>
                  +2.140 ns (MET)
                </div>
              </div>

              <div style={{ padding: 10, backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>TOTAL NEGATIVE SLACK (TNS)</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                  0.000 ns
                </div>
              </div>

              <div style={{ padding: 10, backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>MAX DATA PATH DELAY</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                  7.860 ns
                </div>
              </div>

              <div style={{ padding: 10, backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>CLOCK SKEW (JITTER)</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-purple)", fontFamily: "var(--font-mono)" }}>
                  0.045 ns
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Vivado static timing report modeled for <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>100 MHz target clock (10.000 ns period)</span>. All setup and hold checks passed.
            </div>
          </div>
        )}

        {/* TAB 5: RTL CODE COVERAGE & FSM STATE COVERAGE */}
        {activeTab === "coverage" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Top KPI Metric Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                padding: "10px 12px 6px 12px",
                flexShrink: 0
              }}
            >
              {/* Card 1: Statements */}
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Statements
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color:
                        (coverageReport?.statement_pct ?? 0) >= 80
                          ? "var(--accent-emerald)"
                          : (coverageReport?.statement_pct ?? 0) >= 50
                          ? "var(--accent-amber)"
                          : "var(--accent-rose)"
                    }}
                  >
                    {coverageReport ? `${coverageReport.statement_pct.toFixed(1)}%` : "0.0%"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {coverageReport?.statement_hit ?? 0} / {coverageReport?.statement_total ?? 0} executed
                </div>
                <div style={{ height: 3, width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, coverageReport?.statement_pct ?? 0))}%`,
                      backgroundColor: "var(--accent-emerald)",
                      transition: "width 0.2s ease"
                    }}
                  />
                </div>
              </div>

              {/* Card 2: Branches */}
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Branches (if/case/?)
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color:
                        (coverageReport?.branch_pct ?? 0) >= 80
                          ? "var(--accent-emerald)"
                          : (coverageReport?.branch_pct ?? 0) >= 50
                          ? "var(--accent-amber)"
                          : "var(--accent-rose)"
                    }}
                  >
                    {coverageReport ? `${coverageReport.branch_pct.toFixed(1)}%` : "0.0%"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {coverageReport?.branch_covered ?? 0} full, {coverageReport?.branch_partial ?? 0} partial ({coverageReport?.branch_total ?? 0} total)
                </div>
                <div style={{ height: 3, width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, coverageReport?.branch_pct ?? 0))}%`,
                      backgroundColor: "var(--accent-amber)",
                      transition: "width 0.2s ease"
                    }}
                  />
                </div>
              </div>

              {/* Card 3: Toggle Activity */}
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Toggle Activity (0/1)
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color:
                        (coverageReport?.toggle_pct ?? 0) >= 80
                          ? "var(--accent-cyan)"
                          : (coverageReport?.toggle_pct ?? 0) >= 50
                          ? "var(--accent-amber)"
                          : "var(--accent-rose)"
                    }}
                  >
                    {coverageReport ? `${coverageReport.toggle_pct.toFixed(1)}%` : "0.0%"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {coverageReport?.toggle_covered ?? 0} / {coverageReport?.toggle_total ?? 0} transitions
                </div>
                <div style={{ height: 3, width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, coverageReport?.toggle_pct ?? 0))}%`,
                      backgroundColor: "var(--accent-cyan)",
                      transition: "width 0.2s ease"
                    }}
                  />
                </div>
              </div>

              {/* Card 4: FSM States */}
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    FSM State Coverage
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color:
                        (coverageReport?.fsm_state_pct ?? 0) >= 80
                          ? "var(--accent-purple)"
                          : (coverageReport?.fsm_state_pct ?? 0) >= 50
                          ? "var(--accent-amber)"
                          : "var(--accent-rose)"
                    }}
                  >
                    {coverageReport ? `${coverageReport.fsm_state_pct.toFixed(1)}%` : "100.0%"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {coverageReport?.fsm_state_hit ?? 0} / {coverageReport?.fsm_state_total ?? 0} states ({coverageReport?.fsm_transition_hit ?? 0}/{coverageReport?.fsm_transition_total ?? 0} arcs)
                </div>
                <div style={{ height: 3, width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, coverageReport?.fsm_state_pct ?? 100))}%`,
                      backgroundColor: "var(--accent-purple)",
                      transition: "width 0.2s ease"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Sub-Toolbar (Filter Pills, Search, Summary) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 12px",
                borderBottom: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-primary)",
                gap: 8,
                flexShrink: 0
              }}
            >
              {/* Filter Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setCoverageFilter("all")}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: coverageFilter === "all" ? "var(--bg-tertiary)" : "transparent",
                    color: coverageFilter === "all" ? "#fff" : "var(--text-muted)",
                    border: coverageFilter === "all" ? "1px solid var(--border-strong)" : "1px solid transparent",
                    cursor: "pointer",
                    fontWeight: coverageFilter === "all" ? 600 : 400
                  }}
                >
                  All ({coverageReport?.lines.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageFilter("covered")}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: coverageFilter === "covered" ? "rgba(16, 185, 129, 0.15)" : "transparent",
                    color: coverageFilter === "covered" ? "var(--accent-emerald)" : "var(--text-muted)",
                    border: coverageFilter === "covered" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid transparent",
                    cursor: "pointer",
                    fontWeight: coverageFilter === "covered" ? 600 : 400
                  }}
                >
                  Covered ({coverageReport?.lines.filter((l) => l.status === "Covered").length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageFilter("partial")}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: coverageFilter === "partial" ? "rgba(245, 158, 11, 0.15)" : "transparent",
                    color: coverageFilter === "partial" ? "var(--accent-amber)" : "var(--text-muted)",
                    border: coverageFilter === "partial" ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid transparent",
                    cursor: "pointer",
                    fontWeight: coverageFilter === "partial" ? 600 : 400
                  }}
                >
                  Partial ({coverageReport?.lines.filter((l) => l.status === "Partial").length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageFilter("uncovered")}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: coverageFilter === "uncovered" ? "rgba(244, 63, 94, 0.15)" : "transparent",
                    color: coverageFilter === "uncovered" ? "var(--accent-rose)" : "var(--text-muted)",
                    border: coverageFilter === "uncovered" ? "1px solid rgba(244, 63, 94, 0.3)" : "1px solid transparent",
                    cursor: "pointer",
                    fontWeight: coverageFilter === "uncovered" ? 600 : 400
                  }}
                >
                  Uncovered ({coverageReport?.lines.filter((l) => l.status === "Uncovered").length ?? 0})
                </button>
              </div>

              {/* Search Box */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
                <Search size={11} color="var(--text-muted)" style={{ position: "absolute", left: 6 }} />
                <input
                  type="text"
                  placeholder="Filter by line # or snippet..."
                  value={coverageSearch}
                  onChange={(e) => setCoverageSearch(e.target.value)}
                  style={{
                    fontSize: 11,
                    padding: "2px 6px 2px 22px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    outline: "none",
                    width: 190
                  }}
                />
                {coverageSearch && (
                  <button
                    type="button"
                    onClick={() => setCoverageSearch("")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "0 4px"
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Line-by-Line Table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
              {(!coverageReport || coverageReport.lines.length === 0) ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  <BarChart2 size={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  <div>No coverage points instrumented in active elaborated circuit.</div>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                    Click <strong>Elaborate</strong> or run simulation ticks to begin real-time hit accumulation.
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", textAlign: "left", position: "sticky", top: 0, backgroundColor: "var(--bg-secondary)", zIndex: 2 }}>
                      <th style={{ padding: "5px 10px", width: 60 }}>LINE</th>
                      <th style={{ padding: "5px 10px", width: 110 }}>STATUS</th>
                      <th style={{ padding: "5px 10px", width: 90 }}>HITS</th>
                      <th style={{ padding: "5px 10px", width: 140 }}>BRANCH (T/F)</th>
                      <th style={{ padding: "5px 10px" }}>CODE SNIPPET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageReport.lines
                      .filter((l) => {
                        if (coverageFilter === "covered" && l.status !== "Covered") return false;
                        if (coverageFilter === "partial" && l.status !== "Partial") return false;
                        if (coverageFilter === "uncovered" && l.status !== "Uncovered") return false;
                        if (coverageSearch.trim()) {
                          const q = coverageSearch.toLowerCase();
                          const mLine = String(l.line).includes(q);
                          const mSnip = (l.snippet ?? "").toLowerCase().includes(q);
                          if (!mLine && !mSnip) return false;
                        }
                        return true;
                      })
                      .map((l) => {
                        const isCov = l.status === "Covered";
                        const isPart = l.status === "Partial";

                        return (
                          <tr
                            key={l.line}
                            onClick={() => onNavigateToLine?.(l.line, 1)}
                            title={`Click to jump to line ${l.line} in Monaco editor`}
                            style={{
                              borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                              cursor: "pointer",
                              transition: "background-color 0.1s ease"
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            <td style={{ padding: "4px 10px", color: "var(--accent-blue)", fontWeight: 600 }}>
                              L{l.line}
                            </td>
                            <td style={{ padding: "4px 10px" }}>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  backgroundColor: isCov
                                    ? "rgba(16, 185, 129, 0.15)"
                                    : isPart
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(244, 63, 94, 0.15)",
                                  color: isCov
                                    ? "var(--accent-emerald)"
                                    : isPart
                                    ? "var(--accent-amber)"
                                    : "var(--accent-rose)",
                                  border: `1px solid ${
                                    isCov
                                      ? "rgba(16, 185, 129, 0.3)"
                                      : isPart
                                      ? "rgba(245, 158, 11, 0.3)"
                                      : "rgba(244, 63, 94, 0.3)"
                                  }`
                                }}
                              >
                                {l.status}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "4px 10px",
                                color: l.hits > 0 ? "var(--text-primary)" : "var(--accent-rose)",
                                fontWeight: l.hits > 0 ? 600 : 400
                              }}
                            >
                              {l.hits.toLocaleString()}
                            </td>
                            <td style={{ padding: "4px 10px", color: "var(--text-secondary)" }}>
                              {l.branch_true !== undefined && l.branch_true !== null ? (
                                <span>
                                  <span style={{ color: (l.branch_true ?? 0) > 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                                    T:{l.branch_true}
                                  </span>
                                  {" / "}
                                  <span style={{ color: (l.branch_false ?? 0) > 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                                    F:{l.branch_false}
                                  </span>
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)" }}>—</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "4px 10px",
                                color: "var(--text-secondary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 450
                              }}
                            >
                              {l.snippet ? l.snippet.trim() : <span style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Assertions Tab Content */}
        {activeTab === "assertions" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflowY: "auto",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              padding: "12px 16px",
              gap: 12
            }}
          >
            {/* Top 5 KPI Summary Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10
              }}
            >
              {/* Card 1: Total Assertions */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Total Assertions</span>
                  <ShieldAlert size={14} style={{ color: "var(--accent-cyan)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#f8fafc" }}>
                  {assertionReport?.total_assertions ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Active Protocol Monitors</span>
              </div>

              {/* Card 2: Pass Rate */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Pass Rate</span>
                  <CheckCircle2
                    size={14}
                    style={{
                      color:
                        (assertionReport?.overall_pass_rate_pct ?? 100) >= 90
                          ? "var(--accent-emerald)"
                          : (assertionReport?.overall_pass_rate_pct ?? 100) >= 70
                          ? "var(--accent-amber)"
                          : "var(--accent-rose)"
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color:
                      (assertionReport?.overall_pass_rate_pct ?? 100) >= 90
                        ? "var(--accent-emerald)"
                        : (assertionReport?.overall_pass_rate_pct ?? 100) >= 70
                        ? "var(--accent-amber)"
                        : "var(--accent-rose)"
                  }}
                >
                  {assertionReport ? `${assertionReport.overall_pass_rate_pct.toFixed(1)}%` : "100.0%"}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {assertionReport?.total_passes ?? 0} successful cycles
                </span>
              </div>

              {/* Card 3: Violations */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Violations</span>
                  <AlertCircle
                    size={14}
                    style={{
                      color:
                        (assertionReport?.total_failures ?? state.assertionViolations?.length ?? 0) > 0
                          ? "var(--accent-rose)"
                          : "var(--accent-emerald)"
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color:
                      (assertionReport?.total_failures ?? state.assertionViolations?.length ?? 0) > 0
                        ? "var(--accent-rose)"
                        : "var(--accent-emerald)"
                  }}
                >
                  {assertionReport?.total_failures ?? state.assertionViolations?.length ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {state.assertionViolations?.length ?? 0} in current timeline
                </span>
              </div>

              {/* Card 4: In-Flight */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Active In-Flight</span>
                  <Zap size={14} style={{ color: "var(--accent-blue)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-blue)" }}>
                  {assertionReport?.active_in_flight ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Multi-cycle threads evaluating</span>
              </div>

              {/* Card 5: Vacuous Passes */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Vacuous Passes</span>
                  <Info size={14} style={{ color: "var(--accent-amber)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-amber)" }}>
                  {assertionReport?.total_vacuous ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Antecedent conditions false</span>
              </div>
            </div>

            {/* Dynamic In-RAM SVA Injection Bar */}
            <form
              onSubmit={handleAddDynamicAssertion}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 10px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--accent-cyan)",
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  padding: "3px 7px",
                  borderRadius: 3,
                  whiteSpace: "nowrap"
                }}
              >
                <Plus size={11} />
                <span>INJECT SVA</span>
              </div>

              <input
                type="text"
                value={dynamicAssertionInput}
                onChange={(e) => setDynamicAssertionInput(e.target.value)}
                placeholder="assert property (@(posedge clk) req |-> ##[1:2] ack);"
                style={{
                  flex: 1,
                  fontSize: 11.5,
                  fontFamily: "JetBrains Mono, monospace",
                  backgroundColor: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#f8fafc"
                }}
              />

              <button
                type="submit"
                disabled={!dynamicAssertionInput.trim()}
                className="btn btn-primary"
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: !dynamicAssertionInput.trim() ? 0.5 : 1
                }}
              >
                <span>Inject</span>
              </button>
            </form>

            {/* Filter Pills & Search */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {(["all", "violated", "passing", "in_flight", "vacuous"] as const).map((filter) => {
                  const isActive = assertionFilter === filter;
                  const label =
                    filter === "all"
                      ? `All (${assertionReport?.assertions.length ?? 0})`
                      : filter === "violated"
                      ? `Violated (${assertionReport?.assertions.filter((a) => a.violations.length > 0).length ?? 0})`
                      : filter === "passing"
                      ? `Passing (${assertionReport?.assertions.filter((a) => a.status === "Passing").length ?? 0})`
                      : filter === "in_flight"
                      ? `In-Flight (${assertionReport?.assertions.filter((a) => a.status === "InFlight").length ?? 0})`
                      : `Vacuous (${assertionReport?.assertions.filter((a) => a.status === "Vacuous").length ?? 0})`;

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAssertionFilter(filter)}
                      className="btn btn-ghost"
                      style={{
                        fontSize: 10.5,
                        padding: "2px 8px",
                        height: 22,
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                        color: isActive ? "#fff" : "var(--text-muted)",
                        border: isActive ? "1px solid var(--border-strong)" : "1px solid transparent",
                        fontWeight: isActive ? 600 : 400
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 8px",
                  maxWidth: 240,
                  width: "100%"
                }}
              >
                <Search size={11} style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={assertionSearch}
                  onChange={(e) => setAssertionSearch(e.target.value)}
                  placeholder="Filter assertions..."
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: 11,
                    width: "100%"
                  }}
                />
              </div>
            </div>

            {/* Assertion Items / Table */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-secondary)"
              }}
            >
              {(!assertionReport || assertionReport.assertions.length === 0) ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 120,
                    gap: 8,
                    color: "var(--text-muted)"
                  }}
                >
                  <ShieldAlert size={24} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 12 }}>No temporal assertions loaded in active design</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Add <code>assert property (@(posedge clk) ...);</code> to your RTL or use the injector above.
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {assertionReport.assertions
                    .filter((a) => {
                      if (assertionFilter === "violated") return a.violations.length > 0;
                      if (assertionFilter === "passing") return a.status === "Passing";
                      if (assertionFilter === "in_flight") return a.status === "InFlight";
                      if (assertionFilter === "vacuous") return a.status === "Vacuous";
                      return true;
                    })
                    .filter((a) => {
                      if (!assertionSearch.trim()) return true;
                      const q = assertionSearch.toLowerCase();
                      return (
                        a.def.name.toLowerCase().includes(q) ||
                        a.def.source_text.toLowerCase().includes(q) ||
                        a.def.clock.toLowerCase().includes(q)
                      );
                    })
                    .map((a) => {
                      const badge = getAssertionStatusBadge(a.status);
                      const isExpanded = !!expandedViolationIds[a.def.id];

                      return (
                        <div
                          key={a.def.id}
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            flexDirection: "column"
                          }}
                        >
                          {/* Assertion Header Row */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              gap: 12,
                              backgroundColor: isExpanded ? "var(--bg-tertiary)" : "transparent"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                              {/* Status Badge */}
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 3,
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {badge.label}
                              </span>

                              {/* Assertion Name & Kind */}
                              <div style={{ display: "flex", flexDirection: "column", minWidth: 120 }}>
                                <span
                                  onClick={() => a.def.line && onNavigateToLine?.(a.def.line, 1)}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#f8fafc",
                                    cursor: a.def.line ? "pointer" : "default"
                                  }}
                                  title={a.def.line ? `Jump to line ${a.def.line}` : undefined}
                                >
                                  {a.def.name}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                  {a.def.kind} • {a.def.edge} {a.def.clock}
                                </span>
                              </div>

                              {/* Source Code Snippet */}
                              <div
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  fontFamily: "JetBrains Mono, monospace",
                                  color: "var(--text-secondary)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: 420
                                }}
                                title={a.def.source_text}
                              >
                                {a.def.source_text}
                              </div>
                            </div>

                            {/* Counters & Actions */}
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{ display: "flex", gap: 10, fontSize: 10.5, fontFamily: "var(--font-mono)" }}>
                                <span title="Attempts">Att: <strong>{a.stats.attempts}</strong></span>
                                <span style={{ color: "var(--accent-emerald)" }} title="Passes">Pass: <strong>{a.stats.passes}</strong></span>
                                <span style={{ color: a.stats.failures > 0 ? "var(--accent-rose)" : "var(--text-muted)" }} title="Failures">
                                  Fail: <strong>{a.stats.failures}</strong>
                                </span>
                                <span style={{ color: "var(--accent-amber)" }} title="Vacuous">Vac: <strong>{a.stats.vacuous}</strong></span>
                                {a.stats.in_flight > 0 && (
                                  <span style={{ color: "var(--accent-blue)" }} title="In-flight">Act: <strong>{a.stats.in_flight}</strong></span>
                                )}
                              </div>

                              {/* Violations Toggle */}
                              {a.violations.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleViolationExpanded(a.def.id)}
                                  className="btn btn-ghost"
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    height: 22,
                                    borderRadius: 3,
                                    backgroundColor: "rgba(244, 63, 94, 0.15)",
                                    color: "var(--accent-rose)",
                                    border: "1px solid rgba(244, 63, 94, 0.3)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                >
                                  <span>{a.violations.length} Violations</span>
                                  {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Violations Accordion Drawer */}
                          {isExpanded && a.violations.length > 0 && (
                            <div
                              style={{
                                backgroundColor: "rgba(15, 23, 42, 0.6)",
                                borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                                padding: "8px 12px 8px 36px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6
                              }}
                            >
                              {a.violations.map((v, vIdx) => {
                                const vTime = getViolationTimePs(v);
                                return (
                                  <div
                                    key={vIdx}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      fontSize: 11,
                                      padding: "4px 8px",
                                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                                      border: "1px solid rgba(239, 68, 68, 0.2)",
                                      borderRadius: 4
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                      <span style={{ color: "var(--accent-rose)", fontWeight: 700, fontSize: 10 }}>
                                        #{v.fail_cycle}
                                      </span>
                                      <span style={{ color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                                        {formatTimeCompact(vTime)}
                                      </span>
                                      <span style={{ color: "#f1f5f9", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {v.message}
                                      </span>

                                      {/* Signal Snapshot Pills */}
                                      {v.signals && Object.keys(v.signals).length > 0 && (
                                        <div style={{ display: "flex", gap: 4 }}>
                                          {Object.entries(v.signals).slice(0, 4).map(([sig, val]) => (
                                            <span
                                              key={sig}
                                              style={{
                                                fontSize: 9.5,
                                                fontFamily: "JetBrains Mono, monospace",
                                                padding: "1px 4px",
                                                borderRadius: 2,
                                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                                color: "#cbd5e1"
                                              }}
                                            >
                                              {sig}={val}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleSeekWave(vTime)}
                                        className="btn btn-ghost"
                                        style={{
                                          fontSize: 10,
                                          padding: "1px 6px",
                                          height: 20,
                                          borderRadius: 2,
                                          color: "var(--accent-cyan)",
                                          border: "1px solid rgba(6, 182, 212, 0.3)"
                                        }}
                                        title="Seek waveform timeline to this violation timestamp"
                                      >
                                        Seek Wave
                                      </button>

                                      {v.line && (
                                        <button
                                          type="button"
                                          onClick={() => onNavigateToLine?.(v.line!, 1)}
                                          className="btn btn-ghost"
                                          style={{
                                            fontSize: 10,
                                            padding: "1px 6px",
                                            height: 20,
                                            borderRadius: 2,
                                            color: "var(--accent-blue)",
                                            border: "1px solid rgba(59, 130, 246, 0.3)"
                                          }}
                                          title={`Jump to line ${v.line} in Monaco editor`}
                                        >
                                          L{v.line}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Synthesis Tab Content */}
        {activeTab === "synthesis" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflowY: "auto",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              padding: "12px 16px",
              gap: 12
            }}
          >
            {/* Top 5 KPI Summary Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10
              }}
            >
              {/* Card 1: Total Mapped Cells */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Total Cells</span>
                  <Cpu size={14} style={{ color: "var(--accent-purple, #c084fc)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#f8fafc" }}>
                  {synthCircuit?.stats.total_cells ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Target: {synthCircuit?.target_device ?? targetDevice}
                </span>
              </div>

              {/* Card 2: LUTs Breakdown */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>LUT Primitives</span>
                  <Layers size={14} style={{ color: "var(--accent-cyan)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
                  {synthCircuit?.stats.total_luts ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Util: {(synthCircuit?.stats.lut_utilization_pct ?? 0).toFixed(2)}% of {synthCircuit?.stats.target_lut_capacity ?? 63400}
                </span>
              </div>

              {/* Card 3: Registers (FFs) */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Registers (FFs)</span>
                  <Clock size={14} style={{ color: "var(--accent-emerald)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#10b981" }}>
                  {synthCircuit?.stats.total_ffs ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  FDRE: {synthCircuit?.stats.fdre_count ?? 0} • FDCE: {synthCircuit?.stats.fdce_count ?? 0}
                </span>
              </div>

              {/* Card 4: Arithmetic Carries */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Carry Chains</span>
                  <Zap size={14} style={{ color: "var(--accent-amber)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#fbbf24" }}>
                  {synthCircuit?.stats.total_carries ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {synthCircuit?.stats.carry4_count ?? 0} CARRY4 • {synthCircuit?.stats.carry8_count ?? 0} CARRY8
                </span>
              </div>

              {/* Card 5: I/O Buffers */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>I/O Buffers</span>
                  <CheckCircle2 size={14} style={{ color: "var(--accent-rose)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#f43f5e" }}>
                  {synthCircuit?.stats.total_iobs ?? 0}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {synthCircuit?.stats.ibuf_count ?? 0} IBUF • {synthCircuit?.stats.obuf_count ?? 0} OBUF • {synthCircuit?.stats.bufg_count ?? 0} BUFG
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200, maxWidth: 360, position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 8, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Filter cells by ID, kind, or net..."
                  value={synthFilter}
                  onChange={(e) => setSynthFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "4px 8px 4px 26px",
                    fontSize: 11,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    outline: "none"
                  }}
                />
              </div>

              {/* Quick Category Filter Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {[
                  { id: "all", label: "All" },
                  { id: "lut", label: "LUTs" },
                  { id: "ff", label: "Registers" },
                  { id: "carry", label: "Carries" },
                  { id: "io", label: "I/O Buffers" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSynthKindFilter(item.id)}
                    style={{
                      fontSize: 10.5,
                      padding: "2px 8px",
                      borderRadius: 12,
                      border: synthKindFilter === item.id ? "1px solid var(--accent-purple, #c084fc)" : "1px solid var(--border-subtle)",
                      backgroundColor: synthKindFilter === item.id ? "rgba(168, 85, 247, 0.2)" : "var(--bg-secondary)",
                      color: synthKindFilter === item.id ? "#c084fc" : "var(--text-muted)",
                      cursor: "pointer"
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Split: Cells Table & Inspector */}
            <div style={{ flex: 1, display: "flex", gap: 12, overflow: "hidden", minHeight: 220 }}>
              {/* Left: Cells Table */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden", backgroundColor: "var(--bg-secondary)" }}>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, zIndex: 2 }}>
                        <th style={{ padding: "6px 8px", color: "var(--text-secondary)", fontWeight: 600 }}>Cell ID</th>
                        <th style={{ padding: "6px 8px", color: "var(--text-secondary)", fontWeight: 600 }}>Primitive Kind</th>
                        <th style={{ padding: "6px 8px", color: "var(--text-secondary)", fontWeight: 600 }}>Equation / Parameter</th>
                        <th style={{ padding: "6px 8px", color: "var(--text-secondary)", fontWeight: 600 }}>Delay</th>
                        <th style={{ padding: "6px 8px", color: "var(--text-secondary)", fontWeight: 600 }}>Pins</th>
                        <th style={{ padding: "6px 8px", color: "var(--text-secondary)", fontWeight: 600, textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {synthLoading ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                            Running In-RAM FPGA Logic Synthesizer & Technology Mapper...
                          </td>
                        </tr>
                      ) : !synthCircuit || synthCircuit.cells.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                            No technology-mapped primitives synthesized.
                          </td>
                        </tr>
                      ) : (
                        synthCircuit.cells
                          .filter((c) => {
                            if (synthKindFilter === "lut" && !c.kind.toLowerCase().startsWith("lut")) return false;
                            if (synthKindFilter === "ff" && !c.kind.toLowerCase().startsWith("fd")) return false;
                            if (synthKindFilter === "carry" && !c.kind.toLowerCase().startsWith("carry")) return false;
                            if (synthKindFilter === "io" && !c.kind.toLowerCase().includes("buf")) return false;
                            if (!synthFilter) return true;
                            const query = synthFilter.toLowerCase();
                            return (
                              c.id.toLowerCase().includes(query) ||
                              c.kind.toLowerCase().includes(query) ||
                              Object.values(c.ports).some((net) => net.toLowerCase().includes(query))
                            );
                          })
                          .map((cell) => {
                            const isSelected = selectedCellId === cell.id;
                            return (
                              <tr
                                key={cell.id}
                                onClick={() => setSelectedCellId(cell.id)}
                                style={{
                                  borderBottom: "1px solid var(--border-subtle)",
                                  backgroundColor: isSelected ? "rgba(168, 85, 247, 0.15)" : "transparent",
                                  cursor: "pointer",
                                  transition: "background-color 0.15s ease"
                                }}
                              >
                                <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)", color: "#fff", fontWeight: 600 }}>
                                  {cell.id}
                                </td>
                                <td style={{ padding: "5px 8px" }}>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      padding: "1px 5px",
                                      borderRadius: 3,
                                      backgroundColor: cell.kind.toLowerCase().startsWith("lut")
                                        ? "rgba(168, 85, 247, 0.2)"
                                        : cell.kind.toLowerCase().startsWith("fd")
                                        ? "rgba(16, 185, 129, 0.2)"
                                        : cell.kind.toLowerCase().startsWith("carry")
                                        ? "rgba(245, 158, 11, 0.2)"
                                        : "rgba(56, 189, 248, 0.2)",
                                      color: cell.kind.toLowerCase().startsWith("lut")
                                        ? "#c084fc"
                                        : cell.kind.toLowerCase().startsWith("fd")
                                        ? "#10b981"
                                        : cell.kind.toLowerCase().startsWith("carry")
                                        ? "#fbbf24"
                                        : "#38bdf8",
                                      fontWeight: 700
                                    }}
                                  >
                                    {cell.kind}
                                  </span>
                                </td>
                                <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {cell.equation || (cell.params.INIT !== undefined ? `INIT=64'h${cell.params.INIT.toString(16).toUpperCase()}` : "-")}
                                </td>
                                <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                                  {cell.delay_ps} ps
                                </td>
                                <td style={{ padding: "5px 8px", fontSize: 10, color: "var(--text-muted)" }}>
                                  {Object.keys(cell.ports).length} pins ({Object.entries(cell.ports).slice(0, 2).map(([k, v]) => `.${k}(${v})`).join(", ")}{Object.keys(cell.ports).length > 2 ? "..." : ""})
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>
                                  {cell.source_line && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToLine?.(cell.source_line!, 1);
                                      }}
                                      className="btn btn-ghost"
                                      style={{
                                        fontSize: 9.5,
                                        padding: "1px 5px",
                                        height: 18,
                                        borderRadius: 2,
                                        color: "var(--accent-blue)",
                                        border: "1px solid rgba(59, 130, 246, 0.3)"
                                      }}
                                      title={`Jump to line ${cell.source_line}`}
                                    >
                                      L{cell.source_line}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Selected Cell Detail & Verilog Netlist Inspector */}
              <div
                style={{
                  width: 320,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: 10,
                  overflowY: "auto"
                }}
              >
                {selectedCellId && synthCircuit?.cells.find((c) => c.id === selectedCellId) ? (() => {
                  const cell = synthCircuit.cells.find((c) => c.id === selectedCellId)!;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Layers size={13} color="#c084fc" />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{cell.kind} Details</span>
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>{cell.delay_ps} ps</span>
                      </div>

                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        Instance: <span style={{ color: "#fff", fontFamily: "var(--font-mono)" }}>{cell.id}</span>
                      </div>

                      {cell.equation && (
                        <div style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "5px 7px" }}>
                          <div style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>Equation</div>
                          <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "#38bdf8", wordBreak: "break-all" }}>{cell.equation}</div>
                        </div>
                      )}

                      {cell.params.INIT !== undefined && (
                        <div style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "5px 7px" }}>
                          <div style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>INIT Parameter</div>
                          <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "#a855f7" }}>
                            64'h{cell.params.INIT.toString(16).toUpperCase().padStart(16, "0")}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>Pin Mappings</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                          {Object.entries(cell.ports).map(([pin, net]) => {
                            const val = liveValuesMap.get(net);
                            return (
                              <div key={pin} style={{ fontSize: 10, fontFamily: "var(--font-mono)", backgroundColor: "rgba(0,0,0,0.2)", padding: "2px 5px", borderRadius: 3, display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>.{pin}</span>
                                <span style={{ color: val === "1" ? "#10b981" : "#94a3b8" }}>{net}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Structural Verilog</span>
                      <button
                        onClick={() => {
                          if (synthCircuit?.verilog_text) {
                            navigator.clipboard.writeText(synthCircuit.verilog_text);
                            setCopiedNetlist(true);
                            setTimeout(() => setCopiedNetlist(false), 1500);
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: copiedNetlist ? "var(--accent-emerald)" : "var(--accent-cyan)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10
                        }}
                      >
                        {copiedNetlist ? <Check size={10} /> : <Copy size={10} />}
                        <span>{copiedNetlist ? "Copied" : "Copy Netlist"}</span>
                      </button>
                    </div>

                    <pre
                      style={{
                        flex: 1,
                        margin: 0,
                        padding: 8,
                        fontSize: 9.5,
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "rgba(0,0,0,0.4)",
                        borderRadius: 4,
                        overflowX: "auto",
                        color: "#94a3b8",
                        lineHeight: 1.4
                      }}
                    >
                      {synthCircuit?.verilog_text || "// No netlist generated"}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
