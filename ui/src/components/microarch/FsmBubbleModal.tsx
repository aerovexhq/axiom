import React, { useRef, useEffect, useState } from "react";
import { X, Activity, RefreshCw } from "lucide-react";
import { FsmMacro } from "../../engine/microarchModel";
import { FsmCoverageData, engineBridge } from "../../engine/engineBridge";

interface FsmBubbleModalProps {
  fsm: FsmMacro;
  macroLabel: string;
  activeStateName?: string;
  coverage?: FsmCoverageData;
  onClose: () => void;
}

export const FsmBubbleModal: React.FC<FsmBubbleModalProps> = ({
  fsm,
  macroLabel,
  activeStateName,
  coverage,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [liveCov, setLiveCov] = useState<FsmCoverageData | undefined>(coverage);

  const currentActive = activeStateName || fsm.current_state_default || fsm.reset_state;

  useEffect(() => {
    if (coverage) {
      setLiveCov(coverage);
      return;
    }
    let cancelled = false;
    const fetchCoverage = async () => {
      try {
        const rep = await engineBridge.getCoverage();
        if (!cancelled && rep && rep.fsm_details) {
          const detail =
            rep.fsm_details[fsm.state_reg] ||
            rep.fsm_details[macroLabel] ||
            Object.values(rep.fsm_details)[0];
          if (detail) setLiveCov(detail);
        }
      } catch (err) {
        console.warn("FsmBubbleModal: failed to fetch coverage:", err);
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
  }, [coverage, fsm.state_reg, macroLabel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 600;
    const h = 420;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Dark grid background
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#161b22";
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // State positions (radial layout)
    const numStates = fsm.states.length;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(centerX, centerY) * 0.65;
    const statePositions = new Map<string, { x: number; y: number }>();

    fsm.states.forEach((s, idx) => {
      const angle = (idx / numStates) * 2 * Math.PI - Math.PI / 2;
      const sx = centerX + Math.cos(angle) * radius;
      const sy = centerY + Math.sin(angle) * radius;
      statePositions.set(s.name, { x: sx, y: sy });
    });

    // Draw Transition Arcs
    ctx.lineWidth = 2;
    fsm.transitions.forEach((t) => {
      const src = statePositions.get(t.from_state);
      const dst = statePositions.get(t.to_state);
      if (!src || !dst) return;

      const isSelfLoop = t.from_state === t.to_state;
      const isSrcActive = t.from_state === currentActive;
      const transKey = `${t.from_state}->${t.to_state}`;
      const transHits = liveCov?.transition_hits?.[transKey] ?? 0;
      const isTraversed = transHits > 0;

      ctx.strokeStyle = isSrcActive ? "#f59e0b" : isTraversed ? "#10b981" : "#30363d";
      ctx.fillStyle = isSrcActive ? "#f59e0b" : isTraversed ? "#10b981" : "#8b949e";
      ctx.lineWidth = isTraversed || isSrcActive ? 2.5 : 1.5;

      const condLabel = isTraversed ? `${t.condition} (✓${transHits})` : t.condition;

      if (isSelfLoop) {
        // Self-loop circle above node
        ctx.beginPath();
        const loopRadius = 24;
        const loopCenterY = src.y - 36;
        ctx.arc(src.x, loopCenterY, loopRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Self-loop condition
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(condLabel, src.x, loopCenterY - 30);
      } else {
        // Curved Bezier arrow
        const dx = dst.x - src.x;
        const dy = dst.y - src.y;
        const midX = (src.x + dst.x) / 2 - dy * 0.22;
        const midY = (src.y + dst.y) / 2 + dx * 0.22;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(midX, midY, dst.x, dst.y);
        ctx.stroke();

        // Arrowhead at destination
        const angle = Math.atan2(dst.y - midY, dst.x - midX);
        const nodeRadius = 36;
        const arrowTipX = dst.x - Math.cos(angle) * nodeRadius;
        const arrowTipY = dst.y - Math.sin(angle) * nodeRadius;

        ctx.beginPath();
        ctx.moveTo(arrowTipX, arrowTipY);
        ctx.lineTo(
          arrowTipX - 10 * Math.cos(angle - Math.PI / 6),
          arrowTipY - 10 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowTipX - 10 * Math.cos(angle + Math.PI / 6),
          arrowTipY - 10 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Condition label on midpoint
        ctx.save();
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "center";
        const textWidth = ctx.measureText(condLabel).width;
        ctx.fillStyle = "#0d1117";
        ctx.fillRect(midX - textWidth / 2 - 4, midY - 8, textWidth + 8, 16);
        ctx.strokeStyle = isTraversed ? "#10b981" : "#21262d";
        ctx.strokeRect(midX - textWidth / 2 - 4, midY - 8, textWidth + 8, 16);
        ctx.fillStyle = isSrcActive ? "#f59e0b" : isTraversed ? "#10b981" : "#8b949e";
        ctx.fillText(condLabel, midX, midY + 4);
        ctx.restore();
      }
    });

    // Draw State Circles
    fsm.states.forEach((s) => {
      const pos = statePositions.get(s.name);
      if (!pos) return;

      const isActive = s.name === currentActive;
      const sHits = liveCov?.state_hits?.[s.name] ?? 0;
      const isCovered = sHits > 0;
      const nodeRadius = 36;

      // Glow effect for active state
      if (isActive) {
        ctx.save();
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      } else if (isCovered) {
        // Outer coverage ring
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Circle Body
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#0c2d48" : "#161b22";
      ctx.fill();
      ctx.strokeStyle = isActive ? "#38bdf8" : s.is_reset ? "#10b981" : isCovered ? "#10b981" : "#30363d";
      ctx.lineWidth = isActive ? 3 : s.is_reset ? 2.5 : isCovered ? 2 : 1.5;
      ctx.stroke();

      // Reset double border
      if (s.is_reset) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius - 5, 0, Math.PI * 2);
        ctx.strokeStyle = s.is_reset ? "#10b981" : "#30363d";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // State Name & Binary Value
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.fillStyle = isActive ? "#38bdf8" : "#f0f6fc";
      ctx.fillText(s.name, pos.x, pos.y - 10);

      ctx.font = "10px monospace";
      ctx.fillStyle = isActive ? "#7dd3fc" : "#8b949e";
      ctx.fillText(`[${s.binary_str}]`, pos.x, pos.y + 6);

      // Hit count indicator
      ctx.font = "9px monospace";
      ctx.fillStyle = isCovered ? "#10b981" : "#f43f5e";
      ctx.fillText(isCovered ? `✓ ${sHits} hits` : "0 hits", pos.x, pos.y + 20);
    });

    ctx.restore();
  }, [fsm, currentActive, liveCov]);

  const totalStates = fsm.states.length;
  const coveredStates = fsm.states.filter((s) => (liveCov?.state_hits?.[s.name] ?? 0) > 0).length;
  const covPct = totalStates > 0 ? (coveredStates / totalStates) * 100 : 100;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 720,
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={18} color="var(--accent-cyan)" />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                  {macroLabel} — State Transition Bubble Diagram
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 10,
                    backgroundColor:
                      covPct >= 80
                        ? "rgba(16, 185, 129, 0.15)"
                        : covPct >= 50
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(244, 63, 94, 0.15)",
                    color:
                      covPct >= 80
                        ? "var(--accent-emerald)"
                        : covPct >= 50
                        ? "var(--accent-amber)"
                        : "var(--accent-rose)",
                    border: `1px solid ${
                      covPct >= 80
                        ? "rgba(16, 185, 129, 0.3)"
                        : covPct >= 50
                        ? "rgba(245, 158, 11, 0.3)"
                        : "rgba(244, 63, 94, 0.3)"
                    }`
                  }}
                >
                  FSM Coverage: {coveredStates}/{totalStates} ({covPct.toFixed(0)}%)
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Register: <code style={{ color: "var(--accent-cyan)" }}>{fsm.state_reg}</code> | {fsm.states.length} States | Active State:{" "}
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>{currentActive}</span>
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
              padding: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas Body */}
        <div style={{ padding: 14, backgroundColor: "#0c1017", display: "flex", justifyContent: "center" }}>
          <canvas ref={canvasRef} style={{ borderRadius: 6, display: "block" }} />
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--text-muted)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }} />
              Covered State ({coveredStates}/{totalStates})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#38bdf8", display: "inline-block" }} />
              Active State ({currentActive})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={12} color="#10b981" />
              Traversed Arc
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: "4px 12px", fontSize: 11.5 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
