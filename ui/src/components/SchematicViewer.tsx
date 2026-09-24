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
  X,
  Zap,
  Download,
  Copy,
  Check,
  Cpu,
  ArrowRightLeft,
  ArrowUpDown,
  MoreVertical,
  RotateCcw
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  SchematicGraph,
  SchematicNode,
  SchematicEdge,
  SchematicOrientation,
  LogicCone,
  generateSchematicGraph,
  parseVerilogToSchematicGraph,
  generateSynthesizedSchematicGraph,
  sliceFaninCone,
  sliceFanoutCone
} from "../engine/schematicModel";
import { SynthesizedCircuit, SynthesizedCell, synthesizeClientFallback } from "../engine/synthModel";
import { useTranslation } from "../i18n";

interface SchematicViewerProps {
  state: SimulationState;
  activeDesignId: string;
  selectedSignalId?: string | null;
  onSelectSignal: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
  onOpenAutoPipeline?: (cone?: LogicCone | null) => void;
  verilogSource?: string;
  topModule?: string;
  targetDevice?: string;
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

function isGlobalNet(netName?: string): boolean {
  if (!netName) return false;
  const lower = netName.toLowerCase();
  return (
    lower === "clk" ||
    lower.startsWith("clk_") ||
    lower.endsWith("_clk") ||
    lower.includes("clock") ||
    lower === "rst" ||
    lower === "reset" ||
    lower.startsWith("rst_") ||
    lower.endsWith("_rst") ||
    lower === "rst_n" ||
    lower === "rst_b"
  );
}

export const SchematicViewer: React.FC<SchematicViewerProps> = ({
  state,
  activeDesignId,
  selectedSignalId,
  onSelectSignal,
  onJumpToCode,
  onOpenAutoPipeline,
  verilogSource,
  topModule,
  targetDevice
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Schematic View Mode: RTL Schematic vs Synthesized Gate Netlist
  const [schematicMode, setSchematicMode] = useState<"rtl" | "synth">(() => {
    try {
      const saved = localStorage.getItem("axiom_schematic_mode");
      if (saved === "synth" || saved === "rtl") return saved;
    } catch {}
    return "rtl";
  });

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const isCompact = (containerWidth > 0 ? containerWidth : (typeof window !== "undefined" ? window.innerWidth : 1000)) <= 768;

  // Schematic Layout Orientation: Horizontal (desktop default) vs Vertical (mobile/portrait optimized)
  const [orientation, setOrientation] = useState<SchematicOrientation>(() => {
    try {
      const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
      const key = mobile ? "axiom_schematic_orientation_mobile" : "axiom_schematic_orientation_desktop";
      const saved = localStorage.getItem(key);
      if (saved === "horizontal" || saved === "vertical") return saved;
      const legacy = localStorage.getItem("axiom_schematic_orientation");
      if (legacy === "horizontal" || legacy === "vertical") return legacy;
      if (mobile) {
        return "vertical";
      }
    } catch {}
    return "horizontal";
  });

  const [synthCircuit, setSynthCircuit] = useState<SynthesizedCircuit | null>(null);
  const [synthLoading, setSynthLoading] = useState<boolean>(false);
  const [copiedInit, setCopiedInit] = useState<boolean>(false);
  const [exportedVerilog, setExportedVerilog] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem("axiom_schematic_mode", schematicMode);
    } catch {}
  }, [schematicMode]);

  useEffect(() => {
    try {
      const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
      const key = mobile ? "axiom_schematic_orientation_mobile" : "axiom_schematic_orientation_desktop";
      localStorage.setItem(key, orientation);
      localStorage.setItem("axiom_schematic_orientation", orientation);
    } catch {}
  }, [orientation]);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Close Three-Dots popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    let isCancelled = false;
    if (schematicMode === "synth") {
      setSynthLoading(true);
      engineBridge.synthesizeDesign({
        source: verilogSource,
        topModule: topModule || activeDesignId,
        device: targetDevice
      })
        .then((res) => {
          if (!isCancelled && res) {
            setSynthCircuit(res);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setSynthCircuit(synthesizeClientFallback(activeDesignId, topModule, targetDevice));
          }
        })
        .finally(() => {
          if (!isCancelled) setSynthLoading(false);
        });
    }
    return () => { isCancelled = true; };
  }, [schematicMode, activeDesignId, verilogSource, topModule, targetDevice]);

  // Synthesize Hardware DAG for active design (dynamic source netlist parser with sample fallback)
  const rtlGraph = useMemo<SchematicGraph>(() => {
    if (verilogSource && verilogSource.trim().length > 0) {
      const dynamicGraph = parseVerilogToSchematicGraph(verilogSource, topModule || activeDesignId, orientation);
      if (dynamicGraph && dynamicGraph.nodes.length > 0) {
        return dynamicGraph;
      }
    }
    return generateSchematicGraph(activeDesignId, orientation);
  }, [activeDesignId, verilogSource, topModule, orientation]);

  const synthGraph = useMemo<SchematicGraph | null>(() => {
    if (synthCircuit) {
      return generateSynthesizedSchematicGraph(synthCircuit, orientation);
    }
    return null;
  }, [synthCircuit, orientation]);

  const graph = (schematicMode === "synth" && synthGraph) ? synthGraph : rtlGraph;

  const handleExportSynthesizedVerilog = useCallback(async () => {
    try {
      let code = "";
      try {
        code = await engineBridge.exportSynthesizedVerilog({
          source: verilogSource,
          designId: activeDesignId,
          topModule: topModule || activeDesignId,
          device: synthCircuit?.target_device || targetDevice
        });
      } catch {
        if (synthCircuit?.verilog_text) {
          code = synthCircuit.verilog_text;
        } else if (synthCircuit) {
          const modName = synthCircuit.top_module || activeDesignId || "top";
          const lines = [
            `// Axiom In-RAM RTL Logic Synthesizer - FPGA Technology-Mapped Netlist`,
            `// Target Device: ${synthCircuit.target_device} (${synthCircuit.target_family})`,
            `// Top Module: ${modName}`,
            `module ${modName}_synth (`,
            synthCircuit.ports.map((p) => `  ${p.direction === "Input" ? "input" : "output"} ${p.width > 1 ? `[${p.width - 1}:0] ` : ""}${p.name}`).join(",\n"),
            `);`,
            "",
            synthCircuit.nets.map((n) => `  wire ${n.name};`).join("\n"),
            "",
            ...synthCircuit.cells.map((c) => {
              const portConns = Object.entries(c.ports).map(([pin, net]) => `.${pin}(${net})`).join(", ");
              const paramStr = c.params.INIT !== undefined ? ` #(.INIT(64'h${c.params.INIT.toString(16).toUpperCase().padStart(16, "0")}))` : "";
              return `  ${c.kind}${paramStr} ${c.id} (${portConns});`;
            }),
            "",
            `endmodule`
          ];
          code = lines.join("\n");
        }
      }
      if (code) {
        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeDesignId || "design"}_synth.v`;
        a.click();
        URL.revokeObjectURL(url);
        setExportedVerilog(true);
        setTimeout(() => setExportedVerilog(false), 2500);
      }
    } catch (err) {
      console.error("Failed to export synthesized netlist:", err);
    }
  }, [activeDesignId, synthCircuit]);

  // Camera Viewport State: Pan (offsetX, offsetY) & Zoom (scale) with local persistence per mode & orientation
  const [scale, setScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_schematic_cam_${activeDesignId || "default"}_${schematicMode}_${orientation}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.scale === "number" && !isNaN(parsed.scale) && parsed.scale > 0) {
          return parsed.scale;
        }
      }
    } catch {}
    return 1.0;
  });
  const [offsetX, setOffsetX] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_schematic_cam_${activeDesignId || "default"}_${schematicMode}_${orientation}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.offsetX === "number" && !isNaN(parsed.offsetX)) {
          return parsed.offsetX;
        }
      }
    } catch {}
    return 60;
  });
  const [offsetY, setOffsetY] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_schematic_cam_${activeDesignId || "default"}_${schematicMode}_${orientation}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.offsetY === "number" && !isNaN(parsed.offsetY)) {
          return parsed.offsetY;
        }
      }
    } catch {}
    return 50;
  });

  // Mouse Interaction States
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection & 1-Click Logic Cone Slicer State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeCone, setActiveCone] = useState<LogicCone | null>(null);

  // Selected synthesized cell (when in synth mode or clicking on mapped cell)
  const selectedLutCell = useMemo<SynthesizedCell | null>(() => {
    if (!selectedNodeId || !synthCircuit) return null;
    return synthCircuit.cells.find((c) => c.id === selectedNodeId) || null;
  }, [selectedNodeId, synthCircuit]);

  // Hover & Tooltip State
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // View Options (persisted)
  const [showLiveValues, setShowLiveValues] = useState<boolean>(() => {
    try {
      return localStorage.getItem("axiom_schematic_live_values") === "true";
    } catch {
      return false;
    }
  });
  const [hideClockNets, setHideClockNets] = useState<boolean>(() => {
    try {
      return localStorage.getItem("axiom_schematic_hide_clocks") === "true";
    } catch {
      return false;
    }
  });
  const [crossoverStyle, setCrossoverStyle] = useState<"arc" | "gap" | "straight">(() => {
    try {
      const saved = localStorage.getItem("axiom_schematic_crossover_style");
      if (saved === "gap" || saved === "straight" || saved === "arc") return saved;
    } catch {}
    return "arc";
  });
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth > 768;
    }
    return false;
  });

  // Save view options
  useEffect(() => {
    try {
      localStorage.setItem("axiom_schematic_live_values", String(showLiveValues));
    } catch {}
  }, [showLiveValues]);

  useEffect(() => {
    try {
      localStorage.setItem("axiom_schematic_hide_clocks", String(hideClockNets));
    } catch {}
  }, [hideClockNets]);

  useEffect(() => {
    try {
      localStorage.setItem("axiom_schematic_crossover_style", crossoverStyle);
    } catch {}
  }, [crossoverStyle]);

  // Debounced camera state persistence per design, schematic mode, and orientation
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `axiom_schematic_cam_${activeDesignId || "default"}_${schematicMode}_${orientation}`,
          JSON.stringify({ scale, offsetX, offsetY })
        );
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [scale, offsetX, offsetY, activeDesignId, schematicMode, orientation]);

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

  const renderCanvasRef = useRef<() => void>(() => {});

  // Auto-focus camera on graph bounds: zooms in to comfortably fit the viewport with symmetrical centering
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !graph) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    // Guard against unmeasured / zero container size to prevent offscreen coordinates
    if (!width || !height || width <= 100 || height <= 100) return;

    const isMobileViewport = width <= 768;
    const graphWidth = Math.max(graph.bounds.width, 10);
    const graphHeight = Math.max(graph.bounds.height, 10);

    // True center of the circuit in world space
    const centerX = graph.bounds.minX + graphWidth / 2;
    const centerY = graph.bounds.minY + graphHeight / 2;

    if (isMobileViewport) {
      if (graph.orientation === "vertical") {
        const paddingX = 20;
        const availWidth = Math.max(width - paddingX * 2, 100);
        const availHeight = Math.max(height - 100, 100);
        const scaleX = availWidth / graphWidth;
        const scaleY = availHeight / graphHeight;
        const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.15);
        setScale(targetScale);
        setOffsetX((width - graphWidth * targetScale) / 2 - graph.bounds.minX * targetScale);
        setOffsetY(40 - graph.bounds.minY * targetScale);
      } else {
        // Mobile portrait horizontal: comfortable scale so gate shapes and wire probes are legible and clear
        const targetScale = Math.min(Math.max((height - 140) / (graphHeight * 1.5), 0.72), 0.95);
        setScale(targetScale);
        setOffsetX(16); // Start cleanly from left with padding, never negative
        const visibleH = height - 36;
        setOffsetY(Math.max(16, (visibleH - graphHeight * targetScale) / 2 + 10));
      }
    } else {
      // Desktop: calculate scale to fill the available canvas area cleanly with comfortable margins
      const toolbarHeight = 26;
      const paddingX = 40;
      const paddingY = 36;

      const availWidth = Math.max(width - paddingX * 2, 200);
      const availHeight = Math.max(height - toolbarHeight - paddingY * 2, 150);

      const scaleX = availWidth / graphWidth;
      const scaleY = availHeight / graphHeight;

      // Fit both dimensions, zooming in nicely up to 1.35x for compact circuits
      const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.35);

      // Symmetrically center the circuit on screen
      const screenCenterX = width / 2;
      const screenCenterY = toolbarHeight + (height - toolbarHeight) / 2;

      setScale(targetScale);
      setOffsetX(screenCenterX - centerX * targetScale);
      setOffsetY(screenCenterY - centerY * targetScale);
    }
    requestAnimationFrame(() => {
      renderCanvasRef.current();
    });
  }, [graph]);

  // Reset zoom scale to 100% (1.0x) and center current circuit in viewport
  const handleResetZoom = useCallback(() => {
    setScale(1.0);
    if (containerRef.current && graph) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const centerX = graph.bounds.minX + graph.bounds.width / 2;
      const centerY = graph.bounds.minY + graph.bounds.height / 2;
      setOffsetX(width / 2 - centerX);
      setOffsetY(height / 2 - centerY);
    }
    requestAnimationFrame(() => {
      renderCanvasRef.current();
    });
  }, [graph]);

  // Load saved camera state per design, mode & orientation, or fit to screen if no cached camera exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`axiom_schematic_cam_${activeDesignId || "default"}_${schematicMode}_${orientation}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.scale === "number" && !isNaN(parsed.scale) && parsed.scale > 0) {
          const cW = containerRef.current?.clientWidth || 0;
          const cH = containerRef.current?.clientHeight || 0;
          if (cW > 100 && cH > 100 && graph) {
            const screenLeft = parsed.offsetX + graph.bounds.minX * parsed.scale;
            const screenRight = parsed.offsetX + graph.bounds.maxX * parsed.scale;
            const screenTop = parsed.offsetY + graph.bounds.minY * parsed.scale;
            const screenBottom = parsed.offsetY + graph.bounds.maxY * parsed.scale;
            // If completely outside the visible viewport, discard stale cache and refit
            if (screenRight < 50 || screenLeft > cW - 50 || screenBottom < 50 || screenTop > cH - 50) {
              fitToScreen();
              return;
            }
          }
          setScale(parsed.scale);
          if (typeof parsed.offsetX === "number" && !isNaN(parsed.offsetX)) setOffsetX(parsed.offsetX);
          if (typeof parsed.offsetY === "number" && !isNaN(parsed.offsetY)) setOffsetY(parsed.offsetY);
          return;
        }
      }
    } catch {}
    fitToScreen();
  }, [activeDesignId, schematicMode, orientation, fitToScreen, graph]);

  // When synth graph finishes loading for the first time, auto-fit if not yet cached
  useEffect(() => {
    if (schematicMode === "synth" && synthGraph) {
      const key = `axiom_schematic_cam_${activeDesignId || "default"}_synth_${orientation}`;
      try {
        if (!localStorage.getItem(key)) {
          fitToScreen();
        }
      } catch {}
    }
  }, [schematicMode, synthGraph, activeDesignId, orientation, fitToScreen]);

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

    try {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
      const width = containerRef.current?.clientWidth || Math.round(canvas.width / dpr);
      const height = containerRef.current?.clientHeight || Math.round(canvas.height / dpr);

      // Clear physical hardware canvas buffer
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);

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
      if (hideClockNets && isGlobalNet(edge.netName)) {
        continue;
      }
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
      } else if (inCone && activeCone.isSlackViolated) {
        ctx.shadowColor = "rgba(244, 63, 94, 0.95)";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.8;
      } else if (inCone) {
        ctx.shadowColor = "rgba(16, 185, 129, 0.75)";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.4;
      }

      ctx.beginPath();
      if (edge.wirePoints.length > 0) {
        if (!edge.crossovers || edge.crossovers.length === 0 || crossoverStyle === "straight") {
          ctx.moveTo(edge.wirePoints[0].x, edge.wirePoints[0].y);
          for (let i = 1; i < edge.wirePoints.length; i++) {
            ctx.lineTo(edge.wirePoints[i].x, edge.wirePoints[i].y);
          }
        } else {
          ctx.moveTo(edge.wirePoints[0].x, edge.wirePoints[0].y);
          for (let i = 0; i < edge.wirePoints.length - 1; i++) {
            const p1 = edge.wirePoints[i];
            const p2 = edge.wirePoints[i + 1];
            const isH = Math.abs(p1.y - p2.y) < 1e-3;
            if (isH) {
              const y = p1.y;
              const minX = Math.min(p1.x, p2.x);
              const maxX = Math.max(p1.x, p2.x);
              const segCrossovers = edge.crossovers.filter(
                (c) => Math.abs(c.y - y) < 1 && c.x > minX + 2 && c.x < maxX - 2
              );
              if (segCrossovers.length === 0) {
                ctx.lineTo(p2.x, p2.y);
              } else {
                const movingRight = p2.x >= p1.x;
                segCrossovers.sort((a, b) => (movingRight ? a.x - b.x : b.x - a.x));
                const r = 5;
                for (const cross of segCrossovers) {
                  if (crossoverStyle === "arc") {
                    if (movingRight) {
                      ctx.lineTo(cross.x - r, y);
                      ctx.arc(cross.x, y, r, Math.PI, 0, true);
                    } else {
                      ctx.lineTo(cross.x + r, y);
                      ctx.arc(cross.x, y, r, 0, Math.PI, true);
                    }
                  } else if (crossoverStyle === "gap") {
                    const gap = 4;
                    if (movingRight) {
                      ctx.lineTo(cross.x - gap, y);
                      ctx.moveTo(cross.x + gap, y);
                    } else {
                      ctx.lineTo(cross.x + gap, y);
                      ctx.moveTo(cross.x - gap, y);
                    }
                  }
                }
                ctx.lineTo(p2.x, p2.y);
              }
            } else {
              ctx.lineTo(p2.x, p2.y);
            }
          }
        }
      }
      ctx.stroke();

      // Per-net delay badge along critical path wires (+0.09 ns net)
      if (inCone && activeCone.isSlackViolated && edge.wirePoints.length >= 2 && lodLevel !== "macro") {
        const pMid = edge.wirePoints[Math.floor(edge.wirePoints.length / 2)];
        const netDelayText = edge.delayPs ? `+${(edge.delayPs / 1000).toFixed(2)} ns net` : "+0.09 ns net";
        ctx.font = "bold 8.5px JetBrains Mono, monospace";
        const dMetrics = ctx.measureText(netDelayText);
        const dWidth = dMetrics.width + 8;

        ctx.fillStyle = "#0c1017";
        ctx.fillRect(pMid.x - dWidth / 2, pMid.y - 7, dWidth, 14);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(pMid.x - dWidth / 2, pMid.y - 7, dWidth, 14);

        ctx.fillStyle = "#f43f5e";
        ctx.textAlign = "center";
        ctx.fillText(netDelayText, pMid.x, pMid.y + 3.5);
      }

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

    // 1b. Solid Electrical Fanout Junction Dots (•) at shared net branch points
    if (graph.junctions && graph.junctions.length > 0) {
      for (const junc of graph.junctions) {
        const isNetSelected = selectedEdgeId ? graph.edges.some((e) => e.id === selectedEdgeId && e.netName === junc.netName) : false;
        ctx.save();
        ctx.fillStyle = isNetSelected ? "#00f0ff" : "#38bdf8";
        if (isNetSelected) {
          ctx.shadowColor = "rgba(0, 240, 255, 0.85)";
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(junc.x, junc.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
      if (graph.orientation === "vertical") {
        if (visuals.gateType === "port_in") {
          drawPortInVertical(ctx, node.x, node.y, node.width, node.height);
          ctx.fill();
          ctx.stroke();
        } else if (visuals.gateType === "port_out") {
          drawPortOutVertical(ctx, node.x, node.y, node.width, node.height);
          ctx.fill();
          ctx.stroke();
        } else if (visuals.gateType === "register" || visuals.gateType === "operator" || visuals.gateType === "module") {
          ctx.beginPath();
          ctx.roundRect(node.x, node.y, node.width, node.height, 5);
          ctx.fill();
          ctx.stroke();
        } else {
          // Standard logic gate: rotate 90 deg clockwise so inputs face UP, output faces DOWN
          ctx.save();
          ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
          ctx.rotate(Math.PI / 2);
          drawNodeShape(ctx, node, visuals.gateType, -node.height / 2, -node.width / 2, node.height, node.width, true);
          ctx.restore();
        }
      } else {
        drawNodeShape(ctx, node, visuals.gateType, node.x, node.y, node.width, node.height, false);
      }

      // Clock input notch for sequential registers
      if (visuals.gateType === "register") {
        const clkPort = node.inputs.find((p) => p.isClock);
        if (clkPort && clkPort.offsetX !== undefined && clkPort.offsetY !== undefined) {
          const cx = node.x + clkPort.offsetX;
          const cy = node.y + clkPort.offsetY;
          ctx.fillStyle = visuals.accentColor;
          ctx.beginPath();
          if (graph.orientation === "vertical") {
            ctx.moveTo(cx - 5, cy);
            ctx.lineTo(cx, cy + 6);
            ctx.lineTo(cx + 5, cy);
          } else {
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx + 6, cy);
            ctx.lineTo(cx, cy + 5);
          }
          ctx.closePath();
          ctx.fill();
        }
      }

      // ----------------------------------------------------------------------
      // Labels & Text Display (Vivado Standard)
      // ----------------------------------------------------------------------

      // 1. Instance Name printed above/beside the gate (Vivado style: inv1, and1, or1)
      if (visuals.gateType !== "port_in" && visuals.gateType !== "port_out") {
        ctx.font = "bold 10px JetBrains Mono, monospace";
        const textMetrics = ctx.measureText(visuals.instanceName);
        const textWidth = textMetrics.width;

        if (graph.orientation === "vertical") {
          // In vertical mode, inputs enter from top and outputs exit bottom.
          // Place instance name to the right of the gate where no wires exist.
          const textX = node.x + node.width + 5;
          const textY = node.y + 12;

          ctx.fillStyle = "#0c1017";
          ctx.fillRect(textX - 2, textY - 9, textWidth + 4, 12);

          ctx.fillStyle = isSelected || isHovered ? "#00f0ff" : "rgba(226, 232, 240, 0.85)";
          ctx.textAlign = "left";
          ctx.fillText(visuals.instanceName, textX, textY);
        } else {
          // Horizontal mode: place instance name above gate
          const textX = node.x + node.width / 2;
          const textY = node.y - 6;

          // Solid background knockout plate matching canvas background (#0c1017)
          // Completely isolates text from any background grid lines or passing wire paths
          ctx.fillStyle = "#0c1017";
          ctx.fillRect(textX - textWidth / 2 - 4, textY - 10, textWidth + 8, 14);

          ctx.fillStyle = isSelected || isHovered ? "#00f0ff" : "rgba(226, 232, 240, 0.85)";
          ctx.textAlign = "center";
          ctx.fillText(visuals.instanceName, textX, textY);
        }
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
          if (graph.orientation === "vertical") {
            ctx.textAlign = "center";
            ctx.fillText("0", node.x + 14, node.y + 12);
            ctx.fillText("1", node.x + node.width - 14, node.y + 12);
          } else {
            ctx.textAlign = "left";
            ctx.fillText("0", node.x + 8, node.y + 14);
            ctx.fillText("1", node.x + 8, node.y + node.height - 10);
          }
        } else if (visuals.gateType === "register") {
          ctx.font = "bold 8px JetBrains Mono, monospace";
          ctx.fillStyle = "#94a3b8";
          if (graph.orientation === "vertical") {
            ctx.textAlign = "center";
            ctx.fillText("D", node.x + node.width / 2, node.y + 12);
            ctx.fillText("Q", node.x + node.width / 2, node.y + node.height - 6);
          } else {
            ctx.textAlign = "left";
            ctx.fillText("D", node.x + 7, node.y + 16);
            ctx.textAlign = "right";
            ctx.fillText("Q", node.x + node.width - 7, node.y + 16);
          }
        }
      } else if (visuals.gateType === "operator" || visuals.gateType === "module") {
        // General Operators / Modules
        ctx.font = "bold 11px JetBrains Mono, monospace";
        ctx.fillStyle = isSelected ? "#00f0ff" : isCritical ? "#f43f5e" : "#f1f5f9";
        ctx.textAlign = "center";
        const titleY = node.sublabel ? node.y + 16 : node.y + node.height / 2 + 4;
        ctx.fillText(node.label, node.x + node.width / 2, titleY);
      }

      // Per-gate delay badge on critical path cells (+0.18 ns LUT)
      if (
        isCritical &&
        isConeActive &&
        activeCone.isSlackViolated &&
        visuals.gateType !== "port_in" &&
        visuals.gateType !== "port_out" &&
        lodLevel !== "macro"
      ) {
        const gateDelayText = node.delayPs ? `+${(node.delayPs / 1000).toFixed(2)} ns LUT` : "+0.18 ns LUT";
        ctx.font = "bold 8.5px JetBrains Mono, monospace";
        const gMetrics = ctx.measureText(gateDelayText);
        const gWidth = gMetrics.width + 8;
        const gX = graph.orientation === "vertical" ? node.x - gWidth / 2 - 4 : node.x + node.width / 2;
        const gY = graph.orientation === "vertical" ? node.y + node.height / 2 : node.y + node.height + 11;

        ctx.fillStyle = "#0c1017";
        ctx.fillRect(gX - gWidth / 2, gY - 8, gWidth, 14);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
        ctx.lineWidth = 1;
        ctx.strokeRect(gX - gWidth / 2, gY - 8, gWidth, 14);

        ctx.fillStyle = "#f43f5e";
        ctx.textAlign = "center";
        ctx.fillText(gateDelayText, gX, gY + 2.5);
      }
      // Note: Standard logic gates (and, nand, or, nor, xor, xnor, not, buf) have clean,
      // uncluttered interiors and no text below them. Boolean equations (e.g. w4 = ~B)
      // and JIT operations (jit: band) are presented on hover/selection tooltip.

      // 3. Port Terminal Dots
      if (lodLevel !== "macro") {
        ctx.fillStyle = visuals.accentColor;
        // Inputs (Left or Top)
        for (const pin of node.inputs) {
          if (pin.offsetX === undefined || pin.offsetY === undefined) continue;
          ctx.beginPath();
          ctx.arc(node.x + pin.offsetX, node.y + pin.offsetY, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Compact clock and reset pin badges when global distribution lines are suppressed
          if (hideClockNets) {
            const pinName = pin.name.toLowerCase();
            const isClk = pin.isClock || pinName.includes("clk") || pinName.includes("clock");
            const isRst = pinName.includes("rst") || pinName.includes("reset");
            if (isClk || isRst) {
              const px = node.x + pin.offsetX;
              const py = node.y + pin.offsetY;
              ctx.font = "bold 7px JetBrains Mono, monospace";
              ctx.fillStyle = isClk ? "#f59e0b" : "#ef4444";
              if (graph.orientation === "vertical") {
                ctx.textAlign = "center";
                ctx.fillText(isClk ? "CLK" : "RST", px, py - 4);
              } else {
                ctx.textAlign = "right";
                ctx.fillText(isClk ? "CLK" : "RST", px - 4, py + 2.5);
              }
              ctx.fillStyle = visuals.accentColor;
            }
          }
        }
        // Outputs (Right or Bottom)
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
        const nx = mapX + 8 + (node.x - graph.bounds.minX) * miniScale;
        const ny = mapY + 8 + (node.y - graph.bounds.minY) * miniScale;
        const nw = Math.max(2, node.width * miniScale);
        const nh = Math.max(2, node.height * miniScale);
        ctx.fillStyle = node.id === selectedNodeId ? "#00f0ff" : "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(nx, ny, nw, nh);
      }

      // Draw mini camera viewport box
      const camX = mapX + 8 + (-offsetX / scale - graph.bounds.minX) * miniScale;
      const camY = mapY + 8 + (-offsetY / scale - graph.bounds.minY) * miniScale;
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

    ctx.restore(); // Restore devicePixelRatio transformation
  } catch (err) {
    console.warn("Schematic renderCanvas error:", err);
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
    hideClockNets,
    crossoverStyle,
    showMinimap,
    lodLevel
  ]);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  const prevContainerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const hasFittedRef = useRef<boolean>(false);

  useEffect(() => {
    hasFittedRef.current = false;
    prevContainerSizeRef.current = { width: 0, height: 0 };
  }, [activeDesignId]);

  // Synchronous mount sizing and initial paint: guarantees canvas is sharp & non-blank instantly
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    if (cW > 50 && cH > 50) {
      setContainerWidth(cW);
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
      const bufferW = Math.round(cW * dpr);
      const bufferH = Math.round(cH * dpr);
      if (canvasRef.current.width !== bufferW || canvasRef.current.height !== bufferH) {
        canvasRef.current.width = bufferW;
        canvasRef.current.height = bufferH;
      }
      canvasRef.current.style.width = `${cW}px`;
      canvasRef.current.style.height = `${cH}px`;
      renderCanvas();
    }
  }, [renderCanvas]);

  // Handle Resize & Trigger Render: Continuous ResizeObserver tracking splitter drag & window resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = Math.round(entry.contentRect.width);
        const newH = Math.round(entry.contentRect.height);
        if (newW <= 50 || newH <= 50) continue;

        setContainerWidth(newW);

        // Keep canvas buffer matching physical device pixels to eliminate blur on High-DPI/Retina screens
        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
        const bufferW = Math.round(newW * dpr);
        const bufferH = Math.round(newH * dpr);
        if (canvasRef.current) {
          if (canvasRef.current.width !== bufferW || canvasRef.current.height !== bufferH) {
            canvasRef.current.width = bufferW;
            canvasRef.current.height = bufferH;
          }
          canvasRef.current.style.width = `${newW}px`;
          canvasRef.current.style.height = `${newH}px`;
        }

        if (!hasFittedRef.current) {
          hasFittedRef.current = true;
          prevContainerSizeRef.current = { width: newW, height: newH };
          fitToScreen();
          requestAnimationFrame(renderCanvas);
        } else {
          const prevW = prevContainerSizeRef.current.width;
          const prevH = prevContainerSizeRef.current.height;
          if (prevW > 0 && prevH > 0 && (newW !== prevW || newH !== prevH)) {
            const deltaW = newW - prevW;
            const deltaH = newH - prevH;
            // Mathematically lock the world midpoint to screen center with constant zoom scale
            setOffsetX((prev) => prev + deltaW / 2);
            setOffsetY((prev) => prev + deltaH / 2);
          }
          prevContainerSizeRef.current = { width: newW, height: newH };
          renderCanvas();
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitToScreen, renderCanvas]);

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
          if (hideClockNets && isGlobalNet(edge.netName)) continue;
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
        if (hideClockNets && isGlobalNet(edge.netName)) continue;
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

  const handleMouseLeave = () => {
    setIsPanning(false);
    setHoveredNodeId(null);
    setHoveredEdgeId(null);
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
    if (hoveredNodeId) {
      return graph.nodes.find((n) => n.id === hoveredNodeId) ?? null;
    }
    // If hovering an edge, yield to wire hover tooltip
    if (hoveredEdgeId) {
      return null;
    }
    if (selectedNodeId) {
      return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
    }
    return null;
  }, [hoveredNodeId, hoveredEdgeId, selectedNodeId, graph.nodes]);

  // Active hover edge metadata for tooltip
  const activeHoverEdge = useMemo(() => {
    if (!hoveredEdgeId || hoveredNodeId) return null;
    return graph.edges.find((e) => e.id === hoveredEdgeId) ?? null;
  }, [hoveredEdgeId, hoveredNodeId, graph.edges]);

  // Detailed Gate Information for Vivado Inspector Card
  const activeGateDetails = useMemo(() => {
    if (!activeHoverNode) return null;
    return getGateDetailedInfo(activeHoverNode, graph, liveValuesMap);
  }, [activeHoverNode, graph, liveValuesMap]);

  // Viewport bounds calculation for floating gate inspector tooltip
  const nodeTooltipPos = useMemo(() => {
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

    return {
      x: mousePos.x > maxX ? Math.max(12, mousePos.x - 330) : mousePos.x + 16,
      y: mousePos.y > maxY ? Math.max(12, mousePos.y - 280) : mousePos.y + 16
    };
  }, [mousePos, hoveredNodeId, selectedNodeId, graph.nodes, scale, offsetX, offsetY]);

  // Viewport bounds calculation for floating wire / edge hover tooltip
  const edgeTooltipPos = useMemo(() => {
    const maxX = typeof window !== "undefined" ? window.innerWidth - 270 : 800;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 160 : 600;

    return {
      x: mousePos.x > maxX ? Math.max(12, mousePos.x - 260) : mousePos.x + 16,
      y: mousePos.y > maxY ? Math.max(12, mousePos.y - 130) : mousePos.y + 16
    };
  }, [mousePos]);


  if (!graph || graph.nodes.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-primary)",
          padding: 32,
          textAlign: "center",
          userSelect: "none"
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16
          }}
        >
          <Cpu size={28} color="var(--accent-cyan)" />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>
          No Schematic to Display
        </h3>
        <p style={{ fontSize: 13, color: "#64748b", maxWidth: 420, lineHeight: 1.6 }}>
          No gate-level schematic netlist is available for the current module. Select a synthesizable hardware design or elaborate your design to view its schematic.
        </p>
      </div>
    );
  }

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
        className="schematic-toolbar"
        style={{
          height: 28,
          minHeight: 28,
          flexShrink: 0,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px 0 8px",
          zIndex: 25,
          position: "relative",
          userSelect: "none"
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            scrollbarWidth: "none",
            marginRight: 6
          }}
        >
          {/* Dual-Mode Schematic Switcher: RTL vs Synthesized Netlist (Single Toggle Button) */}
          <button
            onClick={() => setSchematicMode(schematicMode === "rtl" ? "synth" : "rtl")}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              backgroundColor: schematicMode === "synth" ? "rgba(168, 85, 247, 0.2)" : "rgba(56, 189, 248, 0.2)",
              color: schematicMode === "synth" ? "#c084fc" : "var(--accent-cyan)",
              flexShrink: 0
            }}
            title={schematicMode === "rtl" ? "Switch to Synthesized Netlist" : "Switch to RTL Schematic"}
          >
            {schematicMode === "rtl" ? <Zap size={11} /> : <Layers size={11} />}
            <span>{schematicMode === "rtl" ? "RTL" : "Synth"}</span>
            {synthLoading && <span style={{ fontSize: 9, opacity: 0.7 }}>(...)</span>}
          </button>

          {/* Layout Orientation Single Toggle Button */}
          <button
            onClick={() => {
              const next = orientation === "horizontal" ? "vertical" : "horizontal";
              setOrientation(next);
              setTimeout(fitToScreen, 10);
            }}
            style={{
              padding: "2px 6px",
              fontSize: 10,
              fontWeight: 600,
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--accent-cyan)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexShrink: 0
            }}
            title={orientation === "horizontal" ? `${t("schematic.horizontal")} (Click for ${t("schematic.vertical")})` : `${t("schematic.vertical")} (Click for ${t("schematic.horizontal")})`}
            aria-label={t("schematic.orientation")}
          >
            {orientation === "horizontal" ? <ArrowRightLeft size={11} /> : <ArrowUpDown size={11} />}
          </button>

          {/* Fit to Screen (Single Icon-Only Button) */}
          <button
            onClick={fitToScreen}
            className="btn btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 6px",
              color: "var(--accent-cyan)",
              flexShrink: 0
            }}
            title={t("schematic.fitScreen")}
            aria-label={t("schematic.fitScreen")}
          >
            <Maximize2 size={11} />
          </button>

          {/* Live Values Toggle */}
          <button
            onClick={() => setShowLiveValues(!showLiveValues)}
            style={{
              fontSize: 10,
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
            title={t("schematic.liveValues")}
          >
            <Activity size={11} />
            <span>Live</span>
          </button>

          {/* Clock Nets Toggle */}
          <button
            onClick={() => setHideClockNets(!hideClockNets)}
            style={{
              fontSize: 10,
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
            <span>{hideClockNets ? "Clks Off" : "Clks"}</span>
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            style={{
              fontSize: 10,
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
            title={t("schematic.minimap")}
          >
            <MapPin size={11} />
            <span>Map</span>
          </button>
        </div>

        {/* Action Controls: 1-Click Cone Slicing, Zoom, Crossover Style (Desktop wide only, collapsed into More menu on compact/mobile) */}
        {!isCompact && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 6, whiteSpace: "nowrap" }}>
            {/* Slice Fanin Cone Button */}
            {(selectedNodeId || selectedEdgeId) && (
              <button
                onClick={handleSliceFanin}
                title={t("schematic.fanin")}
                className="btn btn-secondary"
                style={{
                  fontSize: 10.5,
                  padding: "2px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap"
                }}
              >
                <Filter size={10} />
                <span>Fan-In [F]</span>
              </button>
            )}

            {/* Slice Fanout Cone Button */}
            {(selectedNodeId || selectedEdgeId) && (
              <button
                onClick={handleSliceFanout}
                title="Slice Fan-Out Driven Tree (O)"
                className="btn btn-secondary"
                style={{
                  fontSize: 10.5,
                  padding: "2px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap"
                }}
              >
                <Layers size={10} />
                <span>Fan-Out [O]</span>
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

            {/* Export Synthesized Netlist */}
            {schematicMode === "synth" && (
              <button
                onClick={handleExportSynthesizedVerilog}
                className="btn btn-secondary"
                style={{
                  fontSize: 10.5,
                  padding: "2px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: exportedVerilog ? "var(--accent-emerald)" : "#c084fc",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  cursor: "pointer",
                  flexShrink: 0
                }}
                title="Export Technology-Mapped Structural Verilog Netlist"
              >
                {exportedVerilog ? <Check size={11} /> : <Download size={11} />}
                <span>{exportedVerilog ? "Exported!" : "Export Netlist"}</span>
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
          </div>
        )}

        {/* Persistent Three-Dots More Options Button & Dropdown Context Menu Popover */}
        <div ref={moreMenuRef} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center" }}>
          <button
            onClick={() => setIsMoreMenuOpen((v) => !v)}
            className="btn-icon"
            data-testid="schematic-more-button"
            style={{
              padding: "3px 6px",
              backgroundColor: isMoreMenuOpen ? "rgba(0, 240, 255, 0.15)" : "var(--bg-tertiary)",
              color: isMoreMenuOpen ? "var(--accent-cyan)" : "var(--text-muted)",
              borderRadius: 3,
              border: `1px solid ${isMoreMenuOpen ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1
            }}
            title={t("schematic.moreOptions")}
            aria-label={t("schematic.moreOptions")}
          >
            <MoreVertical size={13} />
          </button>

          {/* Context Menu Dropdown Popover */}
          {isMoreMenuOpen && (
            <div
              data-testid="schematic-more-popover"
              role="dialog"
              aria-label={t("schematic.moreOptions")}
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                width: 280,
                maxWidth: "calc(100vw - 24px)",
                maxHeight: "80vh",
                overflowY: "auto",
                backgroundColor: "#0d131d",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: 6,
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.75)",
                padding: "8px",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 11,
                color: "var(--text-primary)"
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 6,
                  borderBottom: "1px solid var(--border-subtle)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 11, color: "var(--accent-cyan)" }}>
                  <MoreVertical size={12} />
                  <span>{t("schematic.moreOptions")}</span>
                </div>
                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 2,
                    display: "flex",
                    alignItems: "center"
                  }}
                  title="Close (Esc)"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Section 1: Circuit Metrics */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  {t("schematic.circuitMetrics")}
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: 4,
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Cpu size={12} style={{ color: "var(--accent-cyan)" }} />
                    <span style={{ fontWeight: 600 }}>{`${graph.nodes.length} Cells • ${graph.edges.length} Nets`}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    LOD: {lodLevel.toUpperCase()}
                  </span>
                </div>

                {schematicMode === "synth" && synthCircuit && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "6px 8px",
                      backgroundColor: "rgba(168, 85, 247, 0.08)",
                      borderRadius: 4,
                      border: "1px solid rgba(168, 85, 247, 0.25)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, color: "#c084fc", fontSize: 10.5 }}>
                        {synthCircuit.target_device.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
                        {synthCircuit.stats.total_luts} LUTs • {synthCircuit.stats.total_ffs} FFs
                      </span>
                    </div>
                    {(synthCircuit.stats.carry4_count > 0 || synthCircuit.stats.carry8_count > 0) && (
                      <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
                        Carry logic: {synthCircuit.stats.carry4_count} CARRY4 • {synthCircuit.stats.carry8_count} CARRY8
                      </div>
                    )}
                    <button
                      onClick={() => {
                        handleExportSynthesizedVerilog();
                        setIsMoreMenuOpen(false);
                      }}
                      className="btn btn-secondary"
                      style={{
                        marginTop: 2,
                        padding: "3px 6px",
                        fontSize: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        color: exportedVerilog ? "var(--accent-emerald)" : "#c084fc",
                        border: "1px solid rgba(168, 85, 247, 0.3)"
                      }}
                    >
                      {exportedVerilog ? <Check size={11} /> : <Download size={11} />}
                      <span>{exportedVerilog ? "Exported!" : "Export Structural Verilog"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Layout & View Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  {t("schematic.layoutOptions")}
                </span>

                {/* Orientation Selector */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{t("schematic.orientation")}</span>
                  <div style={{ display: "flex", backgroundColor: "var(--bg-tertiary)", borderRadius: 4, border: "1px solid var(--border-subtle)", padding: 1, gap: 1 }}>
                    <button
                      onClick={() => {
                        if (orientation !== "horizontal") {
                          setOrientation("horizontal");
                          setTimeout(fitToScreen, 10);
                        }
                      }}
                      style={{
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: orientation === "horizontal" ? 600 : 400,
                        backgroundColor: orientation === "horizontal" ? "rgba(0, 240, 255, 0.15)" : "transparent",
                        color: orientation === "horizontal" ? "var(--accent-cyan)" : "var(--text-muted)",
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3
                      }}
                    >
                      <ArrowRightLeft size={10} />
                      <span>{t("schematic.horizontal")}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (orientation !== "vertical") {
                          setOrientation("vertical");
                          setTimeout(fitToScreen, 10);
                        }
                      }}
                      style={{
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: orientation === "vertical" ? 600 : 400,
                        backgroundColor: orientation === "vertical" ? "rgba(0, 240, 255, 0.15)" : "transparent",
                        color: orientation === "vertical" ? "var(--accent-cyan)" : "var(--text-muted)",
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3
                      }}
                    >
                      <ArrowUpDown size={10} />
                      <span>{t("schematic.vertical")}</span>
                    </button>
                  </div>
                </div>

                {/* Wire Crossings */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{t("schematic.crossoverStyle")}</span>
                  <div style={{ display: "flex", backgroundColor: "var(--bg-tertiary)", borderRadius: 4, border: "1px solid var(--border-subtle)", padding: 1, gap: 1 }}>
                    <button
                      onClick={() => setCrossoverStyle("arc")}
                      style={{
                        padding: "3px 6px",
                        fontSize: 9.5,
                        fontWeight: crossoverStyle === "arc" ? 600 : 400,
                        backgroundColor: crossoverStyle === "arc" ? "rgba(0, 240, 255, 0.15)" : "transparent",
                        color: crossoverStyle === "arc" ? "var(--accent-cyan)" : "var(--text-muted)",
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      {t("schematic.crossoverArc")}
                    </button>
                    <button
                      onClick={() => setCrossoverStyle("gap")}
                      style={{
                        padding: "3px 6px",
                        fontSize: 9.5,
                        fontWeight: crossoverStyle === "gap" ? 600 : 400,
                        backgroundColor: crossoverStyle === "gap" ? "rgba(0, 240, 255, 0.15)" : "transparent",
                        color: crossoverStyle === "gap" ? "var(--accent-cyan)" : "var(--text-muted)",
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      {t("schematic.crossoverGap")}
                    </button>
                    <button
                      onClick={() => setCrossoverStyle("straight")}
                      style={{
                        padding: "3px 6px",
                        fontSize: 9.5,
                        fontWeight: crossoverStyle === "straight" ? 600 : 400,
                        backgroundColor: crossoverStyle === "straight" ? "rgba(0, 240, 255, 0.15)" : "transparent",
                        color: crossoverStyle === "straight" ? "var(--accent-cyan)" : "var(--text-muted)",
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      {t("schematic.crossoverStraight")}
                    </button>
                  </div>
                </div>

                {/* Minimap Toggle */}
                <div
                  onClick={() => setShowMinimap(!showMinimap)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: 4,
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={12} style={{ color: showMinimap ? "var(--accent-cyan)" : "var(--text-muted)" }} />
                    <span>{t("schematic.minimap")}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: showMinimap ? "var(--accent-cyan)" : "var(--text-muted)" }}>
                    {showMinimap ? "ON" : "OFF"}
                  </span>
                </div>

                {/* Quick Fit & Zoom Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                  <button
                    onClick={() => {
                      fitToScreen();
                      setIsMoreMenuOpen(false);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "4px 6px", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                    title={t("schematic.fitScreen")}
                  >
                    <Maximize2 size={11} />
                    <span>{t("schematic.fitScreen")}</span>
                  </button>
                  <button
                    onClick={() => {
                      handleResetZoom();
                      setIsMoreMenuOpen(false);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "4px 6px", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                    title={t("schematic.resetZoom")}
                  >
                    <RotateCcw size={11} />
                    <span>100%</span>
                  </button>
                  <button
                    onClick={() => setScale((s) => Math.min(s * 1.25, 3.5))}
                    className="btn btn-secondary"
                    style={{ padding: "4px 6px", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                    title={t("schematic.zoomIn")}
                  >
                    <ZoomIn size={11} />
                    <span>+</span>
                  </button>
                  <button
                    onClick={() => setScale((s) => Math.max(s / 1.25, 0.2))}
                    className="btn btn-secondary"
                    style={{ padding: "4px 6px", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                    title={t("schematic.zoomOut")}
                  >
                    <ZoomOut size={11} />
                    <span>-</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Analysis & Filters */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  {t("schematic.analysisFilters")}
                </span>

                {/* Live Values Toggle */}
                <div
                  onClick={() => setShowLiveValues(!showLiveValues)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: 4,
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={12} style={{ color: showLiveValues ? "var(--accent-emerald)" : "var(--text-muted)" }} />
                    <span>{t("schematic.liveValues")}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: showLiveValues ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                    {showLiveValues ? "ON" : "OFF"}
                  </span>
                </div>

                {/* Clock Nets Filter */}
                <div
                  onClick={() => setHideClockNets(!hideClockNets)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: 4,
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={12} style={{ color: hideClockNets ? "var(--accent-amber)" : "var(--text-muted)" }} />
                    <span>{hideClockNets ? t("schematic.showClockNets") : t("schematic.hideClockNets")}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: hideClockNets ? "var(--accent-amber)" : "var(--text-muted)" }}>
                    {hideClockNets ? "Hidden" : "Visible"}
                  </span>
                </div>

                {/* Logic Cone Slicing Actions */}
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => {
                      handleSliceFanin();
                      setIsMoreMenuOpen(false);
                    }}
                    disabled={!selectedNodeId && !selectedEdgeId}
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      padding: "4px 6px",
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      opacity: !selectedNodeId && !selectedEdgeId ? 0.5 : 1,
                      cursor: !selectedNodeId && !selectedEdgeId ? "not-allowed" : "pointer"
                    }}
                    title={t("schematic.fanin")}
                  >
                    <Filter size={10} />
                    <span>Fan-In [F]</span>
                  </button>
                  <button
                    onClick={() => {
                      handleSliceFanout();
                      setIsMoreMenuOpen(false);
                    }}
                    disabled={!selectedNodeId && !selectedEdgeId}
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      padding: "4px 6px",
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      opacity: !selectedNodeId && !selectedEdgeId ? 0.5 : 1,
                      cursor: !selectedNodeId && !selectedEdgeId ? "not-allowed" : "pointer"
                    }}
                    title="Slice Fan-Out Driven Tree (O)"
                  >
                    <Layers size={10} />
                    <span>Fan-Out [O]</span>
                  </button>
                </div>

                {activeCone && (
                  <button
                    onClick={() => {
                      handleClearSlice();
                      setIsMoreMenuOpen(false);
                    }}
                    className="btn btn-danger"
                    style={{
                      padding: "4px 6px",
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      cursor: "pointer"
                    }}
                  >
                    <X size={10} />
                    <span>{t("schematic.clearCone")}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <canvas
        ref={canvasRef}
        data-testid="schematic-canvas"
        className="schematic-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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

            {onOpenAutoPipeline && activeCone.isSlackViolated && (
              <button
                onClick={() => onOpenAutoPipeline(activeCone)}
                style={{
                  gridColumn: "1 / -1",
                  marginTop: 6,
                  padding: "6px 10px",
                  background: "linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(168, 85, 247, 0.25))",
                  border: "1px solid rgba(244, 63, 94, 0.6)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 10.5,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 8px rgba(244, 63, 94, 0.2)"
                }}
              >
                <Zap size={12} color="#f43f5e" />
                <span>Silicon Copilot: Auto-Pipeline Path</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive LUT Inspector & Physical Cell Overlay Card */}
      {selectedLutCell && (
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 14,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(168, 85, 247, 0.6)",
            borderRadius: 6,
            padding: "10px 14px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 25,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: 320,
            maxHeight: "calc(100% - 70px)",
            overflowY: "auto"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Layers size={13} color="#c084fc" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
                {selectedLutCell.kind} Inspector
              </span>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
            <span>Instance: <span style={{ color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{selectedLutCell.id}</span></span>
            <span>Delay: <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{selectedLutCell.delay_ps} ps</span></span>
          </div>

          {selectedLutCell.equation && (
            <div style={{ backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 4, padding: "6px 8px" }}>
              <div style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Boolean Equation</div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#38bdf8", wordBreak: "break-all" }}>
                {selectedLutCell.equation}
              </div>
            </div>
          )}

          {selectedLutCell.params.INIT !== undefined && (
            <div style={{ backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 4, padding: "6px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>64-Bit INIT Mask</span>
                <button
                  onClick={() => {
                    const hexStr = `64'h${selectedLutCell.params.INIT.toString(16).toUpperCase().padStart(16, "0")}`;
                    navigator.clipboard.writeText(hexStr);
                    setCopiedInit(true);
                    setTimeout(() => setCopiedInit(false), 1500);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: copiedInit ? "var(--accent-emerald)" : "var(--accent-cyan)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 9.5
                  }}
                >
                  {copiedInit ? <Check size={10} /> : <Copy size={10} />}
                  <span>{copiedInit ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a855f7" }}>
                64'h{selectedLutCell.params.INIT.toString(16).toUpperCase().padStart(16, "0")}
              </div>
            </div>
          )}

          {/* Truth Table for LUT cells */}
          {selectedLutCell.kind.toLowerCase().startsWith("lut") && selectedLutCell.params.INIT !== undefined && (() => {
            const inputPins = Object.keys(selectedLutCell.ports).filter((p) => p.startsWith("I")).sort();
            const k = inputPins.length > 0 ? Math.min(inputPins.length, 6) : Math.min(parseInt(selectedLutCell.kind.replace(/\D/g, "") || "2", 10), 6);
            const numRows = Math.pow(2, k);
            const initMask = selectedLutCell.params.INIT;

            let liveRow: number | null = null;
            let allInputsKnown = true;
            let computedLiveRow = 0;
            for (let i = 0; i < k; i++) {
              const pin = `I${i}`;
              const net = selectedLutCell.ports[pin] || "";
              const val = liveValuesMap.get(net);
              if (val === "1") {
                computedLiveRow |= (1 << i);
              } else if (val !== "0") {
                allInputsKnown = false;
                break;
              }
            }
            if (allInputsKnown) {
              liveRow = computedLiveRow;
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Truth Table (2^{k} = {numRows} States)
                  </span>
                  {liveRow !== null && (
                    <span style={{ fontSize: 9, color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent-emerald)" }} />
                      Active State: Row {liveRow}
                    </span>
                  )}
                </div>

                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: 4 }}>
                  <table style={{ width: "100%", fontSize: 10, fontFamily: "var(--font-mono)", borderCollapse: "collapse", textAlign: "center" }}>
                    <thead>
                      <tr style={{ backgroundColor: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {Array.from({ length: k }).map((_, i) => (
                          <th key={i} style={{ padding: "3px 4px", color: "var(--text-secondary)" }}>I{i}</th>
                        ))}
                        <th style={{ padding: "3px 4px", color: "var(--accent-cyan)", borderLeft: "1px solid var(--border-subtle)" }}>O</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: numRows }).map((_, rowIdx) => {
                        const isLive = liveRow === rowIdx;
                        const outBit = (initMask >> rowIdx) & 1;
                        return (
                          <tr
                            key={rowIdx}
                            style={{
                              backgroundColor: isLive ? "rgba(16, 185, 129, 0.2)" : rowIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                              color: isLive ? "#fff" : "var(--text-muted)",
                              fontWeight: isLive ? 700 : 400
                            }}
                          >
                            {Array.from({ length: k }).map((_, i) => {
                              const inBit = (rowIdx >> i) & 1;
                              return (
                                <td key={i} style={{ padding: "2px 4px" }}>{inBit}</td>
                              );
                            })}
                            <td style={{
                              padding: "2px 4px",
                              borderLeft: "1px solid var(--border-subtle)",
                              color: outBit === 1 ? "var(--accent-emerald)" : "var(--text-muted)",
                              fontWeight: 700
                            }}>
                              {outBit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Port mappings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>Pin Connections</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, maxHeight: 100, overflowY: "auto" }}>
              {Object.entries(selectedLutCell.ports).map(([pin, net]) => {
                const liveVal = liveValuesMap.get(net);
                return (
                  <div key={pin} style={{ fontSize: 10, fontFamily: "var(--font-mono)", backgroundColor: "rgba(0,0,0,0.3)", padding: "2px 5px", borderRadius: 3, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>.{pin}</span>
                    <span style={{ color: liveVal === "1" ? "var(--accent-emerald)" : liveVal === "0" ? "#94a3b8" : "var(--accent-cyan)" }}>
                      {net} {liveVal !== undefined ? `[${liveVal}]` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rich Vivado-Grade Gate Inspector Tooltip */}
      {activeHoverNode && activeGateDetails && (
        <div
          style={{
            position: "fixed",
            left: nodeTooltipPos.x,
            top: nodeTooltipPos.y,
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
            left: edgeTooltipPos.x,
            top: edgeTooltipPos.y,
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
  } else if (labelUpper.includes("DSP48") || labelUpper.includes("DSP")) {
    gateType = "operator";
    badge = "DSP SLICE (DSP48E2)";
    ieeeSymbol = "DSP48E2";
    bgColor = "#26191b";
    borderColor = "#e11d48";
    accentColor = "#fb7185";
  } else if (labelUpper.includes("RAMB") || labelUpper.includes("BRAM")) {
    gateType = "operator";
    badge = "BLOCK RAM (RAMB36E2)";
    ieeeSymbol = "RAMB36";
    bgColor = "#141f2e";
    borderColor = "#0284c7";
    accentColor = "#38bdf8";
  } else if (labelUpper.includes("LUT6") || labelUpper.includes("LUT")) {
    gateType = "operator";
    badge = "LOOK-UP TABLE (LUT6_2)";
    ieeeSymbol = "LUT6_2";
    bgColor = "#1e182e";
    borderColor = "#7c3aed";
    accentColor = "#c084fc";
  } else if (labelUpper.includes("BUFG")) {
    gateType = "buf";
    badge = "GLOBAL CLOCK BUFFER (BUFG)";
    ieeeSymbol = "BUFG";
    bgColor = "#132328";
    borderColor = "#0d9488";
    accentColor = "#2dd4bf";
  } else if (labelUpper.includes("CARRY")) {
    gateType = "operator";
    badge = "CARRY CHAIN (CARRY4)";
    ieeeSymbol = "CARRY4";
    bgColor = "#262016";
    borderColor = "#d97706";
    accentColor = "#fbbf24";
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
  h: number,
  isVertical: boolean = false
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
      drawOrInputLeads(ctx, node, x, y, w, h, isVertical);
      break;
    case "nor":
      drawNorShape(ctx, x, y, w, h);
      drawOrInputLeads(ctx, node, x, y, w - 8, h, isVertical);
      break;
    case "xor":
      drawXorShape(ctx, x, y, w, h);
      ctx.fill();
      ctx.stroke();
      drawOrInputLeads(ctx, node, x, y, w - 6, h, isVertical);
      break;
    case "xnor":
      drawXnorShape(ctx, x, y, w, h);
      drawOrInputLeads(ctx, node, x, y, w - 14, h, isVertical);
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

function drawPortInVertical(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tipH = 7;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + w - 2, y);
  ctx.lineTo(x + w - 2, y + h - tipH);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x + 2, y + h - tipH);
  ctx.closePath();
}

function drawPortOutVertical(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tipH = 7;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + w / 2, y + tipH);
  ctx.lineTo(x + w - 2, y);
  ctx.lineTo(x + w - 2, y + h);
  ctx.lineTo(x + 2, y + h);
  ctx.closePath();
}

function drawOrInputLeads(
  ctx: CanvasRenderingContext2D,
  node: SchematicNode,
  x: number,
  y: number,
  w: number,
  h: number,
  isVertical: boolean = false
) {
  for (const pin of node.inputs) {
    const pos = isVertical ? pin.offsetX : pin.offsetY;
    if (pos === undefined) continue;
    const t = Math.max(0, Math.min(1, pos / h));
    const indent = w * 0.22 * (4 * t * (1 - t));
    if (indent > 1) {
      ctx.beginPath();
      ctx.moveTo(x, y + pos);
      ctx.lineTo(x + indent, y + pos);
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
    liveEval = `~${node.inputs[0].name}[${inVal}] -> ${outVal}`;
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
    liveEval = `${node.inputs[0].name}[${in1Val}] & ${node.inputs[1].name}[${in2Val}] -> ${outVal}`;
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
    liveEval = `${node.inputs[0].name}[${in1Val}] | ${node.inputs[1].name}[${in2Val}] -> ${outVal}`;
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
    liveEval = `${node.inputs[0].name}[${in1Val}] ^ ${node.inputs[1].name}[${in2Val}] -> ${outVal}`;
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
