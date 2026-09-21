import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Zap,
  Sliders,
  Layers,
  ArrowRight,
  Check,
  X
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  DieInfo,
  DieBoundary,
  PartitionResult,
  MULTI_DIE_PRESETS,
  synthesizeMultiDiePartition
} from "../engine/multiDieModel";

interface MultiDieViewerProps {
  state: SimulationState;
  activeDesignId: string;
  verilogSource?: string;
  targetDevice?: string;
  onSelectSignal?: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
}

// Layout helper coordinates
interface ModuleLayoutPos {
  moduleName: string;
  dieId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DieLayoutPos {
  die: DieInfo;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BoundaryLayoutPos {
  boundary: DieBoundary;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MultiDieViewer: React.FC<MultiDieViewerProps> = ({
  state: _state,
  activeDesignId,
  verilogSource,
  targetDevice = "xcvu9p-flgb2104-2-e",
  onSelectSignal,
  onJumpToCode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Selected device preset
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(targetDevice);
  // Laguna pipeline register toggle
  const [enableLaguna, setEnableLaguna] = useState<boolean>(false);
  // TDM ratio
  const [tdmRatio, setTdmRatio] = useState<number>(1);
  // Search query
  const [searchFilter, setSearchFilter] = useState<string>("");
  // Selected cut-net or module
  const [selectedCutNetName, setSelectedCutNetName] = useState<string | null>(null);
  const [selectedModuleName, setSelectedModuleName] = useState<string | null>(null);
  const [hoveredCutNetName, setHoveredCutNetName] = useState<string | null>(null);
  const [hoveredModuleName, setHoveredModuleName] = useState<string | null>(null);

  // Partition result state
  const [partition, setPartition] = useState<PartitionResult>(() =>
    synthesizeMultiDiePartition(activeDesignId, targetDevice, false, 1)
  );

  // Manual module die assignment overrides
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, string>>({});

  // Asynchronous partition solver with fallback
  useEffect(() => {
    let cancelled = false;
    async function solvePartition() {
      if (verilogSource && verilogSource.trim().length > 0) {
        try {
          const res = await engineBridge.partitionMultiDie(
            verilogSource,
            activeDesignId,
            selectedDeviceId,
            Object.keys(moduleOverrides).length > 0 ? moduleOverrides : undefined,
            enableLaguna,
            tdmRatio
          );
          if (!cancelled && res && res.cut_nets && res.die_utilization) {
            setPartition(res);
            return;
          }
        } catch (e) {
          console.warn("[MultiDieViewer] engineBridge.partitionMultiDie fallback:", e);
        }
      }
      if (!cancelled) {
        const fallback = synthesizeMultiDiePartition(
          activeDesignId,
          selectedDeviceId,
          enableLaguna,
          tdmRatio
        );
        // Apply manual overrides if present
        if (Object.keys(moduleOverrides).length > 0) {
          const updatedCutNets = fallback.cut_nets.map((cn) => {
            const drvDie = moduleOverrides[cn.driver_module] || cn.driver_die;
            const ldDie = moduleOverrides[cn.load_module] || cn.load_die;
            return {
              ...cn,
              driver_die: drvDie,
              load_die: ldDie
            };
          });
          setPartition({
            ...fallback,
            cut_nets: updatedCutNets
          });
        } else {
          setPartition(fallback);
        }
      }
    }

    solvePartition();
    return () => {
      cancelled = true;
    };
  }, [activeDesignId, verilogSource, selectedDeviceId, enableLaguna, tdmRatio, moduleOverrides]);

  // Transform / Camera state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [zoom, setZoom] = useState<number>(0.85);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load / Save camera persistence
  useEffect(() => {
    const saved = localStorage.getItem(`axiom_multidie_cam_${activeDesignId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.zoom === "number") {
          setPan({ x: parsed.x, y: parsed.y });
          setZoom(parsed.zoom);
        }
      } catch {
        // ignore
      }
    }
  }, [activeDesignId]);

  const persistCamera = useCallback(
    (newPan: { x: number; y: number }, newZoom: number) => {
      localStorage.setItem(
        `axiom_multidie_cam_${activeDesignId}`,
        JSON.stringify({ x: newPan.x, y: newPan.y, zoom: newZoom })
      );
    },
    [activeDesignId]
  );

  // Compute 2.5D Physical Floorplan Layout
  const layout = useMemo(() => {
    const dies: DieLayoutPos[] = [];
    const boundaries: BoundaryLayoutPos[] = [];
    const modules: ModuleLayoutPos[] = [];

    const dieWidth = 720;
    const dieHeight = 175;
    const boundaryHeight = 65;
    const startX = 60;
    let currentY = 50;

    const deviceDies = partition.device.dies;

    // Arrange dies vertically (stacked 2.5D silicon)
    deviceDies.forEach((die, idx) => {
      const diePos: DieLayoutPos = {
        die,
        x: startX,
        y: currentY,
        w: dieWidth,
        h: dieHeight
      };
      dies.push(diePos);

      // Find assigned modules for this die
      const dieUtil = partition.die_utilization.find((u) => u.die_id === die.id);
      const assignedMods = dieUtil ? dieUtil.assigned_modules : [];

      const modWidth = 190;
      const modHeight = 62;
      const modStartX = startX + 24;
      const modStartY = currentY + 86;
      const modGap = 20;

      assignedMods.forEach((mName, mIdx) => {
        modules.push({
          moduleName: mName,
          dieId: die.id,
          x: modStartX + mIdx * (modWidth + modGap),
          y: modStartY,
          w: modWidth,
          h: modHeight
        });
      });

      currentY += dieHeight;

      // Add boundary if not the last die
      if (idx < deviceDies.length - 1) {
        const nextDie = deviceDies[idx + 1];
        const b = partition.device.boundaries.find(
          (boundary) =>
            (boundary.die_a === die.id && boundary.die_b === nextDie.id) ||
            (boundary.die_a === nextDie.id && boundary.die_b === die.id)
        ) || {
          id: `b_${die.id}_${nextDie.id}`,
          die_a: die.id,
          die_b: nextDie.id,
          max_tracks: 1440,
          interconnect_kind: "Sll",
          propagation_delay_ps: 1500,
          capacitance_per_track_ff: 2500
        };

        boundaries.push({
          boundary: b,
          x: startX,
          y: currentY,
          w: dieWidth,
          h: boundaryHeight
        });

        currentY += boundaryHeight;
      }
    });

    return { dies, boundaries, modules, totalHeight: currentY + 60, totalWidth: dieWidth + 120 };
  }, [partition]);

  // Reassign module to another die
  const handleReassignModule = (modName: string, newDieId: string) => {
    setModuleOverrides((prev) => ({
      ...prev,
      [modName]: newDieId
    }));
  };

  // Reset module assignments
  const handleResetAssignments = () => {
    setModuleOverrides({});
  };

  // Canvas Mouse & Interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const newPan = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      };
      setPan(newPan);
      return;
    }

    // Hover detection in world coordinates
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    let foundModule: string | null = null;
    for (const m of layout.modules) {
      if (mouseX >= m.x && mouseX <= m.x + m.w && mouseY >= m.y && mouseY <= m.y + m.h) {
        foundModule = m.moduleName;
        break;
      }
    }
    setHoveredModuleName(foundModule);

    // Check boundary cut-net hover
    let foundCutNet: string | null = null;
    partition.cut_nets.forEach((cn) => {
      const drvMod = layout.modules.find((m) => m.moduleName === cn.driver_module);
      const ldMod = layout.modules.find((m) => m.moduleName === cn.load_module);
      if (drvMod && ldMod) {
        const x1 = drvMod.x + drvMod.w / 2;
        const y1 = drvMod.y + drvMod.h / 2;
        const x2 = ldMod.x + ldMod.w / 2;
        const y2 = ldMod.y + ldMod.h / 2;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dist = Math.hypot(mouseX - midX, mouseY - midY);
        if (dist < 22) {
          foundCutNet = cn.net_name;
        }
      }
    });
    setHoveredCutNetName(foundCutNet);
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      persistCamera(pan, zoom);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    let clickedModule: string | null = null;
    for (const m of layout.modules) {
      if (mouseX >= m.x && mouseX <= m.x + m.w && mouseY >= m.y && mouseY <= m.y + m.h) {
        clickedModule = m.moduleName;
        break;
      }
    }

    setSelectedModuleName((prev) => (prev === clickedModule ? null : clickedModule));

    // Check cut-net click
    let clickedCutNet: string | null = null;
    partition.cut_nets.forEach((cn) => {
      const drvMod = layout.modules.find((m) => m.moduleName === cn.driver_module);
      const ldMod = layout.modules.find((m) => m.moduleName === cn.load_module);
      if (drvMod && ldMod) {
        const x1 = drvMod.x + drvMod.w / 2;
        const y1 = drvMod.y + drvMod.h / 2;
        const x2 = ldMod.x + ldMod.w / 2;
        const y2 = ldMod.y + ldMod.h / 2;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dist = Math.hypot(mouseX - midX, mouseY - midY);
        if (dist < 22) {
          clickedCutNet = cn.net_name;
        }
      }
    });
    setSelectedCutNetName((prev) => (prev === clickedCutNet ? null : clickedCutNet));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(2.5, Math.max(0.3, zoom * zoomFactor));

    const newPan = {
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
    };

    setZoom(newZoom);
    setPan(newPan);
    persistCamera(newPan, newZoom);
  };

  const handleZoomFit = () => {
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scaleX = (cw - 80) / layout.totalWidth;
    const scaleY = (ch - 80) / layout.totalHeight;
    const fitZoom = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)));

    const newPan = {
      x: Math.max(20, (cw - layout.totalWidth * fitZoom) / 2),
      y: Math.max(20, (ch - layout.totalHeight * fitZoom) / 2)
    };

    setZoom(fitZoom);
    setPan(newPan);
    persistCamera(newPan, fitZoom);
  };

  const handleResetCamera = () => {
    setPan({ x: 40, y: 30 });
    setZoom(0.85);
    persistCamera({ x: 40, y: 30 }, 0.85);
  };

  // High-DPI Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 800;
    const h = canvas.parentElement?.clientHeight || 600;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Silicon interposer background pattern
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, w, h);

    // Apply World Camera Transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Silicon Interposer Bed Plate
    const bedX = layout.dies[0]?.x - 30 || 30;
    const bedY = 20;
    const bedW = (layout.dies[0]?.w || 720) + 60;
    const bedH = layout.totalHeight;

    ctx.fillStyle = "#0c1322";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bedX, bedY, bedW, bedH, 16);
    ctx.fill();
    ctx.stroke();

    // Subtle wafer edge gold markers
    ctx.fillStyle = "#e2b340";
    for (let by = bedY + 30; by < bedY + bedH - 30; by += 40) {
      ctx.fillRect(bedX + 4, by, 3, 16);
      ctx.fillRect(bedX + bedW - 7, by, 3, 16);
    }

    // Interposer Label
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("2.5D SILICON INTERPOSER SUBSTRATE (PASSIVE SSIT)", bedX + 24, bedY + 22);

    // 2. Draw Boundaries (Channels between Dies)
    layout.boundaries.forEach((bPos) => {
      const bUtil = partition.boundary_utilization.find((u) => u.boundary_id === bPos.boundary.id);
      const satPct = bUtil ? bUtil.utilization_pct : 0;
      const isOverflow = bUtil ? bUtil.is_overflow : false;

      ctx.fillStyle = "#090d16";
      ctx.strokeStyle = isOverflow ? "#ef4444" : satPct > 80 ? "#f59e0b" : "#1e293b";
      ctx.lineWidth = isOverflow ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(bPos.x, bPos.y, bPos.w, bPos.h, 6);
      ctx.fill();
      ctx.stroke();

      // Micro-bump array (top and bottom rows of interposer micro-bumps)
      const bumpRadius = 2.5;
      const bumpStep = 18;
      ctx.fillStyle = isOverflow ? "#f87171" : "#d97706";
      for (let bx = bPos.x + 20; bx < bPos.x + bPos.w - 20; bx += bumpStep) {
        // Top bump row
        ctx.beginPath();
        ctx.arc(bx, bPos.y + 7, bumpRadius, 0, Math.PI * 2);
        ctx.fill();
        // Bottom bump row
        ctx.beginPath();
        ctx.arc(bx, bPos.y + bPos.h - 7, bumpRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Boundary HUD Info
      const channelKind = bPos.boundary.interconnect_kind;
      const channelLabel =
        channelKind === "Sll"
          ? `Super Long Line (SLL) Channel — Max ${bPos.boundary.max_tracks} Tracks`
          : channelKind === "Laguna"
          ? `Laguna Pipelined Channel (+1 Cycle Latency)`
          : `High-Speed FMC PCB Trace Channel (${bPos.boundary.max_tracks} Tracks Max)`;

      ctx.fillStyle = isOverflow ? "#fca5a5" : "#94a3b8";
      ctx.font = "bold 10px monospace";
      ctx.fillText(channelLabel, bPos.x + 20, bPos.y + 24);

      // Saturation Gauge on right side of boundary
      const gaugeW = 180;
      const gaugeH = 8;
      const gaugeX = bPos.x + bPos.w - gaugeW - 24;
      const gaugeY = bPos.y + 16;

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 4);
      ctx.fill();

      const fillW = Math.min(gaugeW, (gaugeW * satPct) / 100);
      ctx.fillStyle = isOverflow ? "#ef4444" : satPct > 80 ? "#f59e0b" : "#10b981";
      ctx.beginPath();
      ctx.roundRect(gaugeX, gaugeY, fillW, gaugeH, 4);
      ctx.fill();

      // Gauge Percentage Text
      ctx.fillStyle = isOverflow ? "#ef4444" : satPct > 80 ? "#f59e0b" : "#34d399";
      ctx.font = "10px monospace";
      ctx.fillText(
        `${bUtil ? bUtil.tracks_used : 0} / ${bPos.boundary.max_tracks} (${satPct.toFixed(1)}%)`,
        gaugeX - 110,
        gaugeY + 7
      );

      // Delay annotation in boundary center
      const delayText = enableLaguna ? "Latency: 350 ps (+1c Laguna)" : `Latency: ${bPos.boundary.propagation_delay_ps} ps (Direct SLL)`;
      ctx.fillStyle = "#64748b";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(delayText, bPos.x + 20, bPos.y + bPos.h - 14);
    });

    // 3. Draw Die Containers
    layout.dies.forEach((dPos) => {
      const dieUtil = partition.die_utilization.find((u) => u.die_id === dPos.die.id);
      const isDualFpga = dPos.die.kind === "StandaloneFpga";

      // Die Container Box
      ctx.fillStyle = "#111827";
      ctx.strokeStyle = isDualFpga ? "#3b82f6" : "#0284c7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(dPos.x, dPos.y, dPos.w, dPos.h, 10);
      ctx.fill();
      ctx.stroke();

      // Header Banner
      ctx.fillStyle = isDualFpga ? "rgba(59, 130, 246, 0.12)" : "rgba(2, 132, 199, 0.12)";
      ctx.beginPath();
      ctx.roundRect(dPos.x, dPos.y, dPos.w, 40, [10, 10, 0, 0]);
      ctx.fill();

      // Die Name & Index Badge
      ctx.fillStyle = isDualFpga ? "#60a5fa" : "#38bdf8";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(dPos.die.name, dPos.x + 18, dPos.y + 24);

      // Die ID Pill
      ctx.fillStyle = isDualFpga ? "#1d4ed8" : "#0369a1";
      ctx.beginPath();
      ctx.roundRect(dPos.x + dPos.w - 90, dPos.y + 10, 72, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText(dPos.die.id, dPos.x + dPos.w - 80, dPos.y + 24);

      // Resource Utilization Strips (LC, BRAM, DSP)
      if (dieUtil) {
        const stripY = dPos.y + 54;

        // Logic Cells Strip
        const lcPct = dieUtil.logic_cells_pct;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText("Logic Cells:", dPos.x + 18, stripY);

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(dPos.x + 85, stripY - 8, 120, 10, 3);
        ctx.fill();

        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.roundRect(dPos.x + 85, stripY - 8, Math.min(120, (120 * lcPct) / 100), 10, 3);
        ctx.fill();

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "10px monospace";
        ctx.fillText(`${dieUtil.logic_cells_used.toLocaleString()} / ${dieUtil.logic_cells_capacity.toLocaleString()}`, dPos.x + 215, stripY);

        // BRAM Strip
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText("BRAM 36K:", dPos.x + 360, stripY);
        ctx.fillStyle = "#10b981";
        ctx.font = "10px monospace";
        ctx.fillText(`${dieUtil.brams_used} / ${dieUtil.brams_capacity}`, dPos.x + 430, stripY);

        // DSP48 Strip
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText("DSP48E2:", dPos.x + 530, stripY);
        ctx.fillStyle = "#a855f7";
        ctx.font = "10px monospace";
        ctx.fillText(`${dieUtil.dsps_used} / ${dieUtil.dsps_capacity}`, dPos.x + 590, stripY);
      }
    });

    // 4. Draw Modules Inside Dies
    layout.modules.forEach((mPos) => {
      const isSelected = selectedModuleName === mPos.moduleName;
      const isHovered = hoveredModuleName === mPos.moduleName;

      ctx.fillStyle = isSelected ? "#1e293b" : "#0f172a";
      ctx.strokeStyle = isSelected ? "#38bdf8" : isHovered ? "#06b6d4" : "#334155";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(mPos.x, mPos.y, mPos.w, mPos.h, 8);
      ctx.fill();
      ctx.stroke();

      // Module Accent Strip
      ctx.fillStyle = isSelected ? "#38bdf8" : "#0284c7";
      ctx.fillRect(mPos.x, mPos.y, 4, mPos.h);

      // Module Name
      ctx.fillStyle = isSelected ? "#f8fafc" : "#e2e8f0";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(mPos.moduleName, mPos.x + 14, mPos.y + 22);

      // Module Die tag
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.fillText(`@${mPos.dieId}`, mPos.x + 14, mPos.y + 40);

      // Status indicator pill
      ctx.fillStyle = isSelected ? "rgba(56, 189, 248, 0.2)" : "rgba(100, 116, 139, 0.2)";
      ctx.beginPath();
      ctx.roundRect(mPos.x + mPos.w - 55, mPos.y + 12, 45, 18, 4);
      ctx.fill();
      ctx.fillStyle = isSelected ? "#38bdf8" : "#94a3b8";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("ACTIVE", mPos.x + mPos.w - 48, mPos.y + 24);
    });

    // 5. Draw Inter-Die Cut-Net Flylines
    partition.cut_nets.forEach((cn) => {
      const drvMod = layout.modules.find((m) => m.moduleName === cn.driver_module);
      const ldMod = layout.modules.find((m) => m.moduleName === cn.load_module);

      if (!drvMod || !ldMod) return;

      const isSelected = selectedCutNetName === cn.net_name;
      const isHovered = hoveredCutNetName === cn.net_name;

      const x1 = drvMod.x + drvMod.w / 2;
      const y1 = drvMod.y + drvMod.h;
      const x2 = ldMod.x + ldMod.w / 2;
      const y2 = ldMod.y;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Draw Smooth Bezier Spline
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, y1 + 30, x2, y2 - 30, x2, y2);

      if (isSelected || isHovered) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3.5;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = Math.min(3, 1 + cn.bit_width / 16);
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0; // reset glow

      // Cut-Net Midpoint HUD (Laguna flip-flop or Interposer track badge)
      const badgeW = enableLaguna ? 48 : 36;
      const badgeH = 20;
      const badgeX = midX - badgeW / 2;
      const badgeY = midY - badgeH / 2;

      ctx.fillStyle = isSelected ? "#0284c7" : "#0f172a";
      ctx.strokeStyle = isSelected ? "#38bdf8" : "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      // Badge Text (Bit-width and Laguna indicator)
      ctx.fillStyle = isSelected ? "#ffffff" : "#38bdf8";
      ctx.font = "bold 9px monospace";
      if (enableLaguna) {
        ctx.fillText(`/${cn.bit_width} [L]`, badgeX + 4, badgeY + 14);
      } else {
        ctx.fillText(`/${cn.bit_width}`, badgeX + 8, badgeY + 14);
      }
    });

    ctx.restore(); // Restore world camera transform
    ctx.restore(); // Restore DPR transform
  }, [layout, partition, pan, zoom, selectedCutNetName, selectedModuleName, hoveredCutNetName, hoveredModuleName, enableLaguna]);

  // Filtered Cut-Nets for Bottom Table
  const filteredCutNets = useMemo(() => {
    if (!searchFilter.trim()) return partition.cut_nets;
    const q = searchFilter.toLowerCase();
    return partition.cut_nets.filter(
      (cn) =>
        cn.net_name.toLowerCase().includes(q) ||
        cn.driver_module.toLowerCase().includes(q) ||
        cn.load_module.toLowerCase().includes(q) ||
        cn.driver_die.toLowerCase().includes(q) ||
        cn.load_die.toLowerCase().includes(q)
    );
  }, [partition.cut_nets, searchFilter]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--bg-primary, #0c1017)",
        color: "var(--text-primary, #f1f5f9)",
        overflow: "hidden",
        position: "relative"
      }}
    >
      {/* 1. Header Toolbar & Quick Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          backgroundColor: "var(--bg-secondary, #111827)",
          borderBottom: "1px solid var(--border-subtle, #1f293d)",
          gap: "12px",
          flexWrap: "wrap",
          zIndex: 10
        }}
      >
        {/* Left: Device Preset & Laguna & TDM Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={16} color="var(--accent-cyan, #06b6d4)" />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary, #94a3b8)" }}>
              Multi-Die Device:
            </span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{
                backgroundColor: "var(--bg-tertiary, #1e293b)",
                color: "var(--text-primary, #f1f5f9)",
                border: "1px solid var(--border-subtle, #334155)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "12px",
                cursor: "pointer",
                outline: "none"
              }}
            >
              {MULTI_DIE_PRESETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ height: "16px", width: "1px", backgroundColor: "var(--border-subtle, #334155)" }} />

          {/* Laguna Register Switch */}
          <button
            onClick={() => setEnableLaguna((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: enableLaguna ? "rgba(6, 182, 212, 0.15)" : "var(--bg-tertiary, #1e293b)",
              color: enableLaguna ? "var(--accent-cyan, #06b6d4)" : "var(--text-muted, #64748b)",
              border: enableLaguna ? "1px solid var(--accent-cyan, #06b6d4)" : "1px solid var(--border-subtle, #334155)"
            }}
            title="Inserts +1 cycle Laguna pipeline registers on SLR cut-nets, reducing physical delay from ~1,500 ps to ~350 ps"
          >
            <Zap size={14} />
            Laguna Registers: {enableLaguna ? "ON (+1c, 350ps)" : "OFF (Direct SLL)"}
          </button>

          {/* TDM Ratio Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Sliders size={14} color="var(--accent-purple, #a855f7)" />
            <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>TDM Ratio:</span>
            <select
              value={tdmRatio}
              onChange={(e) => setTdmRatio(Number(e.target.value))}
              style={{
                backgroundColor: "var(--bg-tertiary, #1e293b)",
                color: "var(--text-primary, #f1f5f9)",
                border: "1px solid var(--border-subtle, #334155)",
                borderRadius: "4px",
                padding: "3px 6px",
                fontSize: "11px",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value={1}>1:1 (Direct SLL)</option>
              <option value={4}>4:1 (TDM 4x)</option>
              <option value={8}>8:1 (TDM 8x)</option>
              <option value={16}>16:1 (TDM 16x)</option>
            </select>
          </div>

          {Object.keys(moduleOverrides).length > 0 && (
            <button
              onClick={handleResetAssignments}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                cursor: "pointer"
              }}
            >
              Reset Overrides
            </button>
          )}
        </div>

        {/* Right: Camera Zoom & Search Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Telemetry badges */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "3px 8px",
              backgroundColor: "var(--bg-tertiary, #1e293b)",
              borderRadius: "4px",
              fontSize: "11px",
              color: "var(--text-secondary, #94a3b8)"
            }}
          >
            <span>Cut-Nets: <strong style={{ color: "#38bdf8" }}>{partition.total_cut_nets}</strong></span>
            <span>•</span>
            <span>Tracks: <strong style={{ color: "#34d399" }}>{partition.total_tracks_used}</strong></span>
            <span>•</span>
            <span>Power: <strong style={{ color: "#e2b340" }}>{partition.interposer_power_mw.toFixed(1)} mW</strong></span>
          </div>

          <div style={{ height: "16px", width: "1px", backgroundColor: "var(--border-subtle, #334155)" }} />

          <button
            onClick={() => {
              setZoom((prev) => Math.min(2.5, prev * 1.15));
              persistCamera(pan, Math.min(2.5, zoom * 1.15));
            }}
            style={{
              padding: "4px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-subtle, #334155)",
              borderRadius: "4px",
              color: "var(--text-secondary, #94a3b8)",
              cursor: "pointer"
            }}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>

          <button
            onClick={() => {
              setZoom((prev) => Math.max(0.3, prev * 0.85));
              persistCamera(pan, Math.max(0.3, zoom * 0.85));
            }}
            style={{
              padding: "4px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-subtle, #334155)",
              borderRadius: "4px",
              color: "var(--text-secondary, #94a3b8)",
              cursor: "pointer"
            }}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>

          <button
            onClick={handleZoomFit}
            style={{
              padding: "4px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-subtle, #334155)",
              borderRadius: "4px",
              color: "var(--text-secondary, #94a3b8)",
              cursor: "pointer"
            }}
            title="Zoom to Fit"
          >
            <Maximize2 size={14} />
          </button>

          <button
            onClick={handleResetCamera}
            style={{
              padding: "4px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-subtle, #334155)",
              borderRadius: "4px",
              color: "var(--text-secondary, #94a3b8)",
              cursor: "pointer"
            }}
            title="Reset Camera"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 2. Main Floorplan Canvas Area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: "260px" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ width: "100%", height: "100%", display: "block", cursor: isDraggingRef.current ? "grabbing" : "grab" }}
        />

        {/* Selected Module Action Popover */}
        {selectedModuleName && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              backgroundColor: "var(--bg-secondary, #111827)",
              border: "1px solid var(--border-subtle, #334155)",
              borderRadius: "8px",
              padding: "12px 16px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              zIndex: 20
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--accent-cyan, #06b6d4)" }}>
                Module: {selectedModuleName}
              </span>
              <button
                onClick={() => setSelectedModuleName(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #64748b)",
                  cursor: "pointer",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Assign to SLR:</span>
              <select
                value={
                  moduleOverrides[selectedModuleName] ||
                  partition.die_utilization.find((u) => u.assigned_modules.includes(selectedModuleName!))?.die_id ||
                  "SLR0"
                }
                onChange={(e) => handleReassignModule(selectedModuleName!, e.target.value)}
                style={{
                  backgroundColor: "var(--bg-tertiary, #1e293b)",
                  color: "#f1f5f9",
                  border: "1px solid #475569",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "11px"
                }}
              >
                {partition.device.dies.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} ({d.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Cut-Nets & SLL Interconnect Table */}
      <div
        style={{
          height: "210px",
          backgroundColor: "var(--bg-secondary, #111827)",
          borderTop: "1px solid var(--border-subtle, #1f293d)",
          display: "flex",
          flexDirection: "column",
          zIndex: 10
        }}
      >
        {/* Table Subheader & Filter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 16px",
            borderBottom: "1px solid var(--border-subtle, #1f293d)",
            backgroundColor: "var(--bg-tertiary, #162032)",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary, #94a3b8)" }}>
              Inter-Die Cut-Nets & SLL Routing ({filteredCutNets.length} Signals)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "var(--bg-primary, #0c1017)",
                border: "1px solid var(--border-subtle, #334155)",
                borderRadius: "4px",
                padding: "2px 8px",
                gap: "6px"
              }}
            >
              <Search size={12} color="var(--text-muted, #64748b)" />
              <input
                type="text"
                placeholder="Search cut-nets..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f1f5f9",
                  fontSize: "11px",
                  outline: "none",
                  width: "160px"
                }}
              />
            </div>
          </div>
        </div>

        {/* Table Rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ color: "var(--text-muted, #64748b)", borderBottom: "1px solid var(--border-subtle, #1f293d)" }}>
                <th style={{ padding: "6px 16px" }}>Net / Bus</th>
                <th style={{ padding: "6px 12px" }}>Width</th>
                <th style={{ padding: "6px 12px" }}>Driver</th>
                <th style={{ padding: "6px 12px" }}>Direction</th>
                <th style={{ padding: "6px 12px" }}>Load</th>
                <th style={{ padding: "6px 12px" }}>Boundary</th>
                <th style={{ padding: "6px 12px" }}>SLL Tracks</th>
                <th style={{ padding: "6px 12px" }}>Delay / Latency</th>
                <th style={{ padding: "6px 12px" }}>Pipelined</th>
                <th style={{ padding: "6px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCutNets.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                    No inter-die cut-nets match the filter.
                  </td>
                </tr>
              ) : (
                filteredCutNets.map((cn) => {
                  const isSelected = selectedCutNetName === cn.net_name;
                  return (
                    <tr
                      key={cn.net_name}
                      onClick={() => setSelectedCutNetName((prev) => (prev === cn.net_name ? null : cn.net_name))}
                      style={{
                        backgroundColor: isSelected ? "rgba(6, 182, 212, 0.1)" : "transparent",
                        borderBottom: "1px solid var(--border-subtle, #1f293d)",
                        cursor: "pointer"
                      }}
                    >
                      <td style={{ padding: "6px 16px", fontWeight: 600, color: "#38bdf8", fontFamily: "monospace" }}>
                        {cn.net_name}
                      </td>
                      <td style={{ padding: "6px 12px", color: "#cbd5e1" }}>{cn.bit_width} bits</td>
                      <td style={{ padding: "6px 12px", color: "#94a3b8" }}>
                        {cn.driver_module} <span style={{ color: "#38bdf8" }}>({cn.driver_die})</span>
                      </td>
                      <td style={{ padding: "6px 12px", color: "var(--accent-cyan, #06b6d4)" }}>
                        <ArrowRight size={12} />
                      </td>
                      <td style={{ padding: "6px 12px", color: "#94a3b8" }}>
                        {cn.load_module} <span style={{ color: "#a855f7" }}>({cn.load_die})</span>
                      </td>
                      <td style={{ padding: "6px 12px", color: "#64748b", fontFamily: "monospace" }}>{cn.boundary_id}</td>
                      <td style={{ padding: "6px 12px", color: "#34d399", fontWeight: 600 }}>{cn.required_tracks} tracks</td>
                      <td style={{ padding: "6px 12px", color: enableLaguna ? "#a855f7" : "#e2b340" }}>
                        {enableLaguna ? "350 ps (+1c)" : `${cn.estimated_delay_ps} ps`}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        {enableLaguna ? (
                          <span style={{ color: "#34d399", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Check size={12} /> Laguna
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Direct</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                          {onSelectSignal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSignal(cn.net_name);
                              }}
                              style={{
                                padding: "2px 6px",
                                backgroundColor: "var(--bg-tertiary, #1e293b)",
                                border: "1px solid #334155",
                                borderRadius: "3px",
                                color: "#38bdf8",
                                fontSize: "10px",
                                cursor: "pointer"
                              }}
                              title="Inspect Signal"
                            >
                              Inspect
                            </button>
                          )}
                          {onJumpToCode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onJumpToCode(1, 10);
                              }}
                              style={{
                                padding: "2px 6px",
                                backgroundColor: "var(--bg-tertiary, #1e293b)",
                                border: "1px solid #334155",
                                borderRadius: "3px",
                                color: "#94a3b8",
                                fontSize: "10px",
                                cursor: "pointer"
                              }}
                              title="Jump to Code"
                            >
                              Code
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
