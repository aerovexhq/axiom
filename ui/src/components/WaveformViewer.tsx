import React, { useRef, useEffect, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, Bug } from "lucide-react";
import { SimulationState } from "../engine/engineBridge";

interface WaveformViewerProps {
  state: SimulationState;
  selectedSignalIds: Set<string>;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({ state, selectedSignalIds }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport time window (in picoseconds)
  const [timeOffsetPs, setTimeOffsetPs] = useState<number>(0);
  const [pixelsPerPs, setPixelsPerPs] = useState<number>(0.1); // 100 pixels per 1000 ps (1 ns)
  const [cursorPs, setCursorPs] = useState<number | null>(null);
  const [showDeltaGlitches, setShowDeltaGlitches] = useState<boolean>(true);

  // Active displayed signals
  const activeSignals = state.signals.filter(
    (s) => selectedSignalIds.has(s.fullName) || selectedSignalIds.has(s.id)
  );

  const signalHeight = 28;
  const headerHeight = 28;
  const gutterWidth = 180;

  // Auto-fit or adjust time window when simulation advances
  useEffect(() => {
    if (state.currentSimTimePs > 0) {
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const plotWidth = containerWidth - gutterWidth;
      const visibleTimePs = plotWidth / pixelsPerPs;

      if (state.currentSimTimePs > timeOffsetPs + visibleTimePs) {
        setTimeOffsetPs(Math.max(0, state.currentSimTimePs - visibleTimePs * 0.8));
      }
    }
  }, [state.currentSimTimePs, pixelsPerPs, gutterWidth, timeOffsetPs]);

  // Handle Zoom In / Out
  const handleZoom = (factor: number) => {
    setPixelsPerPs((prev) => Math.max(0.001, Math.min(10, prev * factor)));
  };

  const handleZoomFit = () => {
    const containerWidth = containerRef.current?.clientWidth ?? 800;
    const plotWidth = Math.max(100, containerWidth - gutterWidth);
    const maxTime = Math.max(1000, state.currentSimTimePs);
    setPixelsPerPs(plotWidth / maxTime);
    setTimeOffsetPs(0);
  };

  // Main Canvas Render
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#0d0f12";
    ctx.fillRect(0, 0, width, height);

    // Plot area bounds
    const plotX = gutterWidth;
    const plotW = width - gutterWidth;

    // Time calculations
    const startTimePs = timeOffsetPs;
    const endTimePs = timeOffsetPs + plotW / pixelsPerPs;
    const timeSpanPs = endTimePs - startTimePs;

    // Calculate grid step (100ps, 500ps, 1ns, 2ns, 5ns, 10ns, etc.)
    const roughGridSteps = 10;
    const rawStepPs = timeSpanPs / roughGridSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStepPs)));
    let gridStepPs = magnitude;
    if (rawStepPs / magnitude > 5) gridStepPs = magnitude * 5;
    else if (rawStepPs / magnitude > 2) gridStepPs = magnitude * 2;
    gridStepPs = Math.max(10, gridStepPs);

    // Draw Timeline Header & Grid
    ctx.fillStyle = "#13171d";
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.strokeStyle = "#242c38";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(width, headerHeight);
    ctx.stroke();

    // Draw Grid Lines and Time Labels
    const firstGridPs = Math.ceil(startTimePs / gridStepPs) * gridStepPs;
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";

    for (let t = firstGridPs; t <= endTimePs; t += gridStepPs) {
      const x = plotX + (t - startTimePs) * pixelsPerPs;
      if (x < plotX || x > width) continue;

      // Header tick
      ctx.strokeStyle = "#364253";
      ctx.beginPath();
      ctx.moveTo(x, headerHeight - 6);
      ctx.lineTo(x, headerHeight);
      ctx.stroke();

      // Background grid vertical line
      ctx.strokeStyle = "rgba(36, 44, 56, 0.4)";
      ctx.beginPath();
      ctx.moveTo(x, headerHeight);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Label text
      const label = t >= 1_000_000 ? `${(t / 1_000_000).toFixed(1)}μs` : t >= 1000 ? `${(t / 1000).toFixed(1)}ns` : `${t}ps`;
      ctx.fillText(label, x, headerHeight - 10);
    }

    // Draw Current SimTime Vertical Marker
    const simTimeX = plotX + (state.currentSimTimePs - startTimePs) * pixelsPerPs;
    if (simTimeX >= plotX && simTimeX <= width) {
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(simTimeX, 0);
      ctx.lineTo(simTimeX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Cursor line if hovered
    if (cursorPs !== null) {
      const curX = plotX + (cursorPs - startTimePs) * pixelsPerPs;
      if (curX >= plotX && curX <= width) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(curX, 0);
        ctx.lineTo(curX, height);
        ctx.stroke();

        // Time tag at header
        ctx.fillStyle = "#f59e0b";
        const curLabel = cursorPs >= 1000 ? `${(cursorPs / 1000).toFixed(3)}ns` : `${cursorPs}ps`;
        ctx.fillText(curLabel, curX, headerHeight - 12);
      }
    }

    // Render Signals
    activeSignals.forEach((sig, index) => {
      const yTop = headerHeight + index * signalHeight;
      const yMid = yTop + signalHeight / 2;
      const yHigh = yTop + 6;
      const yLow = yTop + signalHeight - 6;

      // Row alternate background
      ctx.fillStyle = index % 2 === 0 ? "rgba(19, 23, 29, 0.5)" : "transparent";
      ctx.fillRect(plotX, yTop, plotW, signalHeight);

      // Row separator
      ctx.strokeStyle = "#1a1f26";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop + signalHeight);
      ctx.lineTo(width, yTop + signalHeight);
      ctx.stroke();

      // Collect intervals for this signal
      const samples = sig.samples;
      if (samples.length === 0) return;

      if (!sig.isBus) {
        // Single-bit binary signal (0, 1, X, Z)
        ctx.lineWidth = 1.5;
        let lastVal = samples[0].value;

        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const currX = plotX + (s.timePs - startTimePs) * pixelsPerPs;
          const nextTime = i < samples.length - 1 ? samples[i + 1].timePs : state.currentSimTimePs;
          const nextX = plotX + (nextTime - startTimePs) * pixelsPerPs;

          const isHigh = s.value === "1";
          const isX = s.value === "x" || s.value === "X";
          const isZ = s.value === "z" || s.value === "Z";

          ctx.strokeStyle = isHigh ? "#10b981" : isX ? "#f43f5e" : isZ ? "#f59e0b" : "#64748b";

          const currentY = isHigh ? yHigh : isZ ? yMid : isX ? yMid : yLow;

          // Transition line from last state
          if (i > 0) {
            const prevHigh = lastVal === "1";
            const prevY = prevHigh ? yHigh : yLow;
            ctx.beginPath();
            ctx.moveTo(Math.max(plotX, currX), prevY);
            ctx.lineTo(Math.max(plotX, currX), currentY);
            ctx.stroke();
          }

          // Horizontal level line
          const drawStartX = Math.max(plotX, currX);
          const drawEndX = Math.min(width, Math.max(drawStartX, nextX));
          if (drawEndX >= plotX && drawStartX <= width) {
            ctx.beginPath();
            ctx.moveTo(drawStartX, currentY);
            ctx.lineTo(drawEndX, currentY);
            ctx.stroke();
          }

          // Delta Glitch highlight indicator
          if (showDeltaGlitches && s.isGlitch) {
            ctx.fillStyle = "#ec4899";
            ctx.beginPath();
            ctx.arc(currX, currentY, 3.5, 0, 2 * Math.PI);
            ctx.fill();
          }

          lastVal = s.value;
        }
      } else {
        // Multi-bit Bus signal (Hex diamonds with text centered)
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const currX = plotX + (s.timePs - startTimePs) * pixelsPerPs;
          const nextTime = i < samples.length - 1 ? samples[i + 1].timePs : state.currentSimTimePs;
          const nextX = plotX + (nextTime - startTimePs) * pixelsPerPs;

          const startX = Math.max(plotX, currX);
          const endX = Math.min(width, nextX);
          const segWidth = endX - startX;

          if (endX < plotX || startX > width) continue;

          // Bus envelope diamond
          ctx.strokeStyle = "#38bdf8";
          ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
          ctx.lineWidth = 1.2;

          const bevel = Math.min(4, Math.max(1, segWidth / 4));

          ctx.beginPath();
          ctx.moveTo(startX + bevel, yHigh);
          ctx.lineTo(endX - bevel, yHigh);
          ctx.lineTo(endX, yMid);
          ctx.lineTo(endX - bevel, yLow);
          ctx.lineTo(startX + bevel, yLow);
          ctx.lineTo(startX, yMid);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Bus Value Text
          if (segWidth > 24) {
            ctx.font = "11px JetBrains Mono, monospace";
            ctx.fillStyle = "#e2e8f0";
            ctx.textAlign = "center";
            ctx.fillText(s.value, startX + segWidth / 2, yMid + 4);
          }
        }
      }
    });

    // Draw Left Gutter (Signal Names & Values at Cursor)
    ctx.fillStyle = "#13171d";
    ctx.fillRect(0, 0, gutterWidth, height);
    ctx.strokeStyle = "#242c38";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gutterWidth, 0);
    ctx.lineTo(gutterWidth, height);
    ctx.stroke();

    // Gutter Header
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("Signals / Nets", 12, headerHeight - 10);
    ctx.textAlign = "right";
    ctx.fillText("Value", gutterWidth - 12, headerHeight - 10);

    // Gutter Signal Rows
    activeSignals.forEach((sig, index) => {
      const yTop = headerHeight + index * signalHeight;
      const yMid = yTop + signalHeight / 2 + 4;

      // Row separator
      ctx.strokeStyle = "#1a1f26";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop + signalHeight);
      ctx.lineTo(gutterWidth, yTop + signalHeight);
      ctx.stroke();

      // Signal Name
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillStyle = sig.isBus ? "#38bdf8" : "#10b981";
      ctx.textAlign = "left";

      const maxChars = 14;
      const displayName = sig.name.length > maxChars ? sig.name.substring(0, maxChars - 2) + ".." : sig.name;
      ctx.fillText(displayName, 12, yMid);

      // Value at Cursor or Current Time
      const queryTime = cursorPs !== null ? cursorPs : state.currentSimTimePs;
      const sample = [...sig.samples].reverse().find((s) => s.timePs <= queryTime) ?? sig.samples[0];
      const valStr = sample?.value ?? "-";

      ctx.fillStyle = "#f1f5f9";
      ctx.textAlign = "right";
      ctx.fillText(valStr, gutterWidth - 12, yMid);
    });
  }, [state, activeSignals, timeOffsetPs, pixelsPerPs, cursorPs, showDeltaGlitches, gutterWidth, headerHeight, signalHeight]);

  // Handle Resize and Canvas Animation
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      renderCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Mouse Interactivity: Cursor Scrubbing & Panning
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartTimeOffset, setPanStartTimeOffset] = useState(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;

    if (x >= gutterWidth) {
      setIsPanning(true);
      setPanStartX(x);
      setPanStartTimeOffset(timeOffsetPs);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;

    if (x >= gutterWidth) {
      const calcPs = Math.max(0, Math.round(timeOffsetPs + (x - gutterWidth) / pixelsPerPs));
      setCursorPs(calcPs);

      if (isPanning) {
        const deltaX = x - panStartX;
        const deltaPs = deltaX / pixelsPerPs;
        setTimeOffsetPs(Math.max(0, panStartTimeOffset - deltaPs));
      }
    } else {
      setCursorPs(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-primary)",
        overflow: "hidden"
      }}
    >
      {/* Waveform Controls Bar */}
      <div
        style={{
          height: 32,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          zIndex: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Stratified Digital Waveforms ({activeSignals.length} nets)
          </span>

          <button
            onClick={() => setShowDeltaGlitches(!showDeltaGlitches)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: showDeltaGlitches ? "rgba(236, 72, 153, 0.15)" : "var(--bg-tertiary)",
              color: showDeltaGlitches ? "var(--signal-glitch)" : "var(--text-muted)",
              border: `1px solid ${showDeltaGlitches ? "var(--signal-glitch)" : "var(--border-subtle)"}`
            }}
            title="Highlight zero-time delta cycle glitches"
          >
            <Bug size={12} />
            <span>Delta Glitches</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => handleZoom(1.3)}
            title="Zoom In"
            style={{
              padding: 4,
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)"
            }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom(0.7)}
            title="Zoom Out"
            style={{
              padding: 4,
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)"
            }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleZoomFit}
            title="Fit to Simulation Extent"
            style={{
              padding: 4,
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)"
            }}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsPanning(false);
          setCursorPs(null);
        }}
        style={{ flex: 1, cursor: isPanning ? "grabbing" : "crosshair" }}
      />
    </div>
  );
};
