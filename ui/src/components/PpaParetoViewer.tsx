import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Cpu,
  Activity,
  Sliders,
  Download,
  Flame,
  Sparkles,
  DollarSign,
  Layers,
  Clock,
  Gauge,
  Zap
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  PpaReport,
  PpaMetrics,
  FpgaFitEvaluation,
  AsicForecast,
  ParetoPoint,
  STANDARD_FPGA_CATALOG,
  evaluateClientFallbackPpa
} from "../engine/ppaModel";

interface PpaParetoViewerProps {
  state?: SimulationState;
  activeDesignId: string;
  verilogSource?: string;
  xdcSource?: string;
  targetDevice?: string;
  onSelectDevice?: (deviceId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
}

export const PpaParetoViewer: React.FC<PpaParetoViewerProps> = ({
  state: _state,
  activeDesignId,
  verilogSource = "",
  xdcSource = "",
  targetDevice = "xc7a100tcsg324-1",
  onSelectDevice,
  onJumpToCode: _onJumpToCode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Configuration Scenario State
  const [selectedDevice, setSelectedDevice] = useState<string>(targetDevice);
  const [clockFreqMhz, setClockFreqMhz] = useState<number>(100);
  const [tempC, setTempC] = useState<number>(25);
  const [voltageV, setVoltageV] = useState<number>(1.0);
  const [switchingAlpha, setSwitchingAlpha] = useState<number>(0.125);
  const [pdkName, setPdkName] = useState<string>("sky130_fd_sc_hd");

  // Chart Metric Toggle
  const [yAxisMetric, setYAxisMetric] = useState<"power" | "energy" | "slack">("power");

  // Hovered Pareto Point
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);

  // PPA Evaluation Result
  const [report, setReport] = useState<PpaReport | null>(null);
  const [_isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [lastEvalDurationMs, setLastEvalDurationMs] = useState<number>(0);

  // Sync prop changes
  useEffect(() => {
    if (targetDevice && targetDevice !== selectedDevice) {
      setSelectedDevice(targetDevice);
    }
  }, [targetDevice]);

  // Run in-RAM PPA Evaluation
  const runEvaluation = useCallback(async () => {
    if (!verilogSource) return;
    setIsEvaluating(true);
    const t0 = performance.now();
    try {
      const res = await engineBridge.evaluatePpa({
        verilogSource,
        xdcSource,
        topModule: activeDesignId,
        targetDevice: selectedDevice,
        targetClockFreqMhz: clockFreqMhz,
        junctionTempC: tempC,
        coreVoltageV: voltageV,
        pdk: pdkName
      });

      setReport(res);
      setLastEvalDurationMs(Math.round((performance.now() - t0) * 10) / 10);
    } catch (err) {
      console.warn("[PpaViewer] Fast client fallback evaluation:", err);
      const fallback = evaluateClientFallbackPpa(verilogSource, {
        target_device: selectedDevice,
        target_clock_freq_mhz: clockFreqMhz,
        junction_temp_c: tempC,
        core_voltage_v: voltageV,
        pdk: pdkName
      });
      setReport(fallback);
      setLastEvalDurationMs(Math.round((performance.now() - t0) * 10) / 10);
    } finally {
      setIsEvaluating(false);
    }
  }, [verilogSource, xdcSource, activeDesignId, selectedDevice, clockFreqMhz, tempC, voltageV, switchingAlpha, pdkName]);

  // Initial and trigger evaluation on dependency change
  useEffect(() => {
    runEvaluation();
  }, [runEvaluation]);

  // Handle switching target silicon
  const handleDeviceSwitch = (devId: string) => {
    setSelectedDevice(devId);
    if (onSelectDevice) {
      onSelectDevice(devId);
    }
  };

  // CSV Report Exporter
  const handleExportCsv = () => {
    if (!report) return;
    const m = report.metrics;
    let csv = "Axiom EDA - Power-Performance-Area (PPA) Executive Report\n";
    csv += `Design: ${report.top_module}, Target Device: ${selectedDevice}, Date: ${new Date().toISOString()}\n\n`;
    csv += "Category,Metric,Value,Unit\n";
    csv += `Area,LUTs,${m.lut_count},Count\n`;
    csv += `Area,Flip-Flops,${m.ff_count},Count\n`;
    csv += `Area,BRAM 36K,${m.bram_36k_count},Count\n`;
    csv += `Area,DSP Slices,${m.dsp_slice_count},Count\n`;
    csv += `Area,Equivalent Logic Cells,${m.total_equivalent_logic_cells},Cells\n`;
    csv += `Area,ASIC Gate Count,${m.asic_gate_count},kGE\n`;
    csv += `Area,ASIC Core Area,${m.asic_core_area_um2},um2\n`;
    csv += `Area,ASIC Die Area,${m.asic_die_area_mm2},mm2\n`;
    csv += `Performance,Fmax,${m.fmax_mhz},MHz\n`;
    csv += `Performance,Critical Delay,${m.critical_path_delay_ps},ps\n`;
    csv += `Performance,Worst Negative Slack,${m.worst_negative_slack_ps},ps\n`;
    csv += `Performance,Logic Depth,${m.logic_depth},Levels\n`;
    csv += `Power,Dynamic Power,${m.dynamic_power_mw},mW\n`;
    csv += `Power,Static Leakage Power,${m.static_power_mw},mW\n`;
    csv += `Power,Total Power,${m.total_power_mw},mW\n`;
    csv += `Power,Energy per Cycle,${m.energy_per_cycle_pj},pJ/cycle\n`;
    csv += `Power,Junction Temperature,${m.junction_temperature_c},C\n`;
    csv += `Figure of Merit,FOM Score,${m.fom_score},Pts\n\n`;

    csv += "FPGA Device Fitting Analysis\n";
    csv += "Device ID,Family,Status,LUT Util (%),FF Util (%),BRAM Util (%),DSP Util (%),Bottleneck,Est Cost ($),Delta ($)\n";
    report.fpga_evaluations.forEach((fit) => {
      csv += `${fit.profile.id},${fit.profile.family},${fit.status},${fit.lut_utilization_pct}%,${fit.ff_utilization_pct}%,${fit.bram_utilization_pct}%,${fit.dsp_utilization_pct}%,${fit.bottleneck_resource},$${fit.estimated_cost_usd},${fit.cost_delta_vs_target}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Axiom_PPA_${report.top_module}_${selectedDevice}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Pareto Frontier 2D Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !report || !report.pareto_curve || report.pareto_curve.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, w, h);

    const margin = { top: 35, right: 40, bottom: 45, left: 65 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;

    if (chartW <= 0 || chartH <= 0) return;

    const points = report.pareto_curve;

    // Determine domain and ranges
    const minFreq = Math.min(...points.map((p) => p.freq_mhz));
    const maxFreq = Math.max(...points.map((p) => p.freq_mhz));

    let getYVal = (p: ParetoPoint) => p.power_mw;
    let yUnit = "mW";
    let yLabel = "Total Power (mW)";
    if (yAxisMetric === "energy") {
      getYVal = (p: ParetoPoint) => p.energy_pj;
      yUnit = "pJ";
      yLabel = "Energy per Cycle (pJ)";
    } else if (yAxisMetric === "slack") {
      getYVal = (p: ParetoPoint) => p.slack_ps;
      yUnit = "ps";
      yLabel = "Worst Slack (ps)";
    }

    const yVals = points.map(getYVal);
    let minY = Math.min(...yVals);
    let maxY = Math.max(...yVals);

    // Padding on Y
    if (minY === maxY) {
      minY = minY * 0.8;
      maxY = maxY * 1.2 || 1;
    } else {
      const pad = (maxY - minY) * 0.12;
      minY = Math.max(0, minY - pad);
      maxY = maxY + pad;
    }

    const scaleX = (freq: number) => margin.left + ((freq - minFreq) / (maxFreq - minFreq || 1)) * chartW;
    const scaleY = (y: number) => margin.top + chartH - ((y - minY) / (maxY - minY || 1)) * chartH;

    // Draw Subtle Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";

    // Horizontal grid
    const numYSteps = 5;
    for (let i = 0; i <= numYSteps; i++) {
      const yVal = minY + ((maxY - minY) * i) / numYSteps;
      const yPos = scaleY(yVal);
      ctx.beginPath();
      ctx.moveTo(margin.left, yPos);
      ctx.lineTo(w - margin.right, yPos);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(yVal.toFixed(1) + " " + yUnit, margin.left - 8, yPos);
    }

    // Vertical grid
    const numXSteps = 6;
    for (let i = 0; i <= numXSteps; i++) {
      const freqVal = minFreq + ((maxFreq - minFreq) * i) / numXSteps;
      const xPos = scaleX(freqVal);
      ctx.beginPath();
      ctx.moveTo(xPos, margin.top);
      ctx.lineTo(xPos, h - margin.bottom);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(Math.round(freqVal) + " MHz", xPos, h - margin.bottom + 8);
    }

    // Axis Titles
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Operating Frequency (MHz)", margin.left + chartW / 2, h - 12);

    ctx.save();
    ctx.translate(16, margin.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Shaded Area under curve
    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartH);
    if (yAxisMetric === "power") {
      gradient.addColorStop(0, "rgba(56, 189, 248, 0.25)");
      gradient.addColorStop(1, "rgba(56, 189, 248, 0.0)");
    } else if (yAxisMetric === "energy") {
      gradient.addColorStop(0, "rgba(168, 85, 247, 0.25)");
      gradient.addColorStop(1, "rgba(168, 85, 247, 0.0)");
    } else {
      gradient.addColorStop(0, "rgba(34, 197, 94, 0.25)");
      gradient.addColorStop(1, "rgba(34, 197, 94, 0.0)");
    }

    ctx.beginPath();
    ctx.moveTo(scaleX(points[0].freq_mhz), scaleY(getYVal(points[0])));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(scaleX(points[i].freq_mhz), scaleY(getYVal(points[i])));
    }
    ctx.lineTo(scaleX(points[points.length - 1].freq_mhz), margin.top + chartH);
    ctx.lineTo(scaleX(points[0].freq_mhz), margin.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Smooth Line
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = yAxisMetric === "power" ? "#38bdf8" : yAxisMetric === "energy" ? "#c084fc" : "#4ade80";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.moveTo(scaleX(points[0].freq_mhz), scaleY(getYVal(points[0])));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(scaleX(points[i].freq_mhz), scaleY(getYVal(points[i])));
    }
    ctx.stroke();

    // Draw Pareto Frontier Points
    points.forEach((pt, idx) => {
      const px = scaleX(pt.freq_mhz);
      const py = scaleY(getYVal(pt));
      const isHovered = hoveredPointIndex === idx;

      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 6.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? "#ffffff" : yAxisMetric === "power" ? "#38bdf8" : "#c084fc";
      ctx.fill();
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.strokeStyle = "#0c1017";
      ctx.stroke();

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw Operating Point indicator
    const currentPointX = scaleX(clockFreqMhz);
    if (currentPointX >= margin.left && currentPointX <= w - margin.right) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.moveTo(currentPointX, margin.top);
      ctx.lineTo(currentPointX, h - margin.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Operating Badge
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Target ${clockFreqMhz} MHz`, currentPointX, margin.top - 10);
    }
  }, [report, yAxisMetric, hoveredPointIndex, clockFreqMhz]);

  // Handle Mouse movement over Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !report || !report.pareto_curve || report.pareto_curve.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setMouseCanvasPos({ x: mouseX, y: mouseY });

    const margin = { top: 35, right: 40, bottom: 45, left: 65 };
    const chartW = rect.width - margin.left - margin.right;
    const points = report.pareto_curve;
    const minFreq = Math.min(...points.map((p) => p.freq_mhz));
    const maxFreq = Math.max(...points.map((p) => p.freq_mhz));

    const scaleX = (freq: number) => margin.left + ((freq - minFreq) / (maxFreq - minFreq || 1)) * chartW;

    let closestIdx: number | null = null;
    let minDistance = 24;

    points.forEach((pt, idx) => {
      const px = scaleX(pt.freq_mhz);
      const dist = Math.abs(px - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoveredPointIndex(closestIdx);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPointIndex(null);
    setMouseCanvasPos(null);
  };

  // Click on point to set operating frequency
  const handleCanvasClick = () => {
    if (hoveredPointIndex !== null && report && report.pareto_curve[hoveredPointIndex]) {
      setClockFreqMhz(report.pareto_curve[hoveredPointIndex].freq_mhz);
    }
  };

  const metrics: PpaMetrics | null = report?.metrics ?? null;
  const currentFpgaFit: FpgaFitEvaluation | undefined = report?.fpga_evaluations.find((e) => e.is_current_target);
  const asicForecast: AsicForecast | undefined = report?.asic_forecast;

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#090d14",
        color: "#f1f5f9",
        overflowY: "auto",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Top Header & Scenario Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "12px 20px",
          background: "#0c1017",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
              boxShadow: "0 0 12px rgba(14, 165, 233, 0.3)"
            }}
          >
            <Gauge size={18} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                PPA Pareto Frontier & Cost Advisor
              </span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  fontWeight: 600
                }}
              >
                In-RAM Engine
              </span>
              {lastEvalDurationMs > 0 && (
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {lastEvalDurationMs}ms
                </span>
              )}
            </div>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Multi-objective optimization & capacity advisor for {report?.top_module || activeDesignId}
            </span>
          </div>
        </div>

        {/* Toolbar Quick Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Target FPGA Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Device:</span>
            <select
              value={selectedDevice}
              onChange={(e) => handleDeviceSwitch(e.target.value)}
              style={{
                background: "#161d29",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "6px",
                padding: "5px 10px",
                fontSize: "12px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              {STANDARD_FPGA_CATALOG.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name} ({dev.family}) — ${dev.reference_cost_usd}
                </option>
              ))}
            </select>
          </div>

          {/* PDK Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>ASIC:</span>
            <select
              value={pdkName}
              onChange={(e) => setPdkName(e.target.value)}
              style={{
                background: "#161d29",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "6px",
                padding: "5px 10px",
                fontSize: "12px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="sky130_fd_sc_hd">SkyWater 130nm</option>
              <option value="ihp_sg13g2">IHP SG13G2 (0.13µm)</option>
            </select>
          </div>

          {/* Export Report */}
          <button
            onClick={handleExportCsv}
            title="Export full PPA executive report as CSV"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s"
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* KPI Executive Summary Grid (3 Cards + FOM Badge) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "14px"
          }}
        >
          {/* Card 1: Performance */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={16} color="#38bdf8" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
                  Timing & Performance
                </span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: (metrics?.worst_negative_slack_ps ?? 0) >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: (metrics?.worst_negative_slack_ps ?? 0) >= 0 ? "#4ade80" : "#f87171",
                  fontWeight: 600
                }}
              >
                {(metrics?.worst_negative_slack_ps ?? 0) >= 0 ? "Timing MET" : "VIOLATION"}
              </span>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                {metrics ? `${metrics.fmax_mhz.toFixed(1)}` : "—"}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#94a3b8", marginLeft: "4px" }}>
                  MHz (Fmax)
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Target: {clockFreqMhz} MHz (Tclk = {metrics ? (metrics.clock_period_ps / 1000).toFixed(2) : "—"} ns)
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                fontSize: "12px"
              }}
            >
              <div>
                <span style={{ color: "#64748b" }}>Worst Slack: </span>
                <span style={{ fontWeight: 600, color: (metrics?.worst_negative_slack_ps ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>
                  {metrics ? `${metrics.worst_negative_slack_ps.toFixed(0)} ps` : "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Critical Path: </span>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
                  {metrics ? `${(metrics.critical_path_delay_ps / 1000).toFixed(2)} ns` : "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Logic Depth: </span>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
                  {metrics?.logic_depth ?? 1} levels
                </span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Latency: </span>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
                  {metrics?.latency_cycles ?? 1} cycle
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Power */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} color="#f59e0b" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
                  Power & Thermal
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#f59e0b" }}>
                <Flame size={13} />
                <span>Tj = {metrics?.junction_temperature_c.toFixed(1) ?? tempC}°C</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                {metrics ? `${metrics.total_power_mw.toFixed(2)}` : "—"}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#94a3b8", marginLeft: "4px" }}>
                  mW
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Energy: {metrics ? `${metrics.energy_per_cycle_pj.toFixed(2)} pJ/cycle` : "—"}
              </div>
            </div>
            {/* Power Split Bar */}
            {metrics && (
              <div>
                <div
                  style={{
                    display: "flex",
                    height: "6px",
                    borderRadius: "3px",
                    overflow: "hidden",
                    background: "#1e293b",
                    marginBottom: "6px"
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (metrics.dynamic_power_mw / (metrics.total_power_mw || 1)) * 100)}%`,
                      background: "#38bdf8"
                    }}
                    title={`Dynamic Power: ${metrics.dynamic_power_mw.toFixed(2)} mW`}
                  />
                  <div
                    style={{
                      width: `${Math.min(100, (metrics.static_power_mw / (metrics.total_power_mw || 1)) * 100)}%`,
                      background: "#f43f5e"
                    }}
                    title={`Static Leakage: ${metrics.static_power_mw.toFixed(2)} mW`}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "#94a3b8"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#38bdf8" }} />
                    Dynamic: {metrics.dynamic_power_mw.toFixed(2)} mW
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f43f5e" }} />
                    Static: {metrics.static_power_mw.toFixed(2)} mW
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Area & Resources */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Cpu size={16} color="#a855f7" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
                  Silicon Area & Resources
                </span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "rgba(168, 85, 247, 0.15)",
                  color: "#c084fc",
                  fontWeight: 600
                }}
              >
                {metrics?.total_equivalent_logic_cells ?? 0} Eq Cells
              </span>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                {metrics?.lut_count ?? 0}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#94a3b8", marginLeft: "4px" }}>
                  LUTs
                </span>
                <span style={{ fontSize: "20px", fontWeight: 700, color: "#64748b", margin: "0 8px" }}>/</span>
                {metrics?.ff_count ?? 0}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#94a3b8", marginLeft: "4px" }}>
                  FFs
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                BRAMs: {metrics?.bram_36k_count ?? 0} | DSP: {metrics?.dsp_slice_count ?? 0}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                fontSize: "12px"
              }}
            >
              <div>
                <span style={{ color: "#64748b" }}>ASIC Gates: </span>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
                  {metrics ? `${metrics.asic_gate_count.toFixed(1)} kGE` : "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Die Area: </span>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
                  {metrics ? `${metrics.asic_die_area_mm2.toFixed(3)} mm²` : "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>FOM Score: </span>
                <span style={{ fontWeight: 700, color: "#38bdf8" }}>
                  {metrics?.fom_score.toFixed(1) ?? "—"} pts
                </span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>FPGA Fit: </span>
                <span style={{ fontWeight: 600, color: currentFpgaFit?.status === "Fits" ? "#4ade80" : "#f87171" }}>
                  {currentFpgaFit?.status ?? "Fits"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Interactive Pareto Frontier Curve + Scenario Sliders */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "16px",
            minHeight: "360px"
          }}
        >
          {/* 2D Pareto Canvas Chart */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={16} color="#38bdf8" />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  Live Pareto Frontier Curve
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  (Click point to set target freq)
                </span>
              </div>

              {/* Metric Switcher */}
              <div
                style={{
                  display: "flex",
                  background: "#1e293b",
                  padding: "2px",
                  borderRadius: "6px"
                }}
              >
                <button
                  onClick={() => setYAxisMetric("power")}
                  style={{
                    padding: "4px 10px",
                    background: yAxisMetric === "power" ? "#0ea5e9" : "transparent",
                    color: yAxisMetric === "power" ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Power (mW)
                </button>
                <button
                  onClick={() => setYAxisMetric("energy")}
                  style={{
                    padding: "4px 10px",
                    background: yAxisMetric === "energy" ? "#a855f7" : "transparent",
                    color: yAxisMetric === "energy" ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Energy (pJ)
                </button>
                <button
                  onClick={() => setYAxisMetric("slack")}
                  style={{
                    padding: "4px 10px",
                    background: yAxisMetric === "slack" ? "#22c55e" : "transparent",
                    color: yAxisMetric === "slack" ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Slack (ps)
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div style={{ flex: 1, position: "relative", minHeight: "260px" }}>
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={handleCanvasMouseLeave}
                onClick={handleCanvasClick}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  cursor: hoveredPointIndex !== null ? "pointer" : "default"
                }}
              />

              {/* Live Point Hover Tooltip */}
              {hoveredPointIndex !== null && report && report.pareto_curve[hoveredPointIndex] && mouseCanvasPos && (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(mouseCanvasPos.x + 16, (canvasRef.current?.clientWidth || 400) - 180)}px`,
                    top: `${Math.max(10, mouseCanvasPos.y - 60)}px`,
                    background: "rgba(15, 23, 42, 0.95)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "#f8fafc",
                    pointerEvents: "none",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    zIndex: 10
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "4px" }}>
                    {report.pareto_curve[hoveredPointIndex].freq_mhz} MHz
                  </div>
                  <div style={{ color: "#cbd5e1" }}>
                    Power: {report.pareto_curve[hoveredPointIndex].power_mw.toFixed(2)} mW
                  </div>
                  <div style={{ color: "#cbd5e1" }}>
                    Energy: {report.pareto_curve[hoveredPointIndex].energy_pj.toFixed(2)} pJ
                  </div>
                  <div style={{ color: report.pareto_curve[hoveredPointIndex].slack_ps >= 0 ? "#4ade80" : "#f87171" }}>
                    Slack: {report.pareto_curve[hoveredPointIndex].slack_ps.toFixed(0)} ps
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scenario Sensitivity & "What-If" Sliders */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sliders size={16} color="#f59e0b" />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                What-If Sensitivity Tuning
              </span>
            </div>

            {/* Slider 1: Target Frequency */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "#94a3b8" }}>Target Clock Frequency:</span>
                <span style={{ fontWeight: 700, color: "#38bdf8" }}>{clockFreqMhz} MHz</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={clockFreqMhz}
                onChange={(e) => setClockFreqMhz(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer" }}
              />
            </div>

            {/* Slider 2: Junction Temperature */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "#94a3b8" }}>Junction Temp (Tj):</span>
                <span style={{ fontWeight: 700, color: tempC > 85 ? "#f87171" : "#e2e8f0" }}>
                  {tempC} °C {tempC > 85 ? "(Thermal Stress)" : ""}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="125"
                step="5"
                value={tempC}
                onChange={(e) => setTempC(Number(e.target.value))}
                style={{ width: "100%", accentColor: tempC > 85 ? "#f87171" : "#f59e0b", cursor: "pointer" }}
              />
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                Exponential leakage power scaling active
              </div>
            </div>

            {/* Slider 3: Core Voltage */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "#94a3b8" }}>Core Voltage (Vdd):</span>
                <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{voltageV.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.20"
                step="0.05"
                value={voltageV}
                onChange={(e) => setVoltageV(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#a855f7", cursor: "pointer" }}
              />
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                Dynamic power scales with Vdd²
              </div>
            </div>

            {/* Slider 4: Switching Activity Factor */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "#94a3b8" }}>Switching Activity (α):</span>
                <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{(switchingAlpha * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.025"
                value={switchingAlpha}
                onChange={(e) => setSwitchingAlpha(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#22c55e", cursor: "pointer" }}
              />
            </div>

            {/* Preset Quick Buttons */}
            <div style={{ display: "flex", gap: "6px", marginTop: "auto" }}>
              <button
                onClick={() => {
                  setClockFreqMhz(100);
                  setTempC(25);
                  setVoltageV(1.0);
                  setSwitchingAlpha(0.125);
                }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  background: "#1e293b",
                  color: "#cbd5e1",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Nominal (25°C)
              </button>
              <button
                onClick={() => {
                  setClockFreqMhz(250);
                  setTempC(85);
                  setVoltageV(1.1);
                  setSwitchingAlpha(0.25);
                }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  background: "#1e293b",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Worst Case (85°C)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Split: Multi-Target FPGA Fitting Table & ASIC Silicon Forecaster */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: "16px"
          }}
        >
          {/* Multi-Target FPGA Comparison Table */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={16} color="#38bdf8" />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  Multi-Target FPGA Fitting & Capacity Advisor
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                6 Device Comparison
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Device</th>
                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Family</th>
                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                    <th style={{ textAlign: "right", padding: "8px 6px" }}>LUT Util</th>
                    <th style={{ textAlign: "right", padding: "8px 6px" }}>FF Util</th>
                    <th style={{ textAlign: "right", padding: "8px 6px" }}>BRAM</th>
                    <th style={{ textAlign: "right", padding: "8px 6px" }}>Cost ($)</th>
                    <th style={{ textAlign: "right", padding: "8px 6px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.fpga_evaluations.map((fit) => {
                    const isTarget = fit.is_current_target;
                    const isRec = fit.is_recommended;
                    return (
                      <tr
                        key={fit.profile.id}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          background: isTarget ? "rgba(56, 189, 248, 0.08)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "8px 6px", fontWeight: 600, color: "#f8fafc" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {isRec && (
                              <span title="Recommended optimal silicon">
                                <Sparkles size={13} color="#f59e0b" />
                              </span>
                            )}
                            <span>{fit.profile.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px 6px", color: "#94a3b8" }}>{fit.profile.family}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: fit.status === "Fits" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: fit.status === "Fits" ? "#4ade80" : "#f87171"
                            }}
                          >
                            {fit.status === "Fits" ? "FITS" : "OVERFLOW"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "8px 6px",
                            textAlign: "right",
                            fontWeight: 600,
                            color: fit.lut_utilization_pct > 100 ? "#f87171" : fit.lut_utilization_pct > 80 ? "#f59e0b" : "#e2e8f0"
                          }}
                        >
                          {fit.lut_utilization_pct.toFixed(1)}%
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: "#cbd5e1" }}>
                          {fit.ff_utilization_pct.toFixed(1)}%
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: "#cbd5e1" }}>
                          {fit.bram_utilization_pct.toFixed(1)}%
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: "#f8fafc" }}>
                          ${fit.estimated_cost_usd}
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>
                          {isTarget ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8" }}>Active</span>
                          ) : (
                            <button
                              onClick={() => handleDeviceSwitch(fit.profile.id)}
                              style={{
                                padding: "3px 8px",
                                background: "#1e293b",
                                color: "#cbd5e1",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "4px",
                                fontSize: "11px",
                                cursor: "pointer"
                              }}
                            >
                              Select
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ASIC Silicon Forecaster & GDSII Cost Estimator */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <DollarSign size={16} color="#22c55e" />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  ASIC GDSII Silicon Forecaster
                </span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  fontWeight: 600
                }}
              >
                {asicForecast?.pdk_name ?? pdkName}
              </span>
            </div>

            {asicForecast ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                {/* Silicon Die Visual Representation */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px",
                    background: "#0c1017",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "8px"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Calculated Die Size</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#f8fafc" }}>
                      {asicForecast.die_width_mm.toFixed(2)} × {asicForecast.die_height_mm.toFixed(2)} mm
                    </div>
                    <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "2px" }}>
                      Die Area: {asicForecast.die_area_mm2.toFixed(3)} mm²
                    </div>
                  </div>
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      background: "linear-gradient(135deg, #1e293b, #0f172a)",
                      border: "2px dashed #22c55e",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "#4ade80",
                      fontWeight: 700
                    }}
                  >
                    CHIP
                  </div>
                </div>

                {/* Gate & Core Details */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    padding: "8px 0"
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b" }}>ASIC Standard Cells:</span>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                      {asicForecast.gate_count.toLocaleString()} gates
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Core Area:</span>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                      {(asicForecast.core_area_um2 / 1000).toFixed(1)} kµm²
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Pad Ring IOs:</span>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                      {asicForecast.pad_ring_io_count} pads
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Process Node:</span>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                      {asicForecast.technology_node_nm} nm
                    </div>
                  </div>
                </div>

                {/* Foundry Tapeout Cost Breakdown */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8" }}>MPW Shuttle Prototype Run:</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#4ade80" }}>
                      ${asicForecast.estimated_mpw_shuttle_cost_usd.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8" }}>Full Production Mask Set:</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1" }}>
                      ${asicForecast.estimated_mask_set_cost_usd.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginTop: "4px" }}>
                  * Shuttles via Efabless / Tiny Tapeout / IHP Open MPW initiative
                </div>
              </div>
            ) : (
              <div style={{ color: "#64748b", fontSize: "12px", textAlign: "center", padding: "20px" }}>
                Running ASIC synthesis forecasting...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
