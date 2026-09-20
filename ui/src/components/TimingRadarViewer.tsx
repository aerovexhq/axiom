import React, { useState, useMemo, useEffect } from "react";
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  Share2,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Crosshair,
  ExternalLink,
  Zap,
  Loader2
} from "lucide-react";
import { engineBridge, SimulationState } from "../engine/engineBridge";
import {
  computeTimingAnalysis,
  computeCdcMatrix,
  computeEnergyTreemap,
  convertStaResult,
  TimingPath,
  PathSegment,
  SlackRadarSummary,
  CdcCrossing,
  EnergyTreemapNode
} from "../engine/timingModel";
import { AxiomProject, ProjectFile } from "../engine/projectModel";
import { useTranslation } from "../i18n/i18nContext";

interface TimingRadarViewerProps {
  state: SimulationState;
  activeDesignId?: string;
  project?: AxiomProject | null;
  onCrossProbe?: (signalOrInstance: string) => void;
  onNavigateToLine?: (line: number) => void;
  onOpenAutoPipeline?: (path?: TimingPath | null) => void;
}

export const TimingRadarViewer: React.FC<TimingRadarViewerProps> = ({
  state,
  activeDesignId: _activeDesignId,
  project,
  onCrossProbe,
  onNavigateToLine,
  onOpenAutoPipeline
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"waterfall" | "cdc" | "treemap">("waterfall");
  const [clockPeriodNs, setClockPeriodNs] = useState<number>(10.0); // 100 MHz default
  const [selectedPathId, setSelectedPathId] = useState<string>("path_1");

  // Dynamic live STA results from Rust axiom-sta engine
  const [liveStaSummary, setLiveStaSummary] = useState<SlackRadarSummary | null>(null);
  const [liveCdcCrossings, setLiveCdcCrossings] = useState<CdcCrossing[] | null>(null);
  const [isLoadingSta, setIsLoadingSta] = useState<boolean>(false);
  const [isLiveStaEngine, setIsLiveStaEngine] = useState<boolean>(false);
  const [lastAnalysisDurationMs, setLastAnalysisDurationMs] = useState<number | null>(null);

  // Trigger live STA analysis whenever project sources or clock constraint changes
  useEffect(() => {
    let cancelled = false;
    if (!project) {
      setLiveStaSummary(null);
      setLiveCdcCrossings(null);
      setIsLiveStaEngine(false);
      return;
    }

    const designFiles = project.files.filter((f: ProjectFile) => f.fileSet === "sources_1");
    const constrFiles = project.files.filter((f: ProjectFile) => f.fileSet === "constrs_1");
    const verilogCode = designFiles.map((f: ProjectFile) => f.content).join("\n\n");
    const xdcCode = constrFiles.map((f: ProjectFile) => f.content).join("\n\n");
    const topModule = project.topModule || state.topModule;

    if (!verilogCode.trim()) {
      return;
    }

    setIsLoadingSta(true);
    const startT = performance.now();
    engineBridge
      .runSta(verilogCode, xdcCode, topModule)
      .then((res) => {
        if (cancelled || !res) return;
        try {
          const { summary, cdcCrossings: cdc } = convertStaResult(res, clockPeriodNs);
          const dur = Math.round(performance.now() - startT);
          setLiveStaSummary(summary);
          setLiveCdcCrossings(cdc);
          setIsLiveStaEngine(true);
          setLastAnalysisDurationMs(dur);
        } catch (err) {
          console.warn("[TimingRadarViewer] STA conversion fallback:", err);
        }
      })
      .catch((err) => {
        console.warn("[TimingRadarViewer] STA run error:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project, state.topModule, clockPeriodNs]);

  // Run Timing Analysis for active design & constraint
  const timingSummary: SlackRadarSummary = useMemo(() => {
    if (liveStaSummary) return liveStaSummary;
    return computeTimingAnalysis(state.topModule, clockPeriodNs);
  }, [liveStaSummary, state.topModule, clockPeriodNs]);

  // Run CDC Analysis
  const cdcCrossings: CdcCrossing[] = useMemo(() => {
    if (liveCdcCrossings) return liveCdcCrossings;
    return computeCdcMatrix(state.topModule);
  }, [liveCdcCrossings, state.topModule]);

  // Run Energy Treemap Analysis
  const energyRoot: EnergyTreemapNode = useMemo(() => {
    return computeEnergyTreemap(state.topModule, state.currentSimTimePs);
  }, [state.topModule, state.currentSimTimePs]);

  // Active path for Waterfall Visualizer
  const activePath: TimingPath = useMemo(() => {
    return (
      timingSummary.allPaths.find((p) => p.id === selectedPathId) ??
      timingSummary.criticalPath
    );
  }, [timingSummary, selectedPathId]);

  // 1-Click Cross-Probing Handler
  const handleSegmentClick = (seg: PathSegment) => {
    const targetName = seg.instanceName || seg.name;
    if (onCrossProbe && targetName) {
      onCrossProbe(targetName);
    }
    if (onNavigateToLine && project && targetName) {
      const activeFile =
        project.files.find((f: ProjectFile) => f.id === project.activeFileId) ??
        project.files[0];
      if (activeFile) {
        const lines = activeFile.content.split("\n");
        const cleanName = targetName.replace(/^[^\w]+|[^\w]+$/g, "");
        const foundIdx = lines.findIndex((l: string) => l.includes(cleanName));
        if (foundIdx >= 0) {
          onNavigateToLine(foundIdx + 1);
        }
      }
    }
  };

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      {/* Timing Radar Header & Sub-Tab Switcher */}
      <div
        style={{
          minHeight: 36,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          zIndex: 5,
          whiteSpace: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "none",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Clock size={14} color="var(--accent-cyan)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {t.timing.title}
            </span>
          </div>

          {/* Engine Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 8px",
              borderRadius: 4,
              backgroundColor: isLiveStaEngine ? "rgba(16, 185, 129, 0.12)" : "rgba(56, 189, 248, 0.12)",
              border: `1px solid ${isLiveStaEngine ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
              fontSize: 10,
              flexShrink: 0,
              whiteSpace: "nowrap"
            }}
          >
            {isLoadingSta ? (
              <Loader2 size={10} className="animate-spin" color="var(--accent-cyan)" />
            ) : (
              <Zap size={10} color={isLiveStaEngine ? "var(--accent-emerald)" : "var(--accent-cyan)"} />
            )}
            <span style={{ color: isLiveStaEngine ? "var(--accent-emerald)" : "var(--accent-cyan)", fontWeight: 600 }}>
              {isLoadingSta
                ? "Analyzing STA..."
                : isLiveStaEngine
                ? `Live STA (${lastAnalysisDurationMs ?? 0}ms)`
                : "Topological Model"}
            </span>
          </div>

          {/* Sub-Tab Switcher */}
          <div style={{ display: "flex", gap: 2, backgroundColor: "var(--bg-tertiary)", padding: 2, borderRadius: 4, border: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            <button
              onClick={() => setActiveTab("waterfall")}
              className="btn btn-ghost"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                height: "auto",
                minHeight: 22,
                borderRadius: 3,
                backgroundColor: activeTab === "waterfall" ? "var(--accent-blue)" : "transparent",
                color: activeTab === "waterfall" ? "#fff" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <TrendingUp size={11} />
              <span>{t.timing.slackWaterfall}</span>
            </button>

            <button
              onClick={() => setActiveTab("cdc")}
              className="btn btn-ghost"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                height: "auto",
                minHeight: 22,
                borderRadius: 3,
                backgroundColor: activeTab === "cdc" ? "var(--accent-blue)" : "transparent",
                color: activeTab === "cdc" ? "#fff" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Share2 size={11} />
              <span>{t.timing.cdcMatrix} ({cdcCrossings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("treemap")}
              className="btn btn-ghost"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                height: "auto",
                minHeight: 22,
                borderRadius: 3,
                backgroundColor: activeTab === "treemap" ? "var(--accent-blue)" : "transparent",
                color: activeTab === "treemap" ? "#fff" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Flame size={11} />
              <span>{t.timing.energyTreemap}</span>
            </button>
          </div>
        </div>

        {/* Clock Constraint Frequency Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.timing.clockConstraint}</span>
          {[20.0, 10.0, 5.0, 3.33].map((period) => {
            const mhz = Math.round(1000 / period);
            const isSelected = Math.abs(clockPeriodNs - period) < 0.05;
            return (
              <button
                key={period}
                onClick={() => setClockPeriodNs(period)}
                className="btn btn-ghost"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  height: "auto",
                  minHeight: 20,
                  borderRadius: 3,
                  backgroundColor: isSelected ? "var(--accent-cyan)" : "var(--bg-tertiary)",
                  color: isSelected ? "#0c1017" : "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  whiteSpace: "nowrap"
                }}
              >
                {mhz} MHz
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content View */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", padding: 14, gap: 14 }}>
        {/* ==================================================================== */}
        {/* TAB 1: SLACK RADAR & CRITICAL PATH WATERFALL                        */}
        {/* ==================================================================== */}
        {activeTab === "waterfall" && (
          <>
            {/* Top Row: Timing Metric Cards & Slack Distribution Histogram */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) 1.5fr", gap: 10 }}>
              {/* Card 1: Worst Negative Slack (WNS) */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: 6,
                  padding: "10px 12px"
                }}
              >
                <div title="Worst Negative Slack" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.timing.wns}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: timingSummary.worstNegativeSlackPs >= 0 ? "var(--accent-emerald)" : "#f43f5e",
                    marginTop: 4,
                    whiteSpace: "nowrap"
                  }}
                >
                  {timingSummary.worstNegativeSlackPs >= 0
                    ? `+${(timingSummary.worstNegativeSlackPs / 1000).toFixed(3)} ns`
                    : `${(timingSummary.worstNegativeSlackPs / 1000).toFixed(3)} ns`}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                  {t.common.status}: {timingSummary.worstNegativeSlackPs >= 0 ? t.timing.statusMet : t.timing.statusViolation}
                </div>
              </div>

              {/* Card 2: Total Negative Slack (TNS) */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: 6,
                  padding: "10px 12px"
                }}
              >
                <div title="Total Negative Slack" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.timing.tns}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: timingSummary.totalNegativeSlackPs === 0 ? "var(--accent-emerald)" : "#f43f5e",
                    marginTop: 4,
                    whiteSpace: "nowrap"
                  }}
                >
                  {(timingSummary.totalNegativeSlackPs / 1000).toFixed(3)} ns
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                  {t.timing.failingPaths}: {timingSummary.failingPathsCount} of {timingSummary.totalPathsCount}
                </div>
              </div>

              {/* Card 3: Worst Hold Slack (WHS) */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: 6,
                  padding: "10px 12px"
                }}
              >
                <div title="Worst Hold Slack" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.timing.whs}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-emerald)",
                    marginTop: 4,
                    whiteSpace: "nowrap"
                  }}
                >
                  +{(timingSummary.worstHoldSlackPs / 1000).toFixed(3)} ns
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                  {t.common.status}: {t.timing.statusMet}
                </div>
              </div>

              {/* Card 4: Max Operating Frequency (Fmax) */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: 6,
                  padding: "10px 12px"
                }}
              >
                <div title="Maximum Operating Frequency" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.timing.fmax}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-cyan)",
                    marginTop: 4,
                    whiteSpace: "nowrap"
                  }}
                >
                  {timingSummary.maxOperatingFrequencyMhz} MHz
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                  Target: {timingSummary.targetFrequencyMhz} MHz
                </div>
              </div>

              {/* Card 5: Slack Distribution Histogram */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span title="Slack Distribution Histogram" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {t.timing.slackHistogram}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--accent-emerald)", whiteSpace: "nowrap" }}>{t.timing.allPathsAnalyzed}</span>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 28, margin: "4px 0" }}>
                  {timingSummary.histogramBins.map((bin, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${Math.max(15, bin.count * 30)}%`,
                        backgroundColor: bin.isViolating ? "#f43f5e" : "var(--accent-emerald)",
                        borderRadius: 2,
                        opacity: bin.count > 0 ? 1 : 0.2
                      }}
                      title={`${bin.range}: ${bin.count} paths`}
                    />
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)" }}>
                  <span>&lt; 0ps (Violations)</span>
                  <span>&gt; +500ps (Met)</span>
                </div>
              </div>
            </div>

            {/* Critical Path Waterfall Visualizer */}
            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-medium)",
                borderRadius: 8,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 12
              }}
            >
              {/* Path Header & Path Selector */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {t.timing.breakdown}: <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{activePath.startPoint} &rarr; {activePath.endPoint}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {t.timing.arrival}: {activePath.arrivalTimePs} ps | {t.timing.required}: {activePath.requiredTimePs} ps | {t.timing.slack}:{" "}
                    <span style={{ color: activePath.slackPs >= 0 ? "var(--accent-emerald)" : "#f43f5e", fontWeight: 700 }}>
                      +{activePath.slackPs} ps
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {onOpenAutoPipeline && activePath.slackPs < 0 && (
                    <button
                      onClick={() => onOpenAutoPipeline(activePath)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 4,
                        backgroundColor: "rgba(244, 63, 94, 0.2)",
                        border: "1px solid rgba(244, 63, 94, 0.5)",
                        color: "#f43f5e",
                        cursor: "pointer",
                        boxShadow: "0 0 10px rgba(244, 63, 94, 0.2)",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <Zap size={11} color="#f43f5e" />
                      <span>⚡ Auto-Pipeline Path</span>
                    </button>
                  )}

                  {timingSummary.allPaths.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPathId(p.id)}
                      className="btn btn-ghost"
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        height: "auto",
                        minHeight: 20,
                        borderRadius: 4,
                        border: selectedPathId === p.id ? "1px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
                        backgroundColor: selectedPathId === p.id ? "rgba(56, 189, 248, 0.15)" : "var(--bg-tertiary)",
                        color: selectedPathId === p.id ? "var(--accent-cyan)" : "var(--text-muted)"
                      }}
                    >
                      Path {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Waterfall Timeline Graphic */}
              <div
                style={{
                  backgroundColor: "#080b11",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}
              >
                {/* Timeline Ruler */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 4, fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  <span>0 ps (Launch Edge)</span>
                  <span>{Math.round(timingSummary.clockPeriodPs * 0.25)} ps</span>
                  <span>{Math.round(timingSummary.clockPeriodPs * 0.5)} ps</span>
                  <span>{Math.round(timingSummary.clockPeriodPs * 0.75)} ps</span>
                  <span>{timingSummary.clockPeriodPs} ps (Capture Edge)</span>
                </div>

                {/* Waterfall Stage Bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activePath.segments.map((seg, idx) => {
                    const prevCumulative = idx === 0 ? 0 : activePath.segments[idx - 1].cumulativeDelayPs;
                    const leftPct = (prevCumulative / timingSummary.clockPeriodPs) * 100;
                    const widthPct = Math.max(3, (seg.delayPs / timingSummary.clockPeriodPs) * 100);

                    const segColor =
                      seg.type === "launch_clock"
                        ? "#38bdf8"
                        : seg.type === "clock_to_out"
                        ? "#818cf8"
                        : seg.type === "logic_cell"
                        ? "#10b981"
                        : seg.type === "interconnect"
                        ? "#f59e0b"
                        : "#c084fc";

                    return (
                      <div
                        key={idx}
                        onClick={() => handleSegmentClick(seg)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          padding: "2px 0",
                          borderRadius: 4,
                          transition: "background 0.15s"
                        }}
                        title={`Click to cross-probe "${seg.instanceName || seg.name}" in Schematic and jump to HDL`}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(56, 189, 248, 0.06)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div style={{ width: 140, fontSize: 10, color: "var(--text-muted)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {seg.name}
                        </div>

                        {/* Bar Track */}
                        <div style={{ flex: 1, height: 20, position: "relative", backgroundColor: "rgba(255, 255, 255, 0.02)", borderRadius: 3 }}>
                          {/* Colored Stage Bar */}
                          <div
                            style={{
                              position: "absolute",
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: "100%",
                              backgroundColor: segColor,
                              borderRadius: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              boxShadow: `0 0 8px ${segColor}44`
                            }}
                          >
                            {seg.delayPs}ps
                          </div>
                        </div>

                        <div style={{ width: 60, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {seg.cumulativeDelayPs} ps
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delay Ratio Analysis & Pipeline Recommendation */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--bg-tertiary)", padding: "10px 14px", borderRadius: 6 }}>
                <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>{t.timing.logicDelay}: </span>
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>
                      {activePath.logicDelayPs} ps ({( (activePath.logicDelayPs / Math.max(1, activePath.dataDelayPs)) * 100 ).toFixed(0)}%)
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>{t.timing.routingDelay}: </span>
                    <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>
                      {activePath.netDelayPs} ps ({( (activePath.netDelayPs / Math.max(1, activePath.dataDelayPs)) * 100 ).toFixed(0)}%)
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Logic Depth: </span>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{activePath.logicLevels} levels</span>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: activePath.slackPs >= 0 ? "var(--accent-cyan)" : "#f43f5e", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  {activePath.slackPs >= 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  <span>{activePath.slackPs >= 0 ? "Timing Met" : "Timing Violation"}</span>
                </div>
              </div>

              {/* Critical Path Datapath Segments & 1-Click Cross-Probing Table */}
              <div
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#fff" }}>
                    <Crosshair size={13} color="var(--accent-cyan)" />
                    <span>Critical Path Netlist Elements &amp; 1-Click Cross-Probing</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Click row to highlight element in Schematic and jump to HDL source
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-sans)" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--text-muted)", fontSize: 10 }}>
                        <th style={{ padding: "6px 8px" }}>#</th>
                        <th style={{ padding: "6px 8px" }}>Segment / Pin</th>
                        <th style={{ padding: "6px 8px" }}>Type</th>
                        <th style={{ padding: "6px 8px" }}>Instance / Location</th>
                        <th style={{ padding: "6px 8px" }}>Delay</th>
                        <th style={{ padding: "6px 8px" }}>Cumulative</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Cross-Probe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePath.segments.map((seg, idx) => (
                        <tr
                          key={idx}
                          onClick={() => handleSegmentClick(seg)}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                            cursor: "pointer",
                            transition: "background 0.12s"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(56, 189, 248, 0.08)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <td style={{ padding: "6px 8px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#fff" }}>
                            {seg.name}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "1px 5px",
                                borderRadius: 3,
                                backgroundColor: "var(--bg-secondary)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border-subtle)"
                              }}
                            >
                              {seg.type}
                            </span>
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                            {seg.instanceName || "—"}
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--accent-emerald)" }}>
                            +{seg.delayPs} ps
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            {seg.cumulativeDelayPs} ps
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <button
                              className="btn btn-ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSegmentClick(seg);
                              }}
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                height: "auto",
                                minHeight: 18,
                                color: "var(--accent-cyan)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              <ExternalLink size={10} />
                              <span>Probe</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: CLOCK DOMAIN CROSSING (CDC) MATRIX                           */}
        {/* ==================================================================== */}
        {activeTab === "cdc" && (
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-medium)",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {t.timing.cdcMatrix}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Detects metastability hazards and verifies 2-FF synchronizers across asynchronous clock boundaries.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-emerald)" }}>
                <ShieldCheck size={14} />
                <span>{t.timing.zeroMetastability}</span>
              </div>
            </div>

            {/* CDC Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-sans)",
                fontSize: 11
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-medium)", textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "8px 10px" }}>{t.timing.sourceDomain}</th>
                  <th style={{ padding: "8px 10px" }}>{t.timing.destDomain}</th>
                  <th style={{ padding: "8px 10px" }}>{t.timing.signalTransferred}</th>
                  <th style={{ padding: "8px 10px" }}>{t.timing.freqRatio}</th>
                  <th style={{ padding: "8px 10px" }}>{t.timing.protectionScheme}</th>
                  <th style={{ padding: "8px 10px" }}>{t.timing.verificationStatus}</th>
                </tr>
              </thead>
              <tbody>
                {cdcCrossings.map((c) => {
                  const isSafe = c.status === "safe";
                  const isWarning = c.status === "warning";
                  const statusColor = isSafe ? "var(--accent-emerald)" : isWarning ? "var(--accent-amber)" : "#f43f5e";
                  const statusBg = isSafe ? "rgba(16, 185, 129, 0.15)" : isWarning ? "rgba(245, 158, 11, 0.15)" : "rgba(244, 63, 94, 0.15)";
                  const statusBorder = isSafe ? "rgba(16, 185, 129, 0.3)" : isWarning ? "rgba(245, 158, 11, 0.3)" : "rgba(244, 63, 94, 0.3)";

                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "10px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                        {c.sourceDomain}
                      </td>
                      <td style={{ padding: "10px", fontFamily: "var(--font-mono)", color: "var(--accent-blue)" }}>
                        {c.destDomain}
                      </td>
                      <td style={{ padding: "10px", fontFamily: "var(--font-mono)", color: "#fff" }}>
                        {c.sourceSignal} &rarr; {c.destSignal}
                      </td>
                      <td style={{ padding: "10px", color: "var(--text-muted)" }}>
                        {c.ratio}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 3,
                            backgroundColor: "var(--bg-tertiary)",
                            color: "#fff",
                            border: "1px solid var(--border-subtle)"
                          }}
                        >
                          {c.protection === "2ff_synchronizer"
                            ? "2-Stage DFF Synchronizer"
                            : c.protection === "handshake"
                            ? "Handshake Sync"
                            : "Direct / Unprotected"}
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 3,
                            backgroundColor: statusBg,
                            color: statusColor,
                            border: `1px solid ${statusBorder}`,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          {isSafe ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                          <span>{isSafe ? t.timing.verifiedPass : isWarning ? "CONSTRAINED" : "HAZARD"}</span>
                        </span>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>
                          {c.message}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: HIERARCHICAL DYNAMIC ENERGY TREEMAP & PDN DROOP             */}
        {/* ==================================================================== */}
        {activeTab === "treemap" && (
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-medium)",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {t.timing.energyTreemap} (E = &frac12; &Sigma; C V&sup2;)
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Area is proportional to dissipated energy; color intensity tracks instantaneous toggle switching rate (&alpha;).
                </div>
              </div>

              {/* PDN Sag Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#090d14",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "6px 12px"
                }}
              >
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{t.timing.pdnDroop}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                    &Delta;V = {energyRoot.pdnDroopMv.toFixed(1)} mV
                  </div>
                </div>
                <div style={{ width: 1, height: 20, backgroundColor: "var(--border-subtle)" }} />
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{t.timing.totalEnergy}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                    {energyRoot.energyUj.toFixed(2)} &mu;J
                  </div>
                </div>
              </div>
            </div>

            {/* Treemap Blocks */}
            <div
              style={{
                height: 280,
                backgroundColor: "#07090e",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                padding: 8,
                display: "flex",
                gap: 8
              }}
            >
              {energyRoot.children?.map((child) => (
                <div
                  key={child.id}
                  style={{
                    flex: child.percentage,
                    backgroundColor: child.thermalColor + "18",
                    border: `1px solid ${child.thermalColor}66`,
                    borderRadius: 4,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: `inset 0 0 16px ${child.thermalColor}22`
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                      {child.name}
                    </div>
                    <div style={{ fontSize: 10, color: child.thermalColor, marginTop: 2 }}>
                      {child.percentage}% of Silicon Energy ({child.energyUj.toFixed(2)} &mu;J)
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}>
                    <span>{t.timing.switchingRate}: &alpha; = {child.switchingRateAlpha.toFixed(2)}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: child.thermalColor }}>
                      Droop: {child.pdnDroopMv} mV
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
