import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Layers,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  X
} from "lucide-react";
import { SimulationState } from "../engine/engineBridge";
import {
  SchematicGraph,
  SchematicNode,
  SchematicEdge,
  LogicCone,
  generateSchematicGraph,
  sliceFaninCone,
  sliceFanoutCone
} from "../engine/schematicModel";

interface SchematicViewerProps {
  state: SimulationState;
  activeDesignId: string;
  selectedSignalId?: string | null;
  onSelectSignal: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
}

export const SchematicViewer: React.FC<SchematicViewerProps> = ({
  state,
  activeDesignId,
  selectedSignalId,
  onSelectSignal,
  onJumpToCode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Synthesize Hardware DAG for active design
  const graph = useMemo<SchematicGraph>(() => {
    return generateSchematicGraph(activeDesignId);
  }, [activeDesignId]);

  // Camera Viewport State: Pan (offsetX, offsetY) & Zoom (scale)
  const [scale, setScale] = useState<number>(0.85);
  const [offsetX, setOffsetX] = useState<number>(60);
  const [offsetY, setOffsetY] = useState<number>(50);

  // Mouse Interaction States
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection & 1-Click Logic Cone Slicer State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeCone, setActiveCone] = useState<LogicCone | null>(null);

  // Hover & Tooltip State
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // View Options
  const [showLiveValues, setShowLiveValues] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);

  // Map signal names to live logic values
  const liveValuesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sig of state.signals) {
      const lastSample = sig.samples[sig.samples.length - 1];
      const val = lastSample?.value ?? "0";
      map.set(sig.id, val);
      map.set(sig.name, val);
      map.set(sig.fullName, val);
      if (sig.name.includes("[")) {
        map.set(sig.name.split("[")[0], val);
      }
    }
    return map;
  }, [state.signals]);

  // Semantic Level-of-Detail (LOD) Category
  const lodLevel = useMemo<"macro" | "structural" | "gate">(() => {
    if (scale < 0.4) return "macro";
    if (scale > 1.2) return "gate";
    return "structural";
  }, [scale]);

  // Auto-focus camera on graph bounds initially or when design changes
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !graph) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const graphWidth = graph.bounds.width || 1200;
    const graphHeight = graph.bounds.height || 650;

    const scaleX = (width - 120) / graphWidth;
    const scaleY = (height - 120) / graphHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.2);

    setScale(newScale);
    setOffsetX((width - graphWidth * newScale) / 2);
    setOffsetY((height - graphHeight * newScale) / 2);
  }, [graph]);

  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Handle external signal selection (e.g. from Waveform or Sidebar)
  useEffect(() => {
    if (!selectedSignalId) return;

    // Find node or edge matching this signal
    const matchingNode = graph.nodes.find(
      (n) => n.id === selectedSignalId || n.label.startsWith(selectedSignalId) || n.inputs.some((p) => p.name === selectedSignalId) || n.outputs.some((p) => p.name === selectedSignalId)
    );
    const matchingEdge = graph.edges.find((e) => e.signalId === selectedSignalId || e.netName.startsWith(selectedSignalId));

    if (matchingNode) {
      setSelectedNodeId(matchingNode.id);
      setSelectedEdgeId(null);
    } else if (matchingEdge) {
      setSelectedEdgeId(matchingEdge.id);
      setSelectedNodeId(null);
    }
  }, [selectedSignalId, graph]);

  // 1-Click Cone Slicing Handlers
  const handleSliceFanin = useCallback(() => {
    const target = selectedNodeId ?? selectedEdgeId;
    if (!target) return;
    const cone = sliceFaninCone(graph, target, 1000);
    setActiveCone(cone);
  }, [selectedNodeId, selectedEdgeId, graph]);

  const handleSliceFanout = useCallback(() => {
    const target = selectedNodeId ?? selectedEdgeId;
    if (!target) return;
    const cone = sliceFanoutCone(graph, target);
    setActiveCone(cone);
  }, [selectedNodeId, selectedEdgeId, graph]);

  const handleClearSlice = useCallback(() => {
    setActiveCone(null);
  }, []);

  // Keyboard Shortcuts (F = Fan-in, O = Fan-out, Escape = Clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        handleSliceFanin();
      } else if (e.key === "o" || e.key === "O") {
        handleSliceFanout();
      } else if (e.key === "Escape") {
        handleClearSlice();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSliceFanin, handleSliceFanout, handleClearSlice]);

  // --------------------------------------------------------------------------
  // Main GPU-Accelerated Canvas Rendering Loop
  // --------------------------------------------------------------------------
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, width, height);

    // Save initial state for camera transformation
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw grid lines
    const gridSize = 40;
    const minGridX = Math.floor(-offsetX / scale / gridSize) * gridSize;
    const maxGridX = Math.ceil((width - offsetX) / scale / gridSize) * gridSize;
    const minGridY = Math.floor(-offsetY / scale / gridSize) * gridSize;
    const maxGridY = Math.ceil((height - offsetY) / scale / gridSize) * gridSize;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let x = minGridX; x <= maxGridX; x += gridSize) {
      ctx.moveTo(x, minGridY);
      ctx.lineTo(x, maxGridY);
    }
    for (let y = minGridY; y <= maxGridY; y += gridSize) {
      ctx.moveTo(minGridX, y);
      ctx.lineTo(maxGridX, y);
    }
    ctx.stroke();

    const isConeActive = activeCone !== null;

    // ------------------------------------------------------------------------
    // 1. Draw Edges / Nets (Manhattan Orthogonal Routing)
    // ------------------------------------------------------------------------
    for (const edge of graph.edges) {
      const inCone = isConeActive && activeCone.edgeIds.has(edge.id);
      const isDimmed = isConeActive && !inCone;
      const isSelected = selectedEdgeId === edge.id;
      const isHovered = hoveredEdgeId === edge.id;

      ctx.save();
      if (isDimmed) {
        ctx.globalAlpha = 0.12;
      }

      // Edge Color
      let strokeColor = edge.isBus ? "#38bdf8" : "#94a3b8";
      if (isSelected || isHovered) {
        strokeColor = "#00f0ff";
      } else if (inCone) {
        strokeColor = activeCone.isSlackViolated ? "#f43f5e" : "#10b981";
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 3 : edge.isBus ? 2 : 1.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      if (isSelected) {
        ctx.shadowColor = "rgba(0, 240, 255, 0.8)";
        ctx.shadowBlur = 10;
      }

      ctx.beginPath();
      if (edge.wirePoints.length > 0) {
        ctx.moveTo(edge.wirePoints[0].x, edge.wirePoints[0].y);
        for (let i = 1; i < edge.wirePoints.length; i++) {
          ctx.lineTo(edge.wirePoints[i].x, edge.wirePoints[i].y);
        }
      }
      ctx.stroke();

      // Bus slash width tag indicator '/[8]'
      if (edge.isBus && edge.wirePoints.length >= 2 && lodLevel !== "macro") {
        const p0 = edge.wirePoints[0];
        const p1 = edge.wirePoints[1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(midX - 4, midY + 5);
        ctx.lineTo(midX + 4, midY - 5);
        ctx.stroke();

        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = strokeColor;
        ctx.textAlign = "center";
        ctx.fillText(`${edge.width}`, midX, midY - 8);
      }

      // Live Signal Value Callout on Wires
      if (showLiveValues && lodLevel !== "macro" && edge.wirePoints.length >= 2) {
        const liveVal = liveValuesMap.get(edge.signalId) ?? liveValuesMap.get(edge.netName) ?? "-";
        const p0 = edge.wirePoints[0];
        const p1 = edge.wirePoints[1];
        const calloutX = (p0.x + p1.x) / 2;
        const calloutY = (p0.y + p1.y) / 2;

        const segX = edge.wirePoints.length > 2
          ? (edge.wirePoints[1].x + edge.wirePoints[2].x) / 2
          : calloutX;
        const segY = edge.wirePoints.length > 2
          ? (edge.wirePoints[1].y + edge.wirePoints[2].y) / 2
          : calloutY;

        ctx.fillStyle = "rgba(12, 16, 23, 0.85)";
        ctx.strokeStyle = isSelected ? "#00f0ff" : "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        const tagWidth = Math.max(34, liveVal.length * 6.5 + 8);
        ctx.beginPath();
        ctx.roundRect(segX - tagWidth / 2, segY - 9, tagWidth, 16, 3);
        ctx.fill();
        ctx.stroke();

        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = liveVal === "1" ? "#10b981" : liveVal === "0" ? "#64748b" : "#38bdf8";
        ctx.textAlign = "center";
        ctx.fillText(liveVal, segX, segY + 3);
      }

      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // 2. Draw Nodes (Ports, Registers, Operators, MUXes, Macro Modules)
    // ------------------------------------------------------------------------
    for (const node of graph.nodes) {
      const inCone = isConeActive && activeCone.nodeIds.has(node.id);
      const isCritical = isConeActive && activeCone.criticalPathNodeIds.includes(node.id);
      const isDimmed = isConeActive && !inCone;
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;

      ctx.save();
      if (isDimmed) {
        ctx.globalAlpha = 0.12;
      }

      // Determine Node Color Scheme by Kind
      let bgColor = "#151b23";
      let borderColor = "#30363d";
      let accentColor = "#94a3b8";

      switch (node.kind) {
        case "port_in":
        case "port_out":
          bgColor = "#0f172a";
          borderColor = isSelected ? "#00f0ff" : "#1e293b";
          accentColor = node.kind === "port_in" ? "#38bdf8" : "#10b981";
          break;
        case "register":
          bgColor = "#1e1b4b";
          borderColor = isSelected ? "#00f0ff" : "#4338ca";
          accentColor = "#818cf8";
          break;
        case "operator":
          bgColor = "#14251f";
          borderColor = isSelected ? "#00f0ff" : "#166534";
          accentColor = "#34d399";
          break;
        case "mux":
          bgColor = "#261b2c";
          borderColor = isSelected ? "#00f0ff" : "#701a75";
          accentColor = "#c084fc";
          break;
        case "gate":
          bgColor = "#251818";
          borderColor = isSelected ? "#00f0ff" : "#831843";
          accentColor = "#f472b6";
          break;
        case "module":
          bgColor = "#1c2230";
          borderColor = isSelected ? "#00f0ff" : "#3b82f6";
          accentColor = "#60a5fa";
          break;
      }

      if (isCritical) {
        borderColor = "#f43f5e";
        bgColor = "rgba(244, 63, 94, 0.15)";
      } else if (inCone) {
        borderColor = "#10b981";
      }

      // Selection Halo
      if (isSelected || isHovered) {
        ctx.shadowColor = "rgba(0, 240, 255, 0.6)";
        ctx.shadowBlur = 14;
        borderColor = "#00f0ff";
      }

      // Draw Node Body
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      if (node.kind === "mux") {
        // Trapezoid shape for Multiplexers
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.x + node.width, node.y + 16);
        ctx.lineTo(node.x + node.width, node.y + node.height - 16);
        ctx.lineTo(node.x, node.y + node.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Rounded Rectangle
        ctx.beginPath();
        ctx.roundRect(node.x, node.y, node.width, node.height, 6);
        ctx.fill();
        ctx.stroke();
      }

      // Clock input triangle for registers
      if (node.kind === "register") {
        const clkPort = node.inputs.find((p) => p.isClock);
        if (clkPort && clkPort.offsetX !== undefined && clkPort.offsetY !== undefined) {
          const cx = node.x + clkPort.offsetX;
          const cy = node.y + clkPort.offsetY;
          ctx.fillStyle = "#818cf8";
          ctx.beginPath();
          ctx.moveTo(cx - 5, cy);
          ctx.lineTo(cx, cy - 8);
          ctx.lineTo(cx + 5, cy);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Node Header Title
      ctx.font = "bold 11px JetBrains Mono, monospace";
      ctx.fillStyle = isSelected ? "#00f0ff" : isCritical ? "#f43f5e" : "#f1f5f9";
      ctx.textAlign = "center";
      const titleY = node.sublabel ? node.y + 16 : node.y + node.height / 2 + 4;
      ctx.fillText(node.label, node.x + node.width / 2, titleY);

      // Node Sublabel
      if (node.sublabel && lodLevel !== "macro") {
        ctx.font = "9px Inter, sans-serif";
        ctx.fillStyle = accentColor;
        ctx.textAlign = "center";
        ctx.fillText(node.sublabel, node.x + node.width / 2, node.y + 30);
      }

      // Gate / Primitive Level Details (LOD 3: Cranelift machine op & delay)
      if (lodLevel === "gate" && (node.craneliftOp || node.delayPs > 0)) {
        ctx.font = "8px JetBrains Mono, monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        const infoText = node.craneliftOp ? `jit: ${node.craneliftOp}` : `${node.delayPs} ps`;
        ctx.fillText(infoText, node.x + node.width / 2, node.y + node.height - 8);
      }

      // Draw Port Pins
      if (lodLevel !== "macro") {
        ctx.fillStyle = accentColor;
        // Inputs (Left)
        for (const pin of node.inputs) {
          if (pin.offsetX === undefined || pin.offsetY === undefined) continue;
          ctx.beginPath();
          ctx.arc(node.x + pin.offsetX, node.y + pin.offsetY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // Outputs (Right)
        for (const pin of node.outputs) {
          if (pin.offsetX === undefined || pin.offsetY === undefined) continue;
          ctx.beginPath();
          ctx.arc(node.x + pin.offsetX, node.y + pin.offsetY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    ctx.restore(); // Restore camera transformation

    // ------------------------------------------------------------------------
    // 3. Draw Minimap (Bottom-Right)
    // ------------------------------------------------------------------------
    if (showMinimap) {
      const mapWidth = 180;
      const mapHeight = 110;
      const mapX = width - mapWidth - 14;
      const mapY = height - mapHeight - 14;

      ctx.fillStyle = "rgba(12, 16, 23, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mapX, mapY, mapWidth, mapHeight, 6);
      ctx.fill();
      ctx.stroke();

      const graphW = Math.max(graph.bounds.width, 1);
      const graphH = Math.max(graph.bounds.height, 1);
      const miniScaleX = (mapWidth - 16) / graphW;
      const miniScaleY = (mapHeight - 16) / graphH;
      const miniScale = Math.min(miniScaleX, miniScaleY);

      // Draw mini nodes
      for (const node of graph.nodes) {
        const nx = mapX + 8 + node.x * miniScale;
        const ny = mapY + 8 + node.y * miniScale;
        const nw = Math.max(2, node.width * miniScale);
        const nh = Math.max(2, node.height * miniScale);
        ctx.fillStyle = node.id === selectedNodeId ? "#00f0ff" : "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(nx, ny, nw, nh);
      }

      // Draw mini camera viewport box
      const camX = mapX + 8 + (-offsetX / scale) * miniScale;
      const camY = mapY + 8 + (-offsetY / scale) * miniScale;
      const camW = (width / scale) * miniScale;
      const camH = (height / scale) * miniScale;

      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(
        Math.max(mapX + 2, camX),
        Math.max(mapY + 2, camY),
        Math.min(mapWidth - 4, camW),
        Math.min(mapHeight - 4, camH)
      );
    }
  }, [
    graph,
    offsetX,
    offsetY,
    scale,
    selectedNodeId,
    selectedEdgeId,
    hoveredNodeId,
    hoveredEdgeId,
    activeCone,
    liveValuesMap,
    showLiveValues,
    showMinimap,
    lodLevel
  ]);

  // Handle Resize & Trigger Render
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

  // --------------------------------------------------------------------------
  // Canvas Mouse Events: Pan, Zoom, Hit-Testing, Selection
  // --------------------------------------------------------------------------
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      // Left click or middle click
      const { x, y } = getCanvasCoords(e);

      // Hit-test nodes (reverse order for top-first)
      let hitNode: SchematicNode | null = null;
      for (let i = graph.nodes.length - 1; i >= 0; i--) {
        const node = graph.nodes[i];
        if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
          hitNode = node;
          break;
        }
      }

      if (hitNode) {
        setSelectedNodeId(hitNode.id);
        setSelectedEdgeId(null);

        // Bidirectional Cross-Probing
        const relatedSignal = hitNode.outputs[0]?.name ?? hitNode.inputs[0]?.name ?? hitNode.label;
        onSelectSignal(relatedSignal);
        if (onJumpToCode && hitNode.sourceSpan) {
          onJumpToCode(hitNode.sourceSpan.lineStart, hitNode.sourceSpan.lineEnd);
        }
      } else {
        // Hit-test edges
        let hitEdge: SchematicEdge | null = null;
        for (const edge of graph.edges) {
          for (let i = 0; i < edge.wirePoints.length - 1; i++) {
            const p1 = edge.wirePoints[i];
            const p2 = edge.wirePoints[i + 1];
            const dist = distanceToSegment({ x, y }, p1, p2);
            if (dist < 6) {
              hitEdge = edge;
              break;
            }
          }
          if (hitEdge) break;
        }

        if (hitEdge) {
          setSelectedEdgeId(hitEdge.id);
          setSelectedNodeId(null);
          onSelectSignal(hitEdge.signalId);
        } else {
          // Deselect or start panning
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setIsPanning(true);
          setPanStart({ x: e.clientX, y: e.clientY });
          setPanStartOffset({ x: offsetX, y: offsetY });
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffsetX(panStartOffset.x + dx);
      setOffsetY(panStartOffset.y + dy);
      return;
    }

    const { x, y } = getCanvasCoords(e);

    // Hover testing for nodes
    let hitNode: SchematicNode | null = null;
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const node = graph.nodes[i];
      if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
        hitNode = node;
        break;
      }
    }
    setHoveredNodeId(hitNode ? hitNode.id : null);

    // Hover testing for edges
    if (!hitNode) {
      let hitEdge: SchematicEdge | null = null;
      for (const edge of graph.edges) {
        for (let i = 0; i < edge.wirePoints.length - 1; i++) {
          const p1 = edge.wirePoints[i];
          const p2 = edge.wirePoints[i + 1];
          const dist = distanceToSegment({ x, y }, p1, p2);
          if (dist < 5) {
            hitEdge = edge;
            break;
          }
        }
        if (hitEdge) break;
      }
      setHoveredEdgeId(hitEdge ? hitEdge.id : null);
    } else {
      setHoveredEdgeId(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Mouse wheel smooth zoom centered on pointer
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.2), 3.5);

    // Keep point under mouse fixed
    const newOffsetX = mouseCanvasX - (mouseCanvasX - offsetX) * (newScale / scale);
    const newOffsetY = mouseCanvasY - (mouseCanvasY - offsetY) * (newScale / scale);

    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // Active hover node metadata for tooltip
  const activeHoverNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return graph.nodes.find((n) => n.id === hoveredNodeId) ?? null;
  }, [hoveredNodeId, graph.nodes]);

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
      {/* Top Schematic Toolbar */}
      <div
        style={{
          height: 36,
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
            Axiom Schematic DAG ({graph.nodes.length} cells, {graph.edges.length} nets)
          </span>

          {/* LOD Badge */}
          <div
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 3,
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--accent-cyan)",
              border: "1px solid var(--border-subtle)",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <Layers size={10} />
            <span>LOD: {lodLevel} ({(scale * 100).toFixed(0)}%)</span>
          </div>

          {/* Live Values Toggle */}
          <button
            onClick={() => setShowLiveValues(!showLiveValues)}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: showLiveValues ? "rgba(16, 185, 129, 0.15)" : "var(--bg-tertiary)",
              color: showLiveValues ? "var(--accent-emerald)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <Activity size={12} />
            <span>Wire Values</span>
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: showMinimap ? "rgba(56, 189, 248, 0.15)" : "var(--bg-tertiary)",
              color: showMinimap ? "var(--accent-cyan)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <MapPin size={12} />
            <span>Minimap</span>
          </button>
        </div>

        {/* Action Controls: 1-Click Cone Slicing, Zoom, Fit */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Slice Fanin Cone Button */}
          <button
            onClick={handleSliceFanin}
            disabled={!selectedNodeId && !selectedEdgeId}
            title="Extract combinational fan-in logic cone (HotKey: F)"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeCone?.isFanin ? "var(--accent-blue)" : "var(--bg-tertiary)",
              color: activeCone?.isFanin ? "#fff" : (!selectedNodeId && !selectedEdgeId) ? "var(--text-muted)" : "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: (!selectedNodeId && !selectedEdgeId) ? 0.5 : 1,
              cursor: (!selectedNodeId && !selectedEdgeId) ? "not-allowed" : "pointer"
            }}
          >
            <Filter size={11} />
            <span>Fan-In Cone [F]</span>
          </button>

          {/* Slice Fanout Tree Button */}
          <button
            onClick={handleSliceFanout}
            disabled={!selectedNodeId && !selectedEdgeId}
            title="Extract driven load fan-out tree (HotKey: O)"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeCone && !activeCone.isFanin ? "var(--accent-blue)" : "var(--bg-tertiary)",
              color: activeCone && !activeCone.isFanin ? "#fff" : (!selectedNodeId && !selectedEdgeId) ? "var(--text-muted)" : "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: (!selectedNodeId && !selectedEdgeId) ? 0.5 : 1,
              cursor: (!selectedNodeId && !selectedEdgeId) ? "not-allowed" : "pointer"
            }}
          >
            <Zap size={11} />
            <span>Fan-Out [O]</span>
          </button>

          {/* Clear Cone Slice */}
          {activeCone && (
            <button
              onClick={handleClearSlice}
              title="Clear active cone slice (Esc)"
              style={{
                fontSize: 11,
                padding: "3px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(244, 63, 94, 0.15)",
                color: "#f43f5e",
                border: "1px solid #f43f5e",
                display: "flex",
                alignItems: "center",
                gap: 2
              }}
            >
              <X size={11} />
              <span>Clear</span>
            </button>
          )}

          <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)", margin: "0 4px" }} />

          {/* Zoom Buttons */}
          <button
            onClick={() => setScale((s) => Math.min(s * 1.2, 3.5))}
            style={{ padding: 4, backgroundColor: "var(--bg-tertiary)", borderRadius: 3, border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s / 1.2, 0.2))}
            style={{ padding: 4, backgroundColor: "var(--bg-tertiary)", borderRadius: 3, border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={fitToScreen}
            style={{ padding: 4, backgroundColor: "var(--bg-tertiary)", borderRadius: 3, border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
            title="Fit to Screen"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          cursor: isPanning ? "grabbing" : "crosshair"
        }}
      />

      {/* Slicer HUD Telemetry Card (Visible when a cone is active) */}
      {activeCone && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 14,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            border: `1px solid ${activeCone.isSlackViolated ? "#f43f5e" : "#10b981"}`,
            borderRadius: 6,
            padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 260
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={13} color={activeCone.isSlackViolated ? "#f43f5e" : "#10b981"} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
                {activeCone.isFanin ? "Fan-In Logic Cone" : "Fan-Out Driven Tree"}
              </span>
            </div>
            <button
              onClick={handleClearSlice}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Target: <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{activeCone.targetId}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Logic Depth</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                {activeCone.maxDepth} levels
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Path Delay</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                {activeCone.totalDelayPs} ps
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Setup Slack</div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: activeCone.isSlackViolated ? "#f43f5e" : "#10b981",
                  fontFamily: "var(--font-mono)"
                }}
              >
                {activeCone.slackPs >= 0 ? `+${activeCone.slackPs} ps` : `${activeCone.slackPs} ps`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Status</div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  color: activeCone.isSlackViolated ? "#f43f5e" : "#10b981"
                }}
              >
                {activeCone.isSlackViolated ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                <span>{activeCone.isSlackViolated ? "VIOLATED" : "MET"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rich Node Hover Tooltip */}
      {activeHoverNode && (
        <div
          style={{
            position: "fixed",
            left: mousePos.x + 14,
            top: mousePos.y + 14,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            border: "1px solid var(--accent-cyan)",
            borderRadius: 6,
            padding: "8px 12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
            zIndex: 30,
            fontSize: 11
          }}
        >
          <div style={{ fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)", marginBottom: 2 }}>
            {activeHoverNode.label}
          </div>
          {activeHoverNode.sublabel && (
            <div style={{ color: "var(--accent-cyan)", fontSize: 10, marginBottom: 4 }}>
              {activeHoverNode.sublabel}
            </div>
          )}
          {activeHoverNode.expressionText && (
            <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10, marginBottom: 4 }}>
              {activeHoverNode.expressionText}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 10 }}>
            <span>Delay: {activeHoverNode.delayPs} ps</span>
            <span>Power: {activeHoverNode.dynamicPowerMw} mW</span>
            {activeHoverNode.craneliftOp && <span>JIT: {activeHoverNode.craneliftOp}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper: Calculate distance from point P to line segment AB
function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const distSq = (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y);
    return Math.sqrt(distSq);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY));
}
