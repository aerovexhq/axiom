import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Eye,
  EyeOff,
  Cpu,
  Search,
  ExternalLink,
  Sparkles,
  Clock,
  Zap,
  Boxes
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  MicroarchGraph,
  MacroBlock,
  MicroarchBus,
  FsmMacro,
  AluMacro,
  RegisterFileMacro,
  synthesizeMicroarchGraph
} from "../engine/microarchModel";
import { FsmBubbleModal } from "./microarch/FsmBubbleModal";
import { AluInspectorModal, MicroarchRadix, formatRadix } from "./microarch/AluInspectorModal";
import { RegFileModal } from "./microarch/RegFileModal";

interface MicroarchViewerProps {
  state: SimulationState;
  activeDesignId: string;
  verilogSource?: string;
  selectedSignalId?: string | null;
  onSelectSignal?: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export const MicroarchViewer: React.FC<MicroarchViewerProps> = ({
  state,
  activeDesignId,
  verilogSource,
  selectedSignalId: _selectedSignalId,
  onSelectSignal,
  onJumpToCode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active micro-architecture graph (dynamic with fallback)
  const [graph, setGraph] = useState<MicroarchGraph>(() => synthesizeMicroarchGraph(activeDesignId));

  // Radix state: hex, dec, bin
  const [radix, setRadix] = useState<MicroarchRadix>("hex");

  // Visibility filters
  const [showDatapathBuses, setShowDatapathBuses] = useState<boolean>(true);
  const [showControlWires, setShowControlWires] = useState<boolean>(true);
  const [showLiveValues, setShowLiveValues] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Selection & Hover
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredBusId, setHoveredBusId] = useState<string | null>(null);

  // Deep-dive inspector modals
  const [inspectingFsm, setInspectingFsm] = useState<{ fsm: FsmMacro; label: string } | null>(null);
  const [inspectingAlu, setInspectingAlu] = useState<{ alu: AluMacro; label: string } | null>(null);
  const [inspectingRegFile, setInspectingRegFile] = useState<{ regFile: RegisterFileMacro; label: string } | null>(null);

  // Camera State: Pan & Zoom with persistence
  const [scale, setScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_microarch_cam_${activeDesignId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.scale === "number" && parsed.scale > 0) return parsed.scale;
      }
    } catch {}
    return 1.0;
  });

  const [offsetX, setOffsetX] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_microarch_cam_${activeDesignId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.offsetX === "number") return parsed.offsetX;
      }
    } catch {}
    return 40;
  });

  const [offsetY, setOffsetY] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_microarch_cam_${activeDesignId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.offsetY === "number") return parsed.offsetY;
      }
    } catch {}
    return 40;
  });

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Save camera to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        `axiom_microarch_cam_${activeDesignId || "default"}`,
        JSON.stringify({ scale, offsetX, offsetY })
      );
    } catch {}
  }, [scale, offsetX, offsetY, activeDesignId]);

  // Attempt dynamic synthesis from engineBridge if source code is available
  useEffect(() => {
    let cancelled = false;
    const loadGraph = async () => {
      if (verilogSource && verilogSource.trim().length > 0) {
        try {
          const res = await engineBridge.synthesizeMicroarch(verilogSource, activeDesignId);
          if (res && res.blocks && res.blocks.length > 0 && !cancelled) {
            setGraph(res);
            return;
          }
        } catch (e) {
          console.warn("[MicroarchViewer] Dynamic synthesis fallback:", e);
        }
      }
      if (!cancelled) {
        setGraph(synthesizeMicroarchGraph(activeDesignId));
      }
    };
    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [activeDesignId, verilogSource]);

  // Helper to extract live signal value from simulation state
  const getSignalValue = useCallback(
    (signalName: string): number | string => {
      if (!state.signals || state.signals.length === 0) return 0;
      const cleanName = signalName.replace(/\[.*\]/, "").trim();
      const sig = state.signals.find(
        (s) => s.name === cleanName || s.fullName.endsWith(`.${cleanName}`) || s.id === cleanName
      );
      if (!sig || !sig.samples || sig.samples.length === 0) return 0;
      const latest = sig.samples[sig.samples.length - 1];
      if (typeof latest.value === "number") return latest.value;
      const parsed = parseInt(String(latest.value).replace(/^0x/i, ""), 16);
      return isNaN(parsed) ? 0 : parsed;
    },
    [state.signals]
  );

  // Category Color Palette
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Control":
        return { primary: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.4)" };
      case "Datapath":
        return { primary: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", border: "rgba(6, 182, 212, 0.4)" };
      case "Memory":
        return { primary: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.4)" };
      case "Peripheral":
        return { primary: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.4)" };
      default:
        return { primary: "#64748b", bg: "rgba(100, 116, 139, 0.12)", border: "rgba(100, 116, 139, 0.4)" };
    }
  };

  // Canvas ResizeObserver & Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animFrameId: number;

    const render = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Dark background
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, w, h);

      // World-space transform
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // 1. Grid Background
      const gridPitch = 30;
      const worldLeft = -offsetX / scale;
      const worldTop = -offsetY / scale;
      const worldRight = worldLeft + w / scale;
      const worldBottom = worldTop + h / scale;

      const startX = Math.floor(worldLeft / gridPitch) * gridPitch;
      const endX = Math.ceil(worldRight / gridPitch) * gridPitch;
      const startY = Math.floor(worldTop / gridPitch) * gridPitch;
      const endY = Math.ceil(worldBottom / gridPitch) * gridPitch;

      ctx.strokeStyle = "#161b22";
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      for (let gx = startX; gx <= endX; gx += gridPitch) {
        ctx.moveTo(gx, worldTop);
        ctx.lineTo(gx, worldBottom);
      }
      for (let gy = startY; gy <= endY; gy += gridPitch) {
        ctx.moveTo(worldLeft, gy);
        ctx.lineTo(worldRight, gy);
      }
      ctx.stroke();

      // Filtered blocks
      const matchingBlockIds = new Set(
        graph.blocks
          .filter(
            (b) =>
              !searchFilter ||
              b.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
              b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
              b.category.toLowerCase().includes(searchFilter.toLowerCase())
          )
          .map((b) => b.id)
      );

      // 2. Control Wires (render underneath buses)
      if (showControlWires) {
        graph.control_wires.forEach((cw) => {
          const isSelected = selectedBusId === cw.id;
          const isHovered = hoveredBusId === cw.id;

          const isClock = cw.signal_type === "Clock";
          const isReset = cw.signal_type === "Reset";
          const wireColor = isClock ? "#f43f5e" : isReset ? "#ef4444" : "#f59e0b";

          ctx.lineWidth = isSelected || isHovered ? 2.5 : 1.5;
          ctx.strokeStyle = isSelected ? "#38bdf8" : isHovered ? "#fcd34d" : wireColor;

          if (isClock || isReset) {
            ctx.setLineDash([4, 4]);
          } else {
            ctx.setLineDash([]);
          }

          ctx.beginPath();
          cw.wire_points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt[0], pt[1]);
            else ctx.lineTo(pt[0], pt[1]);
          });
          ctx.stroke();
          ctx.setLineDash([]);

          // Arrowhead
          if (cw.wire_points.length >= 2) {
            const last = cw.wire_points[cw.wire_points.length - 1];
            const prev = cw.wire_points[cw.wire_points.length - 2];
            const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(last[0] - 6 * Math.cos(angle - Math.PI / 6), last[1] - 6 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(last[0] - 6 * Math.cos(angle + Math.PI / 6), last[1] - 6 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }

          // Small signal tag along wire
          if (scale > 0.65 && cw.wire_points.length >= 2) {
            const midIdx = Math.floor(cw.wire_points.length / 2);
            const p1 = cw.wire_points[midIdx - 1];
            const p2 = cw.wire_points[midIdx];
            const midX = (p1[0] + p2[0]) / 2;
            const midY = (p1[1] + p2[1]) / 2;

            ctx.font = "9px monospace";
            const textWidth = ctx.measureText(cw.name).width;

            ctx.fillStyle = "#0c1017";
            ctx.fillRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 12);
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.strokeRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 12);

            ctx.fillStyle = isSelected ? "#38bdf8" : "#94a3b8";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(cw.name, midX, midY);
          }
        });
      }

      // 3. Thick Datapath Buses
      if (showDatapathBuses) {
        graph.buses.forEach((bus) => {
          const isSelected = selectedBusId === bus.id;
          const isHovered = hoveredBusId === bus.id;

          const busWidthPx = bus.width >= 8 ? 4 : 3;
          ctx.lineWidth = isSelected ? busWidthPx + 2 : isHovered ? busWidthPx + 1 : busWidthPx;
          ctx.strokeStyle = isSelected ? "#f59e0b" : isHovered ? "#38bdf8" : "#0284c7";

          // Glow shadow if selected or hovered
          if (isSelected || isHovered) {
            ctx.shadowColor = isSelected ? "rgba(245, 158, 11, 0.5)" : "rgba(56, 189, 248, 0.5)";
            ctx.shadowBlur = 8;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          bus.wire_points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt[0], pt[1]);
            else ctx.lineTo(pt[0], pt[1]);
          });
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Arrowhead
          if (bus.wire_points.length >= 2) {
            const last = bus.wire_points[bus.wire_points.length - 1];
            const prev = bus.wire_points[bus.wire_points.length - 2];
            const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(last[0] - 8 * Math.cos(angle - Math.PI / 6), last[1] - 8 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(last[0] - 8 * Math.cos(angle + Math.PI / 6), last[1] - 8 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }

          // Bus Slash Marker & Live Value Pill
          if (scale > 0.55 && bus.wire_points.length >= 2) {
            // Find longest horizontal or vertical segment
            let maxLen = 0;
            let segStart = bus.wire_points[0];
            let segEnd = bus.wire_points[1];
            for (let i = 0; i < bus.wire_points.length - 1; i++) {
              const dx = bus.wire_points[i + 1][0] - bus.wire_points[i][0];
              const dy = bus.wire_points[i + 1][1] - bus.wire_points[i][1];
              const len = Math.hypot(dx, dy);
              if (len > maxLen) {
                maxLen = len;
                segStart = bus.wire_points[i];
                segEnd = bus.wire_points[i + 1];
              }
            }

            const midX = (segStart[0] + segEnd[0]) / 2;
            const midY = (segStart[1] + segEnd[1]) / 2;

            // Bus bit-width slash '/'
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(midX - 4, midY + 5);
            ctx.lineTo(midX + 4, midY - 5);
            ctx.stroke();

            ctx.font = "bold 9px monospace";
            ctx.fillStyle = "#38bdf8";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(String(bus.width), midX + 6, midY - 6);

            // Live value badge pill (if enabled)
            if (showLiveValues) {
              const liveVal = getSignalValue(bus.name);
              const formattedVal = formatRadix(liveVal, bus.width, radix);

              ctx.font = "10px monospace";
              const valWidth = ctx.measureText(formattedVal).width;
              const pillW = valWidth + 10;
              const pillH = 16;
              const pillX = midX - pillW / 2;
              const pillY = midY + 8;

              ctx.fillStyle = "#0c1017";
              ctx.fillRect(pillX, pillY, pillW, pillH);
              ctx.strokeStyle = isSelected ? "#f59e0b" : "rgba(56, 189, 248, 0.4)";
              ctx.lineWidth = 1;
              ctx.strokeRect(pillX, pillY, pillW, pillH);

              ctx.fillStyle = isSelected ? "#f59e0b" : "#38bdf8";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(formattedVal, midX, pillY + pillH / 2);
            }
          }
        });
      }

      // 4. Macro Blocks
      graph.blocks.forEach((block) => {
        const isSelected = selectedBlockId === block.id;
        const isHovered = hoveredBlockId === block.id;
        const isMatch = matchingBlockIds.has(block.id);
        const colorPalette = getCategoryColor(block.category);

        // Opacity when search active
        ctx.globalAlpha = searchFilter && !isMatch ? 0.25 : 1.0;

        // Block Body Shadow & Glow
        if (isSelected) {
          ctx.shadowColor = colorPalette.primary;
          ctx.shadowBlur = 16;
        } else if (isHovered) {
          ctx.shadowColor = "rgba(56, 189, 248, 0.4)";
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }

        // Background fill
        ctx.fillStyle = isSelected ? "rgba(22, 27, 34, 0.98)" : "#161b22";
        ctx.strokeStyle = isSelected
          ? colorPalette.primary
          : isHovered
          ? "#38bdf8"
          : colorPalette.border;
        ctx.lineWidth = isSelected ? 2 : 1.5;

        // Rounded Box
        const r = 6;
        ctx.beginPath();
        ctx.roundRect(block.x, block.y, block.width, block.height, r);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Header Stripe
        const headerH = 26;
        ctx.fillStyle = colorPalette.bg;
        ctx.beginPath();
        ctx.roundRect(block.x + 1, block.y + 1, block.width - 2, headerH, [r, r, 0, 0]);
        ctx.fill();

        ctx.strokeStyle = colorPalette.border;
        ctx.beginPath();
        ctx.moveTo(block.x, block.y + headerH);
        ctx.lineTo(block.x + block.width, block.y + headerH);
        ctx.stroke();

        // Block Title & Category Badge
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(block.label, block.x + 10, block.y + headerH / 2);

        // Category Tag
        ctx.font = "9px sans-serif";
        const catText = block.category.toUpperCase();
        const catW = ctx.measureText(catText).width + 8;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(block.x + block.width - catW - 8, block.y + 5, catW, 16);
        ctx.strokeStyle = colorPalette.border;
        ctx.strokeRect(block.x + block.width - catW - 8, block.y + 5, catW, 16);
        ctx.fillStyle = colorPalette.primary;
        ctx.textAlign = "center";
        ctx.fillText(catText, block.x + block.width - 8 - catW / 2, block.y + 13);

        // Subtitle / Architecture Type
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "var(--text-muted, #8b949e)";
        ctx.textAlign = "left";
        ctx.fillText(block.sublabel, block.x + 10, block.y + headerH + 14);

        // Block Kind Specific Details
        if (block.kind.type === "Fsm") {
          const fsm = block.kind.data as FsmMacro;
          const liveState = String(getSignalValue(fsm.state_reg));
          ctx.font = "10px monospace";
          ctx.fillStyle = "#f59e0b";
          ctx.fillText(`State: ${liveState || fsm.reset_state}`, block.x + 10, block.y + headerH + 32);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`States: ${fsm.states.length} | Inputs: ${fsm.inputs.length}`, block.x + 10, block.y + headerH + 48);

          // Deep-dive pill button indicator
          ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
          ctx.fillRect(block.x + 10, block.y + block.height - 24, block.width - 20, 18);
          ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
          ctx.strokeRect(block.x + 10, block.y + block.height - 24, block.width - 20, 18);
          ctx.fillStyle = "#f59e0b";
          ctx.textAlign = "center";
          ctx.fillText("⚡ Double-click: FSM Bubble Diagram", block.x + block.width / 2, block.y + block.height - 15);
        } else if (block.kind.type === "Alu") {
          const alu = block.kind.data as AluMacro;
          const liveOp = Number(getSignalValue(alu.opcode_signal)) || 0;
          const opObj = alu.operations.find((op) => op.opcode_val === liveOp) || alu.operations[0];
          ctx.font = "10px monospace";
          ctx.fillStyle = "#38bdf8";
          ctx.fillText(`Active Op: ${opObj?.name || "ADD"} (${opObj?.expression || "+"})`, block.x + 10, block.y + headerH + 32);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`Operands: ${alu.operand_width}b | Ops: ${alu.operations.length}`, block.x + 10, block.y + headerH + 48);

          // Deep-dive pill button indicator
          ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
          ctx.fillRect(block.x + 10, block.y + block.height - 24, block.width - 20, 18);
          ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
          ctx.strokeRect(block.x + 10, block.y + block.height - 24, block.width - 20, 18);
          ctx.fillStyle = "#38bdf8";
          ctx.textAlign = "center";
          ctx.fillText("⚡ Double-click: ALU Function Table", block.x + block.width / 2, block.y + block.height - 15);
        } else if (block.kind.type === "RegisterFile") {
          const rf = block.kind.data as RegisterFileMacro;
          ctx.font = "10px monospace";
          ctx.fillStyle = "#a855f7";
          ctx.fillText(`Capacity: ${rf.depth} words × ${rf.word_width}-bit`, block.x + 10, block.y + headerH + 32);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`Read Ports: ${rf.read_ports.length} | Write: ${rf.write_ports.length}`, block.x + 10, block.y + headerH + 48);

          // Deep-dive pill button indicator
          ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
          ctx.fillRect(block.x + 10, block.y + block.height - 24, block.width - 20, 18);
          ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
          ctx.strokeRect(block.x + 10, block.y + block.height - 24, block.width - 20, 18);
          ctx.fillStyle = "#c084fc";
          ctx.textAlign = "center";
          ctx.fillText("⚡ Double-click: Register Matrix", block.x + block.width / 2, block.y + block.height - 15);
        } else if (block.kind.type === "DatapathReg") {
          const reg = block.kind.data;
          const liveVal = getSignalValue(reg.name);
          ctx.font = "10px monospace";
          ctx.fillStyle = "#10b981";
          ctx.fillText(`Current: ${formatRadix(liveVal, reg.width, radix)}`, block.x + 10, block.y + headerH + 32);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`Behavior: ${reg.step_behavior || "Register"}`, block.x + 10, block.y + headerH + 48);
        } else if (block.kind.type === "Decoder") {
          const dec = block.kind.data;
          ctx.font = "9.5px monospace";
          ctx.fillStyle = "#fb923c";
          ctx.fillText(`Input: ${dec.input_bus}`, block.x + 10, block.y + headerH + 28);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`Fields: ${dec.fields.map((f: any) => f.name).join(", ")}`, block.x + 10, block.y + headerH + 44);
        }

        // Ports Rendering (Pins on border)
        block.inputs.forEach((p) => {
          const px = block.x + p.offset_x;
          const py = block.y + p.offset_y;
          ctx.fillStyle = p.is_clock ? "#f43f5e" : p.is_datapath ? "#38bdf8" : "#f59e0b";
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();

          if (scale > 0.7) {
            ctx.font = "8.5px monospace";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.textAlign = "left";
            ctx.fillText(p.name, px + 5, py + 3);
          }
        });

        block.outputs.forEach((p) => {
          const px = block.x + p.offset_x;
          const py = block.y + p.offset_y;
          ctx.fillStyle = p.is_datapath ? "#38bdf8" : "#f59e0b";
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();

          if (scale > 0.7) {
            ctx.font = "8.5px monospace";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.textAlign = "right";
            ctx.fillText(p.name, px - 5, py + 3);
          }
        });

        ctx.globalAlpha = 1.0;
      });

      ctx.restore();
      ctx.restore();
    };

    render();
    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [
    graph,
    scale,
    offsetX,
    offsetY,
    radix,
    showDatapathBuses,
    showControlWires,
    showLiveValues,
    searchFilter,
    selectedBlockId,
    selectedBusId,
    hoveredBlockId,
    hoveredBusId,
    state,
    getSignalValue
  ]);

  // Coordinate Conversion (Viewport to World)
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      return {
        x: (sx - offsetX) / scale,
        y: (sy - offsetY) / scale
      };
    },
    [offsetX, offsetY, scale]
  );

  // Mouse Down (Start Pan or Select)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      // Left click
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);

      // Check if clicking a block
      const hitBlock = graph.blocks.find(
        (b) =>
          world.x >= b.x &&
          world.x <= b.x + b.width &&
          world.y >= b.y &&
          world.y <= b.y + b.height
      );

      if (hitBlock) {
        setSelectedBlockId(hitBlock.id);
        setSelectedBusId(null);
        if (onSelectSignal) onSelectSignal(hitBlock.name);
      } else {
        // Check if clicking near a bus
        let hitBus: MicroarchBus | null = null;
        for (const bus of graph.buses) {
          for (let i = 0; i < bus.wire_points.length - 1; i++) {
            const p1 = bus.wire_points[i];
            const p2 = bus.wire_points[i + 1];
            // Point-to-segment distance
            const d = distToSegment(world.x, world.y, p1[0], p1[1], p2[0], p2[1]);
            if (d < 10) {
              hitBus = bus;
              break;
            }
          }
          if (hitBus) break;
        }

        if (hitBus) {
          setSelectedBusId(hitBus.id);
          setSelectedBlockId(null);
          if (onSelectSignal) onSelectSignal(hitBus.name);
        } else {
          // Clear selection and start pan
          setSelectedBlockId(null);
          setSelectedBusId(null);
          setIsPanning(true);
          setPanStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
        }
      }
    }
  };

  // Mouse Move (Pan or Hover)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isPanning) {
      setOffsetX(e.clientX - panStart.x);
      setOffsetY(e.clientY - panStart.y);
      return;
    }

    const world = screenToWorld(sx, sy);

    // Hover block
    const hitBlock = graph.blocks.find(
      (b) =>
        world.x >= b.x &&
        world.x <= b.x + b.width &&
        world.y >= b.y &&
        world.y <= b.y + b.height
    );
    setHoveredBlockId(hitBlock ? hitBlock.id : null);

    if (!hitBlock) {
      // Hover bus
      let hitBus: MicroarchBus | null = null;
      for (const bus of graph.buses) {
        for (let i = 0; i < bus.wire_points.length - 1; i++) {
          const p1 = bus.wire_points[i];
          const p2 = bus.wire_points[i + 1];
          const d = distToSegment(world.x, world.y, p1[0], p1[1], p2[0], p2[1]);
          if (d < 10) {
            hitBus = bus;
            break;
          }
        }
        if (hitBus) break;
      }
      setHoveredBusId(hitBus ? hitBus.id : null);
    } else {
      setHoveredBusId(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Double Click (Deep-Dive Trigger)
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);

    const hitBlock = graph.blocks.find(
      (b) =>
        world.x >= b.x &&
        world.x <= b.x + b.width &&
        world.y >= b.y &&
        world.y <= b.y + b.height
    );

    if (hitBlock) {
      triggerInspect(hitBlock);
    }
  };

  const triggerInspect = (block: MacroBlock) => {
    if (block.kind.type === "Fsm") {
      setInspectingFsm({ fsm: block.kind.data, label: block.label });
    } else if (block.kind.type === "Alu") {
      setInspectingAlu({ alu: block.kind.data, label: block.label });
    } else if (block.kind.type === "RegisterFile") {
      setInspectingRegFile({ regFile: block.kind.data, label: block.label });
    }
  };

  // Zoom via Wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.min(Math.max(scale * zoomFactor, 0.25), 3.5);
    const newOffsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
    const newOffsetY = mouseY - (mouseY - offsetY) * (newScale / scale);

    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // Zoom Fit (Calculate Bounds)
  const handleZoomFit = () => {
    const container = containerRef.current;
    if (!container || graph.blocks.length === 0) return;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const bounds = graph.bounds;
    const graphW = bounds.width || 1000;
    const graphH = bounds.height || 600;

    const scaleX = (w - 80) / graphW;
    const scaleY = (h - 80) / graphH;
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    setScale(fitScale);
    setOffsetX((w - graphW * fitScale) / 2 - bounds.min_x * fitScale);
    setOffsetY((h - graphH * fitScale) / 2 - bounds.min_y * fitScale);
  };

  const handleResetCamera = () => {
    setScale(1.0);
    setOffsetX(40);
    setOffsetY(40);
  };

  const selectedBlock = graph.blocks.find((b) => b.id === selectedBlockId);
  const selectedBus = graph.buses.find((b) => b.id === selectedBusId);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0c1017",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        userSelect: "none"
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          height: 38,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          zIndex: 10,
          flexShrink: 0
        }}
      >
        {/* Left: Title & Module Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontWeight: 600, fontSize: 12 }}>
            <Boxes size={15} color="var(--accent-purple, #a855f7)" />
            <span>Architecture</span>
          </div>
          <span
            style={{
              fontSize: 10.5,
              padding: "2px 7px",
              borderRadius: 3,
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "#c084fc",
              fontWeight: 600
            }}
          >
            {graph.top_module}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {graph.blocks.length} Blocks • {graph.buses.length} Buses
          </span>
        </div>

        {/* Center: Search Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220, flex: 1, margin: "0 10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: 4,
              padding: "2px 8px",
              border: "1px solid var(--border-subtle)"
            }}
          >
            <Search size={12} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search macros..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 11
              }}
            />
          </div>
        </div>

        {/* Right: Radix, Filters & Zoom Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Radix Toggle */}
          <div
            style={{
              display: "flex",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: 4,
              padding: 2,
              border: "1px solid var(--border-subtle)"
            }}
          >
            {(["hex", "dec", "bin"] as MicroarchRadix[]).map((r) => (
              <button
                key={r}
                onClick={() => setRadix(r)}
                style={{
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  borderRadius: 3,
                  border: "none",
                  background: radix === r ? "var(--accent-primary, #3b82f6)" : "transparent",
                  color: radix === r ? "#ffffff" : "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Visibility Toggles */}
          <button
            onClick={() => setShowDatapathBuses(!showDatapathBuses)}
            title="Toggle Datapath Buses"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              fontSize: 11,
              borderRadius: 3,
              border: "1px solid var(--border-subtle)",
              background: showDatapathBuses ? "rgba(56, 189, 248, 0.15)" : "transparent",
              color: showDatapathBuses ? "#38bdf8" : "var(--text-muted)",
              cursor: "pointer"
            }}
          >
            <Zap size={11} />
            <span>Buses</span>
          </button>

          <button
            onClick={() => setShowControlWires(!showControlWires)}
            title="Toggle Control/Clock Wires"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              fontSize: 11,
              borderRadius: 3,
              border: "1px solid var(--border-subtle)",
              background: showControlWires ? "rgba(245, 158, 11, 0.15)" : "transparent",
              color: showControlWires ? "#f59e0b" : "var(--text-muted)",
              cursor: "pointer"
            }}
          >
            <Clock size={11} />
            <span>Control</span>
          </button>

          <button
            onClick={() => setShowLiveValues(!showLiveValues)}
            title="Toggle Live Bus Values"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              fontSize: 11,
              borderRadius: 3,
              border: "1px solid var(--border-subtle)",
              background: showLiveValues ? "rgba(16, 185, 129, 0.15)" : "transparent",
              color: showLiveValues ? "#10b981" : "var(--text-muted)",
              cursor: "pointer"
            }}
          >
            {showLiveValues ? <Eye size={11} /> : <EyeOff size={11} />}
            <span>Values</span>
          </button>

          <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          {/* Zoom Controls */}
          <button
            onClick={() => setScale((s) => Math.min(s * 1.2, 3.5))}
            title="Zoom In"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 3
            }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s * 0.8, 0.25))}
            title="Zoom Out"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 3
            }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleZoomFit}
            title="Fit to Diagram"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 3
            }}
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={handleResetCamera}
            title="Reset Camera"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 3
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          style={{
            display: "block",
            cursor: isPanning ? "grabbing" : "grab"
          }}
        />

        {/* Selected Block / Bus Bottom HUD Card */}
        {(selectedBlock || selectedBus) && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              right: 12,
              maxWidth: 620,
              backgroundColor: "rgba(22, 27, 34, 0.95)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              padding: "10px 14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 20
            }}
          >
            {selectedBlock && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    backgroundColor: getCategoryColor(selectedBlock.category).bg,
                    border: `1px solid ${getCategoryColor(selectedBlock.category).primary}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Cpu size={18} color={getCategoryColor(selectedBlock.category).primary} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                      {selectedBlock.label}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({selectedBlock.name})</span>
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: "1px 5px",
                        borderRadius: 3,
                        backgroundColor: getCategoryColor(selectedBlock.category).bg,
                        color: getCategoryColor(selectedBlock.category).primary,
                        fontWeight: 600
                      }}
                    >
                      {selectedBlock.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Inputs: {selectedBlock.inputs.length} | Outputs: {selectedBlock.outputs.length} | Latency:{" "}
                    {selectedBlock.latency_cycles} cycles
                  </div>
                </div>
              </div>
            )}

            {selectedBus && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                    border: "1px solid #38bdf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Zap size={18} color="#38bdf8" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#38bdf8" }}>
                      Bus: {selectedBus.name}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({selectedBus.width}-bit)</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Live Value:{" "}
                    <strong style={{ color: "#38bdf8", fontFamily: "monospace" }}>
                      {formatRadix(getSignalValue(selectedBus.name), selectedBus.width, radix)}
                    </strong>{" "}
                    ({formatRadix(getSignalValue(selectedBus.name), selectedBus.width, "dec")} dec)
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {selectedBlock &&
                (selectedBlock.kind.type === "Fsm" ||
                  selectedBlock.kind.type === "Alu" ||
                  selectedBlock.kind.type === "RegisterFile") && (
                  <button
                    onClick={() => triggerInspect(selectedBlock)}
                    className="btn btn-primary"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Sparkles size={12} />
                    <span>Deep Inspect</span>
                  </button>
                )}

              {selectedBlock?.source_line && onJumpToCode && (
                <button
                  onClick={() => onJumpToCode(selectedBlock.source_line!, selectedBlock.source_line!)}
                  className="btn btn-secondary"
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Line {selectedBlock.source_line}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Deep-Dive Modals */}
      {inspectingFsm && (
        <FsmBubbleModal
          fsm={inspectingFsm.fsm}
          macroLabel={inspectingFsm.label}
          activeStateName={String(getSignalValue(inspectingFsm.fsm.state_reg))}
          onClose={() => setInspectingFsm(null)}
        />
      )}

      {inspectingAlu && (
        <AluInspectorModal
          alu={inspectingAlu.alu}
          macroLabel={inspectingAlu.label}
          currentOpcode={Number(getSignalValue(inspectingAlu.alu.opcode_signal)) || 0}
          operandAValue={getSignalValue(inspectingAlu.alu.operand_a)}
          operandBValue={getSignalValue(inspectingAlu.alu.operand_b)}
          resultValue={getSignalValue(inspectingAlu.alu.result_signal)}
          onClose={() => setInspectingAlu(null)}
        />
      )}

      {inspectingRegFile && (
        <RegFileModal
          regFile={inspectingRegFile.regFile}
          macroLabel={inspectingRegFile.label}
          onClose={() => setInspectingRegFile(null)}
        />
      )}
    </div>
  );
};
