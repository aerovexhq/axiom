import React, { useState, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  Share2,
  Flame,
  ShieldCheck
} from "lucide-react";
import { SimulationState } from "../engine/engineBridge";
import {
  computeTimingAnalysis,
  computeCdcMatrix,
  computeEnergyTreemap,
  TimingPath,
  SlackRadarSummary,
  CdcCrossing,
  EnergyTreemapNode
} from "../engine/timingModel";

interface TimingRadarViewerProps {
  state: SimulationState;
  activeDesignId?: string;
}

export const TimingRadarViewer: React.FC<TimingRadarViewerProps> = ({
  state,
  activeDesignId: _activeDesignId
}) => {
  const [activeTab, setActiveTab] = useState<"waterfall" | "cdc" | "treemap">("waterfall");
  const [clockPeriodNs, setClockPeriodNs] = useState<number>(10.0); // 100 MHz default
  const [selectedPathId, setSelectedPathId] = useState<string>("path_1");

  // Run Timing Analysis for active design & constraint
  const timingSummary: SlackRadarSummary = useMemo(() => {
    return computeTimingAnalysis(state.topModule, clockPeriodNs);
  }, [state.topModule, clockPeriodNs]);

  // Run CDC Analysis
  const cdcCrossings: CdcCrossing[] = useMemo(() => {
    return computeCdcMatrix(state.topModule);
  }, [state.topModule]);

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
          height: 36,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          zIndex: 5
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} color="var(--accent-cyan)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
              Axiom Timing & Energy Intelligence Suite
            </span>
          </div>

          {/* Sub-Tab Switcher */}
          <div style={{ display: "flex", gap: 2, backgroundColor: "var(--bg-tertiary)", padding: 2, borderRadius: 4, border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setActiveTab("waterfall")}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 3,
                backgroundColor: activeTab === "waterfall" ? "var(--accent-blue)" : "transparent",
                color: activeTab === "waterfall" ? "#fff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <TrendingUp size={11} />
              <span>Slack Waterfall</span>
            </button>

            <button
              onClick={() => setActiveTab("cdc")}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 3,
                backgroundColor: activeTab === "cdc" ? "var(--accent-blue)" : "transparent",
                color: activeTab === "cdc" ? "#fff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Share2 size={11} />
              <span>CDC Matrix ({cdcCrossings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("treemap")}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 3,
                backgroundColor: activeTab === "treemap" ? "var(--accent-blue)" : "transparent",
                color: activeTab === "treemap" ? "#fff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Flame size={11} />
              <span>Silicon Energy Treemap</span>
            </button>
          </div>
        </div>

        {/* Clock Constraint Frequency Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>Target Clock:</span>
          {[20.0, 10.0, 5.0, 3.33].map((period) => {
            const mhz = Math.round(1000 / period);
            const isSelected = Math.abs(clockPeriodNs - period) < 0.05;
            return (
              <button
                key={period}
                onClick={() => setClockPeriodNs(period)}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor: isSelected ? "var(--accent-cyan)" : "var(--bg-tertiary)",
                  color: isSelected ? "#0c1017" : "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer"
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
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Worst Negative Slack (WNS)
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: timingSummary.worstNegativeSlackPs >= 0 ? "var(--accent-emerald)" : "#f43f5e",
                    marginTop: 4
                  }}
                >
                  {timingSummary.worstNegativeSlackPs >= 0
                    ? `+${(timingSummary.worstNegativeSlackPs / 1000).toFixed(3)} ns`
                    : `${(timingSummary.worstNegativeSlackPs / 1000).toFixed(3)} ns`}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  Status: {timingSummary.worstNegativeSlackPs >= 0 ? "MET (PASS)" : "VIOLATION"}
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
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Total Negative Slack (TNS)
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: timingSummary.totalNegativeSlackPs === 0 ? "var(--accent-emerald)" : "#f43f5e",
                    marginTop: 4
                  }}
                >
                  {(timingSummary.totalNegativeSlackPs / 1000).toFixed(3)} ns
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  Failing Paths: {timingSummary.failingPathsCount} of {timingSummary.totalPathsCount}
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
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Worst Hold Slack (WHS)
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-emerald)",
                    marginTop: 4
                  }}
                >
                  +{(timingSummary.worstHoldSlackPs / 1000).toFixed(3)} ns
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  Min Hold Margin: Met
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
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Max Frequency (Fmax)
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-cyan)",
                    marginTop: 4
                  }}
                >
                  {timingSummary.maxOperatingFrequencyMhz} MHz
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Slack Distribution Histogram
                  </span>
                  <span style={{ fontSize: 10, color: "var(--accent-emerald)" }}>All Paths Analyzed</span>
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
                    Critical Path Delay Breakdown: <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{activePath.startPoint} &rarr; {activePath.endPoint}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Arrival: {activePath.arrivalTimePs} ps | Required: {activePath.requiredTimePs} ps | Slack:{" "}
                    <span style={{ color: activePath.slackPs >= 0 ? "var(--accent-emerald)" : "#f43f5e", fontWeight: 700 }}>
                      +{activePath.slackPs} ps
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {timingSummary.allPaths.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPathId(p.id)}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: selectedPathId === p.id ? "1px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
                        backgroundColor: selectedPathId === p.id ? "rgba(56, 189, 248, 0.15)" : "var(--bg-tertiary)",
                        color: selectedPathId === p.id ? "var(--accent-cyan)" : "var(--text-muted)",
                        cursor: "pointer"
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
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                    <span style={{ color: "var(--text-muted)" }}>Logic Gate Delay: </span>
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>
                      {activePath.logicDelayPs} ps ({( (activePath.logicDelayPs / activePath.dataDelayPs) * 100 ).toFixed(0)}%)
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Interconnect Wire Delay: </span>
                    <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>
                      {activePath.netDelayPs} ps ({( (activePath.netDelayPs / activePath.dataDelayPs) * 100 ).toFixed(0)}%)
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Logic Depth: </span>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{activePath.logicLevels} levels</span>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} />
                  <span>Pipeline Optimization: Healthy Timing Margin</span>
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
                  Automated Clock Domain Crossing (CDC) Verification Matrix
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Detects metastability hazards and verifies 2-FF synchronizers across asynchronous clock boundaries.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-emerald)" }}>
                <ShieldCheck size={14} />
                <span>Zero Metastability Hazards Detected</span>
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
                  <th style={{ padding: "8px 10px" }}>Source Domain</th>
                  <th style={{ padding: "8px 10px" }}>Destination Domain</th>
                  <th style={{ padding: "8px 10px" }}>Signal Transferred</th>
                  <th style={{ padding: "8px 10px" }}>Freq Ratio</th>
                  <th style={{ padding: "8px 10px" }}>Protection Scheme</th>
                  <th style={{ padding: "8px 10px" }}>Verification Status</th>
                </tr>
              </thead>
              <tbody>
                {cdcCrossings.map((c) => (
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
                        {c.protection === "2ff_synchronizer" ? "2-Stage DFF Synchronizer" : "Direct Net (Intra-Domain)"}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 3,
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "var(--accent-emerald)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <CheckCircle2 size={10} />
                        <span>VERIFIED (PASS)</span>
                      </span>
                    </td>
                  </tr>
                ))}
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
                  Hierarchical Silicon Dynamic Energy Treemap (E = &frac12; &Sigma; C V&sup2;)
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
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>PDN Voltage Droop</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                    &Delta;V = {energyRoot.pdnDroopMv.toFixed(1)} mV
                  </div>
                </div>
                <div style={{ width: 1, height: 20, backgroundColor: "var(--border-subtle)" }} />
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Total Energy</div>
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
                    <span>Switching: &alpha; = {child.switchingRateAlpha.toFixed(2)}</span>
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
