import React, { useState, useEffect } from "react";
import {
  Zap,
  X,
  ArrowRight,
  Sparkles,
  Code2,
  Loader2
} from "lucide-react";
import {
  AutoPipelineRecommendation,
  PipelineCutCandidate,
  refactorVerilogPipeline
} from "../engine/autoPipelineModel";

interface AutoPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: AutoPipelineRecommendation | null;
  activeSourceCode?: string;
  onApplyPipeline?: (cutNet: string, clockName: string, resetName?: string) => Promise<void>;
  isLoading?: boolean;
}

export const AutoPipelineModal: React.FC<AutoPipelineModalProps> = ({
  isOpen,
  onClose,
  recommendation,
  activeSourceCode,
  onApplyPipeline,
  isLoading = false
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCutCandidate | null>(null);
  const [clockName, setClockName] = useState<string>("clk");
  const [resetName, setResetName] = useState<string>("rst_n");
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Initialize selected candidate to the optimal cut
  useEffect(() => {
    if (recommendation) {
      setSelectedCandidate(recommendation.optimal_cut || recommendation.candidates[0] || null);
      if (recommendation.clock_name) setClockName(recommendation.clock_name);
      if (recommendation.reset_name) setResetName(recommendation.reset_name);
    }
  }, [recommendation]);

  if (!isOpen || !recommendation) return null;

  // Active cut being inspected
  const activeCut = selectedCandidate || recommendation.optimal_cut || recommendation.candidates[0];

  // Dynamic code diff based on the selected cut
  const diffContent = React.useMemo(() => {
    if (!activeCut || !activeSourceCode) {
      return recommendation.diff_preview || "";
    }
    const res = refactorVerilogPipeline(activeSourceCode, activeCut.net_name, clockName, resetName);
    return res.diff_preview;
  }, [activeCut, activeSourceCode, clockName, resetName, recommendation.diff_preview]);

  const handleApply = async () => {
    if (!activeCut || !onApplyPipeline) return;
    setIsApplying(true);
    try {
      await onApplyPipeline(activeCut.net_name, clockName, resetName);
      onClose();
    } catch (err) {
      console.error("[AutoPipelineModal] Apply error:", err);
    } finally {
      setIsApplying(false);
    }
  };

  const currentWns = recommendation.current_wns_ps;
  const predictedWns = activeCut ? activeCut.predicted_wns_ps : currentWns;
  const slackGain = activeCut ? activeCut.slack_gain_ps : 0;

  const currentFmax = recommendation.current_fmax_mhz;
  const predictedFmax = activeCut ? activeCut.predicted_fmax_mhz : currentFmax;
  const fmaxGain = activeCut ? activeCut.fmax_gain_mhz : 0;
  const pctGain = Math.round((fmaxGain / Math.max(currentFmax, 1)) * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "92vh",
          backgroundColor: "#0d1117",
          border: "1px solid rgba(244, 63, 94, 0.4)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(244, 63, 94, 0.15)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(244, 63, 94, 0.12), rgba(168, 85, 247, 0.08), transparent)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #f43f5e, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(244, 63, 94, 0.5)"
              }}
            >
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
                  Silicon Copilot
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "rgba(244, 63, 94, 0.2)",
                    border: "1px solid rgba(244, 63, 94, 0.4)",
                    color: "#f43f5e",
                    textTransform: "uppercase"
                  }}
                >
                  Auto-Pipelining
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                Critical Path: <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{recommendation.startpoint}</span>
                {" → "}
                <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{recommendation.endpoint}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Before vs After KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {/* WNS Card */}
            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: `1px solid ${predictedWns >= 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)"}`,
                borderRadius: 8,
                padding: "12px 14px",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Worst Negative Slack (WNS)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: currentWns < 0 ? "#f43f5e" : "#10b981", textDecoration: "line-through", fontFamily: "var(--font-mono)" }}>
                  {currentWns >= 0 ? `+${currentWns}` : currentWns} ps
                </span>
                <ArrowRight size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 18, fontWeight: 800, color: predictedWns >= 0 ? "#10b981" : "#f43f5e", fontFamily: "var(--font-mono)" }}>
                  {predictedWns >= 0 ? `+${predictedWns}` : predictedWns} ps
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "#10b981", marginTop: 4, fontWeight: 600 }}>
                +{slackGain} ps timing recovery
              </div>
            </div>

            {/* Fmax Card */}
            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: 8,
                padding: "12px 14px"
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Maximum Operating Frequency</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "line-through", fontFamily: "var(--font-mono)" }}>
                  {currentFmax} MHz
                </span>
                <ArrowRight size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 18, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono)" }}>
                  {predictedFmax} MHz
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "#10b981", marginTop: 4, fontWeight: 600 }}>
                +{fmaxGain} MHz (+{pctGain}%)
              </div>
            </div>

            {/* Latency Card */}
            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: "12px 14px"
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Pipeline Latency Tradeoff</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>1 cycle</span>
                <ArrowRight size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                  2 cycles
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--accent-cyan)", marginTop: 4, fontWeight: 600 }}>
                +1 register pipeline stage
              </div>
            </div>
          </div>

          {/* Interactive Stage Cut Points Track */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                Select Optimal Combinational Cut Point
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Click any candidate net to inspect before/after performance
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                backgroundColor: "var(--bg-secondary)",
                padding: 8,
                borderRadius: 8,
                border: "1px solid var(--border-subtle)"
              }}
            >
              {recommendation.candidates.map((cand, idx) => {
                const isSelected = activeCut?.net_name === cand.net_name;
                return (
                  <div
                    key={cand.net_name}
                    onClick={() => setSelectedCandidate(cand)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 6,
                      backgroundColor: isSelected ? "rgba(244, 63, 94, 0.15)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${isSelected ? "#f43f5e" : "transparent"}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: isSelected ? "#f43f5e" : "var(--bg-tertiary)",
                          color: isSelected ? "#fff" : "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10.5,
                          fontWeight: 700
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: isSelected ? "#fff" : "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                            {cand.net_name}
                          </span>
                          {cand.is_optimal && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: "1px 5px",
                                borderRadius: 3,
                                backgroundColor: "rgba(16, 185, 129, 0.2)",
                                color: "#10b981",
                                border: "1px solid rgba(16, 185, 129, 0.4)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2
                              }}
                            >
                              <Sparkles size={9} />
                              OPTIMAL CUT
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                          Driver Cell: <span style={{ fontFamily: "var(--font-mono)" }}>{cand.driver_cell}</span> · Stage 1: {cand.stage1_delay_ps} ps · Stage 2: {cand.stage2_delay_ps} ps
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: cand.predicted_wns_ps >= 0 ? "#10b981" : "#f43f5e",
                          fontFamily: "var(--font-mono)"
                        }}
                      >
                        {cand.predicted_wns_ps >= 0 ? `+${cand.predicted_wns_ps}` : cand.predicted_wns_ps} ps
                      </div>
                      <div style={{ fontSize: 10.5, color: "#10b981", fontWeight: 600 }}>
                        +{cand.fmax_gain_mhz} MHz
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration inputs: Clock & Reset detection */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Target Clock Port
              </label>
              <input
                type="text"
                value={clockName}
                onChange={(e) => setClockName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Target Reset Port (Active Low / High)
              </label>
              <input
                type="text"
                value={resetName}
                onChange={(e) => setResetName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)"
                }}
              />
            </div>
          </div>

          {/* RTL Code Refactoring Preview */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Code2 size={13} color="var(--accent-purple)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  SystemVerilog Refactoring Diff (Driver-Shadow Pattern)
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                Downstream logic untouched & preserved
              </span>
            </div>

            <div
              style={{
                backgroundColor: "#05070a",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: "10px 14px",
                maxHeight: 180,
                overflowY: "auto",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                lineHeight: 1.5
              }}
            >
              {diffContent.split("\n").map((line, lIdx) => {
                let color = "var(--text-secondary)";
                let bg = "transparent";
                if (line.startsWith("+")) {
                  color = "#10b981";
                  bg = "rgba(16, 185, 129, 0.08)";
                } else if (line.startsWith("-")) {
                  color = "#f43f5e";
                  bg = "rgba(244, 63, 94, 0.08)";
                } else if (line.startsWith("@")) {
                  color = "var(--accent-purple)";
                }
                return (
                  <div key={lIdx} style={{ color, backgroundColor: bg, whiteSpace: "pre-wrap" }}>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-secondary)"
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Axiom Silicon Copilot v0.1.0-jit · Sub-50ms Timing Remediation
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              Cancel
            </button>

            <button
              onClick={handleApply}
              disabled={isApplying || isLoading || !activeCut}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 6,
                background: "linear-gradient(135deg, #f43f5e, #e11d48)",
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: isApplying || isLoading || !activeCut ? "not-allowed" : "pointer",
                boxShadow: "0 2px 10px rgba(244, 63, 94, 0.4)",
                transition: "all 0.15s ease",
                opacity: isApplying || isLoading || !activeCut ? 0.6 : 1
              }}
            >
              {isApplying ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Applying & Re-elaborating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>🚀 Apply Pipelining & Re-elaborate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
