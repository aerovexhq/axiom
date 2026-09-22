import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Cpu,
  RefreshCw,
  GitBranch,
  SplitSquareVertical,
  LayoutGrid
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  DieFloorplan,
  getPrimitiveColor,
  getHeatmapColor
} from "../engine/floorplanModel";
import {
  SynthesizedCircuit,
  TARGET_DEVICES,
  synthesizeClientFallback
} from "../engine/synthModel";
import {
  generateSynthesizedSchematicGraph,
  SchematicGraph,
  sliceFaninCone,
  sliceFanoutCone
} from "../engine/schematicModel";
import { useTranslation } from "../i18n";

interface FloorplanStudioViewerProps {
  state: SimulationState;
  activeDesignId: string;
  verilogSource?: string;
  topModule?: string;
  targetDevice?: string;
  onDeviceChange?: (device: string) => void;
  onSelectSignal?: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
}

type StudioViewMode = "floorplan" | "netlist" | "split";

export const FloorplanStudioViewer: React.FC<FloorplanStudioViewerProps> = ({
  state: _state,
  activeDesignId,
  verilogSource,
  topModule = "logic_circuit",
  targetDevice = "xc7a35tcpg236-1",
  onDeviceChange,
  onSelectSignal,
  onJumpToCode: _onJumpToCode
}) => {
  const { t } = useTranslation();

  // Selected Target Device
  const [selectedDevice, setSelectedDevice] = useState<string>(targetDevice);
  const [viewMode, setViewMode] = useState<StudioViewMode>("split");

  // Floorplan & Synthesis Data State
  const [floorplan, setFloorplan] = useState<DieFloorplan | null>(null);
  const [synthCircuit, setSynthCircuit] = useState<SynthesizedCircuit | null>(null);
  const [schematicGraph, setSchematicGraph] = useState<SchematicGraph | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Layer Visibility Toggles
  const [showClockRegions, setShowClockRegions] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPlacedCells, setShowPlacedCells] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showFlightlines, setShowFlightlines] = useState<boolean>(true);
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(true);

  // Netlist Logic Cone Toggles
  const [showFaninCone, setShowFaninCone] = useState<boolean>(false);
  const [showFanoutCone, setShowFanoutCone] = useState<boolean>(false);

  // Selection & Inspector
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [selectedHopIndex, setSelectedHopIndex] = useState<number | null>(null);
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"timing" | "cell" | "utilization">("timing");

  // Canvas Viewport Pan & Zoom (Floorplan Canvas)
  const fpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fpContainerRef = useRef<HTMLDivElement | null>(null);
  const [fpPan, setFpPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [fpZoom, setFpZoom] = useState<number>(1.0);
  const isFpDragging = useRef<boolean>(false);
  const fpDragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas Viewport Pan & Zoom (Gate Netlist Canvas)
  const nlCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nlContainerRef = useRef<HTMLDivElement | null>(null);
  const [nlPan, setNlPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [nlZoom, setNlZoom] = useState<number>(1.0);
  const isNlDragging = useRef<boolean>(false);
  const nlDragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (targetDevice && targetDevice !== selectedDevice) {
      setSelectedDevice(targetDevice);
    }
  }, [targetDevice]);

  // Load Floorplan & Synthesis Data
  const loadFloorplan = useCallback(async (devToUse: string = selectedDevice) => {
    setIsLoading(true);
    try {
      const top = topModule || "top";
      const fp = await engineBridge.generateFloorplan({
        source: verilogSource,
        topModule: top,
        device: devToUse
      });
      setFloorplan(fp);

      const synth = await engineBridge.synthesizeDesign({
        source: verilogSource,
        topModule: top,
        device: devToUse,
        designId: activeDesignId || top
      });
      setSynthCircuit(synth);
      setSchematicGraph(generateSynthesizedSchematicGraph(synth));

      if (synth.cells.length > 0 && !selectedCellId) {
        setSelectedCellId(synth.cells[0].id);
      }
    } catch (err) {
      console.warn("[FloorplanStudioViewer] Floorplan generation fallback:", err);
      const synthFallback = synthesizeClientFallback(activeDesignId || topModule, topModule, devToUse);
      setSynthCircuit(synthFallback);
      setSchematicGraph(generateSynthesizedSchematicGraph(synthFallback));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice, topModule, verilogSource, activeDesignId, selectedCellId]);

  useEffect(() => {
    loadFloorplan(selectedDevice);
  }, [selectedDevice, topModule, activeDesignId]);

  const handleDeviceChange = (dev: string) => {
    setSelectedDevice(dev);
    onDeviceChange?.(dev);
  };

  // Selected cell object
  const selectedCell = useMemo(() => {
    if (!selectedCellId || !synthCircuit) return null;
    return synthCircuit.cells.find((c) => c.id === selectedCellId) || null;
  }, [selectedCellId, synthCircuit]);

  const selectedPlacedCell = useMemo(() => {
    if (!selectedCellId || !floorplan) return null;
    return floorplan.placed_cells[selectedCellId] || null;
  }, [selectedCellId, floorplan]);

  // Critical path nodes and edges
  const criticalPathCellIds = useMemo(() => {
    const set = new Set<string>();
    if (!floorplan?.critical_path) return set;
    for (const hop of floorplan.critical_path.hops) {
      set.add(hop.source_cell);
      set.add(hop.dest_cell);
    }
    return set;
  }, [floorplan]);

  // Active Logic Cones for Netlist View
  const activeCone = useMemo(() => {
    if (!schematicGraph || !selectedCellId) return null;
    if (showFaninCone) return sliceFaninCone(schematicGraph, selectedCellId);
    if (showFanoutCone) return sliceFanoutCone(schematicGraph, selectedCellId);
    return null;
  }, [schematicGraph, selectedCellId, showFaninCone, showFanoutCone]);

  // --------------------------------------------------------------------------
  // 1. Render Physical Floorplan Canvas
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = fpCanvasRef.current;
    if (!canvas || !floorplan) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(fpPan.x, fpPan.y);
    ctx.scale(fpZoom, fpZoom);

    const cellW = 18;
    const cellH = 14;
    const gridW = floorplan.grid_width * cellW;
    const gridH = floorplan.grid_height * cellH;

    // Background substrate
    ctx.fillStyle = "#090d13";
    ctx.fillRect(0, 0, gridW, gridH);

    // Density Heatmap Layer
    if (showHeatmap && floorplan.heatmap_tiles.length > 0) {
      const tileSize = 4;
      for (const tile of floorplan.heatmap_tiles) {
        const tx = tile.col * tileSize * cellW;
        const ty = tile.row * tileSize * cellH;
        const tw = tileSize * cellW;
        const th = tileSize * cellH;
        ctx.fillStyle = getHeatmapColor(tile.utilization_pct, tile.congestion_score);
        ctx.fillRect(tx, ty, tw, th);
      }
    }

    // Silicon Resource Grid & Columns
    if (showGrid) {
      for (let c = 0; c < floorplan.grid_width; c++) {
        const colDef = floorplan.site_columns[c];
        const cx = c * cellW;
        const isIob = colDef?.site_type === "Iob";
        const isDsp = colDef?.site_type === "Dsp48";
        const isBram = colDef?.site_type === "Ramb36";
        const isBufg = colDef?.site_type === "Bufg";

        // Column track background
        if (isIob) {
          ctx.fillStyle = "rgba(163, 113, 247, 0.12)";
          ctx.fillRect(cx, 0, cellW, gridH);
        } else if (isDsp) {
          ctx.fillStyle = "rgba(210, 153, 34, 0.1)";
          ctx.fillRect(cx, 0, cellW, gridH);
        } else if (isBram) {
          ctx.fillStyle = "rgba(56, 139, 253, 0.1)";
          ctx.fillRect(cx, 0, cellW, gridH);
        } else if (isBufg) {
          ctx.fillStyle = "rgba(247, 120, 186, 0.14)";
          ctx.fillRect(cx, 0, cellW, gridH);
        }

        // Column borders
        ctx.strokeStyle = "#161b22";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, gridH);
        ctx.stroke();
      }

      // Horizontal row lines
      ctx.strokeStyle = "#161b22";
      ctx.lineWidth = 0.5;
      for (let r = 0; r <= floorplan.grid_height; r += 2) {
        const ry = r * cellH;
        ctx.beginPath();
        ctx.moveTo(0, ry);
        ctx.lineTo(gridW, ry);
        ctx.stroke();
      }
    }

    // Clock Regions Layer
    if (showClockRegions) {
      for (const cr of floorplan.clock_regions) {
        const rx = cr.min_col * cellW;
        const ry = cr.min_row * cellH;
        const rw = (cr.max_col - cr.min_col + 1) * cellW;
        const rh = (cr.max_row - cr.min_row + 1) * cellH;

        ctx.strokeStyle = "rgba(56, 139, 253, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);

        // Clock region label badge
        ctx.fillStyle = "rgba(56, 139, 253, 0.25)";
        ctx.fillRect(rx + 4, ry + 4, 76, 16);
        ctx.fillStyle = "#58a6ff";
        ctx.font = "bold 9.5px monospace";
        ctx.fillText(`CLOCK ${cr.name}`, rx + 8, ry + 16);
      }
    }

    // Net Flightlines Layer
    if (showFlightlines && synthCircuit) {
      ctx.lineWidth = 1;
      for (const net of synthCircuit.nets) {
        if (!net.driver_cell) continue;
        const drvPlaced = floorplan.placed_cells[net.driver_cell];
        if (!drvPlaced) continue;

        const isSelectedNet = selectedCell && (selectedCell.id === net.driver_cell || Object.values(selectedCell.ports).includes(net.name));
        ctx.strokeStyle = isSelectedNet ? "rgba(88, 166, 255, 0.85)" : "rgba(110, 118, 129, 0.2)";
        ctx.lineWidth = isSelectedNet ? 2 : 0.8;

        const sx = drvPlaced.col * cellW + cellW / 2;
        const sy = drvPlaced.row * cellH + cellH / 2;

        for (const [loadId, _] of net.load_cells) {
          const loadPlaced = floorplan.placed_cells[loadId];
          if (!loadPlaced) continue;
          const ex = loadPlaced.col * cellW + cellW / 2;
          const ey = loadPlaced.row * cellH + cellH / 2;

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    }

    // Placed Silicon Cells Layer
    if (showPlacedCells) {
      for (const [id, cell] of Object.entries(floorplan.placed_cells)) {
        const cx = cell.col * cellW;
        const cy = cell.row * cellH;
        const isSelected = selectedCellId === id;
        const isHovered = hoveredCellId === id;
        const isCrit = criticalPathCellIds.has(cell.name) || criticalPathCellIds.has(id);

        const color = getPrimitiveColor(cell.kind);
        ctx.fillStyle = color;
        ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);

        // Highlight ring
        if (isSelected || isHovered || isCrit) {
          ctx.strokeStyle = isSelected ? "#ffffff" : isCrit ? "#ff7b72" : "#58a6ff";
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.strokeRect(cx - 1, cy - 1, cellW + 2, cellH + 2);
        }

        // Cell Label when zoomed in
        if (fpZoom >= 1.4) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "8px sans-serif";
          ctx.fillText(cell.name.slice(0, 5), cx + 2, cy + 9);
        }
      }
    }

    // Critical Path Flightline / Manhattan Routing Overlay
    if (showCriticalPath && floorplan.critical_path) {
      const hops = floorplan.critical_path.hops;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#ff7b72"; // Bright neon coral/red
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 0; i < hops.length; i++) {
        const hop = hops[i];
        const isHopSelected = selectedHopIndex === i;
        ctx.strokeStyle = isHopSelected ? "#ffffff" : "#ff7b72";
        ctx.lineWidth = isHopSelected ? 4.5 : 3.0;

        const x1 = hop.source_col * cellW + cellW / 2;
        const y1 = hop.source_row * cellH + cellH / 2;
        const x2 = hop.dest_col * cellW + cellW / 2;
        const y2 = hop.dest_row * cellH + cellH / 2;

        // Manhattan routing channel: horizontal then vertical jog
        const midX = x1 + (x2 - x1) / 2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Directional arrow head on endpoint
        ctx.fillStyle = isHopSelected ? "#ffffff" : "#ff7b72";
        ctx.beginPath();
        ctx.arc(x2, y2, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Latency badge callout
        if (fpZoom >= 1.1) {
          ctx.fillStyle = "rgba(13, 17, 23, 0.92)";
          ctx.strokeStyle = "#ff7b72";
          ctx.lineWidth = 1;
          const badgeX = midX - 22;
          const badgeY = (y1 + y2) / 2 - 8;
          ctx.fillRect(badgeX, badgeY, 44, 15);
          ctx.strokeRect(badgeX, badgeY, 44, 15);

          ctx.fillStyle = "#ff7b72";
          ctx.font = "bold 8.5px monospace";
          ctx.fillText(`+${Math.round(hop.logic_delay_ps + hop.routing_delay_ps)}ps`, badgeX + 4, badgeY + 11);
        }
      }
    }

    ctx.restore();
  }, [
    floorplan,
    synthCircuit,
    fpPan,
    fpZoom,
    showClockRegions,
    showGrid,
    showPlacedCells,
    showHeatmap,
    showFlightlines,
    showCriticalPath,
    selectedCellId,
    hoveredCellId,
    selectedHopIndex,
    criticalPathCellIds,
    selectedCell
  ]);

  // --------------------------------------------------------------------------
  // 2. Render Gate Netlist Schematic Canvas (RTL-to-Gate DAG)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = nlCanvasRef.current;
    if (!canvas || !schematicGraph) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(nlPan.x, nlPan.y);
    ctx.scale(nlZoom, nlZoom);

    // 1. Draw Interconnect Wire Edges
    for (const edge of schematicGraph.edges) {
      const isConeActive = activeCone !== null;
      const isInCone = activeCone ? activeCone.edgeIds.has(edge.id) : true;
      const isCrit = criticalPathCellIds.has(edge.sourceNodeId) && criticalPathCellIds.has(edge.targetNodeId);

      ctx.strokeStyle = isCrit
        ? "#ff7b72"
        : isInCone
        ? "#58a6ff"
        : "rgba(110, 118, 129, 0.18)";
      ctx.lineWidth = isCrit ? 3.0 : isInCone ? 2.0 : 1.0;

      if (isConeActive && !isInCone && !isCrit) {
        ctx.strokeStyle = "rgba(110, 118, 129, 0.15)";
      }

      if (edge.wirePoints.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(edge.wirePoints[0].x, edge.wirePoints[0].y);
        for (let i = 1; i < edge.wirePoints.length; i++) {
          ctx.lineTo(edge.wirePoints[i].x, edge.wirePoints[i].y);
        }
        ctx.stroke();
      }
    }

    // 2. Draw Primitive Gate Nodes
    for (const node of schematicGraph.nodes) {
      const isSelected = selectedCellId === node.id || (selectedCell && selectedCell.name === node.label);
      const isHovered = hoveredCellId === node.id;
      const isConeActive = activeCone !== null;
      const isInCone = activeCone ? activeCone.nodeIds.has(node.id) : true;
      const isCrit = criticalPathCellIds.has(node.id) || criticalPathCellIds.has(node.label);

      const opacity = isConeActive && !isInCone && !isSelected && !isCrit ? 0.2 : 1.0;
      ctx.globalAlpha = opacity;

      // Gate body
      ctx.fillStyle = "#161b22";
      ctx.strokeStyle = isSelected
        ? "#58a6ff"
        : isHovered
        ? "#79c0ff"
        : isCrit
        ? "#ff7b72"
        : isInCone && isConeActive
        ? "#79c0ff"
        : "#30363d";
      ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2.0 : isCrit ? 2.0 : 1.0;

      // Draw rounded rectangle gate body
      const r = 6;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, node.height, r);
      ctx.fill();
      ctx.stroke();

      // Primitive Kind Header Pill
      const primColor = getPrimitiveColor(node.label);
      ctx.fillStyle = primColor;
      ctx.fillRect(node.x + 1, node.y + 1, 5, node.height - 2);

      // Node Label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(node.label, node.x + 12, node.y + 16);

      // Node Sublabel (primitive kind / equation)
      ctx.fillStyle = "#8b949e";
      ctx.font = "9px sans-serif";
      const sub = node.sublabel || (node.kind === "gate" ? "LUT" : node.kind);
      ctx.fillText(sub, node.x + 12, node.y + 28);

      // Draw Input & Output Pin Terminals
      for (const p of node.inputs) {
        const px = node.x + (p.offsetX ?? 0);
        const py = node.y + (p.offsetY ?? node.height / 2);
        ctx.fillStyle = p.isClock ? "#f778ba" : "#8b949e";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      for (const p of node.outputs) {
        const px = node.x + (p.offsetX ?? node.width);
        const py = node.y + (p.offsetY ?? node.height / 2);
        ctx.fillStyle = "#58a6ff";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }, [
    schematicGraph,
    nlPan,
    nlZoom,
    selectedCellId,
    hoveredCellId,
    activeCone,
    criticalPathCellIds,
    selectedCell
  ]);

  // --------------------------------------------------------------------------
  // Interaction Handlers (Floorplan Canvas)
  // --------------------------------------------------------------------------
  const handleFpMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isFpDragging.current = true;
    fpDragStart.current = { x: e.clientX - fpPan.x, y: e.clientY - fpPan.y };
  };

  const handleFpMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isFpDragging.current) {
      setFpPan({
        x: e.clientX - fpDragStart.current.x,
        y: e.clientY - fpDragStart.current.y
      });
      return;
    }

    // Hover site detection
    const canvas = fpCanvasRef.current;
    if (!canvas || !floorplan) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - fpPan.x) / fpZoom;
    const my = (e.clientY - rect.top - fpPan.y) / fpZoom;

    const cellW = 18;
    const cellH = 14;
    const col = Math.floor(mx / cellW);
    const row = Math.floor(my / cellH);

    let foundCell: string | null = null;
    for (const [id, pc] of Object.entries(floorplan.placed_cells)) {
      if (pc.col === col && pc.row === row) {
        foundCell = id;
        break;
      }
    }
    setHoveredCellId(foundCell);
  };

  const handleFpMouseUp = () => {
    isFpDragging.current = false;
  };

  const handleFpClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = fpCanvasRef.current;
    if (!canvas || !floorplan) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - fpPan.x) / fpZoom;
    const my = (e.clientY - rect.top - fpPan.y) / fpZoom;

    const cellW = 18;
    const cellH = 14;
    const col = Math.floor(mx / cellW);
    const row = Math.floor(my / cellH);

    for (const [id, pc] of Object.entries(floorplan.placed_cells)) {
      if (pc.col === col && pc.row === row) {
        setSelectedCellId(id);
        onSelectSignal?.(pc.name);
        return;
      }
    }
  };

  const handleFpWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setFpZoom((prev) => Math.max(0.4, Math.min(prev * zoomFactor, 6.0)));
  };

  // --------------------------------------------------------------------------
  // Interaction Handlers (Gate Netlist Canvas)
  // --------------------------------------------------------------------------
  const handleNlMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isNlDragging.current = true;
    nlDragStart.current = { x: e.clientX - nlPan.x, y: e.clientY - nlPan.y };
  };

  const handleNlMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isNlDragging.current) {
      setNlPan({
        x: e.clientX - nlDragStart.current.x,
        y: e.clientY - nlDragStart.current.y
      });
      return;
    }

    const canvas = nlCanvasRef.current;
    if (!canvas || !schematicGraph) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - nlPan.x) / nlZoom;
    const my = (e.clientY - rect.top - nlPan.y) / nlZoom;

    let foundNode: string | null = null;
    for (const node of schematicGraph.nodes) {
      if (mx >= node.x && mx <= node.x + node.width && my >= node.y && my <= node.y + node.height) {
        foundNode = node.id;
        break;
      }
    }
    setHoveredCellId(foundNode);
  };

  const handleNlMouseUp = () => {
    isNlDragging.current = false;
  };

  const handleNlClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = nlCanvasRef.current;
    if (!canvas || !schematicGraph) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - nlPan.x) / nlZoom;
    const my = (e.clientY - rect.top - nlPan.y) / nlZoom;

    for (const node of schematicGraph.nodes) {
      if (mx >= node.x && mx <= node.x + node.width && my >= node.y && my <= node.y + node.height) {
        setSelectedCellId(node.id);
        onSelectSignal?.(node.label);
        return;
      }
    }
  };

  const handleNlWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setNlZoom((prev) => Math.max(0.3, Math.min(prev * zoomFactor, 4.0)));
  };

  // Cross-Probing Focus Action
  const focusOnCell = (cellId: string) => {
    setSelectedCellId(cellId);
    if (floorplan && floorplan.placed_cells[cellId]) {
      const pc = floorplan.placed_cells[cellId];
      const cellW = 18;
      const cellH = 14;
      const targetX = pc.col * cellW;
      const targetY = pc.row * cellH;
      setFpPan({ x: 180 - targetX * fpZoom, y: 140 - targetY * fpZoom });
    }

    if (schematicGraph) {
      const node = schematicGraph.nodes.find((n) => n.id === cellId);
      if (node) {
        setNlPan({ x: 220 - node.x * nlZoom, y: 160 - node.y * nlZoom });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] select-none overflow-hidden">
      {/* 1. Header Control Ribbon */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <LayoutGrid className="w-4 h-4 text-[#58a6ff]" />
            <span>{t("floorplan.title")}</span>
          </div>

          {/* Device Selector */}
          <select
            value={selectedDevice}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="px-2 py-1 text-xs rounded bg-[#21262d] border border-[#30363d] text-white focus:outline-none focus:border-[#58a6ff]"
          >
            {TARGET_DEVICES.map((dev) => (
              <option key={dev.id} value={dev.id}>
                {dev.name}
              </option>
            ))}
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center p-0.5 rounded bg-[#21262d] border border-[#30363d]">
            <button
              onClick={() => setViewMode("floorplan")}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                viewMode === "floorplan"
                  ? "bg-[#30363d] text-white font-semibold"
                  : "text-[#8b949e] hover:text-white"
              }`}
              title={t("floorplan.floorplanView")}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{t("floorplan.floorplanView")}</span>
            </button>
            <button
              onClick={() => setViewMode("netlist")}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                viewMode === "netlist"
                  ? "bg-[#30363d] text-white font-semibold"
                  : "text-[#8b949e] hover:text-white"
              }`}
              title={t("floorplan.netlistView")}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{t("floorplan.netlistView")}</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                viewMode === "split"
                  ? "bg-[#30363d] text-white font-semibold"
                  : "text-[#8b949e] hover:text-white"
              }`}
              title={t("floorplan.splitView")}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>{t("floorplan.splitView")}</span>
            </button>
          </div>
        </div>

        {/* Display Layer Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Floorplan Toggles */}
          {(viewMode === "floorplan" || viewMode === "split") && (
            <>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showGrid
                    ? "bg-[#21262d] text-[#7ee787] border-[#7ee787]/40"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title="FPGA Die Grid"
              >
                Grid
              </button>
              <button
                onClick={() => setShowPlacedCells(!showPlacedCells)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showPlacedCells
                    ? "bg-[#21262d] text-[#79c0ff] border-[#79c0ff]/40"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title="Placed Silicon Cells"
              >
                Cells
              </button>
              <button
                onClick={() => setShowClockRegions(!showClockRegions)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showClockRegions
                    ? "bg-[#21262d] text-[#58a6ff] border-[#58a6ff]/40"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title={t("floorplan.clockRegions")}
              >
                CR
              </button>
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showHeatmap
                    ? "bg-[#21262d] text-[#d29922] border-[#d29922]/40"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title={t("floorplan.heatmap")}
              >
                Heatmap
              </button>
              <button
                onClick={() => setShowFlightlines(!showFlightlines)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showFlightlines
                    ? "bg-[#21262d] text-[#a371f7] border-[#a371f7]/40"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title={t("floorplan.flightlines")}
              >
                Wires
              </button>
              <button
                onClick={() => setShowCriticalPath(!showCriticalPath)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showCriticalPath
                    ? "bg-[#21262d] text-[#ff7b72] border-[#ff7b72]/40 font-semibold"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title={t("floorplan.criticalPath")}
              >
                Critical Path
              </button>
            </>
          )}

          {/* Gate Netlist Toggles */}
          {(viewMode === "netlist" || viewMode === "split") && (
            <>
              <button
                onClick={() => {
                  setShowFaninCone(!showFaninCone);
                  if (showFanoutCone) setShowFanoutCone(false);
                }}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showFaninCone
                    ? "bg-[#21262d] text-[#79c0ff] border-[#79c0ff]/40 font-semibold"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title={t("floorplan.faninCone")}
              >
                Fan-In
              </button>
              <button
                onClick={() => {
                  setShowFanoutCone(!showFanoutCone);
                  if (showFaninCone) setShowFaninCone(false);
                }}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  showFanoutCone
                    ? "bg-[#21262d] text-[#a371f7] border-[#a371f7]/40 font-semibold"
                    : "bg-transparent text-[#8b949e] border-[#30363d]"
                }`}
                title={t("floorplan.fanoutCone")}
              >
                Fan-Out
              </button>
            </>
          )}

          {/* Refresh button */}
          <button
            onClick={() => loadFloorplan(selectedDevice)}
            disabled={isLoading}
            className="p-1 rounded bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d]"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Main Viewport (Floorplan Canvas / Gate Netlist / Split) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Physical Floorplan View */}
        {(viewMode === "floorplan" || viewMode === "split") && (
          <div
            ref={fpContainerRef}
            className={`h-full relative overflow-hidden bg-[#090d13] ${
              viewMode === "split" ? "w-1/2 border-r border-[#30363d]" : "w-full"
            }`}
          >
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-[#161b22]/80 border border-[#30363d] text-[10px] font-mono text-[#8b949e] pointer-events-none">
              PHYSICAL SILICON FABRIC ({floorplan?.grid_width ?? 0}x{floorplan?.grid_height ?? 0})
            </div>

            <canvas
              ref={fpCanvasRef}
              width={800}
              height={600}
              onMouseDown={handleFpMouseDown}
              onMouseMove={handleFpMouseMove}
              onMouseUp={handleFpMouseUp}
              onClick={handleFpClick}
              onWheel={handleFpWheel}
              className="w-full h-full cursor-grab active:cursor-grabbing"
            />

            {/* Floorplan Zoom Controls */}
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-md bg-[#161b22]/90 border border-[#30363d] backdrop-blur-sm">
              <button
                onClick={() => setFpZoom((z) => Math.min(z * 1.25, 6.0))}
                className="p-1 rounded text-[#8b949e] hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFpZoom((z) => Math.max(z * 0.8, 0.4))}
                className="p-1 rounded text-[#8b949e] hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setFpZoom(1.0);
                  setFpPan({ x: 30, y: 30 });
                }}
                className="p-1 rounded text-[#8b949e] hover:text-white"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Gate Netlist View */}
        {(viewMode === "netlist" || viewMode === "split") && (
          <div
            ref={nlContainerRef}
            className={`h-full relative overflow-hidden bg-[#0d1117] ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-[#161b22]/80 border border-[#30363d] text-[10px] font-mono text-[#8b949e] pointer-events-none">
              SYNTHESIZED GATE NETLIST DAG ({schematicGraph?.nodes.length ?? 0} CELLS)
            </div>

            <canvas
              ref={nlCanvasRef}
              width={800}
              height={600}
              onMouseDown={handleNlMouseDown}
              onMouseMove={handleNlMouseMove}
              onMouseUp={handleNlMouseUp}
              onClick={handleNlClick}
              onWheel={handleNlWheel}
              className="w-full h-full cursor-grab active:cursor-grabbing"
            />

            {/* Netlist Zoom Controls */}
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-md bg-[#161b22]/90 border border-[#30363d] backdrop-blur-sm">
              <button
                onClick={() => setNlZoom((z) => Math.min(z * 1.25, 4.0))}
                className="p-1 rounded text-[#8b949e] hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setNlZoom((z) => Math.max(z * 0.8, 0.3))}
                className="p-1 rounded text-[#8b949e] hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setNlZoom(1.0);
                  setNlPan({ x: 40, y: 40 });
                }}
                className="p-1 rounded text-[#8b949e] hover:text-white"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Inspector Drawer (Critical Path Waterfall / Cell Inspector / Utilization) */}
      <div className="h-44 bg-[#161b22] border-t border-[#30363d] flex flex-col">
        {/* Tab Headers */}
        <div className="flex items-center justify-between px-3 pt-1.5 border-b border-[#21262d] bg-[#0d1117]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setInspectorTab("timing")}
              className={`px-3 py-1 text-xs font-semibold rounded-t transition-colors ${
                inspectorTab === "timing"
                  ? "bg-[#161b22] text-[#ff7b72] border-t-2 border-[#ff7b72]"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              {t("floorplan.criticalPath")} ({floorplan?.critical_path?.hops.length ?? 0} Hops)
            </button>
            <button
              onClick={() => setInspectorTab("cell")}
              className={`px-3 py-1 text-xs font-semibold rounded-t transition-colors ${
                inspectorTab === "cell"
                  ? "bg-[#161b22] text-[#58a6ff] border-t-2 border-[#58a6ff]"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              {t("floorplan.cell")} Inspector
            </button>
            <button
              onClick={() => setInspectorTab("utilization")}
              className={`px-3 py-1 text-xs font-semibold rounded-t transition-colors ${
                inspectorTab === "utilization"
                  ? "bg-[#161b22] text-[#d29922] border-t-2 border-[#d29922]"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              {t("floorplan.density")} & Silicon Summary
            </button>
          </div>

          {/* Quick Metrics Strip */}
          {floorplan?.critical_path && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-[#8b949e]">
                Delay: <span className="text-white font-bold">{Math.round(floorplan.critical_path.total_delay_ps)} ps</span>
              </span>
              <span className="text-[#8b949e]">
                Logic: <span className="text-[#2ea043]">{Math.round((floorplan.critical_path.logic_delay_ps / floorplan.critical_path.total_delay_ps) * 100)}%</span>
              </span>
              <span className="text-[#8b949e]">
                Route: <span className="text-[#a371f7]">{Math.round((floorplan.critical_path.routing_delay_ps / floorplan.critical_path.total_delay_ps) * 100)}%</span>
              </span>
              <span className="text-[#8b949e]">
                Slack: <span className="text-[#58a6ff] font-bold">+{Math.round(floorplan.critical_path.slack_ps)} ps</span>
              </span>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {inspectorTab === "timing" && (
            <div className="space-y-1">
              {floorplan?.critical_path?.hops && floorplan.critical_path.hops.length > 0 ? (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="text-[#8b949e] border-b border-[#21262d]">
                      <th className="py-1 px-2">Hop</th>
                      <th className="py-1 px-2">{t("floorplan.cell")}</th>
                      <th className="py-1 px-2">{t("floorplan.pin")}</th>
                      <th className="py-1 px-2">{t("floorplan.site")}</th>
                      <th className="py-1 px-2">{t("floorplan.net")}</th>
                      <th className="py-1 px-2 text-right">{t("floorplan.logicDelay")}</th>
                      <th className="py-1 px-2 text-right">{t("floorplan.routingDelay")}</th>
                      <th className="py-1 px-2 text-right">Arrival</th>
                      <th className="py-1 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {floorplan.critical_path.hops.map((hop, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedHopIndex(idx)}
                        className={`border-b border-[#21262d]/50 hover:bg-[#21262d]/40 cursor-pointer ${
                          selectedHopIndex === idx ? "bg-[#21262d]/70 text-white" : "text-[#c9d1d9]"
                        }`}
                      >
                        <td className="py-1 px-2 font-mono text-[#ff7b72]">#{hop.hop_index}</td>
                        <td className="py-1 px-2 font-mono font-semibold">{hop.source_cell}</td>
                        <td className="py-1 px-2 font-mono text-[#8b949e]">{hop.source_pin}</td>
                        <td className="py-1 px-2 font-mono text-[#2ea043]">{hop.source_site}</td>
                        <td className="py-1 px-2 font-mono text-[#58a6ff]">{hop.net_name}</td>
                        <td className="py-1 px-2 text-right font-mono">{Math.round(hop.logic_delay_ps)} ps</td>
                        <td className="py-1 px-2 text-right font-mono text-[#a371f7]">+{Math.round(hop.routing_delay_ps)} ps</td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-white">
                          {Math.round(hop.cumulative_delay_ps)} ps
                        </td>
                        <td className="py-1 px-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              focusOnCell(hop.source_cell);
                            }}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-[#30363d] hover:bg-[#58a6ff] hover:text-black font-semibold transition-colors"
                          >
                            {t("floorplan.focus")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-6 text-center text-[#8b949e] text-xs">
                  No critical timing path available for this circuit.
                </div>
              )}
            </div>
          )}

          {inspectorTab === "cell" && (
            <div className="grid grid-cols-3 gap-3 h-full text-xs">
              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] font-semibold uppercase mb-1">Physical Site Placement</div>
                {selectedPlacedCell ? (
                  <div className="space-y-1 font-mono">
                    <div className="text-white font-bold">{selectedPlacedCell.site_name}</div>
                    <div className="text-[#2ea043]">Site Type: {selectedPlacedCell.site_type}</div>
                    <div className="text-[#8b949e]">Grid Coordinates: ({selectedPlacedCell.col}, {selectedPlacedCell.row})</div>
                    <div className="text-[#a371f7]">BEL Slot: {selectedPlacedCell.bel_slot}</div>
                  </div>
                ) : (
                  <div className="text-[#8b949e]">Select a cell or site to inspect placement.</div>
                )}
              </div>

              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] font-semibold uppercase mb-1">Cell Primitive & Logic</div>
                {selectedCell ? (
                  <div className="space-y-1 font-mono">
                    <div className="text-white font-bold">{selectedCell.name}</div>
                    <div className="text-[#58a6ff]">Kind: {selectedCell.kind}</div>
                    {selectedCell.equation && (
                      <div className="text-[#ff7b72] truncate">Eq: {selectedCell.equation}</div>
                    )}
                    <div className="text-[#8b949e]">Cell Delay: {Math.round(selectedCell.delay_ps)} ps</div>
                  </div>
                ) : (
                  <div className="text-[#8b949e]">Select a cell to view logic equation.</div>
                )}
              </div>

              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] font-semibold uppercase mb-1">Port Net Connections</div>
                {selectedCell ? (
                  <div className="space-y-0.5 font-mono text-[11px] overflow-y-auto max-h-24">
                    {Object.entries(selectedCell.ports).map(([pin, net]) => (
                      <div key={pin} className="flex justify-between">
                        <span className="text-[#8b949e]">{pin}:</span>
                        <span className="text-[#58a6ff]">{net}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#8b949e]">No port connections.</div>
                )}
              </div>
            </div>
          )}

          {inspectorTab === "utilization" && (
            <div className="grid grid-cols-4 gap-3 h-full text-xs">
              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] uppercase font-semibold">Total Cells Placed</div>
                <div className="text-lg font-bold text-white mt-1">
                  {Object.keys(floorplan?.placed_cells ?? {}).length}
                </div>
                <div className="text-[#8b949e] text-[10px]">
                  Across {floorplan?.grid_width ?? 0}x{floorplan?.grid_height ?? 0} silicon array
                </div>
              </div>

              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] uppercase font-semibold">Clock Regions</div>
                <div className="text-lg font-bold text-[#58a6ff] mt-1">
                  {floorplan?.clock_regions.length ?? 0} Regions
                </div>
                <div className="text-[#8b949e] text-[10px]">Global balanced clock spine</div>
              </div>

              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] uppercase font-semibold">Estimated Wirelength</div>
                <div className="text-lg font-bold text-[#2ea043] mt-1">
                  {Math.round(floorplan?.total_wirelength ?? 0)} <span className="text-xs font-normal">HPWL</span>
                </div>
                <div className="text-[#8b949e] text-[10px]">Half-Perimeter Wire Length</div>
              </div>

              <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
                <div className="text-[#8b949e] text-[10px] uppercase font-semibold">Data Path Delay</div>
                <div className="text-lg font-bold text-[#ff7b72] mt-1">
                  {Math.round(floorplan?.critical_path?.total_delay_ps ?? 0)} ps
                </div>
                <div className="text-[#8b949e] text-[10px]">Worst-case timing path</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
