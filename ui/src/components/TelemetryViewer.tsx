import React, { useRef, useEffect } from "react";
import { Zap, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { SimulationState } from "../engine/engineBridge";

interface TelemetryViewerProps {
  state: SimulationState;
}

export const TelemetryViewer: React.FC<TelemetryViewerProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const telemetry = state.telemetry;

  // Calculate summary metrics
  const latestPowerMw = telemetry.length > 0 ? telemetry[telemetry.length - 1].powerMw : 0;
  const avgPowerMw =
    telemetry.length > 0
      ? telemetry.reduce((acc, p) => acc + p.powerMw, 0) / telemetry.length
      : 0;

  const totalEnergyNj =
    telemetry.length > 1
      ? telemetry.reduce((acc, p, idx) => {
          if (idx === 0) return 0;
          const dtNs = (p.timePs - telemetry[idx - 1].timePs) / 1000;
          return acc + (p.powerMw * dtNs) / 1000;
        }, 0)
      : 0;

  // Switching activity rate estimate (events per simulated time)
  const switchingRateAlpha = state.currentSimTimePs > 0
    ? ((telemetry.length / (state.currentSimTimePs / 1000)) * 10).toFixed(1)
    : "0.0";

  const hasSagAlert = state.maxSagMv > 35;

  // Canvas Analog Plot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = containerRef.current?.clientWidth ?? 600);
    const height = (canvas.height = 140);

    // Clear
    ctx.fillStyle = "#0d0f12";
    ctx.fillRect(0, 0, width, height);

    if (telemetry.length < 2) {
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Awaiting simulation switching events for telemetry...", width / 2, height / 2);
      return;
    }

    const padLeft = 40;
    const padRight = 20;
    const padTop = 15;
    const padBottom = 20;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const minTime = telemetry[0].timePs;
    const maxTime = Math.max(minTime + 100, telemetry[telemetry.length - 1].timePs);

    const maxCur = Math.max(5, ...telemetry.map((p) => p.currentMa)) * 1.15;
    const maxSag = Math.max(20, ...telemetry.map((p) => p.voltageSagV * 1000)) * 1.2;

    // Grid lines
    ctx.strokeStyle = "#1a1f26";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (plotH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
    }

    // Y Axis labels
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(`${maxCur.toFixed(1)}mA`, padLeft - 6, padTop + 8);
    ctx.fillText("0mA", padLeft - 6, padTop + plotH);

    // 1. Draw Current Curve (Cyan gradient fill)
    ctx.beginPath();
    telemetry.forEach((p, idx) => {
      const x = padLeft + ((p.timePs - minTime) / (maxTime - minTime)) * plotW;
      const y = padTop + plotH - (p.currentMa / maxCur) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Stroke Current
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Fill under Current
    const curLastX = padLeft + ((telemetry[telemetry.length - 1].timePs - minTime) / (maxTime - minTime)) * plotW;
    ctx.lineTo(curLastX, padTop + plotH);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.closePath();
    const gradCur = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    gradCur.addColorStop(0, "rgba(6, 182, 212, 0.25)");
    gradCur.addColorStop(1, "rgba(6, 182, 212, 0.0)");
    ctx.fillStyle = gradCur;
    ctx.fill();

    // 2. Draw Voltage Sag Curve (Rose/Red spikes)
    ctx.beginPath();
    telemetry.forEach((p, idx) => {
      const x = padLeft + ((p.timePs - minTime) / (maxTime - minTime)) * plotW;
      const sagMv = p.voltageSagV * 1000;
      const y = padTop + (sagMv / maxSag) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }, [telemetry]);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      {/* Telemetry Header */}
      <div
        style={{
          height: 32,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-tertiary)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Zap size={14} color="var(--accent-amber)" />
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase" }}>
            Physics-Informed Power & PDN Telemetry (1.2V Core Rail)
          </span>
        </div>

        {/* Legend & Rail Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 4,
              backgroundColor: hasSagAlert ? "rgba(244, 63, 94, 0.15)" : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${hasSagAlert ? "rgba(244, 63, 94, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              color: hasSagAlert ? "var(--accent-rose)" : "var(--accent-emerald)",
              fontSize: 10,
              fontWeight: 600
            }}
          >
            {hasSagAlert ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
            <span>{hasSagAlert ? "PDN SAG DETECTED" : "PDN RAIL NOMINAL (1.20V)"}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#06b6d4" }} />
            <span style={{ color: "var(--text-secondary)" }}>Transient Current (mA)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#f43f5e" }} />
            <span style={{ color: "var(--text-secondary)" }}>Voltage Sag (mV)</span>
          </div>
        </div>
      </div>

      {/* Telemetry Metrics Cards, Dial & Canvas */}
      <div style={{ display: "flex", flex: 1, minHeight: 140 }}>
        {/* Dynamic Dial & Switching Activity Left Section */}
        <div
          style={{
            width: 320,
            borderRight: "1px solid var(--border-subtle)",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: "var(--bg-primary)"
          }}
        >
          {/* SVG Analog Dial */}
          <AnalogPowerDial powerMw={latestPowerMw || avgPowerMw} />

          {/* 4 Digital Metric Cards */}
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6
            }}
          >
            <div style={{ backgroundColor: "var(--bg-secondary)", padding: "5px 7px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Avg Power</span>
                <span style={{ fontSize: 8, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }} title="Total Dissipated Energy">
                  {totalEnergyNj.toFixed(2)}nJ
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-emerald)" }}>
                {avgPowerMw.toFixed(2)} mW
              </div>
            </div>

            <div style={{ backgroundColor: "var(--bg-secondary)", padding: "5px 7px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 1 }}>Peak Current</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                {state.peakCurrentMa.toFixed(1)} mA
              </div>
            </div>

            <div style={{ backgroundColor: "var(--bg-secondary)", padding: "5px 7px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 1 }}>Max Sag</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: hasSagAlert ? "var(--accent-rose)" : "var(--accent-amber)" }}>
                {state.maxSagMv.toFixed(1)} mV
              </div>
            </div>

            <div style={{ backgroundColor: "var(--bg-secondary)", padding: "5px 7px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 1 }}>Activity α</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-purple)", display: "flex", alignItems: "center", gap: 3 }}>
                <Activity size={11} />
                <span>{switchingRateAlpha}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Telemetry Graph */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", minHeight: 140 }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: 140, display: "block" }} />
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Circular Analog Dynamic Power Dial
const AnalogPowerDial: React.FC<{ powerMw: number; maxScaleMw?: number }> = ({ powerMw, maxScaleMw = 8.0 }) => {
  const clamped = Math.min(maxScaleMw, Math.max(0, powerMw));
  const ratio = clamped / maxScaleMw;
  // Sweep from -110 deg to +110 deg
  const angle = -110 + ratio * 220;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 95, flexShrink: 0 }}>
      <svg width="90" height="68" viewBox="0 0 100 80">
        <defs>
          <linearGradient id="powerDialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="45%" stopColor="#06b6d4" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Background Arc */}
        <path
          d="M 16 66 A 40 40 0 1 1 84 66"
          fill="none"
          stroke="#1e293b"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Active Colored Arc */}
        <path
          d="M 16 66 A 40 40 0 1 1 84 66"
          fill="none"
          stroke="url(#powerDialGrad)"
          strokeWidth="6"
          strokeDasharray="160"
          strokeDashoffset={160 * (1 - ratio)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.2s ease-out" }}
        />

        {/* Center Pivot Pin */}
        <circle cx="50" cy="58" r="4.5" fill="#0b0f17" stroke="#475569" strokeWidth="1.5" />

        {/* Sweeping Pointer Needle */}
        <g transform={`rotate(${angle} 50 58)`} style={{ transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          <line x1="50" y1="58" x2="50" y2="24" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
          <polygon points="50,21 48,26 52,26" fill="#f43f5e" />
        </g>
      </svg>

      <div style={{ marginTop: -14, textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
          {powerMw.toFixed(2)} <span style={{ fontSize: 8, color: "var(--text-muted)" }}>mW</span>
        </div>
        <div style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Dynamic P
        </div>
      </div>
    </div>
  );
};
