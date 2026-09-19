import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Clock,
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
import { useTranslation } from "../i18n";

interface SchematicViewerProps {
  state: SimulationState;
  activeDesignId: string;
  selectedSignalId?: string | null;
  onSelectSignal: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
}

export type GateType =
  | "and"
  | "nand"
  | "or"
  | "nor"
  | "xor"
  | "xnor"
  | "not"
  | "buf"
  | "mux"
  | "register"
  | "port_in"
  | "port_out"
  | "operator"
  | "module";

export const SchematicViewer: React.FC<SchematicViewerProps> = ({
  state,
  activeDesignId,
  selectedSignalId,
  onSelectSignal,
  onJumpToCode
}) => {
  const { t } = useTranslation();
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
  const [hideClockNets, setHideClockNets] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth > 768;
    }
    return false;
  });

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
    const width = containerRef.current.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 800);
    const height = containerRef.current.clientHeight || (typeof window !== "undefined" ? window.innerHeight - 100 : 600);

    const isMobileViewport = width <= 768;
    const graphWidth = graph.bounds.width || 1000;
    const graphHeight = graph.bounds.height || 220;

    if (isMobileViewport) {
      // Mobile portrait: comfortable scale so gate shapes and wire probes are legible and clear
      const targetScale = Math.min(Math.max((height - 140) / (graphHeight * 1.8), 0.68), 0.85);
      setScale(targetScale);
      setOffsetX(24); // Start cleanly from left with padding, never negative
      const visibleH = height - 42;
      setOffsetY(Math.max(16, (visibleH - graphHeight * targetScale) / 2 + 10));
    } else {
      const scaleX = (width - 120) / graphWidth;
      const scaleY = (height - 120) / graphHeight;
      const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.2);

      setScale(newScale);
      setOffsetX(Math.max(24, (width - graphWidth * newScale) / 2));
      setOffsetY(Math.max(24, (height - graphHeight * newScale) / 2));
    }
  }, [graph]);

  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Handle external signal selection (e.g. from Waveform or Sidebar)
  useEffect(() => {
    if (!selectedSignalId) return;

    // Find node or edge matching this signal
    const matchingNode = graph.nodes.find(
      (n) =>
        n.id === selectedSignalId ||
        n.label.startsWith(selectedSignalId) ||
        n.inputs.some((p) => p.name === selectedSignalId) ||
        n.outputs.some((p) => p.name === selectedSignalId)
    );
    const matchingEdge = graph.edges.find(
      (e) => e.signalId === selectedSignalId || e.netName.startsWith(selectedSignalId)
    );

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
    // 1. Draw Edges / Nets (Manhattan Orthogonal Routing & Hover Glow)
    // ------------------------------------------------------------------------
    for (const edge of graph.edges) {
      const inCone = isConeActive && activeCone.edgeIds.has(edge.id);
      const isDimmed = isConeActive && !inCone;
      const isSelected = selectedEdgeId === edge.id;
      const isHovered = hoveredEdgeId === edge.id;
      const isConnectedToHoveredNode =
        hoveredNodeId !== null &&
        (edge.sourceNodeId === hoveredNodeId || edge.targetNodeId === hoveredNodeId);

      ctx.save();
      if (isDimmed) {
        ctx.globalAlpha = 0.12;
      }

      // Edge Color & Glow
      let strokeColor = edge.isBus ? "#38bdf8" : "#94a3b8";
      if (isSelected || isHovered || isConnectedToHoveredNode) {
        strokeColor = "#00f0ff";
      } else if (inCone) {
        strokeColor = activeCone.isSlackViolated ? "#f43f5e" : "#10b981";
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected || isConnectedToHoveredNode ? 3 : isHovered ? 2.5 : edge.isBus ? 2 : 1.3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      if (isSelected || isHovered || isConnectedToHoveredNode) {
        ctx.shadowColor = "rgba(0, 240, 255, 0.85)";
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

        const segX =
          edge.wirePoints.length > 2
            ? (edge.wirePoints[1].x + edge.wirePoints[2].x) / 2
            : calloutX;
        const segY =
          edge.wirePoints.length > 2
            ? (edge.wirePoints[1].y + edge.wirePoints[2].y) / 2
            : calloutY;

        ctx.fillStyle = "rgba(12, 16, 23, 0.9)";
        ctx.strokeStyle =
          isSelected || isConnectedToHoveredNode ? "#00f0ff" : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        const tagWidth = Math.max(34, liveVal.length * 6.5 + 8);
        ctx.beginPath();
        ctx.roundRect(segX - tagWidth / 2, segY - 9, tagWidth, 16, 3);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 9px JetBrains Mono, monospace";
        ctx.fillStyle = liveVal === "1" ? "#10b981" : liveVal === "0" ? "#94a3b8" : "#38bdf8";
        ctx.textAlign = "center";
        ctx.fillText(liveVal, segX, segY + 3);
      }

      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // 2. Draw Nodes (Vivado / IEEE Standard Gate Shapes)
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

      // Visual Scheme & Gate Classification
      const visuals = getGateVisuals(node, isSelected, isHovered, inCone, isCritical);

      // Selection / Hover Glow
      if (isSelected || isHovered) {
        ctx.shadowColor = "rgba(0, 240, 255, 0.85)";
        ctx.shadowBlur = 14;
      }

      ctx.fillStyle = visuals.bgColor;
      ctx.strokeStyle = visuals.borderColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      // Draw the Authentic Vivado / IEEE Symbol Shape
      drawNodeShape(ctx, node, visuals.gateType, node.x, node.y, node.width, node.height);

      // Clock input notch for sequential registers
      if (visuals.gateType === "register") {
        const clkPort = node.inputs.find((p) => p.isClock);
        if (clkPort && clkPort.offsetX !== undefined && clkPort.offsetY !== undefined) {
          const cx = node.x + clkPort.offsetX;
          const cy = node.y + clkPort.offsetY;
          ctx.fillStyle = visuals.accentColor;
          ctx.beginPath();
          ctx.moveTo(cx - 5, cy);
          ctx.lineTo(cx, cy - 8);
          ctx.lineTo(cx + 5, cy);
          ctx.closePath();
          ctx.fill();
        }
      }

      // ----------------------------------------------------------------------
      // Labels & Text Display (Vivado Standard)
      // ----------------------------------------------------------------------

      // 1. Instance Name printed above the gate (Vivado style: inv1, and1, or1)
      if (visuals.gateType !== "port_in" && visuals.gateType !== "port_out") {
        ctx.font = "bold 10px JetBrains Mono, monospace";
        ctx.fillStyle = isSelected || isHovered ? "#00f0ff" : "rgba(226, 232, 240, 0.85)";
        ctx.textAlign = "center";
        ctx.fillText(visuals.instanceName, node.x + node.width / 2, node.y - 6);
      }

      // 2. Interior Symbol / Port Name
      if (visuals.gateType === "port_in" || visuals.gateType === "port_out") {
        ctx.font = "bold 11px JetBrains Mono, monospace";
        ctx.fillStyle = isSelected || isHovered ? "#00f0ff" : "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x + (node.width - 4) / 2, node.y + node.height / 2 + 4);
      } else if (visuals.gateType === "mux" || visuals.gateType === "register") {
        // Centered label for complex sequential/data blocks
        ctx.font = "bold 10px JetBrains Mono, monospace";
        ctx.fillStyle = isSelected || isHovered ? "#00f0ff" : visuals.accentColor;
        ctx.textAlign = "center";
        ctx.fillText(visuals.ieeeSymbol, node.x + node.width / 2, node.y + node.height / 2 + 4);

        // MUX pin indices 0 / 1
        if (visuals.gateType === "mux") {
          ctx.font = "bold 8px JetBrains Mono, monospace";
          ctx.fillStyle = "#94a3b8";
          ctx.textAlign = "left";
          ctx.fillText("0", node.x + 8, node.y + 14);
          ctx.fillText("1", node.x + 8, node.y + node.height - 10);
        } else if (visuals.gateType === "register") {
          ctx.font = "bold 8px JetBrains Mono, monospace";
          ctx.fillStyle = "#94a3b8";
          ctx.textAlign = "left";
          ctx.fillText("D", node.x + 7, node.y + 16);
          ctx.textAlign = "right";
          ctx.fillText("Q", node.x + node.width - 7, node.y + 16);
        }
      } else if (visuals.gateType === "operator" || visuals.gateType === "module") {
        // General Operators / Modules
        ctx.font = "bold 11px JetBrains Mono, monospace";
        ctx.fillStyle = isSelected ? "#00f0ff" : isCritical ? "#f43f5e" : "#f1f5f9";
        ctx.textAlign = "center";
        const titleY = node.sublabel ? node.y + 16 : node.y + node.height / 2 + 4;
        ctx.fillText(node.label, node.x + node.width / 2, titleY);
      }
      // Note: Standard logic gates (and, nand, or, nor, xor, xnor, not, buf) have clean,
      // uncluttered interiors and no text below them. Boolean equations (e.g. w4 = ~B)
      // and JIT operations (jit: band) are presented on hover/selection tooltip.

      // 3. Port Terminal Dots
      if (lodLevel !== "macro") {
        ctx.fillStyle = visuals.accentColor;
        // Inputs (Left)
        for (const pin of node.inputs) {
          if (pin.offsetX === undefined || pin.offsetY === undefined) continue;
          ctx.beginPath();
          ctx.arc(node.x + pin.offsetX, node.y + pin.offsetY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Outputs (Right)
        for (const pin of node.outputs) {
          if (pin.offsetX === undefined || pin.offsetY === undefined) continue;
          ctx.beginPath();
          ctx.arc(node.x + pin.offsetX, node.y + pin.offsetY, 2.5, 0, Math.PI * 2);
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
      const isMobile = width <= 768;
      const mapWidth = isMobile ? 120 : 180;
      const mapHeight = isMobile ? 70 : 110;
      const mapX = width - mapWidth - (isMobile ? 10 : 14);
      const mapY = height - mapHeight - (isMobile ? 10 : 14);

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
  // Touch Gestures for Mobile Panning and Pinch-to-Zoom
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    isPinch: boolean;
    startPinchDist: number;
    startScale: number;
  } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      touchStateRef.current = {
        startX: t.clientX - rect.left,
        startY: t.clientY - rect.top,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        isPinch: false,
        startPinchDist: 0,
        startScale: scale
      };
      setIsPanning(true);
    } else if (e.touches.length === 2) {
      const rect = e.currentTarget.getBoundingClientRect();
      const t0 = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      const t1 = { x: e.touches[1].clientX - rect.left, y: e.touches[1].clientY - rect.top };
      const dist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
      touchStateRef.current = {
        startX: (t0.x + t1.x) / 2,
        startY: (t0.y + t1.y) / 2,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        isPinch: true,
        startPinchDist: dist,
        startScale: scale
      };
      setIsPanning(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStateRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();

    if (!touchStateRef.current.isPinch && e.touches.length === 1) {
      const t = e.touches[0];
      const curX = t.clientX - rect.left;
      const curY = t.clientY - rect.top;
      const dx = curX - touchStateRef.current.startX;
      const dy = curY - touchStateRef.current.startY;
      setOffsetX(touchStateRef.current.startOffsetX + dx);
      setOffsetY(touchStateRef.current.startOffsetY + dy);
    } else if (e.touches.length === 2 && touchStateRef.current.startPinchDist > 0) {
      const t0 = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      const t1 = { x: e.touches[1].clientX - rect.left, y: e.touches[1].clientY - rect.top };
      const dist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
      const ratio = dist / touchStateRef.current.startPinchDist;
      const newScale = Math.min(Math.max(touchStateRef.current.startScale * ratio, 0.2), 3.0);
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (touchStateRef.current && !touchStateRef.current.isPinch && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const endX = t.clientX - rect.left;
      const endY = t.clientY - rect.top;
      const distMoved = Math.hypot(endX - touchStateRef.current.startX, endY - touchStateRef.current.startY);

      // Tap to select
      if (distMoved < 8) {
        const graphX = (endX - offsetX) / scale;
        const graphY = (endY - offsetY) / scale;

        let hitNode: SchematicNode | null = null;
        for (let i = graph.nodes.length - 1; i >= 0; i--) {
          const n = graph.nodes[i];
          if (graphX >= n.x && graphX <= n.x + n.width && graphY >= n.y && graphY <= n.y + n.height) {
            hitNode = n;
            break;
          }
        }

        if (hitNode) {
          setSelectedNodeId(hitNode.id);
          setSelectedEdgeId(null);
          onSelectSignal(hitNode.id);
        } else {
          setSelectedNodeId(null);
        }
      }
    }
    setIsPanning(false);
    touchStateRef.current = null;
  };

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
          if (dist < 6) {
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

  // Active hover/selected node metadata for tooltip
  const activeHoverNode = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId;
    if (!targetId) return null;
    return graph.nodes.find((n) => n.id === targetId) ?? null;
  }, [hoveredNodeId, selectedNodeId, graph.nodes]);

  // Active hover edge metadata for tooltip
  const activeHoverEdge = useMemo(() => {
    if (!hoveredEdgeId || hoveredNodeId || selectedNodeId) return null;
    return graph.edges.find((e) => e.id === hoveredEdgeId) ?? null;
  }, [hoveredEdgeId, hoveredNodeId, selectedNodeId, graph.edges]);

  // Detailed Gate Information for Vivado Inspector Card
  const activeGateDetails = useMemo(() => {
    if (!activeHoverNode) return null;
    return getGateDetailedInfo(activeHoverNode, graph, liveValuesMap);
  }, [activeHoverNode, graph, liveValuesMap]);

  // Viewport bounds calculation for floating tooltip
  const tooltipPos = useMemo(() => {
    const maxX = typeof window !== "undefined" ? window.innerWidth - 350 : 800;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 340 : 600;

    if (hoveredNodeId) {
      return {
        x: mousePos.x > maxX ? Math.max(12, mousePos.x - 330) : mousePos.x + 16,
        y: mousePos.y > maxY ? Math.max(12, mousePos.y - 280) : mousePos.y + 16
      };
    }

    if (selectedNodeId) {
      const node = graph.nodes.find((n) => n.id === selectedNodeId);
      if (node && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const screenX = rect.left + node.x * scale + offsetX;
        const screenY = rect.top + node.y * scale + offsetY;
        return {
          x: Math.min(Math.max(12, screenX + node.width * scale + 14), maxX),
          y: Math.min(Math.max(48, screenY), maxY)
        };
      }
    }

    return { x: 20, y: 50 };
  }, [mousePos, hoveredNodeId, selectedNodeId, graph.nodes, scale, offsetX, offsetY]);

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
          height: 26,
          minHeight: 26,
          flexShrink: 0,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          zIndex: 10,
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          scrollbarWidth: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            {`${graph.nodes.length} Cells • ${graph.edges.length} Nets`}
          </span>

          {/* LOD Badge */}
          <div
            style={{
              fontSize: 9.5,
              padding: "1px 5px",
              borderRadius: 3,
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--accent-cyan)",
              border: "1px solid var(--border-subtle)",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexShrink: 0,
              whiteSpace: "nowrap"
            }}
          >
            <Layers size={9} />
            <span>LOD: {lodLevel} ({(scale * 100).toFixed(0)}%)</span>
          </div>

          {/* Live Values Toggle */}
          <button
            onClick={() => setShowLiveValues(!showLiveValues)}
            style={{
              fontSize: 10.5,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: showLiveValues ? "rgba(16, 185, 129, 0.15)" : "var(--bg-tertiary)",
              color: showLiveValues ? "var(--accent-emerald)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap"
            }}
          >
            <Activity size={11} />
            <span>{t("schematic.liveValues")}</span>
          </button>

          {/* Clock Nets Toggle */}
          <button
            onClick={() => setHideClockNets(!hideClockNets)}
            style={{
              fontSize: 10.5,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: hideClockNets ? "rgba(245, 158, 11, 0.15)" : "var(--bg-tertiary)",
              color: hideClockNets ? "var(--accent-amber)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap"
            }}
            title={hideClockNets ? t("schematic.showClockNets") : t("schematic.hideClockNets")}
          >
            <Clock size={11} />
            <span>{hideClockNets ? "All Nets" : "No Clks"}</span>
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            style={{
              fontSize: 10.5,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: showMinimap ? "rgba(56, 189, 248, 0.15)" : "var(--bg-tertiary)",
              color: showMinimap ? "var(--accent-cyan)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap"
            }}
          >
            <MapPin size={11} />
            <span>{t("schematic.minimap")}</span>
          </button>
        </div>

        {/* Action Controls: 1-Click Cone Slicing, Zoom, Fit */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 6, whiteSpace: "nowrap" }}>
          {/* Slice Fanin Cone Button */}
          {(typeof window === "undefined" || window.innerWidth > 768 || selectedNodeId || selectedEdgeId) && (
            <button
              onClick={handleSliceFanin}
              disabled={!selectedNodeId && !selectedEdgeId}
              title={t("schematic.fanin")}
              className="btn btn-secondary"
              style={{
                fontSize: 10.5,
                padding: "2px 6px",
                display: "flex",
                alignItems: "center",
                gap: 3,
                opacity: !selectedNodeId && !selectedEdgeId ? 0.5 : 1,
                cursor: !selectedNodeId && !selectedEdgeId ? "not-allowed" : "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
            >
              <Filter size={10} />
              <span>Cone [F]</span>
            </button>
          )}

          {/* Clear Cone Slice */}
          {activeCone && (
            <button
              onClick={handleClearSlice}
              title="Clear active cone slice (Esc)"
              className="btn btn-danger"
              style={{
                fontSize: 10.5,
                padding: "2px 5px",
                display: "flex",
                alignItems: "center",
                gap: 2,
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              <X size={10} />
              <span>{t("schematic.clearCone")}</span>
            </button>
          )}

          <div style={{ width: 1, height: 14, backgroundColor: "var(--border-subtle)", margin: "0 2px", flexShrink: 0 }} />

          {/* Zoom Buttons */}
          <button
            onClick={() => setScale((s) => Math.min(s * 1.25, 3.5))}
            className="btn-icon"
            style={{
              padding: "2px 5px",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: 3,
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0
            }}
            title={t("schematic.zoomIn")}
          >
            <ZoomIn size={11} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s / 1.25, 0.2))}
            className="btn-icon"
            style={{
              padding: "2px 5px",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: 3,
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0
            }}
            title={t("schematic.zoomOut")}
          >
            <ZoomOut size={11} />
          </button>
          <button
            onClick={fitToScreen}
            className="btn btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              color: "var(--accent-cyan)",
              fontSize: 10.5,
              fontWeight: 600,
              flexShrink: 0
            }}
            title={t("schematic.fitScreen")}
          >
            <Maximize2 size={11} />
            <span>{t("schematic.fitScreen")}</span>
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          setIsPanning(false);
          touchStateRef.current = null;
        }}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          cursor: isPanning ? "grabbing" : "crosshair",
          touchAction: "none"
        }}
      />

      {/* Slicer HUD Telemetry Card (Visible when a cone is active) */}
      {activeCone && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 14,
            backgroundColor: "rgba(15, 23, 42, 0.94)",
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

      {/* Rich Vivado-Grade Gate Inspector Tooltip */}
      {activeHoverNode && activeGateDetails && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y,
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            border: "1px solid var(--accent-cyan)",
            borderRadius: 6,
            padding: "10px 14px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            pointerEvents: "none",
            zIndex: 30,
            width: 320,
            fontSize: 11
          }}
        >
          {/* Header: Primitive Badge + Instance Name */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 3,
                  backgroundColor: activeGateDetails.badgeBg,
                  color: activeGateDetails.badgeColor,
                  border: `1px solid ${activeGateDetails.badgeColor}`
                }}
              >
                {activeGateDetails.badge}
              </span>
              <span style={{ fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {activeGateDetails.instanceName}
              </span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {activeHoverNode.scope}.v:{activeHoverNode.sourceSpan?.lineStart || 1}
            </span>
          </div>

          {/* Sublabel / Boolean Expression & Live Evaluation */}
          {activeGateDetails.expression && (
            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                borderRadius: 4,
                padding: "6px 8px",
                marginBottom: 8,
                border: "1px solid rgba(255,255,255,0.06)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Boolean Equation
                </span>
                <span style={{ fontSize: 10, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {activeGateDetails.expression}
                </span>
              </div>
              {/* Live Signal Evaluation */}
              {activeGateDetails.liveEval && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#f1f5f9",
                    fontFamily: "var(--font-mono)",
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Live Eval:</span>
                  <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>
                    {activeGateDetails.liveEval}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pin Connectivity & Live State Table */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 9,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 4
              }}
            >
              Pin Connectivity & Live Logic
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-mono)" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left" }}>
                  <th style={{ padding: "2px 4px" }}>Pin</th>
                  <th style={{ padding: "2px 4px" }}>Dir</th>
                  <th style={{ padding: "2px 4px" }}>Net</th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {activeHoverNode.inputs.map((pin) => {
                  const edge = graph.edges.find(
                    (e) => e.targetNodeId === activeHoverNode.id && e.targetPortId === pin.id
                  );
                  const netName = edge ? edge.netName : pin.name;
                  const liveVal =
                    liveValuesMap.get(edge?.signalId ?? "") ??
                    liveValuesMap.get(netName) ??
                    liveValuesMap.get(`${activeHoverNode.scope}.${netName}`) ??
                    "-";
                  return (
                    <tr key={`in_${pin.id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "2px 4px", color: "var(--accent-cyan)" }}>{pin.name}</td>
                      <td style={{ padding: "2px 4px", color: "var(--text-muted)" }}>IN</td>
                      <td style={{ padding: "2px 4px", color: "#e2e8f0" }}>{netName}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right" }}>
                        <span
                          style={{
                            padding: "0 4px",
                            borderRadius: 2,
                            backgroundColor: liveVal === "1" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.05)",
                            color: liveVal === "1" ? "#10b981" : "#94a3b8",
                            fontWeight: 700
                          }}
                        >
                          {liveVal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {activeHoverNode.outputs.map((pin) => {
                  const edge = graph.edges.find(
                    (e) => e.sourceNodeId === activeHoverNode.id && e.sourcePortId === pin.id
                  );
                  const netName = edge ? edge.netName : pin.name;
                  const liveVal =
                    liveValuesMap.get(edge?.signalId ?? "") ??
                    liveValuesMap.get(netName) ??
                    liveValuesMap.get(`${activeHoverNode.scope}.${netName}`) ??
                    "-";
                  return (
                    <tr key={`out_${pin.id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "2px 4px", color: "var(--accent-emerald)" }}>{pin.name}</td>
                      <td style={{ padding: "2px 4px", color: "var(--text-muted)" }}>OUT</td>
                      <td style={{ padding: "2px 4px", color: "#e2e8f0" }}>{netName}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right" }}>
                        <span
                          style={{
                            padding: "0 4px",
                            borderRadius: 2,
                            backgroundColor: liveVal === "1" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.05)",
                            color: liveVal === "1" ? "#10b981" : "#94a3b8",
                            fontWeight: 700
                          }}
                        >
                          {liveVal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Physical Telemetry & Performance */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 6,
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              padding: 6,
              borderRadius: 4
            }}
          >
            <div>
              <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Delay (tpd)</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                {activeHoverNode.delayPs} ps
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Est. Power</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", fontFamily: "var(--font-mono)" }}>
                {activeHoverNode.dynamicPowerMw} mW
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-muted)" }}>JIT Op</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-emerald)", fontFamily: "var(--font-mono)" }}>
                {activeHoverNode.craneliftOp ? `jit: ${activeHoverNode.craneliftOp}` : "native_jit"}
              </div>
            </div>
          </div>

          {/* RTL Jump Hint */}
          <div style={{ marginTop: 6, fontSize: 9, color: "var(--text-muted)", textAlign: "center", fontStyle: "italic" }}>
            Click cell to cross-probe & jump to RTL line {activeHoverNode.sourceSpan?.lineStart || 1}
          </div>
        </div>
      )}

      {/* Wire / Edge Hover Tooltip */}
      {activeHoverEdge && !activeHoverNode && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y,
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            border: "1px solid #00f0ff",
            borderRadius: 6,
            padding: "8px 12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
            zIndex: 30,
            width: 240,
            fontSize: 11
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 3,
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                color: "#38bdf8",
                fontWeight: 700
              }}
            >
              NET / WIRE
            </span>
            <span style={{ fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {activeHoverEdge.netName}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
            <div>
              Driver: <span style={{ color: "#fff", fontFamily: "var(--font-mono)" }}>{activeHoverEdge.sourceNodeId}</span>
            </div>
            <div>
              Load: <span style={{ color: "#fff", fontFamily: "var(--font-mono)" }}>{activeHoverEdge.targetNodeId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span>Width: {activeHoverEdge.isBus ? `[${activeHoverEdge.width - 1}:0]` : "1-bit"}</span>
              <span>Delay: {activeHoverEdge.delayPs} ps</span>
              <span>
                Value:{" "}
                <strong
                  style={{
                    color:
                      (liveValuesMap.get(activeHoverEdge.signalId) ??
                        liveValuesMap.get(activeHoverEdge.netName)) === "1"
                        ? "#10b981"
                        : "#94a3b8"
                  }}
                >
                  {liveValuesMap.get(activeHoverEdge.signalId) ??
                    liveValuesMap.get(activeHoverEdge.netName) ??
                    "-"}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Geometry & Canvas Shape Drawing Functions (Vivado / IEEE Logic Gates)
// ----------------------------------------------------------------------------

function getGateVisuals(
  node: SchematicNode,
  isSelected: boolean,
  isHovered: boolean,
  inCone: boolean,
  isCritical: boolean
) {
  const kind = node.kind;
  const labelUpper = node.label.toUpperCase();
  const op = node.craneliftOp?.toLowerCase() ?? "";

  let gateType: GateType = "operator";
  let badge = "PRIMITIVE";
  let ieeeSymbol = "";
  let bgColor = "#151b23";
  let borderColor = "#30363d";
  let accentColor = "#94a3b8";

  if (kind === "port_in") {
    gateType = "port_in";
    badge = "INPUT PORT (IBUF)";
    bgColor = "#0f1d2e";
    borderColor = "#0284c7";
    accentColor = "#38bdf8";
  } else if (kind === "port_out") {
    gateType = "port_out";
    badge = "OUTPUT PORT (OBUF)";
    bgColor = "#0d241c";
    borderColor = "#059669";
    accentColor = "#10b981";
  } else if (kind === "register") {
    gateType = "register";
    badge = "FLIP-FLOP (FDRE)";
    ieeeSymbol = "FDRE";
    bgColor = "#1b1938";
    borderColor = "#4f46e5";
    accentColor = "#818cf8";
  } else if (kind === "mux" || labelUpper.includes("MUX")) {
    gateType = "mux";
    badge = "MULTIPLEXER (MUX)";
    ieeeSymbol = "MUX";
    bgColor = "#25182e";
    borderColor = "#9333ea";
    accentColor = "#c084fc";
  } else if (labelUpper.startsWith("NAND") || op === "bnand") {
    gateType = "nand";
    badge = "NAND2 GATE";
    ieeeSymbol = "";
    bgColor = "#10241b";
    borderColor = "#059669";
    accentColor = "#34d399";
  } else if (labelUpper.startsWith("AND") || op === "band" || labelUpper.includes("&")) {
    gateType = "and";
    badge = "AND2 GATE";
    ieeeSymbol = "";
    bgColor = "#10241b";
    borderColor = "#059669";
    accentColor = "#34d399";
  } else if (labelUpper.startsWith("XNOR") || op === "bxnor") {
    gateType = "xnor";
    badge = "XNOR2 GATE";
    ieeeSymbol = "";
    bgColor = "#1d1830";
    borderColor = "#7c3aed";
    accentColor = "#a78bfa";
  } else if (labelUpper.startsWith("XOR") || op === "bxor" || labelUpper.includes("^")) {
    gateType = "xor";
    badge = "XOR2 GATE";
    ieeeSymbol = "";
    bgColor = "#1d1830";
    borderColor = "#7c3aed";
    accentColor = "#a78bfa";
  } else if (labelUpper.startsWith("NOR") || op === "bnor") {
    gateType = "nor";
    badge = "NOR2 GATE";
    ieeeSymbol = "";
    bgColor = "#23172e";
    borderColor = "#9333ea";
    accentColor = "#c084fc";
  } else if (labelUpper.startsWith("OR") || op === "bor" || labelUpper.includes("|")) {
    gateType = "or";
    badge = "OR2 GATE";
    ieeeSymbol = "";
    bgColor = "#23172e";
    borderColor = "#9333ea";
    accentColor = "#c084fc";
  } else if (
    labelUpper.startsWith("NOT") ||
    labelUpper.startsWith("INV") ||
    op === "bnot" ||
    labelUpper.includes("~")
  ) {
    gateType = "not";
    badge = "INVERTER (INV)";
    ieeeSymbol = "";
    bgColor = "#24161f";
    borderColor = "#db2777";
    accentColor = "#f472b6";
  } else if (labelUpper.startsWith("BUF")) {
    gateType = "buf";
    badge = "BUFFER (BUF)";
    ieeeSymbol = "";
    bgColor = "#0f1d2e";
    borderColor = "#0284c7";
    accentColor = "#38bdf8";
  } else if (kind === "module") {
    gateType = "module";
    badge = "HIERARCHICAL MODULE";
    bgColor = "#1c2230";
    borderColor = "#2563eb";
    accentColor = "#60a5fa";
  } else {
    gateType = "operator";
    badge = `${node.label} OPERATOR`;
    ieeeSymbol = node.label;
    bgColor = "#14251f";
    borderColor = "#166534";
    accentColor = "#34d399";
  }

  if (isCritical) {
    borderColor = "#f43f5e";
    bgColor = "rgba(244, 63, 94, 0.2)";
  } else if (inCone) {
    borderColor = "#10b981";
  }

  if (isSelected || isHovered) {
    borderColor = "#00f0ff";
  }

  const instanceName = node.id.startsWith("gate_")
    ? node.id.replace("gate_", "")
    : node.id.startsWith("in_") || node.id.startsWith("out_")
    ? node.label
    : node.id;

  return {
    gateType,
    badge,
    ieeeSymbol,
    instanceName,
    bgColor,
    borderColor,
    accentColor
  };
}

function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  node: SchematicNode,
  gateType: GateType,
  x: number,
  y: number,
  w: number,
  h: number
) {
  switch (gateType) {
    case "and":
      drawAndShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      break;
    case "nand":
      drawNandShape(ctx, x, y, w, h);
      break;
    case "or":
      drawOrShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      drawOrInputLeads(ctx, node, x, y, w, h);
      break;
    case "nor":
      drawNorShape(ctx, x, y, w, h);
      drawOrInputLeads(ctx, node, x, y, w - 8, h);
      break;
    case "xor":
      drawXorShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      drawOrInputLeads(ctx, node, x, y, w - 6, h);
      break;
    case "xnor":
      drawXnorShape(ctx, x, y, w, h);
      drawOrInputLeads(ctx, node, x, y, w - 14, h);
      break;
    case "not":
      drawNotShape(ctx, x, y, w, h);
      break;
    case "buf":
      drawBufShape(ctx, x, y, w, h);
      break;
    case "mux":
      drawMuxShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      break;
    case "port_in":
      drawPortInShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      break;
    case "port_out":
      drawPortOutShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      break;
    case "register":
    case "operator":
    case "module":
    default:
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.stroke();
      break;
  }
}

function drawAndShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.48, y);
  ctx.bezierCurveTo(x + w * 0.82, y, x + w, y + h * 0.22, x + w, y + h / 2);
  ctx.bezierCurveTo(x + w, y + h * 0.78, x + w * 0.82, y + h, x + w * 0.48, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawNandShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bodyW = w - 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + bodyW * 0.48, y);
  ctx.bezierCurveTo(x + bodyW * 0.82, y, x + bodyW, y + h * 0.22, x + bodyW, y + h / 2);
  ctx.bezierCurveTo(x + bodyW, y + h * 0.78, x + bodyW * 0.82, y + h, x + bodyW * 0.48, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inversion bubble
  ctx.beginPath();
  ctx.arc(x + w - 4, y + h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawOrShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.22, y + h * 0.28, x + w * 0.22, y + h * 0.72, x, y + h);
  ctx.bezierCurveTo(x + w * 0.45, y + h, x + w * 0.82, y + h * 0.76, x + w, y + h / 2);
  ctx.bezierCurveTo(x + w * 0.82, y + h * 0.24, x + w * 0.45, y, x, y);
  ctx.closePath();
}

function drawNorShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bodyW = w - 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + bodyW * 0.22, y + h * 0.28, x + bodyW * 0.22, y + h * 0.72, x, y + h);
  ctx.bezierCurveTo(x + bodyW * 0.45, y + h, x + bodyW * 0.82, y + h * 0.76, x + bodyW, y + h / 2);
  ctx.bezierCurveTo(x + bodyW * 0.82, y + h * 0.24, x + bodyW * 0.45, y, x, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w - 4, y + h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawXorShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const offset = 6;
  const bodyX = x + offset;
  const bodyW = w - offset;

  // Outer back curve
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + bodyW * 0.22, y + h * 0.28, x + bodyW * 0.22, y + h * 0.72, x, y + h);
  ctx.stroke();

  // Inner OR body
  ctx.beginPath();
  ctx.moveTo(bodyX, y);
  ctx.bezierCurveTo(bodyX + bodyW * 0.22, y + h * 0.28, bodyX + bodyW * 0.22, y + h * 0.72, bodyX, y + h);
  ctx.bezierCurveTo(bodyX + bodyW * 0.45, y + h, bodyX + bodyW * 0.82, y + h * 0.76, x + w, y + h / 2);
  ctx.bezierCurveTo(bodyX + bodyW * 0.82, y + h * 0.24, bodyX + bodyW * 0.45, y, bodyX, y);
  ctx.closePath();
}

function drawXnorShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const offset = 6;
  const bodyX = x + offset;
  const bodyW = w - offset - 8;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + bodyW * 0.22, y + h * 0.28, x + bodyW * 0.22, y + h * 0.72, x, y + h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(bodyX, y);
  ctx.bezierCurveTo(bodyX + bodyW * 0.22, y + h * 0.28, bodyX + bodyW * 0.22, y + h * 0.72, bodyX, y + h);
  ctx.bezierCurveTo(bodyX + bodyW * 0.45, y + h, bodyX + bodyW * 0.82, y + h * 0.76, bodyX + bodyW, y + h / 2);
  ctx.bezierCurveTo(bodyX + bodyW * 0.82, y + h * 0.24, bodyX + bodyW * 0.45, y, bodyX, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w - 4, y + h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawNotShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bodyW = w - 8;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + bodyW, y + h / 2);
  ctx.lineTo(x, y + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w - 4, y + h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBufShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x, y + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawMuxShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const slant = Math.min(14, h * 0.28);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + slant);
  ctx.lineTo(x + w, y + h - slant);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawPortInShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tipW = 10;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + w - tipW, y + 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - tipW, y + h - 2);
  ctx.lineTo(x, y + h - 2);
  ctx.closePath();
}

function drawPortOutShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tipW = 10;
  ctx.beginPath();
  ctx.moveTo(x + tipW, y + 2);
  ctx.lineTo(x + w, y + 2);
  ctx.lineTo(x + w, y + h - 2);
  ctx.lineTo(x + tipW, y + h - 2);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

function drawOrInputLeads(
  ctx: CanvasRenderingContext2D,
  node: SchematicNode,
  x: number,
  y: number,
  w: number,
  h: number
) {
  for (const pin of node.inputs) {
    if (pin.offsetY === undefined) continue;
    const t = Math.max(0, Math.min(1, pin.offsetY / h));
    const indent = w * 0.22 * (4 * t * (1 - t));
    if (indent > 1) {
      ctx.beginPath();
      ctx.moveTo(x, y + pin.offsetY);
      ctx.lineTo(x + indent, y + pin.offsetY);
      ctx.stroke();
    }
  }
}

// ----------------------------------------------------------------------------
// Detailed Metadata Inspector Generator for Tooltips
// ----------------------------------------------------------------------------

function getGateDetailedInfo(
  node: SchematicNode,
  _graph: SchematicGraph,
  liveValuesMap: Map<string, string>
) {
  const kind = node.kind;
  const labelUpper = node.label.toUpperCase();
  const op = node.craneliftOp?.toLowerCase() ?? "";

  let badge = "PRIMITIVE";
  let badgeColor = "#38bdf8";
  let badgeBg = "rgba(56, 189, 248, 0.15)";
  let gateType: GateType = "operator";

  if (kind === "port_in") {
    gateType = "port_in";
    badge = "INPUT PORT (IBUF)";
    badgeColor = "#38bdf8";
    badgeBg = "rgba(56, 189, 248, 0.18)";
  } else if (kind === "port_out") {
    gateType = "port_out";
    badge = "OUTPUT PORT (OBUF)";
    badgeColor = "#10b981";
    badgeBg = "rgba(16, 185, 129, 0.18)";
  } else if (kind === "register") {
    gateType = "register";
    badge = "FLIP-FLOP (FDRE)";
    badgeColor = "#818cf8";
    badgeBg = "rgba(99, 102, 241, 0.18)";
  } else if (kind === "mux" || labelUpper.includes("MUX")) {
    gateType = "mux";
    badge = "MULTIPLEXER (MUX)";
    badgeColor = "#c084fc";
    badgeBg = "rgba(168, 85, 247, 0.18)";
  } else if (labelUpper.startsWith("NAND") || op === "bnand") {
    gateType = "nand";
    badge = "NAND2 GATE";
    badgeColor = "#34d399";
    badgeBg = "rgba(16, 185, 129, 0.18)";
  } else if (labelUpper.startsWith("AND") || op === "band" || labelUpper.includes("&")) {
    gateType = "and";
    badge = "AND2 GATE";
    badgeColor = "#34d399";
    badgeBg = "rgba(16, 185, 129, 0.18)";
  } else if (labelUpper.startsWith("XNOR") || op === "bxnor") {
    gateType = "xnor";
    badge = "XNOR2 GATE";
    badgeColor = "#a78bfa";
    badgeBg = "rgba(139, 92, 246, 0.18)";
  } else if (labelUpper.startsWith("XOR") || op === "bxor" || labelUpper.includes("^")) {
    gateType = "xor";
    badge = "XOR2 GATE";
    badgeColor = "#a78bfa";
    badgeBg = "rgba(139, 92, 246, 0.18)";
  } else if (labelUpper.startsWith("NOR") || op === "bnor") {
    gateType = "nor";
    badge = "NOR2 GATE";
    badgeColor = "#c084fc";
    badgeBg = "rgba(168, 85, 247, 0.18)";
  } else if (labelUpper.startsWith("OR") || op === "bor" || labelUpper.includes("|")) {
    gateType = "or";
    badge = "OR2 GATE";
    badgeColor = "#c084fc";
    badgeBg = "rgba(168, 85, 247, 0.18)";
  } else if (
    labelUpper.startsWith("NOT") ||
    labelUpper.startsWith("INV") ||
    op === "bnot" ||
    labelUpper.includes("~")
  ) {
    gateType = "not";
    badge = "INVERTER (INV)";
    badgeColor = "#f472b6";
    badgeBg = "rgba(236, 72, 153, 0.18)";
  } else if (kind === "module") {
    gateType = "module";
    badge = "HIERARCHICAL MODULE";
    badgeColor = "#60a5fa";
    badgeBg = "rgba(59, 130, 246, 0.18)";
  } else {
    badge = `${node.label} OPERATOR`;
    badgeColor = "#34d399";
    badgeBg = "rgba(16, 185, 129, 0.18)";
  }

  const instanceName = node.id.startsWith("gate_")
    ? node.id.replace("gate_", "")
    : node.id.startsWith("in_") || node.id.startsWith("out_")
    ? node.label
    : node.id;

  // Derive live evaluation string:
  let liveEval: string | null = null;
  if (gateType === "not" && node.inputs.length > 0) {
    const inVal =
      liveValuesMap.get(node.inputs[0].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[0].name}`) ??
      "0";
    const outVal = inVal === "1" ? "0" : inVal === "0" ? "1" : "X";
    liveEval = `~${node.inputs[0].name}[${inVal}] ➔ ${outVal}`;
  } else if (gateType === "and" && node.inputs.length >= 2) {
    const in1Val =
      liveValuesMap.get(node.inputs[0].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[0].name}`) ??
      "0";
    const in2Val =
      liveValuesMap.get(node.inputs[1].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[1].name}`) ??
      "0";
    const outVal =
      in1Val === "1" && in2Val === "1" ? "1" : in1Val === "0" || in2Val === "0" ? "0" : "X";
    liveEval = `${node.inputs[0].name}[${in1Val}] & ${node.inputs[1].name}[${in2Val}] ➔ ${outVal}`;
  } else if (gateType === "or" && node.inputs.length >= 2) {
    const in1Val =
      liveValuesMap.get(node.inputs[0].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[0].name}`) ??
      "0";
    const in2Val =
      liveValuesMap.get(node.inputs[1].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[1].name}`) ??
      "0";
    const outVal =
      in1Val === "1" || in2Val === "1" ? "1" : in1Val === "0" && in2Val === "0" ? "0" : "X";
    liveEval = `${node.inputs[0].name}[${in1Val}] | ${node.inputs[1].name}[${in2Val}] ➔ ${outVal}`;
  } else if (gateType === "xor" && node.inputs.length >= 2) {
    const in1Val =
      liveValuesMap.get(node.inputs[0].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[0].name}`) ??
      "0";
    const in2Val =
      liveValuesMap.get(node.inputs[1].name) ??
      liveValuesMap.get(`${node.scope}.${node.inputs[1].name}`) ??
      "0";
    const outVal =
      in1Val !== in2Val && in1Val !== "X" && in2Val !== "X" ? "1" : in1Val === in2Val && in1Val !== "X" ? "0" : "X";
    liveEval = `${node.inputs[0].name}[${in1Val}] ^ ${node.inputs[1].name}[${in2Val}] ➔ ${outVal}`;
  }

  return {
    gateType,
    badge,
    badgeColor,
    badgeBg,
    instanceName,
    expression: node.sublabel || node.expressionText,
    liveEval
  };
}

// Calculate distance from point P to line segment AB
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
