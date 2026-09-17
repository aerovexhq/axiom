import React, { useRef, useEffect } from "react";
import { Zap } from "lucide-react";
import { SimulationState } from "../engine/engineBridge";

interface TelemetryViewerProps {
  state: SimulationState;
}

export const TelemetryViewer: React.FC<TelemetryViewerProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const telemetry = state.telemetry;

  // Calculate summary metrics
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

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
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

      {/* Telemetry Metrics Cards & Canvas */}
      <div style={{ display: "flex", flex: 1, minHeight: 140 }}>
        {/* Metric Cards Left */}
        <div
          style={{
            width: 220,
            borderRight: "1px solid var(--border-subtle)",
            padding: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            backgroundColor: "var(--bg-primary)"
          }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", padding: "6px 8px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Avg Power</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-emerald)" }}>
              {avgPowerMw.toFixed(2)} mW
            </div>
          </div>

          <div style={{ backgroundColor: "var(--bg-secondary)", padding: "6px 8px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Peak Current</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
              {state.peakCurrentMa.toFixed(1)} mA
            </div>
          </div>

          <div style={{ backgroundColor: "var(--bg-secondary)", padding: "6px 8px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Max Sag</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-rose)" }}>
              {state.maxSagMv.toFixed(1)} mV
            </div>
          </div>

          <div style={{ backgroundColor: "var(--bg-secondary)", padding: "6px 8px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Total Energy</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-amber)" }}>
              {totalEnergyNj.toFixed(3)} nJ
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
