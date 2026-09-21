import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  Workflow,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Table,
  Crosshair,
  Compass
} from "lucide-react";
import { SimulationState, engineBridge, FsmCoverageData } from "../engine/engineBridge";
import {
  FsmMacro,
  auditFsm,
  FsmAuditReport,
  synthesizeMicroarchGraph
} from "../engine/microarchModel";

export interface FsmViewerProps {
  state: SimulationState;
  activeDesignId: string;
  verilogSource?: string;
  onSelectSignal?: (signalId: string) => void;
  onJumpToCode?: (lineStart: number, lineEnd: number) => void;
  onOpenAutoPipeline?: () => void;
}

interface StatePosition {
  x: number;
  y: number;
}

export const FsmViewer: React.FC<FsmViewerProps> = ({
  state,
  activeDesignId,
  verilogSource,
  onSelectSignal: _onSelectSignal,
  onJumpToCode,
  onOpenAutoPipeline: _onOpenAutoPipeline
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Extracted FSMs list & selected index
  const [fsms, setFsms] = useState<Array<{ fsm: FsmMacro; label: string }>>([]);
  const [selectedFsmIdx, setSelectedFsmIdx] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<"radial" | "chain">("radial");
  const [showAuditDrawer, setShowAuditDrawer] = useState<boolean>(false);

  // Camera pan & zoom
  const [scale, setScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_fsm_cam_${activeDesignId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.scale === "number") return parsed.scale;
      }
    } catch {}
    return 1.0;
  });

  const [offsetX, setOffsetX] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_fsm_cam_${activeDesignId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.offsetX === "number") return parsed.offsetX;
      }
    } catch {}
    return 0;
  });

  const [offsetY, setOffsetY] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_fsm_cam_${activeDesignId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.offsetY === "number") return parsed.offsetY;
      }
    } catch {}
    return 0;
  });

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Live coverage & hover inspect
  const [coverage, setCoverage] = useState<FsmCoverageData | undefined>(undefined);
  const [hoveredStateName, setHoveredStateName] = useState<string | null>(null);
  const [hoveredTransitionKey, setHoveredTransitionKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Transition Flash Animation tracking
  const [prevActiveState, setPrevActiveState] = useState<string | null>(null);
  const [flashingTransKey, setFlashingTransKey] = useState<string | null>(null);

  // Persist camera
  useEffect(() => {
    try {
      localStorage.setItem(
        `axiom_fsm_cam_${activeDesignId || "default"}`,
        JSON.stringify({ scale, offsetX, offsetY })
      );
    } catch {}
  }, [scale, offsetX, offsetY, activeDesignId]);

  // Dynamic FSM extraction via engineBridge
  useEffect(() => {
    let cancelled = false;

    const extract = (macroBlocks: any[]): Array<{ fsm: FsmMacro; label: string }> => {
      const result: Array<{ fsm: FsmMacro; label: string }> = [];
      for (const b of macroBlocks) {
        if (!b) continue;
        const fsm: FsmMacro | null =
          b.kind?.Fsm ||
          b.kind?.fsm ||
          (b.kind?.type === "Fsm" ? b.kind.data : null) ||
          (b.kind?.states && b.kind?.transitions ? b.kind : null);

        if (fsm && Array.isArray(fsm.states) && fsm.states.length >= 2) {
          result.push({ fsm, label: b.label || `${fsm.state_reg} FSM` });
        }
      }
      return result;
    };

    const loadFsms = async () => {
      if (verilogSource && verilogSource.trim().length > 0) {
        try {
          const res = await engineBridge.synthesizeMicroarch(verilogSource, activeDesignId);
          if (res && Array.isArray(res.blocks)) {
            const list = extract(res.blocks);
            if (list.length > 0 && !cancelled) {
              setFsms(list);
              setSelectedFsmIdx(0);
              return;
            }
          }
        } catch (e) {
          console.warn("[FsmViewer] Dynamic synthesis fallback:", e);
        }
      }

      // Fallback to deterministic model generator
      const fallbackGraph = synthesizeMicroarchGraph(activeDesignId);
      if (fallbackGraph && Array.isArray(fallbackGraph.blocks)) {
        const list = extract(fallbackGraph.blocks);
        if (!cancelled) {
          setFsms(list);
          setSelectedFsmIdx(0);
        }
      }
    };

    loadFsms();
    return () => {
      cancelled = true;
    };
  }, [activeDesignId, verilogSource]);

  const currentItem = fsms[selectedFsmIdx] || null;
  const currentFsm = currentItem?.fsm || null;
  const currentLabel = currentItem?.label || "Finite State Machine";

  // Audit report
  const auditReport: FsmAuditReport | null = useMemo(() => {
    if (!currentFsm) return null;
    return auditFsm(currentFsm);
  }, [currentFsm]);

  // Live coverage fetch
  useEffect(() => {
    if (!currentFsm) return;
    let cancelled = false;

    const fetchCoverage = async () => {
      try {
        const rep = await engineBridge.getCoverage();
        if (!cancelled && rep && rep.fsm_details) {
          const detail =
            rep.fsm_details[currentFsm.state_reg] ||
            rep.fsm_details[currentLabel] ||
            Object.values(rep.fsm_details)[0];
          if (detail) setCoverage(detail);
        }
      } catch (err) {
        console.warn("[FsmViewer] Failed to fetch coverage:", err);
      }
    };

    fetchCoverage();
    const unsub = engineBridge.subscribe(() => {
      fetchCoverage();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentFsm, currentLabel]);

  // Derive active state from live simulation signals
  const activeStateName = useMemo(() => {
    if (!currentFsm) return "";
    if (!state.signals || state.signals.length === 0) {
      return currentFsm.reset_state || currentFsm.current_state_default || currentFsm.states[0]?.name || "";
    }

    const regName = currentFsm.state_reg.toLowerCase();
    const sig = state.signals.find((s) => {
      const name = s.name.toLowerCase();
      const full = s.fullName.toLowerCase();
      return (
        name === regName ||
        full.endsWith(`.${regName}`) ||
        name.includes(regName) ||
        full.includes(regName)
      );
    });

    if (!sig) {
      return currentFsm.reset_state || currentFsm.current_state_default || currentFsm.states[0]?.name || "";
    }

    const lastSample = sig.samples && sig.samples.length > 0 ? sig.samples[sig.samples.length - 1] : undefined;
    if (!lastSample) {
      return currentFsm.reset_state || currentFsm.current_state_default || currentFsm.states[0]?.name || "";
    }

    const sampleVal = String(lastSample.value);
    const numVal = parseInt(sampleVal, 10);
    const matchedState = currentFsm.states.find(
      (s) => s.value === numVal || s.binary_str === sampleVal || s.name.toLowerCase() === sampleVal.toLowerCase()
    );

    return matchedState?.name || currentFsm.reset_state || currentFsm.states[0]?.name || "";
  }, [currentFsm, state.signals]);

  // Transition Flash Animation trigger when activeStateName changes
  useEffect(() => {
    if (!currentFsm) return;
    if (prevActiveState && prevActiveState !== activeStateName) {
      const key = `${prevActiveState}->${activeStateName}`;
      setFlashingTransKey(key);
      const timer = setTimeout(() => {
        setFlashingTransKey(null);
      }, 700);
      return () => clearTimeout(timer);
    }
    setPrevActiveState(activeStateName);
  }, [activeStateName, prevActiveState, currentFsm]);

  // Auto-Fit Camera centering on diagram
  const handleAutoFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFsm) return;
    const w = canvas.parentElement?.clientWidth || 800;
    const h = canvas.parentElement?.clientHeight || 600;

    setScale(1.0);
    setOffsetX(w / 2);
    setOffsetY(h / 2);
  }, [currentFsm]);

  // Auto-fit on initial load if no offset cached
  useEffect(() => {
    if (currentFsm && offsetX === 0 && offsetY === 0) {
      handleAutoFit();
    }
  }, [currentFsm, offsetX, offsetY, handleAutoFit]);

  // Compute node positions (Radial or Horizontal Chain)
  const statePositions = useMemo(() => {
    const map = new Map<string, StatePosition>();
    if (!currentFsm) return map;

    const numStates = currentFsm.states.length;
    if (layoutMode === "radial") {
      const radius = Math.max(140, Math.min(260, 90 + numStates * 28));
      currentFsm.states.forEach((s, idx) => {
        const angle = (idx / numStates) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        map.set(s.name, { x, y });
      });
    } else {
      // Chain layout
      const spacingX = 140;
      const startX = -((numStates - 1) * spacingX) / 2;
      currentFsm.states.forEach((s, idx) => {
        map.set(s.name, { x: startX + idx * spacingX, y: 0 });
      });
    }
    return map;
  }, [currentFsm, layoutMode]);

  // Draw FSM Bubble Diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFsm) return;
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

    // Dark grid background
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, w, h);

    // Apply Camera Transform
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Subtle coordinate grid in world space
    ctx.strokeStyle = "rgba(36, 44, 56, 0.4)";
    ctx.lineWidth = 1 / scale;
    const gridSpan = 800;
    const gridStep = 40;
    for (let gx = -gridSpan; gx <= gridSpan; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, -gridSpan);
      ctx.lineTo(gx, gridSpan);
      ctx.stroke();
    }
    for (let gy = -gridSpan; gy <= gridSpan; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(-gridSpan, gy);
      ctx.lineTo(gridSpan, gy);
      ctx.stroke();
    }

    const nodeRadius = 38;

    // 1. Draw Transition Arcs
    currentFsm.transitions.forEach((t) => {
      const src = statePositions.get(t.from_state);
      const dst = statePositions.get(t.to_state);
      if (!src || !dst) return;

      const isSelfLoop = t.from_state === t.to_state;
      const transKey = `${t.from_state}->${t.to_state}`;
      const isFlashing = flashingTransKey === transKey;
      const isHovered = hoveredTransitionKey === transKey;
      const isSrcActive = t.from_state === activeStateName;
      const transHits = coverage?.transition_hits?.[transKey] ?? 0;
      const isTraversed = transHits > 0;

      let strokeColor = "#30363d";
      let lineWidth = 1.5;

      if (isFlashing) {
        strokeColor = "#38bdf8";
        lineWidth = 3.5;
      } else if (isHovered) {
        strokeColor = "#f59e0b";
        lineWidth = 2.8;
      } else if (isSrcActive) {
        strokeColor = "#38bdf8";
        lineWidth = 2.4;
      } else if (isTraversed) {
        strokeColor = "#10b981";
        lineWidth = 2.0;
      }

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = lineWidth;

      const condLabel = isTraversed ? `${t.condition} [${transHits}]` : t.condition;

      if (isSelfLoop) {
        // Self-loop circle pointing outwards from center
        const angle = Math.atan2(src.y, src.x);
        const loopDist = 32;
        const loopRadius = 24;
        const loopCx = src.x + Math.cos(angle) * (nodeRadius + loopDist);
        const loopCy = src.y + Math.sin(angle) * (nodeRadius + loopDist);

        ctx.beginPath();
        ctx.arc(loopCx, loopCy, loopRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Arrowhead on loop
        const arrowAngle = angle + Math.PI / 2;
        const arrowX = loopCx + Math.cos(arrowAngle) * loopRadius;
        const arrowY = loopCy + Math.sin(arrowAngle) * loopRadius;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - 8 * Math.cos(arrowAngle - Math.PI / 6),
          arrowY - 8 * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - 8 * Math.cos(arrowAngle + Math.PI / 6),
          arrowY - 8 * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Condition label knockout plate
        ctx.save();
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        const textWidth = ctx.measureText(condLabel).width;
        ctx.fillStyle = "#0c1017";
        ctx.fillRect(loopCx - textWidth / 2 - 4, loopCy - 7, textWidth + 8, 14);
        ctx.strokeStyle = isFlashing ? "#38bdf8" : isTraversed ? "#10b981" : "#21262d";
        ctx.strokeRect(loopCx - textWidth / 2 - 4, loopCy - 7, textWidth + 8, 14);
        ctx.fillStyle = isFlashing ? "#38bdf8" : isTraversed ? "#10b981" : "#94a3b8";
        ctx.fillText(condLabel, loopCx, loopCy + 4);
        ctx.restore();
      } else {
        // Curved Quadratic Bezier Arc between distinct states
        const dx = dst.x - src.x;
        const dy = dst.y - src.y;
        const dist = Math.hypot(dx, dy);
        const curveOffset = Math.min(48, Math.max(24, dist * 0.18));

        // Perpendicular offset for curve
        const midX = (src.x + dst.x) / 2 - (dy / dist) * curveOffset;
        const midY = (src.y + dst.y) / 2 + (dx / dist) * curveOffset;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(midX, midY, dst.x, dst.y);
        ctx.stroke();

        // Arrowhead at destination boundary
        const angle = Math.atan2(dst.y - midY, dst.x - midX);
        const arrowTipX = dst.x - Math.cos(angle) * nodeRadius;
        const arrowTipY = dst.y - Math.sin(angle) * nodeRadius;

        ctx.beginPath();
        ctx.moveTo(arrowTipX, arrowTipY);
        ctx.lineTo(
          arrowTipX - 10 * Math.cos(angle - Math.PI / 6),
          arrowTipY - 10 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowTipX - 10 * Math.cos(angle + Math.PI / 6),
          arrowTipY - 10 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Condition label knockout badge at curve midpoint
        ctx.save();
        ctx.font = "10.5px Inter, monospace";
        ctx.textAlign = "center";
        const textWidth = ctx.measureText(condLabel).width;
        ctx.fillStyle = "#0c1017";
        ctx.fillRect(midX - textWidth / 2 - 5, midY - 8, textWidth + 10, 16);
        ctx.strokeStyle = isFlashing ? "#38bdf8" : isHovered ? "#f59e0b" : isTraversed ? "#10b981" : "#242c38";
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - textWidth / 2 - 5, midY - 8, textWidth + 10, 16);
        ctx.fillStyle = isFlashing ? "#38bdf8" : isHovered ? "#f59e0b" : isTraversed ? "#10b981" : "#94a3b8";
        ctx.fillText(condLabel, midX, midY + 4);
        ctx.restore();
      }
    });

    // 2. Draw Reset Entry Pointer Arrow into Reset State
    const resetState = currentFsm.states.find((s) => s.is_reset || s.name === currentFsm.reset_state);
    if (resetState) {
      const rPos = statePositions.get(resetState.name);
      if (rPos) {
        const ptrAngle = Math.atan2(rPos.y, rPos.x) || -Math.PI / 2;
        const ptrLen = 60;
        const startX = rPos.x + Math.cos(ptrAngle) * (nodeRadius + ptrLen);
        const startY = rPos.y + Math.sin(ptrAngle) * (nodeRadius + ptrLen);
        const tipX = rPos.x + Math.cos(ptrAngle) * nodeRadius;
        const tipY = rPos.y + Math.sin(ptrAngle) * nodeRadius;

        ctx.strokeStyle = "#10b981";
        ctx.fillStyle = "#10b981";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Arrowhead
        const arrAngle = Math.atan2(tipY - startY, tipX - startX);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - 9 * Math.cos(arrAngle - Math.PI / 6),
          tipY - 9 * Math.sin(arrAngle - Math.PI / 6)
        );
        ctx.lineTo(
          tipX - 9 * Math.cos(arrAngle + Math.PI / 6),
          tipY - 9 * Math.sin(arrAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // "RESET" text badge
        ctx.save();
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        const tagX = startX + Math.cos(ptrAngle) * 8;
        const tagY = startY + Math.sin(ptrAngle) * 8;
        ctx.fillStyle = "#0c1017";
        ctx.fillRect(tagX - 22, tagY - 7, 44, 14);
        ctx.strokeStyle = "#10b981";
        ctx.strokeRect(tagX - 22, tagY - 7, 44, 14);
        ctx.fillStyle = "#10b981";
        ctx.fillText("RESET", tagX, tagY + 3.5);
        ctx.restore();
      }
    }

    // 3. Draw State Bubble Nodes
    currentFsm.states.forEach((s) => {
      const pos = statePositions.get(s.name);
      if (!pos) return;

      const isActive = s.name === activeStateName;
      const isHovered = s.name === hoveredStateName;
      const sHits = coverage?.state_hits?.[s.name] ?? 0;
      const isCovered = sHits > 0;

      // Glow effect for active state
      if (isActive) {
        ctx.save();
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      } else if (isHovered) {
        ctx.save();
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      } else if (isCovered) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Circle Body
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#0c2d48" : isHovered ? "#1c2331" : "#13171d";
      ctx.fill();

      ctx.strokeStyle = isActive
        ? "#38bdf8"
        : isHovered
        ? "#f59e0b"
        : s.is_reset
        ? "#10b981"
        : isCovered
        ? "#10b981"
        : "#30363d";
      ctx.lineWidth = isActive ? 3.2 : isHovered ? 2.5 : s.is_reset ? 2.5 : 1.5;
      ctx.stroke();

      // Reset double inner ring
      if (s.is_reset) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius - 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // State Name & Binary Value Text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 12.5px Inter, sans-serif";
      ctx.fillStyle = isActive ? "#38bdf8" : isHovered ? "#f59e0b" : "#f1f5f9";
      ctx.fillText(s.name, pos.x, pos.y - 11);

      ctx.font = "10px monospace";
      ctx.fillStyle = isActive ? "#7dd3fc" : "#94a3b8";
      ctx.fillText(`[${s.binary_str}]`, pos.x, pos.y + 6);

      // Hit count
      ctx.font = "9px monospace";
      ctx.fillStyle = isCovered ? "#10b981" : "#64748b";
      ctx.fillText(isCovered ? `${sHits} hits` : "0 hits", pos.x, pos.y + 21);
    });

    ctx.restore();
    ctx.restore();
  }, [
    currentFsm,
    statePositions,
    scale,
    offsetX,
    offsetY,
    activeStateName,
    hoveredStateName,
    hoveredTransitionKey,
    flashingTransKey,
    coverage
  ]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setOffsetX(e.clientX - panStart.x);
      setOffsetY(e.clientY - panStart.y);
      return;
    }

    // World coordinates
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    let foundState: string | null = null;
    const nodeRadius = 38;

    statePositions.forEach((pos, name) => {
      const dist = Math.hypot(worldX - pos.x, worldY - pos.y);
      if (dist <= nodeRadius) {
        foundState = name;
      }
    });

    setHoveredStateName(foundState);
    if (foundState) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Check transition proximity
    let foundTrans: string | null = null;
    currentFsm?.transitions.forEach((t) => {
      const src = statePositions.get(t.from_state);
      const dst = statePositions.get(t.to_state);
      if (!src || !dst) return;
      const key = `${t.from_state}->${t.to_state}`;

      if (t.from_state === t.to_state) {
        const angle = Math.atan2(src.y, src.x);
        const loopCx = src.x + Math.cos(angle) * (nodeRadius + 32);
        const loopCy = src.y + Math.sin(angle) * (nodeRadius + 32);
        if (Math.hypot(worldX - loopCx, worldY - loopCy) <= 28) {
          foundTrans = key;
        }
      } else {
        const midX = (src.x + dst.x) / 2;
        const midY = (src.y + dst.y) / 2;
        if (Math.hypot(worldX - midX, worldY - midY) <= 24) {
          foundTrans = key;
        }
      }
    });

    setHoveredTransitionKey(foundTrans);
    if (foundTrans) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    } else {
      setTooltipPos(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    setHoveredStateName(null);
    setHoveredTransitionKey(null);
    setTooltipPos(null);
  };

  // Zoom via wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.min(Math.max(scale * zoomFactor, 0.3), 3.0);
    const newOffsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
    const newOffsetY = mouseY - (mouseY - offsetY) * (newScale / scale);

    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // Click to jump to code
  const handleClick = () => {
    if (hoveredStateName && onJumpToCode) {
      onJumpToCode(1, 1);
    }
  };

  // KPI calculations
  const totalStates = currentFsm?.states.length || 0;
  const coveredStates =
    currentFsm?.states.filter((s) => (coverage?.state_hits?.[s.name] ?? 0) > 0).length || 0;
  const stateCovPct = totalStates > 0 ? (coveredStates / totalStates) * 100 : 100;

  const totalTrans = currentFsm?.transitions.length || 0;
  const coveredTrans =
    currentFsm?.transitions.filter(
      (t) => (coverage?.transition_hits?.[`${t.from_state}->${t.to_state}`] ?? 0) > 0
    ).length || 0;
  const transCovPct = totalTrans > 0 ? (coveredTrans / totalTrans) * 100 : 100;

  if (!currentFsm || fsms.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0c1017",
          padding: 32,
          textAlign: "center"
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
          <Workflow size={28} color="var(--accent-cyan)" />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          No Finite State Machine Detected
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            maxWidth: 480,
            lineHeight: 1.5,
            marginBottom: 20
          }}
        >
          The FSM Visualizer extracts state registers (<code style={{ color: "var(--accent-cyan)" }}>state &lt;= next_state</code>)
          and branching logic (<code style={{ color: "var(--accent-cyan)" }}>case (state)</code>).
          Switch to an FSM design such as the <strong>Sequence Detector '1011'</strong> (Lesson 5) or <strong>UART Transceiver</strong>.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0c1017",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Top Header Control Ribbon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          zIndex: 10,
          gap: 8,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Workflow size={14} color="var(--accent-cyan)" />
          {fsms.length > 1 ? (
            <select
              value={selectedFsmIdx}
              onChange={(e) => setSelectedFsmIdx(Number(e.target.value))}
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                cursor: "pointer"
              }}
            >
              {fsms.map((item, idx) => (
                <option key={idx} value={idx}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
              {currentLabel}
            </span>
          )}

          <span
            style={{
              fontSize: 10.5,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              color: "var(--accent-cyan)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              fontFamily: "monospace"
            }}
          >
            reg [{currentFsm.state_width - 1}:0] {currentFsm.state_reg}
          </span>

          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Active State: <strong style={{ color: "#38bdf8" }}>{activeStateName}</strong>
          </span>
        </div>

        {/* Middle Coverage & Warnings Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {auditReport && auditReport.warnings.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: 10,
                backgroundColor: "rgba(244, 63, 94, 0.15)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                color: "var(--accent-rose)",
                fontSize: 10.5,
                fontWeight: 600
              }}
              title={auditReport.warnings.join("\n")}
            >
              <AlertTriangle size={11} />
              {auditReport.warnings.length} Audit Warning{auditReport.warnings.length > 1 ? "s" : ""}
            </div>
          )}

          {/* State Coverage Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 10,
              backgroundColor:
                stateCovPct >= 80
                  ? "rgba(16, 185, 129, 0.15)"
                  : stateCovPct >= 50
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(244, 63, 94, 0.15)",
              border: `1px solid ${
                stateCovPct >= 80
                  ? "rgba(16, 185, 129, 0.3)"
                  : stateCovPct >= 50
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(244, 63, 94, 0.3)"
              }`,
              color:
                stateCovPct >= 80
                  ? "var(--accent-emerald)"
                  : stateCovPct >= 50
                  ? "var(--accent-amber)"
                  : "var(--accent-rose)",
              fontSize: 10.5,
              fontWeight: 600
            }}
          >
            <CheckCircle2 size={11} />
            States: {coveredStates}/{totalStates} ({stateCovPct.toFixed(0)}%)
          </div>

          {/* Transition Coverage Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 10,
              backgroundColor:
                transCovPct >= 80
                  ? "rgba(16, 185, 129, 0.15)"
                  : transCovPct >= 50
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(244, 63, 94, 0.15)",
              border: `1px solid ${
                transCovPct >= 80
                  ? "rgba(16, 185, 129, 0.3)"
                  : transCovPct >= 50
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(244, 63, 94, 0.3)"
              }`,
              color:
                transCovPct >= 80
                  ? "var(--accent-emerald)"
                  : transCovPct >= 50
                  ? "var(--accent-amber)"
                  : "var(--accent-rose)",
              fontSize: 10.5,
              fontWeight: 600
            }}
          >
            <Activity size={11} />
            Arcs: {coveredTrans}/{totalTrans} ({transCovPct.toFixed(0)}%)
          </div>
        </div>

        {/* Right Toolbar Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Layout switcher */}
          <button
            onClick={() => setLayoutMode((m) => (m === "radial" ? "chain" : "radial"))}
            title={layoutMode === "radial" ? "Switch to Chain Layout" : "Switch to Radial Layout"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              fontSize: 10.5,
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            <Compass size={11} />
            <span>{layoutMode === "radial" ? "Radial" : "Chain"}</span>
          </button>

          <button
            onClick={() => setScale((s) => Math.min(s * 1.2, 3.0))}
            title="Zoom In"
            style={{
              padding: "3px 6px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            <ZoomIn size={12} />
          </button>

          <button
            onClick={() => setScale((s) => Math.max(s * 0.8, 0.3))}
            title="Zoom Out"
            style={{
              padding: "3px 6px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            <ZoomOut size={12} />
          </button>

          <button
            onClick={handleAutoFit}
            title="Auto-Fit Diagram"
            style={{
              padding: "3px 6px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            <Crosshair size={12} />
          </button>

          <button
            onClick={() => {
              setScale(1.0);
              const canvas = canvasRef.current;
              if (canvas) {
                setOffsetX(canvas.clientWidth / 2);
                setOffsetY(canvas.clientHeight / 2);
              }
            }}
            title="Reset Camera"
            style={{
              padding: "3px 6px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            <RotateCcw size={12} />
          </button>

          {/* Toggle Audit Drawer */}
          <button
            onClick={() => setShowAuditDrawer((prev) => !prev)}
            title="Toggle FSM Verification Audit Dock"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 7px",
              fontSize: 10.5,
              fontWeight: showAuditDrawer ? 600 : 400,
              backgroundColor: showAuditDrawer ? "rgba(59, 130, 246, 0.2)" : "var(--bg-tertiary)",
              border: `1px solid ${showAuditDrawer ? "var(--accent-blue)" : "var(--border-subtle)"}`,
              color: showAuditDrawer ? "var(--accent-blue)" : "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer"
            }}
          >
            <Table size={11} />
            <span>Audit</span>
            {showAuditDrawer ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          cursor: isPanning ? "grabbing" : hoveredStateName ? "pointer" : "grab"
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onClick={handleClick}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Floating Tooltip Inspector Card */}
        {tooltipPos && hoveredStateName && (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x + 14,
              top: tooltipPos.y + 14,
              backgroundColor: "rgba(19, 23, 29, 0.95)",
              backdropFilter: "blur(6px)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              zIndex: 999,
              pointerEvents: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              maxWidth: 260
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <strong style={{ color: "var(--text-primary)", fontSize: 12 }}>
                {hoveredStateName}
              </strong>
              {currentFsm.states.find((s) => s.name === hoveredStateName)?.is_reset && (
                <span style={{ fontSize: 9, color: "var(--accent-emerald)", fontWeight: 700 }}>
                  [RESET]
                </span>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>
              Hits:{" "}
              <strong style={{ color: "var(--accent-emerald)" }}>
                {coverage?.state_hits?.[hoveredStateName] ?? 0}
              </strong>{" "}
              visits
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              Outgoing transitions:{" "}
              {currentFsm.transitions.filter((t) => t.from_state === hoveredStateName).length}
            </div>
          </div>
        )}

        {/* Legend Overlay at Bottom-Left */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            backgroundColor: "rgba(13, 17, 23, 0.85)",
            backdropFilter: "blur(4px)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 10px",
            fontSize: 10.5,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            pointerEvents: "none",
            zIndex: 5
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#38bdf8",
                boxShadow: "0 0 6px #38bdf8"
              }}
            />
            Active State
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                border: "2px double #10b981",
                backgroundColor: "#13171d"
              }}
            />
            Reset State
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10b981"
              }}
            />
            Covered State
          </span>
        </div>
      </div>

      {/* Collapsible Bottom Audit & Verification Dock */}
      {showAuditDrawer && (
        <div
          style={{
            height: 180,
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            zIndex: 20,
            overflow: "hidden"
          }}
        >
          <div
            style={{
              padding: "4px 12px",
              backgroundColor: "var(--bg-tertiary)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)"
            }}
          >
            <span>FSM Verification Audit & State Transition Table</span>
            <button
              onClick={() => setShowAuditDrawer(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px 4px"
              }}
            >
              <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px", display: "flex", gap: 16 }}>
            {/* Verification Warnings */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Design Rule Checks (DRC)
              </div>
              {auditReport && auditReport.warnings.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} />
                  0 DRC Violations. All states reachable with valid reset and exit transitions.
                </div>
              ) : (
                auditReport?.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 10.5,
                      color: "var(--accent-rose)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4
                    }}
                  >
                    <AlertTriangle size={12} />
                    {w}
                  </div>
                ))
              )}
            </div>

            {/* State Table */}
            <div style={{ flex: 1.4, minWidth: 320, overflowX: "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                States & Transitions Matrix
              </div>
              <table style={{ width: "100%", fontSize: 10.5, borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={{ padding: "3px 6px" }}>State Name</th>
                    <th style={{ padding: "3px 6px" }}>Value</th>
                    <th style={{ padding: "3px 6px" }}>In / Out</th>
                    <th style={{ padding: "3px 6px" }}>Reset</th>
                    <th style={{ padding: "3px 6px" }}>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFsm.states.map((s) => {
                    const inDeg = auditReport?.inDegrees[s.name] ?? 0;
                    const outDeg = auditReport?.outDegrees[s.name] ?? 0;
                    const hits = coverage?.state_hits?.[s.name] ?? 0;
                    return (
                      <tr
                        key={s.name}
                        style={{
                          borderBottom: "1px solid rgba(36, 44, 56, 0.4)",
                          color: s.name === activeStateName ? "#38bdf8" : "var(--text-secondary)"
                        }}
                      >
                        <td style={{ padding: "3px 6px", fontWeight: s.name === activeStateName ? 700 : 400 }}>
                          {s.name}
                        </td>
                        <td style={{ padding: "3px 6px", fontFamily: "monospace" }}>{s.binary_str}</td>
                        <td style={{ padding: "3px 6px" }}>
                          {inDeg} in / {outDeg} out
                        </td>
                        <td style={{ padding: "3px 6px", color: s.is_reset ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                          {s.is_reset ? "Yes" : "No"}
                        </td>
                        <td style={{ padding: "3px 6px", color: hits > 0 ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                          {hits}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
