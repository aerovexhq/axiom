import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Box,
  Cpu,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Sliders,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Save,
  Trash2
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import {
  FpgaPackageDef,
  PackagePinDef,
  PortAssignment,
  SiliconDieModel,
  getPackageForDevice,
  createSiliconDieModel,
  extractTopPortsFromVerilog,
  parseXdcPortConstraints,
  serializePortAssignmentsToXdc,
  VIVADO_BANK_PALETTES
} from "../engine/packageModel";
import { useTranslation } from "../i18n";
import { toast } from "../engine/toast";

interface PackageVisualizerProps {
  project: AxiomProject | null;
  verilogSource?: string;
  xdcSource?: string;
  activeDesignId?: string;
  onUpdateXdc?: (newXdcContent: string) => void;
  onNavigateToLine?: (line: number) => void;
}

export const PackageVisualizer: React.FC<PackageVisualizerProps> = ({
  project,
  verilogSource = "",
  xdcSource = "",
  activeDesignId: _activeDesignId,
  onUpdateXdc
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // View state: Package BGA vs Silicon Die
  const [viewMode, setViewMode] = useState<"package" | "device">("package");

  // Selected target device package
  const targetDevice = project?.targetDevice || "xc7a35tcpg236-1";
  const pkgDef: FpgaPackageDef = useMemo(() => {
    return getPackageForDevice(targetDevice);
  }, [targetDevice]);

  const dieModel: SiliconDieModel = useMemo(() => {
    return createSiliconDieModel();
  }, []);

  // Pan & Zoom
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection & Hover
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [hoveredPin, setHoveredPin] = useState<PackagePinDef | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedPortName, setSelectedPortName] = useState<string | null>(null);

  // Table filter
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [isPortsTreeExpanded, setIsPortsTreeExpanded] = useState<boolean>(true);

  // Port assignments model
  const [portAssignments, setPortAssignments] = useState<PortAssignment[]>([]);

  // Parse top-level ports and existing XDC constraints
  useEffect(() => {
    const topModuleName = project?.topModule || "logic_circuit";
    const ports = extractTopPortsFromVerilog(verilogSource, topModuleName);
    const xdcConstraints = parseXdcPortConstraints(xdcSource);

    // If no ports extracted from empty verilog, provide standard default pins (A, B, C -> F)
    const effectivePorts = ports.length > 0
      ? ports
      : [
          { name: "A", direction: "IN" as const, width: 1 },
          { name: "B", direction: "IN" as const, width: 1 },
          { name: "C", direction: "IN" as const, width: 1 },
          { name: "F", direction: "OUT" as const, width: 1 }
        ];

    // Map ports to assignments
    const assignments: PortAssignment[] = effectivePorts.map((p) => {
      const c = xdcConstraints[p.name] || {};
      const assignedPin = c.packagePin || (p.name === "A" ? "V17" : p.name === "B" ? "V16" : p.name === "C" ? "W16" : p.name === "F" ? "U16" : p.name === "clk" ? "W5" : "");
      const pinObj = pkgDef.pins[assignedPin];
      const bank = pinObj ? String(pinObj.bank) : "14";

      return {
        name: p.name,
        direction: p.direction,
        isBus: p.width > 1,
        packagePin: assignedPin,
        fixed: c.fixed ?? true,
        bank,
        ioStandard: c.ioStandard || "LVCMOS33",
        vcco: "3.3V",
        vref: "--",
        driveStrength: c.driveStrength || "12mA",
        slewType: c.slewType || "SLOW",
        pullType: "NONE",
        negDiffPair: "--"
      };
    });

    setPortAssignments(assignments);
  }, [verilogSource, xdcSource, project?.topModule, pkgDef]);

  // Lookup assigned port by pin name
  const pinToPortMap = useMemo(() => {
    const map = new Map<string, PortAssignment>();
    for (const a of portAssignments) {
      if (a.packagePin) {
        map.set(a.packagePin, a);
      }
    }
    return map;
  }, [portAssignments]);

  // Auto-fit canvas on initial render or device change
  const handleResetView = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    setZoom(1.0);
    setPan({ x: cw / 2 - 270, y: ch / 2 - 270 });
  }, []);

  useEffect(() => {
    handleResetView();
  }, [handleResetView, targetDevice]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Substrate background
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, width, height);

    // Apply pan & zoom
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    if (viewMode === "package") {
      renderPackageBga(ctx, pkgDef, pinToPortMap, selectedPin, hoveredPin);
    } else {
      renderSiliconDie(ctx, dieModel, hoveredPin);
    }

    ctx.restore();
    ctx.restore();
  }, [pan, zoom, viewMode, pkgDef, dieModel, pinToPortMap, selectedPin, hoveredPin]);

  // Renders the 2D BGA Ball Grid Map matching AMD Vivado
  const renderPackageBga = (
    ctx: CanvasRenderingContext2D,
    pkg: FpgaPackageDef,
    portMap: Map<string, PortAssignment>,
    selPin: string | null,
    hovPin: PackagePinDef | null
  ) => {
    const cellSize = 26;
    const ballRadius = 9;
    const gridCols = pkg.gridCols;
    const gridRows = pkg.gridRows;
    const startX = 60;
    const startY = 60;
    const gridW = gridCols.length * cellSize;
    const gridH = gridRows.length * cellSize;

    // Substrate PCB chip package body
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(startX - 15, startY - 15, gridW + 30, gridH + 30, 8);
    ctx.fill();
    ctx.stroke();

    // Pin A1 Chamfer Notch (Top-Left corner marker)
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(startX - 15, startY - 15);
    ctx.lineTo(startX - 15 + 18, startY - 15);
    ctx.lineTo(startX - 15, startY - 15 + 18);
    ctx.closePath();
    ctx.fill();

    // Draw Column Headers across the top (1..19)
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#94a3b8";

    for (let c = 0; c < gridCols.length; c++) {
      const x = startX + c * cellSize + cellSize / 2;
      ctx.fillText(String(gridCols[c]), x, startY - 26);

      // Subtle column guide track
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + gridH);
      ctx.stroke();
    }

    // Draw Row Headers down the left (A..W)
    for (let r = 0; r < gridRows.length; r++) {
      const y = startY + r * cellSize + cellSize / 2;
      ctx.fillText(gridRows[r], startX - 26, y);

      // Subtle row guide track
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + gridW, y);
      ctx.stroke();
    }

    // Draw BGA Balls
    for (let r = 0; r < gridRows.length; r++) {
      const row = gridRows[r];
      for (let c = 0; c < gridCols.length; c++) {
        const col = gridCols[c];
        const pinName = `${row}${col}`;
        const pinDef = pkg.pins[pinName];
        if (!pinDef) continue;

        const cx = startX + c * cellSize + cellSize / 2;
        const cy = startY + r * cellSize + cellSize / 2;

        const isSelected = selPin === pinName;
        const isHovered = hovPin?.pin === pinName;
        const assignedPort = portMap.get(pinName);

        const bankInfo = pkg.banks[String(pinDef.bank)] || pkg.banks["GND"];
        const ballColor = bankInfo?.color || "rgba(71, 85, 105, 0.4)";
        const borderColor = bankInfo?.borderColor || "#475569";

        // Selection / Hover Glow Ring
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(56, 189, 248, 0.5)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ballRadius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Assigned Port Highlight Aura
        if (assignedPort) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
          ctx.beginPath();
          ctx.arc(cx, cy, ballRadius + 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Main BGA Ball Body
        ctx.fillStyle = ballColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner Glyph / Symbol (+, -, C, S, •)
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isSelected ? "#fff" : assignedPort ? "#10b981" : borderColor;
        ctx.fillText(pinDef.symbol, cx, cy);

        // Assigned Port Name Tag underneath ball
        if (assignedPort) {
          ctx.font = "bold 8px sans-serif";
          ctx.fillStyle = "#38bdf8";
          ctx.fillText(assignedPort.name, cx, cy + ballRadius + 7);
        }
      }
    }
  };

  // Renders the Silicon Die Floorplan with CLB array, BRAMs, and DSPs
  const renderSiliconDie = (
    ctx: CanvasRenderingContext2D,
    die: SiliconDieModel,
    _hovPin: PackagePinDef | null
  ) => {
    // Silicon substrate
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(30, 20, die.width, die.height, 6);
    ctx.fill();
    ctx.stroke();

    // Render Tiles
    for (const tile of die.tiles) {
      ctx.fillStyle = tile.color;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 0.8;
      ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
      ctx.strokeRect(tile.x, tile.y, tile.width, tile.height);

      if (tile.type === "BRAM" || tile.type === "DSP" || tile.type === "CMT" || tile.type === "IOB") {
        ctx.font = "bold 7px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tile.label, tile.x + tile.width / 2, tile.y + tile.height / 2);
      }
    }
  };

  // Mouse Interaction: Coordinate mapping to BGA Pin
  const getPinAtCoords = (mx: number, my: number): PackagePinDef | null => {
    const cellSize = 26;
    const startX = 60;
    const startY = 60;

    // Convert screen coordinates to world coordinates
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;

    const colIdx = Math.floor((wx - startX) / cellSize);
    const rowIdx = Math.floor((wy - startY) / cellSize);

    if (rowIdx >= 0 && rowIdx < pkgDef.gridRows.length && colIdx >= 0 && colIdx < pkgDef.gridCols.length) {
      const pinName = `${pkgDef.gridRows[rowIdx]}${pkgDef.gridCols[colIdx]}`;
      return pkgDef.pins[pinName] || null;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pin = getPinAtCoords(mx, my);
    if (pin) {
      setSelectedPin(pin.pin);
      // If a port was selected in the table, assign this pin to that port!
      if (selectedPortName) {
        assignPinToPort(selectedPortName, pin.pin);
      }
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else {
      const pin = getPinAtCoords(mx, my);
      setHoveredPin(pin);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(3.5, Math.max(0.4, zoom * zoomFactor));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setPan({
      x: mx - (mx - pan.x) * (newZoom / zoom),
      y: my - (my - pan.y) * (newZoom / zoom)
    });
    setZoom(newZoom);
  };

  // Assigns a package pin to a port
  const assignPinToPort = (portName: string, pinName: string) => {
    setPortAssignments((prev) =>
      prev.map((p) => {
        if (p.name === portName) {
          const pinObj = pkgDef.pins[pinName];
          return {
            ...p,
            packagePin: pinName,
            bank: pinObj ? String(pinObj.bank) : p.bank,
            fixed: true
          };
        }
        return p;
      })
    );
    toast.success(`Assigned pin ${pinName} to port "${portName}"`);
  };

  // Auto-Assigns standard pins for known signals
  const handleAutoAssign = () => {
    setPortAssignments((prev) =>
      prev.map((p) => {
        let pin = p.packagePin;
        if (p.name === "A") pin = "V17";
        else if (p.name === "B") pin = "V16";
        else if (p.name === "C") pin = "W16";
        else if (p.name === "F") pin = "U16";
        else if (p.name.toLowerCase().includes("clk")) pin = "W5";
        else if (p.name.toLowerCase().includes("rst")) pin = "U18";

        const pinObj = pkgDef.pins[pin];
        return {
          ...p,
          packagePin: pin,
          bank: pinObj ? String(pinObj.bank) : p.bank,
          fixed: true
        };
      })
    );
    toast.success("Auto-assigned default physical package pins");
  };

  // Serializes port assignments and commits back to XDC
  const handleSaveToXdc = () => {
    if (onUpdateXdc) {
      const updatedXdc = serializePortAssignmentsToXdc(portAssignments, xdcSource);
      onUpdateXdc(updatedXdc);
      toast.success("Saved I/O pin assignments to constraints XDC");
    }
  };

  const handleClearAll = () => {
    setPortAssignments((prev) =>
      prev.map((p) => ({
        ...p,
        packagePin: "",
        fixed: false
      }))
    );
    toast.info("Cleared all pin assignments");
  };

  // Filtered port list
  const filteredPorts = useMemo(() => {
    if (!filterQuery) return portAssignments;
    const q = filterQuery.toLowerCase();
    return portAssignments.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.packagePin.toLowerCase().includes(q) ||
        p.bank.toLowerCase().includes(q)
    );
  }, [portAssignments, filterQuery]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-primary)",
        overflow: "hidden",
        position: "relative"
      }}
    >
      {/* Top Header Ribbon */}
      <div
        style={{
          minHeight: 36,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          gap: 12,
          whiteSpace: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "none",
          flexShrink: 0,
          zIndex: 5
        }}
      >
        {/* Left: View Mode Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Box size={14} color="var(--accent-cyan)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {t.package.title}
            </span>
          </div>

          <div style={{ display: "flex", gap: 2, backgroundColor: "var(--bg-tertiary)", padding: 2, borderRadius: 4, border: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            <button
              onClick={() => setViewMode("package")}
              className="btn btn-ghost"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 8px",
                height: "auto",
                minHeight: 22,
                borderRadius: 3,
                backgroundColor: viewMode === "package" ? "var(--accent-blue)" : "transparent",
                color: viewMode === "package" ? "#fff" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap"
              }}
            >
              <Box size={11} />
              <span>{t.package.packageView}</span>
            </button>

            <button
              onClick={() => setViewMode("device")}
              className="btn btn-ghost"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 8px",
                height: "auto",
                minHeight: 22,
                borderRadius: 3,
                backgroundColor: viewMode === "device" ? "var(--accent-blue)" : "transparent",
                color: viewMode === "device" ? "#fff" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap"
              }}
            >
              <Cpu size={11} />
              <span>{t.package.deviceView}</span>
            </button>
          </div>

          <div
            style={{
              fontSize: 10,
              color: "var(--accent-cyan)",
              padding: "2px 6px",
              borderRadius: 3,
              backgroundColor: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              whiteSpace: "nowrap"
            }}
          >
            {pkgDef.partName}
          </div>
        </div>

        {/* Right: Bank Swatches & Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Bank Legend Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f97316" }} />
              <span style={{ color: "var(--text-muted)" }}>Bank 0</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#84cc16" }} />
              <span style={{ color: "var(--text-muted)" }}>Bank 14</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#d946ef" }} />
              <span style={{ color: "var(--text-muted)" }}>Bank 15</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#06b6d4" }} />
              <span style={{ color: "var(--text-muted)" }}>Bank 34</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#3b82f6" }} />
              <span style={{ color: "var(--text-muted)" }}>Bank 35</span>
            </div>
          </div>

          {/* Zoom Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
              className="btn btn-ghost"
              style={{ padding: "2px 6px", height: 22, minHeight: 22, borderRadius: 3 }}
              title={t.package.zoomIn}
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z * 0.8))}
              className="btn btn-ghost"
              style={{ padding: "2px 6px", height: 22, minHeight: 22, borderRadius: 3 }}
              title={t.package.zoomOut}
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={handleResetView}
              className="btn btn-ghost"
              style={{ padding: "2px 6px", height: 22, minHeight: 22, borderRadius: 3 }}
              title={t.package.resetView}
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive 2D BGA / Silicon Die Canvas Area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 240 }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{ width: "100%", height: "100%", display: "block", cursor: isDragging ? "grabbing" : "grab" }}
        />

        {/* Live Hover Inspection Tooltip */}
        {hoveredPin && (
          <div
            style={{
              position: "fixed",
              left: Math.min(window.innerWidth - 250, mousePos.x + 14),
              top: Math.min(window.innerHeight - 150, mousePos.y + 14),
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid var(--border-medium)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 11,
              zIndex: 100,
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              pointerEvents: "none",
              whiteSpace: "nowrap"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>Pin {hoveredPin.pin}</span>
              <span
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  borderRadius: 3,
                  backgroundColor: VIVADO_BANK_PALETTES[String(hoveredPin.bank)]?.color || "rgba(255,255,255,0.1)",
                  color: VIVADO_BANK_PALETTES[String(hoveredPin.bank)]?.borderColor || "#fff",
                  fontWeight: 600
                }}
              >
                Bank {hoveredPin.bank}
              </span>
            </div>

            <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>
              <div>Type: <span style={{ color: "#fff" }}>{hoveredPin.pinType} ({hoveredPin.symbol})</span></div>
              {hoveredPin.label && <div>Function: <span style={{ color: "#38bdf8" }}>{hoveredPin.label}</span></div>}
              {pinToPortMap.has(hoveredPin.pin) && (
                <div style={{ marginTop: 3, color: "#10b981", fontWeight: 600 }}>
                  Assigned Port: {pinToPortMap.get(hoveredPin.pin)?.name} ({pinToPortMap.get(hoveredPin.pin)?.direction})
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* Bottom Vivado-Grade I/O Ports Dock Table                             */}
      {/* ==================================================================== */}
      <div
        style={{
          height: 240,
          minHeight: 180,
          backgroundColor: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          zIndex: 10
        }}
      >
        {/* Table Toolbar Ribbon */}
        <div
          style={{
            height: 32,
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            backgroundColor: "var(--bg-tertiary)",
            whiteSpace: "nowrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#fff" }}>
              <Sliders size={12} color="var(--accent-cyan)" />
              <span>{t.package.ioPorts} ({portAssignments.length})</span>
            </div>

            {/* Quick Search */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "2px 6px"
              }}
            >
              <Search size={10} color="var(--text-muted)" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter ports..."
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#fff",
                  fontSize: 10,
                  width: 110
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={handleAutoAssign}
              className="btn btn-ghost"
              style={{
                fontSize: 10,
                padding: "2px 8px",
                height: 22,
                minHeight: 22,
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "var(--accent-cyan)"
              }}
              title="Auto-Assign standard Basys 3 board pins"
            >
              <Sparkles size={11} />
              <span>{t.package.autoAssign}</span>
            </button>

            <button
              onClick={handleSaveToXdc}
              className="btn btn-ghost"
              style={{
                fontSize: 10,
                padding: "2px 8px",
                height: 22,
                minHeight: 22,
                borderRadius: 3,
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "var(--accent-emerald)",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
              title="Save pin constraints into constrs_1 XDC"
            >
              <Save size={11} />
              <span>{t.package.saveToXdc}</span>
            </button>

            <button
              onClick={handleClearAll}
              className="btn btn-ghost"
              style={{
                fontSize: 10,
                padding: "2px 8px",
                height: 22,
                minHeight: 22,
                borderRadius: 3,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
              title="Clear all package pin bindings"
            >
              <Trash2 size={11} />
              <span>{t.package.clearAll}</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              textAlign: "left",
              whiteSpace: "nowrap"
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-medium)",
                  color: "var(--text-muted)",
                  fontSize: 10,
                  textTransform: "uppercase"
                }}
              >
                <th style={{ padding: "6px 10px", width: 140 }}>{t.package.name}</th>
                <th style={{ padding: "6px 10px", width: 80 }}>{t.package.direction}</th>
                <th style={{ padding: "6px 10px", width: 100 }}>{t.package.negDiffPair}</th>
                <th style={{ padding: "6px 10px", width: 120 }}>{t.package.packagePin}</th>
                <th style={{ padding: "6px 10px", width: 60, textAlign: "center" }}>{t.package.fixed}</th>
                <th style={{ padding: "6px 10px", width: 70 }}>{t.package.bank}</th>
                <th style={{ padding: "6px 10px", width: 110 }}>{t.package.ioStd}</th>
                <th style={{ padding: "6px 10px", width: 70 }}>{t.package.vcco}</th>
                <th style={{ padding: "6px 10px", width: 70 }}>{t.package.vref}</th>
                <th style={{ padding: "6px 10px", width: 90 }}>{t.package.driveStrength}</th>
                <th style={{ padding: "6px 10px", width: 80 }}>{t.package.slewType}</th>
                <th style={{ padding: "6px 10px", width: 80 }}>{t.package.pullType}</th>
              </tr>
            </thead>
            <tbody>
              {/* Tree Header Row: All ports */}
              <tr
                onClick={() => setIsPortsTreeExpanded((v) => !v)}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border-subtle)"
                }}
              >
                <td colSpan={12} style={{ padding: "4px 8px", fontWeight: 700, color: "#38bdf8" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {isPortsTreeExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {t.package.allPorts} ({portAssignments.length})
                  </span>
                </td>
              </tr>

              {/* Port Rows */}
              {isPortsTreeExpanded &&
                filteredPorts.map((port) => {
                  const isSelected = selectedPortName === port.name;
                  return (
                    <tr
                      key={port.name}
                      onClick={() => {
                        setSelectedPortName(port.name);
                        if (port.packagePin) setSelectedPin(port.packagePin);
                      }}
                      style={{
                        backgroundColor: isSelected ? "rgba(56, 189, 248, 0.1)" : "transparent",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer"
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: "6px 10px", fontWeight: 600, color: "#fff", paddingLeft: 24 }}>
                        <span style={{ color: isSelected ? "var(--accent-cyan)" : "#fff" }}>{port.name}</span>
                      </td>

                      {/* Direction */}
                      <td style={{ padding: "6px 10px" }}>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 3,
                            backgroundColor: port.direction === "IN" ? "rgba(59, 130, 246, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: port.direction === "IN" ? "#60a5fa" : "#34d399"
                          }}
                        >
                          {port.direction}
                        </span>
                      </td>

                      {/* Neg Diff Pair */}
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{port.negDiffPair || "--"}</td>

                      {/* Package Pin Input / Dropdown */}
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={port.packagePin}
                          onChange={(e) => assignPinToPort(port.name, e.target.value.toUpperCase())}
                          placeholder={t.package.unassigned}
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 3,
                            color: port.packagePin ? "var(--accent-cyan)" : "var(--text-muted)",
                            padding: "2px 6px",
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            width: 80
                          }}
                        />
                      </td>

                      {/* Fixed Checkbox */}
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={port.fixed}
                          onChange={(e) => {
                            setPortAssignments((prev) =>
                              prev.map((p) => (p.name === port.name ? { ...p, fixed: e.target.checked } : p))
                            );
                          }}
                        />
                      </td>

                      {/* Bank */}
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                        {port.bank ? `Bank ${port.bank}` : "--"}
                      </td>

                      {/* I/O Std Dropdown */}
                      <td style={{ padding: "4px 8px" }}>
                        <select
                          value={port.ioStandard}
                          onChange={(e) => {
                            setPortAssignments((prev) =>
                              prev.map((p) => (p.name === port.name ? { ...p, ioStandard: e.target.value } : p))
                            );
                          }}
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 3,
                            color: "#fff",
                            padding: "2px 4px",
                            fontSize: 10.5
                          }}
                        >
                          <option value="LVCMOS33">LVCMOS33</option>
                          <option value="LVCMOS25">LVCMOS25</option>
                          <option value="LVCMOS18">LVCMOS18</option>
                          <option value="LVDS_25">LVDS_25</option>
                        </select>
                      </td>

                      {/* Vcco */}
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{port.vcco}</td>

                      {/* Vref */}
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{port.vref}</td>

                      {/* Drive Strength */}
                      <td style={{ padding: "4px 8px" }}>
                        {port.direction === "OUT" ? (
                          <select
                            value={port.driveStrength}
                            onChange={(e) => {
                              setPortAssignments((prev) =>
                                prev.map((p) => (p.name === port.name ? { ...p, driveStrength: e.target.value } : p))
                              );
                            }}
                            style={{
                              backgroundColor: "var(--bg-tertiary)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 3,
                              color: "#fff",
                              padding: "2px 4px",
                              fontSize: 10.5
                            }}
                          >
                            <option value="4mA">4mA</option>
                            <option value="8mA">8mA</option>
                            <option value="12mA">12mA</option>
                            <option value="16mA">16mA</option>
                          </select>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>--</span>
                        )}
                      </td>

                      {/* Slew Type */}
                      <td style={{ padding: "4px 8px" }}>
                        {port.direction === "OUT" ? (
                          <select
                            value={port.slewType}
                            onChange={(e) => {
                              setPortAssignments((prev) =>
                                prev.map((p) => (p.name === port.name ? { ...p, slewType: e.target.value } : p))
                              );
                            }}
                            style={{
                              backgroundColor: "var(--bg-tertiary)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 3,
                              color: "#fff",
                              padding: "2px 4px",
                              fontSize: 10.5
                            }}
                          >
                            <option value="SLOW">SLOW</option>
                            <option value="FAST">FAST</option>
                          </select>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>--</span>
                        )}
                      </td>

                      {/* Pull Type */}
                      <td style={{ padding: "4px 8px" }}>
                        <select
                          value={port.pullType}
                          onChange={(e) => {
                            setPortAssignments((prev) =>
                              prev.map((p) => (p.name === port.name ? { ...p, pullType: e.target.value } : p))
                            );
                          }}
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 3,
                            color: "#fff",
                            padding: "2px 4px",
                            fontSize: 10.5
                          }}
                        >
                          <option value="NONE">NONE</option>
                          <option value="PULLUP">PULLUP</option>
                          <option value="PULLDOWN">PULLDOWN</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
