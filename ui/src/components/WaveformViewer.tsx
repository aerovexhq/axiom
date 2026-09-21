import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ZoomIn, ZoomOut, Maximize2, Bug, Sliders, Lock, Unlock, Layers, AlertTriangle, X,
  Search, History, Cpu, ShieldAlert, Bookmark, Activity, ChevronDown,
  Plus, Trash2, Edit2
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  DisplayRadix, formatValueWithRadix, extractBitValue, parseRawValue, parseToFloat,
  formatFrequency, calculateClockCycles
} from "../engine/radixUtils";
import { useTranslation } from "../i18n/i18nContext";
import { DecodedTransaction } from "../engine/protocolDecoders";
import { ProtocolDecoderModal } from "./ProtocolDecoderModal";
import { AssertionViolation, getViolationTimePs } from "../engine/assertionModel";

const formatTimeCompact = (ps: number) => {
  if (ps >= 1_000_000) return `${(ps / 1_000_000).toFixed(2)}μs`;
  if (ps >= 1000) return `${(ps / 1000).toFixed(2)}ns`;
  return `${ps}ps`;
};

export type BusPlotMode = "digital" | "analog_step" | "analog_linear";
export type BusSliceMode = "bits" | "nibbles";

export interface TimelineMarker {
  id: string;
  timePs: number;
  label: string;
  color: string;
}

interface WaveformViewerProps {
  state: SimulationState;
  selectedSignalIds: Set<string>;
}

interface DisplaySignalRow {
  key: string;
  isBitChild: boolean;
  parentName?: string;
  bitIndex?: number;
  id: string;
  name: string;
  fullName: string;
  width: number;
  isBus: boolean;
  samples: Array<{ timePs: number; delta: number; value: string; isGlitch?: boolean }>;
}

export interface RowLayout {
  row: DisplaySignalRow;
  yTop: number;
  height: number;
  isAnalog: boolean;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({ state, selectedSignalIds }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport time window (in picoseconds) with local persistence
  const [timeOffsetPs, setTimeOffsetPs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_wave_viewport_${state.topModule || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.timeOffsetPs === "number" && !isNaN(parsed.timeOffsetPs)) {
          return parsed.timeOffsetPs;
        }
      }
    } catch {}
    return 0;
  });
  const [pixelsPerPs, setPixelsPerPs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`axiom_wave_viewport_${state.topModule || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.pixelsPerPs === "number" && !isNaN(parsed.pixelsPerPs) && parsed.pixelsPerPs > 0) {
          return parsed.pixelsPerPs;
        }
      }
    } catch {}
    return 0.1; // 100 pixels per 1000 ps (1 ns)
  });
  const [hoverTimePs, setHoverTimePs] = useState<number | null>(null);

  // Debounced persistence for waveform viewport
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `axiom_wave_viewport_${state.topModule || "default"}`,
          JSON.stringify({ timeOffsetPs, pixelsPerPs })
        );
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [timeOffsetPs, pixelsPerPs, state.topModule]);

  // Listen for simulation reset to rewind graph to t=0
  useEffect(() => {
    const handleSimReset = () => {
      setTimeOffsetPs(0);
    };
    window.addEventListener("axiom_sim_reset", handleSimReset);
    return () => window.removeEventListener("axiom_sim_reset", handleSimReset);
  }, []);

  const headerHeight = 32;
  const gutterWidth = 230;

  // Listen for waveform seek events (e.g. from bottom dock Assertions tab)
  useEffect(() => {
    const handleSeekWaveform = (e: any) => {
      if (typeof e.detail?.timePs === "number") {
        const targetTime = e.detail.timePs;
        const containerW = containerRef.current?.clientWidth || 800;
        const plotW = Math.max(100, containerW - gutterWidth);
        const newOffset = Math.max(0, targetTime - (plotW / pixelsPerPs) / 2);
        setTimeOffsetPs(newOffset);
        setCursorAPrivate(targetTime);
      }
    };
    window.addEventListener("axiom_seek_waveform", handleSeekWaveform);
    return () => window.removeEventListener("axiom_seek_waveform", handleSeekWaveform);
  }, [pixelsPerPs, gutterWidth]);

  // Modern Drag-to-Measure Window Selection System
  const [cursorAPrivate, setCursorAPrivate] = useState<number | null>(null);
  const [cursorBPrivate, setCursorBPrivate] = useState<number | null>(null);
  const [activeCursorDrag, setActiveCursorDrag] = useState<"A" | "B" | "window" | "new_selection" | string | null>(null);
  const [selectionAnchorPs, setSelectionAnchorPs] = useState<number | null>(null);
  const [windowDragOffsetPs, setWindowDragOffsetPs] = useState<number>(0);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-Radix Bus Exploder State with local persistence
  const [expandedBuses, setExpandedBuses] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`axiom_wave_expanded_buses_${state.topModule || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `axiom_wave_expanded_buses_${state.topModule || "default"}`,
          JSON.stringify(expandedBuses)
        );
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [expandedBuses, state.topModule]);

  const [busRadixMap, setBusRadixMap] = useState<Record<string, DisplayRadix>>({});
  const [globalRadix, setGlobalRadix] = useState<DisplayRadix>("hex");

  // Phase 37: Multi-Bit Bus Plot Modes (Digital, Analog Stepped, Analog Linear)
  const [busPlotModes, setBusPlotModes] = useState<Record<string, BusPlotMode>>(() => {
    try {
      const saved = localStorage.getItem(`axiom_wave_bus_modes_${state.topModule || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `axiom_wave_bus_modes_${state.topModule || "default"}`,
          JSON.stringify(busPlotModes)
        );
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [busPlotModes, state.topModule]);

  // Phase 37: Multi-Bit Bus Slicing Mode (Bits vs. Nibbles)
  const [busSliceModes, setBusSliceModes] = useState<Record<string, BusSliceMode>>(() => {
    try {
      const saved = localStorage.getItem(`axiom_wave_slice_modes_${state.topModule || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `axiom_wave_slice_modes_${state.topModule || "default"}`,
          JSON.stringify(busSliceModes)
        );
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [busSliceModes, state.topModule]);

  // Phase 37: Draggable Timeline Bookmark Markers
  const [markers, setMarkers] = useState<TimelineMarker[]>(() => {
    try {
      const saved = localStorage.getItem(`axiom_wave_markers_${state.topModule || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `axiom_wave_markers_${state.topModule || "default"}`,
          JSON.stringify(markers)
        );
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [markers, state.topModule]);

  const [activeMarkerModal, setActiveMarkerModal] = useState<{
    isOpen: boolean;
    marker: TimelineMarker;
    isNew: boolean;
  } | null>(null);
  const [isMarkerDropdownOpen, setIsMarkerDropdownOpen] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  // Zero-Time Delta Accordion Viewer State
  const [showDeltaGlitches, setShowDeltaGlitches] = useState<boolean>(true);
  const [expandedDeltaTimePs, setExpandedDeltaTimePs] = useState<number | null>(null);

  // Phase 22: Temporal Logic Assertion Radar Pins
  const [showAssertionPins, setShowAssertionPins] = useState<boolean>(true);
  const [activeHoverViolation, setActiveHoverViolation] = useState<AssertionViolation | null>(null);

  // Signal Forcing Modal State
  const [forcingSignal, setForcingSignal] = useState<{ id: string; name: string; isBus: boolean; width: number } | null>(null);
  const [forceInputVal, setForceInputVal] = useState<string>("1");

  // Phase 18: Time-Machine Scrub Sync & Hardware Protocol Decoder State
  const [timeMachineSync, setTimeMachineSync] = useState<boolean>(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [decodedTransactions, setDecodedTransactions] = useState<DecodedTransaction[]>([]);
  const [activeHoverTx, setActiveHoverTx] = useState<DecodedTransaction | null>(null);

  // Active base signals from parent selection
  const baseSignals = useMemo(() => {
    return state.signals.filter(
      (s) => selectedSignalIds.has(s.fullName) || selectedSignalIds.has(s.id)
    );
  }, [state.signals, selectedSignalIds]);

  // Flattened row list incorporating expanded multi-bit sub-lanes
  // Flattened row list incorporating expanded multi-bit sub-lanes and custom slices
  const displayRows = useMemo<DisplaySignalRow[]>(() => {
    const rows: DisplaySignalRow[] = [];

    baseSignals.forEach((sig) => {
      // Parent row
      rows.push({
        key: sig.id,
        isBitChild: false,
        id: sig.id,
        name: sig.name,
        fullName: sig.fullName,
        width: sig.width,
        isBus: sig.isBus,
        samples: sig.samples
      });

      // If bus is expanded, generate bit or nibble sub-lanes
      if (sig.isBus && expandedBuses[sig.id]) {
        const sliceMode = busSliceModes[sig.id] || "bits";

        if (sliceMode === "nibbles" && sig.width >= 8 && sig.width % 4 === 0) {
          // Nibble Slicing: create 4-bit sub-lanes [N*4-1 : (N-1)*4]
          const nibbleCount = Math.floor(sig.width / 4);
          for (let n = nibbleCount - 1; n >= 0; n--) {
            const highBit = (n + 1) * 4 - 1;
            const lowBit = n * 4;
            const sliceName = `${sig.name}[${highBit}:${lowBit}]`;

            const sliceSamples = sig.samples.map((s) => {
              const parsed = parseRawValue(s.value, sig.width);
              let sliceVal = "0x0";
              if (parsed.hasX) sliceVal = "x";
              else if (parsed.hasZ) sliceVal = "z";
              else if (parsed.num !== null) {
                const nibbleVal = Number((parsed.num >> BigInt(lowBit)) & 0xFn);
                sliceVal = "0x" + nibbleVal.toString(16).toUpperCase();
              }
              return {
                timePs: s.timePs,
                delta: s.delta,
                value: sliceVal,
                isGlitch: s.isGlitch
              };
            });

            rows.push({
              key: `${sig.id}_nibble_${n}`,
              isBitChild: true,
              parentName: sig.name,
              bitIndex: lowBit,
              id: `${sig.id}_nibble_${n}`,
              name: sliceName,
              fullName: `${sig.fullName}[${highBit}:${lowBit}]`,
              width: 4,
              isBus: true,
              samples: sliceSamples
            });
          }
        } else {
          // Individual bit expansion: [width-1] down to [0]
          for (let b = sig.width - 1; b >= 0; b--) {
            const bitName = `${sig.name}[${b}]`;
            const bitSamples = sig.samples.map((s) => ({
              timePs: s.timePs,
              delta: s.delta,
              value: extractBitValue(s.value, sig.width, b),
              isGlitch: s.isGlitch
            }));

            rows.push({
              key: `${sig.id}_bit_${b}`,
              isBitChild: true,
              parentName: sig.name,
              bitIndex: b,
              id: `${sig.id}_bit_${b}`,
              name: bitName,
              fullName: `${sig.fullName}[${b}]`,
              width: 1,
              isBus: false,
              samples: bitSamples
            });
          }
        }
      }
    });

    return rows;
  }, [baseSignals, expandedBuses, busSliceModes]);

  const protocolTrackHeight = decodedTransactions.length > 0 ? 28 : 0;

  // Flattened row layouts with dynamic heights for analog waveforms
  const rowLayouts = useMemo<RowLayout[]>(() => {
    let currY = headerHeight + protocolTrackHeight;
    return displayRows.map((row) => {
      const isAnalog =
        row.isBus &&
        !row.isBitChild &&
        (busPlotModes[row.id] === "analog_step" || busPlotModes[row.id] === "analog_linear");
      const h = isAnalog ? 56 : 28;
      const layout: RowLayout = { row, yTop: currY, height: h, isAnalog };
      currY += h;
      return layout;
    });
  }, [displayRows, busPlotModes, headerHeight, protocolTrackHeight]);

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

  // Toggle Bus Expansion
  const toggleBusExpansion = (busId: string) => {
    setExpandedBuses((prev) => ({
      ...prev,
      [busId]: !prev[busId]
    }));
  };

  // Toggle All Buses (Explode All / Collapse All)
  const toggleAllBuses = () => {
    const hasAnyExpanded = Object.values(expandedBuses).some(Boolean);
    if (hasAnyExpanded) {
      setExpandedBuses({});
    } else {
      const next: Record<string, boolean> = {};
      baseSignals.forEach((s) => {
        if (s.isBus) next[s.id] = true;
      });
      setExpandedBuses(next);
    }
  };

  // Cycle Analog Plot Mode for Bus (digital -> analog_step -> analog_linear -> digital)
  const cycleBusPlotMode = (busId: string) => {
    const current = busPlotModes[busId] || "digital";
    const next: BusPlotMode =
      current === "digital"
        ? "analog_step"
        : current === "analog_step"
        ? "analog_linear"
        : "digital";
    setBusPlotModes((prev) => ({ ...prev, [busId]: next }));
  };

  // Cycle Slice Mode for Bus (bits -> nibbles -> bits)
  const cycleBusSliceMode = (busId: string) => {
    setBusSliceModes((prev) => ({
      ...prev,
      [busId]: prev[busId] === "nibbles" ? "bits" : "nibbles"
    }));
  };

  // Jump camera and set cursor to specific timestamp
  const jumpToTime = (targetPs: number) => {
    const containerW = containerRef.current?.clientWidth || 800;
    const plotW = Math.max(100, containerW - gutterWidth);
    const newOffset = Math.max(0, targetPs - (plotW / pixelsPerPs) / 2);
    setTimeOffsetPs(newOffset);
    setCursorAPrivate(targetPs);
  };

  // Cycle Radix for Bus
  const cycleBusRadix = (busId: string, current: DisplayRadix) => {
    const radices: DisplayRadix[] = ["hex", "bin", "u_dec", "s_dec", "ascii"];
    const nextIdx = (radices.indexOf(current) + 1) % radices.length;
    setBusRadixMap((prev) => ({
      ...prev,
      [busId]: radices[nextIdx]
    }));
  };

  // Delta timestamps with multi-delta activity
  const deltaTimestamps = useMemo(() => {
    const timeCounts = new Map<number, number>();
    for (const sig of state.signals) {
      for (const s of sig.samples) {
        timeCounts.set(s.timePs, (timeCounts.get(s.timePs) ?? 0) + 1);
      }
    }
    const result: number[] = [];
    timeCounts.forEach((count, t) => {
      if (count > 1) result.push(t);
    });
    return result;
  }, [state.signals]);
  // Clock Signal & Precision Cycle Detection
  const clockCycleData = useMemo(() => {
    if (cursorAPrivate === null || cursorBPrivate === null) return null;
    const deltaPs = Math.abs(cursorBPrivate - cursorAPrivate);
    if (deltaPs <= 0) return null;

    const clockSig = state.signals.find(
      (s) =>
        s.name.toLowerCase() === "clk" ||
        s.name.toLowerCase() === "clock" ||
        s.name.toLowerCase().endsWith("_clk") ||
        s.name.toLowerCase().includes("clk")
    );
    if (!clockSig || !clockSig.samples || clockSig.samples.length < 3) return null;

    return calculateClockCycles(deltaPs, clockSig.samples);
  }, [cursorAPrivate, cursorBPrivate, state.signals]);

  // Delta Time & Frequency Measurement Calculation
  const measurementDelta = useMemo(() => {
    if (cursorAPrivate === null || cursorBPrivate === null) return null;
    const deltaPs = Math.abs(cursorBPrivate - cursorAPrivate);
    const deltaNs = deltaPs / 1000;
    const deltaUs = deltaNs / 1000;

    const timeStr = deltaPs >= 1_000_000
      ? `${deltaUs.toFixed(3)} μs`
      : deltaPs >= 1000
      ? `${deltaNs.toFixed(3)} ns`
      : `${deltaPs} ps`;

    const freqStr = formatFrequency(deltaPs);

    return { timeStr, freqStr, deltaPs };
  }, [cursorAPrivate, cursorBPrivate]);

  // Main Canvas Render
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#090c10";
    ctx.fillRect(0, 0, width, height);

    // Plot area bounds
    const plotX = gutterWidth;
    const plotW = width - gutterWidth;

    // Time calculations
    const startTimePs = timeOffsetPs;
    const endTimePs = timeOffsetPs + plotW / pixelsPerPs;
    const timeSpanPs = endTimePs - startTimePs;

    // Grid step calculation
    const roughGridSteps = 10;
    const rawStepPs = timeSpanPs / roughGridSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStepPs)));
    let gridStepPs = magnitude;
    if (rawStepPs / magnitude > 5) gridStepPs = magnitude * 5;
    else if (rawStepPs / magnitude > 2) gridStepPs = magnitude * 2;
    gridStepPs = Math.max(10, gridStepPs);

    // Draw Timeline Header Background
    ctx.fillStyle = "#11151c";
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.strokeStyle = "#1e293b";
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
      ctx.strokeStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(x, headerHeight - 6);
      ctx.lineTo(x, headerHeight);
      ctx.stroke();

      // Background grid vertical line
      ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
      ctx.beginPath();
      ctx.moveTo(x, headerHeight);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Label text
      const label = t >= 1_000_000 ? `${(t / 1_000_000).toFixed(1)}μs` : t >= 1000 ? `${(t / 1000).toFixed(1)}ns` : `${t}ps`;
      ctx.fillText(label, x, headerHeight - 12);
    }

    // Draw Delta Indicators [δ+] on timeline header
    deltaTimestamps.forEach((dT) => {
      const dX = plotX + (dT - startTimePs) * pixelsPerPs;
      if (dX >= plotX && dX <= width) {
        ctx.fillStyle = expandedDeltaTimePs === dT ? "#00f2fe" : "rgba(245, 158, 11, 0.9)";
        ctx.beginPath();
        ctx.arc(dX, headerHeight - 6, 3.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = "bold 8px JetBrains Mono, monospace";
        ctx.fillStyle = expandedDeltaTimePs === dT ? "#00f2fe" : "#f59e0b";
        ctx.fillText("δ+", dX, headerHeight - 14);
      }
    });

    // Draw Current SimTime Vertical Marker
    const simTimeX = plotX + (state.currentSimTimePs - startTimePs) * pixelsPerPs;
    if (simTimeX >= plotX && simTimeX <= width) {
      ctx.strokeStyle = "#00f2fe";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(simTimeX, 0);
      ctx.lineTo(simTimeX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw SVA Temporal Logic Assertion Violation Radar Pins
    if (showAssertionPins && state.assertionViolations && state.assertionViolations.length > 0) {
      state.assertionViolations.forEach((v) => {
        const vTimePs = getViolationTimePs(v);
        const vX = plotX + (vTimePs - startTimePs) * pixelsPerPs;
        if (vX >= plotX && vX <= width) {
          const isHovered = activeHoverViolation === v;

          // Vertical crimson violation line spanning all signal tracks
          ctx.strokeStyle = isHovered ? "rgba(239, 68, 68, 0.85)" : "rgba(239, 68, 68, 0.45)";
          ctx.lineWidth = isHovered ? 1.5 : 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(vX, headerHeight);
          ctx.lineTo(vX, height);
          ctx.stroke();
          ctx.setLineDash([]);

          // Header crimson violation pin badge
          const pinY = 4;
          const pinH = 16;
          const pinW = 20;

          ctx.fillStyle = isHovered ? "#dc2626" : "#ef4444";
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(vX - pinW / 2, pinY, pinW, pinH, 3);
          } else {
            ctx.rect(vX - pinW / 2, pinY, pinW, pinH);
          }
          ctx.fill();

          if (isHovered) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Pin icon/label "!"
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("!", vX, pinY + 11);
        }
      });
    }

    // Phase 37: Draw Draggable Timeline Bookmark Markers
    markers.forEach((m, idx) => {
      const mX = plotX + (m.timePs - startTimePs) * pixelsPerPs;
      if (mX >= plotX && mX <= width) {
        const isHovered = hoveredMarkerId === m.id || activeCursorDrag === `marker:${m.id}`;

        // Full-height vertical dashed line
        ctx.strokeStyle = m.color || "#f59e0b";
        ctx.lineWidth = isHovered ? 1.8 : 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(mX, headerHeight);
        ctx.lineTo(mX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bookmark Flag Tag on Timeline Header
        const flagText = m.label || `M${idx + 1}`;
        ctx.font = "bold 9px Inter, sans-serif";
        const tagTextWidth = ctx.measureText(flagText).width;
        const tagW = Math.max(24, Math.min(80, tagTextWidth + 10));
        const tagH = 16;
        const tagY = 3;

        ctx.fillStyle = m.color || "#f59e0b";
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(mX - tagW / 2, tagY, tagW, tagH, 3);
        } else {
          ctx.rect(mX - tagW / 2, tagY, tagW, tagH);
        }
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Pointer notch at bottom of flag
        ctx.fillStyle = m.color || "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(mX - 4, tagY + tagH);
        ctx.lineTo(mX + 4, tagY + tagH);
        ctx.lineTo(mX, tagY + tagH + 4);
        ctx.closePath();
        ctx.fill();

        // Marker label text
        ctx.fillStyle = "#0c1017";
        ctx.textAlign = "center";
        const trimmedLabel = flagText.length > 10 ? flagText.slice(0, 9) + "…" : flagText;
        ctx.fillText(trimmedLabel, mX, tagY + 11);
      }
    });

    // Draw Measurement Window Shading between Cursor A and B
    if (cursorAPrivate !== null && cursorBPrivate !== null && cursorAPrivate !== cursorBPrivate) {
      const minCur = Math.min(cursorAPrivate, cursorBPrivate);
      const maxCur = Math.max(cursorAPrivate, cursorBPrivate);
      const winLeft = Math.max(plotX, plotX + (minCur - startTimePs) * pixelsPerPs);
      const winRight = Math.min(width, plotX + (maxCur - startTimePs) * pixelsPerPs);
      if (winRight > winLeft) {
        ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
        ctx.fillRect(winLeft, 0, winRight - winLeft, height);

        ctx.fillStyle = "rgba(6, 182, 212, 0.28)";
        ctx.fillRect(winLeft, 0, winRight - winLeft, headerHeight);

        ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(winLeft, 0, winRight - winLeft, height);

        // Phase 37: Floating Precision Measurement HUD Badge on Canvas
        if (measurementDelta) {
          const winW = winRight - winLeft;
          const badgeCenterX = winLeft + winW / 2;
          const badgeY = headerHeight + 6;

          let badgeText = `Δt: ${measurementDelta.timeStr}   f: ${measurementDelta.freqStr}`;
          if (clockCycleData) {
            badgeText += `   [${clockCycleData.cycles} cyc]`;
          }

          ctx.font = "bold 10px JetBrains Mono, monospace";
          const textMetrics = ctx.measureText(badgeText);
          const badgeW = Math.max(160, textMetrics.width + 16);
          const badgeH = 20;
          const badgeLeft = Math.max(plotX + 8, Math.min(width - badgeW - 8, badgeCenterX - badgeW / 2));

          ctx.fillStyle = "rgba(12, 16, 23, 0.95)";
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(badgeLeft, badgeY, badgeW, badgeH, 4);
          } else {
            ctx.rect(badgeLeft, badgeY, badgeW, badgeH);
          }
          ctx.fill();

          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Render measurement metrics inside floating badge
          ctx.fillStyle = "#00f2fe";
          ctx.textAlign = "left";
          ctx.fillText(`Δt: ${measurementDelta.timeStr}`, badgeLeft + 8, badgeY + 14);

          ctx.fillStyle = "#10b981";
          const dtW = ctx.measureText(`Δt: ${measurementDelta.timeStr}   `).width;
          ctx.fillText(`f: ${measurementDelta.freqStr}`, badgeLeft + 8 + dtW, badgeY + 14);

          if (clockCycleData) {
            ctx.fillStyle = "#f59e0b";
            const fW = ctx.measureText(`f: ${measurementDelta.freqStr}   `).width;
            ctx.fillText(`${clockCycleData.cycles} cyc`, badgeLeft + 8 + dtW + fW, badgeY + 14);
          }
        }
      }
    }

    // Draw Cursor A (Electric Cyan)
    if (cursorAPrivate !== null) {
      const curAX = plotX + (cursorAPrivate - startTimePs) * pixelsPerPs;
      if (curAX >= plotX && curAX <= width) {
        ctx.strokeStyle = "#00f2fe";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curAX, 0);
        ctx.lineTo(curAX, height);
        ctx.stroke();

        // Cursor A Tag
        ctx.fillStyle = "#00f2fe";
        ctx.fillRect(curAX - 12, 2, 24, 14);
        ctx.fillStyle = "#080b11";
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("A", curAX, 12);
      }
    }

    // Draw Cursor B (Neon Violet)
    if (cursorBPrivate !== null) {
      const curBX = plotX + (cursorBPrivate - startTimePs) * pixelsPerPs;
      if (curBX >= plotX && curBX <= width) {
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curBX, 0);
        ctx.lineTo(curBX, height);
        ctx.stroke();

        // Cursor B Tag
        ctx.fillStyle = "#a855f7";
        ctx.fillRect(curBX - 12, 2, 24, 14);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("B", curBX, 12);
      }
    }

    // Draw Hover Guide Line
    if (hoverTimePs !== null && hoverTimePs !== cursorAPrivate && hoverTimePs !== cursorBPrivate) {
      const hX = plotX + (hoverTimePs - startTimePs) * pixelsPerPs;
      if (hX >= plotX && hX <= width) {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hX, 0);
        ctx.lineTo(hX, height);
        ctx.stroke();
      }
    }

    // Draw Decoded Protocol Transaction Ribbon
    if (decodedTransactions.length > 0) {
      const pYTop = headerHeight;
      const pHeight = 28;
      ctx.fillStyle = "rgba(6, 182, 212, 0.08)";
      ctx.fillRect(plotX, pYTop, plotW, pHeight);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pYTop + pHeight);
      ctx.lineTo(width, pYTop + pHeight);
      ctx.stroke();

      for (const tx of decodedTransactions) {
        const tStart = tx.start_time_ps;
        const tEnd = Math.max(tStart + 10, tx.end_time_ps);
        const bX1 = plotX + (tStart - startTimePs) * pixelsPerPs;
        const bX2 = plotX + (tEnd - startTimePs) * pixelsPerPs;
        const bW = Math.max(24, bX2 - bX1);

        if (bX2 >= plotX && bX1 <= width) {
          const isHovered = activeHoverTx?.id === tx.id;
          ctx.fillStyle = isHovered ? "rgba(6, 182, 212, 0.45)" : "rgba(6, 182, 212, 0.22)";
          ctx.strokeStyle = isHovered ? "#22d3ee" : "#06b6d4";
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(bX1 + 1, pYTop + 4, bW - 2, pHeight - 8, 4);
          } else {
            ctx.rect(bX1 + 1, pYTop + 4, bW - 2, pHeight - 8);
          }
          ctx.fill();
          ctx.stroke();

          ctx.font = "10px JetBrains Mono, monospace";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          const label = tx.summary.length > 20 ? tx.summary.slice(0, 18) + "…" : tx.summary;
          ctx.fillText(label, bX1 + bW / 2, pYTop + 17);
        }
      }
    }

    // Render Signal Waveforms using rowLayouts
    rowLayouts.forEach(({ row, yTop, height: rowH, isAnalog }, index) => {
      const yMid = yTop + rowH / 2;
      const yHigh = yTop + 6;
      const yLow = yTop + rowH - 6;

      // Row background
      ctx.fillStyle = row.isBitChild
        ? "rgba(15, 23, 42, 0.3)"
        : index % 2 === 0
        ? "rgba(17, 21, 28, 0.4)"
        : "transparent";
      ctx.fillRect(plotX, yTop, plotW, rowH);

      // Row separator
      ctx.strokeStyle = "#151b23";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop + rowH);
      ctx.lineTo(width, yTop + rowH);
      ctx.stroke();

      const samples = row.samples;
      if (samples.length === 0) return;

      if (!row.isBus) {
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

          // Transition vertical line
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
            ctx.arc(currX, currentY, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Coral glitch hazard ribbon
            ctx.fillStyle = "rgba(236, 72, 153, 0.18)";
            ctx.fillRect(currX - 3, yTop, 6, rowH);
          }

          lastVal = s.value;
        }
      } else if (!isAnalog) {
        // Multi-bit Bus signal: Digital Hex diamonds with formatted text
        const currentRadix = busRadixMap[row.id] ?? globalRadix;

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

          // Bus Value Text with Multi-Radix Formatting
          if (segWidth > 24) {
            const formattedVal = formatValueWithRadix(s.value, row.width, currentRadix);
            ctx.font = "10px JetBrains Mono, monospace";
            ctx.fillStyle = "#e2e8f0";
            ctx.textAlign = "center";
            ctx.fillText(formattedVal, startX + segWidth / 2, yMid + 3.5);
          }
        }
      } else {
        // Phase 37: Multi-Bit Bus signal: Analog & Stepped Waveform Plotting!
        const plotMode = busPlotModes[row.id];
        const isSigned = (busRadixMap[row.id] ?? globalRadix) === "s_dec";

        const numericSamples: Array<{ timePs: number; value: number }> = [];
        let minVal = Infinity;
        let maxVal = -Infinity;

        for (const s of samples) {
          const v = parseToFloat(s.value, row.width, isSigned);
          if (v !== null) {
            numericSamples.push({ timePs: s.timePs, value: v });
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
          }
        }

        if (numericSamples.length > 0) {
          if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
          }
          const valRange = maxVal - minVal;

          // Subtle reference grid lines (0%, 50%, 100%)
          ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(plotX, yHigh);
          ctx.lineTo(width, yHigh);
          ctx.moveTo(plotX, yMid);
          ctx.lineTo(width, yMid);
          ctx.moveTo(plotX, yLow);
          ctx.lineTo(width, yLow);
          ctx.stroke();
          ctx.setLineDash([]);

          // Compute curve points
          const points: Array<{ x: number; y: number; val: number }> = [];
          for (let i = 0; i < numericSamples.length; i++) {
            const s = numericSamples[i];
            const currX = plotX + (s.timePs - startTimePs) * pixelsPerPs;
            const norm = (s.value - minVal) / valRange;
            const currY = yLow - norm * (yLow - yHigh);
            points.push({ x: currX, y: currY, val: s.value });
          }

          // Gradient fill under curve down to yLow
          const gradient = ctx.createLinearGradient(0, yHigh, 0, yLow);
          gradient.addColorStop(0, plotMode === "analog_step" ? "rgba(56, 189, 248, 0.28)" : "rgba(16, 185, 129, 0.28)");
          gradient.addColorStop(1, "rgba(56, 189, 248, 0.02)");

          ctx.fillStyle = gradient;
          ctx.beginPath();

          const firstX = Math.max(plotX, points[0].x);
          ctx.moveTo(firstX, yLow);
          ctx.lineTo(firstX, points[0].y);

          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const nextTime = i < numericSamples.length - 1 ? numericSamples[i + 1].timePs : state.currentSimTimePs;
            const nextX = plotX + (nextTime - startTimePs) * pixelsPerPs;

            if (plotMode === "analog_step") {
              ctx.lineTo(nextX, p.y);
            } else {
              if (i < points.length - 1) {
                ctx.lineTo(points[i + 1].x, points[i + 1].y);
              } else {
                ctx.lineTo(nextX, p.y);
              }
            }
          }

          const lastX = Math.min(width, plotX + (state.currentSimTimePs - startTimePs) * pixelsPerPs);
          ctx.lineTo(lastX, yLow);
          ctx.closePath();
          ctx.fill();

          // Stroke curve
          ctx.strokeStyle = plotMode === "analog_step" ? "#38bdf8" : "#10b981";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(firstX, points[0].y);

          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const nextTime = i < numericSamples.length - 1 ? numericSamples[i + 1].timePs : state.currentSimTimePs;
            const nextX = plotX + (nextTime - startTimePs) * pixelsPerPs;

            if (plotMode === "analog_step") {
              ctx.lineTo(nextX, p.y);
              if (i < points.length - 1) {
                ctx.lineTo(nextX, points[i + 1].y);
              }
            } else {
              if (i < points.length - 1) {
                ctx.lineTo(points[i + 1].x, points[i + 1].y);
              } else {
                ctx.lineTo(nextX, p.y);
              }
            }
          }
          ctx.stroke();

          // Draw sample point dots when zoomed in
          if (pixelsPerPs > 0.05) {
            ctx.fillStyle = plotMode === "analog_step" ? "#00f0ff" : "#34d399";
            for (const p of points) {
              if (p.x >= plotX && p.x <= width) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }

          // Range watermark labels in top-right of track
          ctx.font = "9px JetBrains Mono, monospace";
          ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
          ctx.textAlign = "right";
          ctx.fillText(`+${maxVal}`, width - 8, yHigh + 8);
          ctx.fillText(`${minVal}`, width - 8, yLow - 2);
        }
      }
    });

    // Draw Left Gutter (Signal Names & Values at Cursor)
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, gutterWidth, height);
    ctx.strokeStyle = "#1e293b";
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
    ctx.fillText(cursorAPrivate !== null ? "Value (A)" : "Value", gutterWidth - 12, headerHeight - 10);

    // Gutter Protocol Track
    if (decodedTransactions.length > 0) {
      const pYTop = headerHeight;
      ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
      ctx.fillRect(0, pYTop, gutterWidth, 28);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pYTop + 28);
      ctx.lineTo(gutterWidth, pYTop + 28);
      ctx.stroke();

      ctx.font = "11px Inter, sans-serif";
      ctx.fillStyle = "#06b6d4";
      ctx.textAlign = "left";
      ctx.fillText(decodedTransactions[0]?.protocol.toUpperCase() ?? "DECODE", 12, pYTop + 18);
    }

    // Gutter Signal Rows
    rowLayouts.forEach(({ row, yTop, height: rowH, isAnalog }) => {
      const yMid = yTop + (isAnalog ? 20 : rowH / 2 + 4);

      // Row separator
      ctx.strokeStyle = "#151b23";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop + rowH);
      ctx.lineTo(gutterWidth, yTop + rowH);
      ctx.stroke();

      const isForced = state.forcedSignalIds.includes(row.id);

      // 1. Expand/Collapse Chevron indicator for buses
      if (row.isBus && !row.isBitChild) {
        ctx.font = "9px Inter, sans-serif";
        ctx.fillStyle = expandedBuses[row.id] ? "#38bdf8" : "#64748b";
        ctx.textAlign = "left";
        ctx.fillText(expandedBuses[row.id] ? "▼" : "▶", 8, yMid - 1);
      }

      // 2. Analog Mode Pill Badge for buses
      if (row.isBus && !row.isBitChild) {
        const plotMode = busPlotModes[row.id] || "digital";
        const modeLabel = plotMode === "digital" ? "DIG" : plotMode === "analog_step" ? "STP" : "LIN";
        const modeBg =
          plotMode === "digital"
            ? "rgba(100, 116, 139, 0.2)"
            : plotMode === "analog_step"
            ? "rgba(56, 189, 248, 0.25)"
            : "rgba(16, 185, 129, 0.25)";
        const modeColor =
          plotMode === "digital" ? "#94a3b8" : plotMode === "analog_step" ? "#38bdf8" : "#10b981";

        ctx.fillStyle = modeBg;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(22, yMid - 8, 26, 13, 2);
        } else {
          ctx.rect(22, yMid - 8, 26, 13);
        }
        ctx.fill();

        ctx.font = "bold 8px JetBrains Mono, monospace";
        ctx.fillStyle = modeColor;
        ctx.textAlign = "center";
        ctx.fillText(modeLabel, 35, yMid + 2);
      }

      // 3. Slice Mode Pill Badge for buses >= 8 bits
      const hasSliceSupport = row.isBus && !row.isBitChild && row.width >= 8 && row.width % 4 === 0;
      if (hasSliceSupport) {
        const sliceMode = busSliceModes[row.id] || "bits";
        const sliceLabel = sliceMode === "nibbles" ? "NIB" : "BIT";
        const sliceBg = sliceMode === "nibbles" ? "rgba(168, 85, 247, 0.25)" : "rgba(100, 116, 139, 0.2)";
        const sliceColor = sliceMode === "nibbles" ? "#c084fc" : "#94a3b8";

        ctx.fillStyle = sliceBg;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(50, yMid - 8, 22, 13, 2);
        } else {
          ctx.rect(50, yMid - 8, 22, 13);
        }
        ctx.fill();

        ctx.font = "bold 8px JetBrains Mono, monospace";
        ctx.fillStyle = sliceColor;
        ctx.textAlign = "center";
        ctx.fillText(sliceLabel, 61, yMid + 2);
      }

      // 4. Signal Name & Indentation
      ctx.font = row.isBitChild ? "10px JetBrains Mono, monospace" : "11px JetBrains Mono, monospace";
      ctx.fillStyle = isForced
        ? "#f59e0b"
        : row.isBitChild
        ? "#94a3b8"
        : row.isBus
        ? isAnalog
          ? "#00f2fe"
          : "#38bdf8"
        : "#10b981";
      ctx.textAlign = "left";

      const xOffset = row.isBitChild ? 28 : row.isBus ? (hasSliceSupport ? 76 : 52) : 12;
      const maxChars = row.isBitChild ? 14 : row.isBus ? (hasSliceSupport ? 10 : 13) : 16;
      const displayName = row.name.length > maxChars ? row.name.substring(0, maxChars - 2) + ".." : row.name;

      ctx.fillText(displayName, xOffset, yMid);

      // Subtitle in analog mode: range
      if (isAnalog) {
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        ctx.fillText(`∿ ${busPlotModes[row.id] === "analog_step" ? "DAC Step" : "Linear"}`, xOffset, yMid + 16);
      }

      // Value at Cursor A or Current Time
      const queryTime = cursorAPrivate !== null ? cursorAPrivate : state.currentSimTimePs;
      const sample = [...row.samples].reverse().find((s) => s.timePs <= queryTime) ?? row.samples[0];
      const currentRadix = busRadixMap[row.id] ?? globalRadix;
      const rawVal = sample?.value ?? "-";
      const displayVal = row.isBus ? formatValueWithRadix(rawVal, row.width, currentRadix) : rawVal;

      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillStyle = isForced ? "#f59e0b" : "#f1f5f9";
      ctx.textAlign = "right";
      ctx.fillText(displayVal, gutterWidth - 12, yMid);
    });
  }, [
    state,
    rowLayouts,
    timeOffsetPs,
    pixelsPerPs,
    cursorAPrivate,
    cursorBPrivate,
    hoverTimePs,
    showDeltaGlitches,
    expandedDeltaTimePs,
    expandedBuses,
    busRadixMap,
    globalRadix,
    busPlotModes,
    markers,
    hoveredMarkerId,
    activeCursorDrag,
    deltaTimestamps,
    gutterWidth,
    headerHeight,
    measurementDelta,
    clockCycleData,
    decodedTransactions,
    activeHoverTx,
    activeHoverViolation,
    t
  ]);

  // Handle Resize and Animation
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

  // Mouse Interactivity: Pan, Drag-to-Measure Window Selection & Edge Dragging
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartTimeOffset, setPanStartTimeOffset] = useState(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouseDownPos({ x, y });

    const protocolTrackHeight = decodedTransactions.length > 0 ? 28 : 0;
    const rowYOffset = headerHeight + protocolTrackHeight;

    if (x >= gutterWidth) {
      const clickedPs = Math.max(0, Math.round(timeOffsetPs + (x - gutterWidth) / pixelsPerPs));

      // Click on Decoded Protocol Track: Jump/Scrub to transaction
      if (decodedTransactions.length > 0 && y >= headerHeight && y < rowYOffset) {
        const found = decodedTransactions.find((t) => clickedPs >= t.start_time_ps && clickedPs <= t.end_time_ps);
        if (found) {
          setActiveHoverTx(found);
          setCursorAPrivate(found.start_time_ps);
          setCursorBPrivate(found.end_time_ps);
          engineBridge.scrubToTime(found.start_time_ps);
          return;
        }
      }

      // 1. Click on timeline header: check markers, assertion violation pins, delta indicators or start horizontal pan
      if (y <= headerHeight) {
        // Check timeline markers
        const clickedMarker = markers.find((m) => {
          const mX = gutterWidth + (m.timePs - timeOffsetPs) * pixelsPerPs;
          return Math.abs(mX - x) <= 12;
        });
        if (clickedMarker) {
          setActiveCursorDrag(`marker:${clickedMarker.id}`);
          return;
        }

        if (showAssertionPins && state.assertionViolations && state.assertionViolations.length > 0) {
          const clickedViolation = state.assertionViolations.find((v) => {
            const vTime = getViolationTimePs(v);
            return Math.abs(vTime - clickedPs) * pixelsPerPs <= 12;
          });
          if (clickedViolation) {
            const vTime = getViolationTimePs(clickedViolation);
            jumpToTime(vTime);
            setActiveHoverViolation(clickedViolation);
            return;
          }
        }

        const matchingDelta = deltaTimestamps.find((dT) => Math.abs(dT - clickedPs) * pixelsPerPs < 12);
        if (matchingDelta !== undefined) {
          setExpandedDeltaTimePs(expandedDeltaTimePs === matchingDelta ? null : matchingDelta);
          return;
        }
        setIsPanning(true);
        setPanStartX(x);
        setPanStartTimeOffset(timeOffsetPs);
        return;
      }

      // 2. Middle click, Alt+click: pan time
      if (e.button === 1 || e.altKey) {
        setIsPanning(true);
        setPanStartX(x);
        setPanStartTimeOffset(timeOffsetPs);
        return;
      }

      // Time Machine Sync: clicking on the waveform instantly rewinds or scrubs simulation
      if (timeMachineSync) {
        engineBridge.scrubToTime(clickedPs);
      }

      // 3. Drag existing Cursor A handle
      if (cursorAPrivate !== null && Math.abs(clickedPs - cursorAPrivate) * pixelsPerPs < 10) {
        setActiveCursorDrag("A");
        return;
      }

      // 4. Drag existing Cursor B handle
      if (cursorBPrivate !== null && Math.abs(clickedPs - cursorBPrivate) * pixelsPerPs < 10) {
        setActiveCursorDrag("B");
        return;
      }

      // 5. Click inside measurement window to slide the window
      if (cursorAPrivate !== null && cursorBPrivate !== null) {
        const minPs = Math.min(cursorAPrivate, cursorBPrivate);
        const maxPs = Math.max(cursorAPrivate, cursorBPrivate);
        if (clickedPs >= minPs && clickedPs <= maxPs && !e.shiftKey) {
          setActiveCursorDrag("window");
          setWindowDragOffsetPs(clickedPs - minPs);
          return;
        }
      }

      // 6. Shift+Click: Extend or place Cursor B
      if (e.shiftKey && cursorAPrivate !== null) {
        setCursorBPrivate(clickedPs);
        return;
      }

      // 7. Otherwise: Start new drag-to-measure window selection!
      setSelectionAnchorPs(clickedPs);
      setCursorAPrivate(clickedPs);
      setCursorBPrivate(clickedPs);
      setActiveCursorDrag("new_selection");
    } else {
      // Clicked in gutter: Find row layout by y
      const hit = rowLayouts.find((l) => y >= l.yTop && y < l.yTop + l.height);
      if (hit && hit.row.isBus && !hit.row.isBitChild) {
        if (x < 22) {
          // Toggle bus expansion
          toggleBusExpansion(hit.row.id);
        } else if (x >= 22 && x < 50) {
          // Toggle analog mode
          cycleBusPlotMode(hit.row.id);
        } else if (x >= 50 && x < 74 && hit.row.width >= 8 && hit.row.width % 4 === 0) {
          // Toggle slice mode between bits and nibbles
          cycleBusSliceMode(hit.row.id);
        } else if (x > gutterWidth - 65) {
          // Cycle radix
          cycleBusRadix(hit.row.id, busRadixMap[hit.row.id] ?? globalRadix);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= gutterWidth) {
      const calcPs = Math.max(0, Math.round(timeOffsetPs + (x - gutterWidth) / pixelsPerPs));
      setHoverTimePs(calcPs);

      // Dragging a timeline marker
      if (activeCursorDrag && typeof activeCursorDrag === "string" && activeCursorDrag.startsWith("marker:")) {
        const markerId = activeCursorDrag.slice("marker:".length);
        setMarkers((prev) =>
          prev.map((m) => (m.id === markerId ? { ...m, timePs: calcPs } : m))
        );
        return;
      }

      // Time Machine Sync: dragging cursor continuously scrubs live circuit state
      if (timeMachineSync && (activeCursorDrag === "A" || activeCursorDrag === "new_selection")) {
        engineBridge.scrubToTime(calcPs);
      }

      if (activeCursorDrag === "A") {
        setCursorAPrivate(calcPs);
      } else if (activeCursorDrag === "B") {
        setCursorBPrivate(calcPs);
      } else if (activeCursorDrag === "new_selection" && selectionAnchorPs !== null) {
        setCursorAPrivate(Math.min(selectionAnchorPs, calcPs));
        setCursorBPrivate(Math.max(selectionAnchorPs, calcPs));
      } else if (activeCursorDrag === "window" && cursorAPrivate !== null && cursorBPrivate !== null) {
        const widthPs = Math.abs(cursorBPrivate - cursorAPrivate);
        const newMin = Math.max(0, calcPs - windowDragOffsetPs);
        setCursorAPrivate(newMin);
        setCursorBPrivate(newMin + widthPs);
      } else if (isPanning) {
        const deltaX = x - panStartX;
        const deltaPs = deltaX / pixelsPerPs;
        setTimeOffsetPs(Math.max(0, panStartTimeOffset - deltaPs));
      }

      // Check hover on header markers or SVA pins
      if (y <= headerHeight) {
        const hoveredM = markers.find((m) => {
          const mX = gutterWidth + (m.timePs - timeOffsetPs) * pixelsPerPs;
          return Math.abs(mX - x) <= 12;
        });
        setHoveredMarkerId(hoveredM ? hoveredM.id : null);

        if (showAssertionPins && state.assertionViolations && state.assertionViolations.length > 0) {
          const hoveredViolation = state.assertionViolations.find((v) => {
            const vTime = getViolationTimePs(v);
            return Math.abs(vTime - calcPs) * pixelsPerPs <= 12;
          });
          setActiveHoverViolation(hoveredViolation || null);
        } else if (activeHoverViolation) {
          setActiveHoverViolation(null);
        }
      } else {
        if (hoveredMarkerId) setHoveredMarkerId(null);
        if (activeHoverViolation) setActiveHoverViolation(null);
      }

      // Update cursor icon dynamically
      if (canvasRef.current) {
        if (isPanning) {
          canvasRef.current.style.cursor = "grabbing";
        } else if (hoveredMarkerId) {
          canvasRef.current.style.cursor = "ew-resize";
        } else if (activeHoverViolation) {
          canvasRef.current.style.cursor = "pointer";
        } else if (y <= headerHeight) {
          canvasRef.current.style.cursor = "grab";
        } else if (
          (cursorAPrivate !== null && Math.abs(calcPs - cursorAPrivate) * pixelsPerPs < 10) ||
          (cursorBPrivate !== null && Math.abs(calcPs - cursorBPrivate) * pixelsPerPs < 10)
        ) {
          canvasRef.current.style.cursor = "ew-resize";
        } else if (
          cursorAPrivate !== null &&
          cursorBPrivate !== null &&
          calcPs >= Math.min(cursorAPrivate, cursorBPrivate) &&
          calcPs <= Math.max(cursorAPrivate, cursorBPrivate)
        ) {
          canvasRef.current.style.cursor = "move";
        } else {
          canvasRef.current.style.cursor = "crosshair";
        }
      }
    } else {
      setHoverTimePs(null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = "default";
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && activeCursorDrag === "new_selection") {
      const x = e.clientX - rect.left;
      const movedPx = Math.abs(x - mouseDownPos.x);
      if (movedPx < 4) {
        // Single click without drag: keep cursor A only
        setCursorBPrivate(null);
      }
    }
    setIsPanning(false);
    setActiveCursorDrag(null);
    setSelectionAnchorPs(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= gutterWidth && y <= headerHeight) {
      const clickedPs = Math.max(0, Math.round(timeOffsetPs + (x - gutterWidth) / pixelsPerPs));
      const existing = markers.find((m) => {
        const mX = gutterWidth + (m.timePs - timeOffsetPs) * pixelsPerPs;
        return Math.abs(mX - x) <= 14;
      });

      if (existing) {
        setActiveMarkerModal({ isOpen: true, marker: { ...existing }, isNew: false });
      } else {
        const newMarker: TimelineMarker = {
          id: `m_${Date.now()}`,
          timePs: clickedPs,
          label: `M${markers.length + 1}`,
          color: ["#f59e0b", "#10b981", "#38bdf8", "#a855f7", "#ec4899"][markers.length % 5]
        };
        setActiveMarkerModal({ isOpen: true, marker: newMarker, isNew: true });
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on mouse
      const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
      const plotX = gutterWidth;
      const mousePs = timeOffsetPs + Math.max(0, mouseX - plotX) / pixelsPerPs;
      const newPixelsPerPs = Math.min(Math.max(pixelsPerPs * zoomFactor, 0.0001), 10);
      const newTimeOffsetPs = Math.max(0, mousePs - Math.max(0, mouseX - plotX) / newPixelsPerPs);
      setPixelsPerPs(newPixelsPerPs);
      setTimeOffsetPs(newTimeOffsetPs);
    } else {
      // Horizontal pan with wheel or trackpad
      const deltaX = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const deltaPs = (deltaX * 3) / pixelsPerPs;
      setTimeOffsetPs((prev) => Math.max(0, prev + deltaPs));
    }
  };

  const handleZoomToWindow = () => {
    if (cursorAPrivate === null || cursorBPrivate === null) return;
    const minPs = Math.min(cursorAPrivate, cursorBPrivate);
    const maxPs = Math.max(cursorAPrivate, cursorBPrivate);
    const deltaPs = Math.max(maxPs - minPs, 10);
    const containerWidth = containerRef.current?.clientWidth ?? 800;
    const plotWidth = containerWidth - gutterWidth;
    const newPixelsPerPs = Math.min(Math.max(plotWidth / deltaPs, 0.0001), 10);
    setPixelsPerPs(newPixelsPerPs);
    setTimeOffsetPs(Math.max(0, minPs - (plotWidth / newPixelsPerPs) * 0.05));
  };

  // Delta Accordion Events at expanded time
  const activeDeltaEvents = useMemo(() => {
    if (expandedDeltaTimePs === null) return [];
    const events: Array<{ signalName: string; value: string; delta: number; isGlitch?: boolean }> = [];
    for (const sig of state.signals) {
      for (const s of sig.samples) {
        if (s.timePs === expandedDeltaTimePs) {
          events.push({ signalName: sig.name, value: s.value, delta: s.delta, isGlitch: s.isGlitch });
        }
      }
    }
    return events.sort((a, b) => a.delta - b.delta);
  }, [expandedDeltaTimePs, state.signals]);

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
            {t.waveforms.title} ({displayRows.length} {t.waveforms.traces})
          </span>

          {/* Radix Switcher Pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, backgroundColor: "var(--bg-tertiary)", padding: "2px 4px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginRight: 4 }}>{t.waveforms.radix}:</span>
            {(["hex", "bin", "u_dec", "s_dec", "ascii"] as DisplayRadix[]).map((r) => (
              <button
                key={r}
                onClick={() => setGlobalRadix(r)}
                className="btn btn-ghost"
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  height: "auto",
                  minHeight: 18,
                  borderRadius: 2,
                  backgroundColor: globalRadix === r ? "var(--accent-blue)" : "transparent",
                  color: globalRadix === r ? "#ffffff" : "var(--text-muted)",
                  textTransform: "uppercase"
                }}
              >
                {r === "u_dec" ? "UDec" : r === "s_dec" ? "SDec" : r}
              </button>
            ))}
          </div>

          {/* Phase 37: Explode / Collapse All Buses */}
          {baseSignals.some((s) => s.isBus) && (
            <button
              onClick={toggleAllBuses}
              className="btn btn-ghost"
              style={{
                fontSize: 11,
                padding: "2px 7px",
                height: "auto",
                minHeight: 22,
                borderRadius: "var(--radius-sm)",
                backgroundColor: Object.values(expandedBuses).some(Boolean)
                  ? "rgba(56, 189, 248, 0.15)"
                  : "var(--bg-tertiary)",
                color: Object.values(expandedBuses).some(Boolean) ? "#38bdf8" : "var(--text-muted)",
                border: `1px solid ${
                  Object.values(expandedBuses).some(Boolean) ? "#38bdf8" : "var(--border-subtle)"
                }`,
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
              title={Object.values(expandedBuses).some(Boolean) ? t.waveforms.collapseBuses : t.waveforms.explodeBuses}
            >
              <Activity size={12} />
              <span>{Object.values(expandedBuses).some(Boolean) ? t.waveforms.collapseBuses : t.waveforms.explodeBuses}</span>
            </button>
          )}

          {/* Phase 37: Timeline Bookmark Markers Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setIsMarkerDropdownOpen(!isMarkerDropdownOpen)}
              className="btn btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "2px 8px",
                height: "auto",
                minHeight: 22,
                borderRadius: "var(--radius-sm)",
                backgroundColor: markers.length > 0 ? "rgba(245, 158, 11, 0.15)" : "var(--bg-tertiary)",
                color: markers.length > 0 ? "#f59e0b" : "var(--text-muted)",
                border: `1px solid ${markers.length > 0 ? "#f59e0b" : "var(--border-subtle)"}`
              }}
              title="Timeline Markers & Bookmarks"
            >
              <Bookmark size={12} />
              <span>Markers ({markers.length})</span>
              <ChevronDown size={11} />
            </button>

            {isMarkerDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: 26,
                  left: 0,
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  minWidth: 200,
                  padding: 6,
                  zIndex: 70,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <button
                  onClick={() => {
                    setIsMarkerDropdownOpen(false);
                    const timePs = cursorAPrivate !== null ? cursorAPrivate : Math.round(timeOffsetPs + 500);
                    const newM: TimelineMarker = {
                      id: `m_${Date.now()}`,
                      timePs,
                      label: `M${markers.length + 1}`,
                      color: ["#f59e0b", "#10b981", "#38bdf8", "#a855f7", "#ec4899"][markers.length % 5]
                    };
                    setActiveMarkerModal({ isOpen: true, marker: newM, isNew: true });
                  }}
                  className="btn btn-primary"
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    justifyContent: "center"
                  }}
                >
                  <Plus size={12} />
                  <span>{t.waveforms.addMarker}</span>
                </button>

                {markers.length > 0 && (
                  <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                    {markers.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "3px 6px",
                          borderRadius: 4,
                          backgroundColor: "rgba(255,255,255,0.03)",
                          cursor: "pointer",
                          fontSize: 11
                        }}
                        onClick={() => {
                          jumpToTime(m.timePs);
                          setIsMarkerDropdownOpen(false);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: m.color }} />
                          <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{m.label}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{formatTimeCompact(m.timePs)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMarkerDropdownOpen(false);
                              setActiveMarkerModal({ isOpen: true, marker: { ...m }, isNew: false });
                            }}
                            className="btn btn-ghost btn-icon"
                            style={{ width: 18, height: 18, padding: 0 }}
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMarkers((prev) => prev.filter((item) => item.id !== m.id));
                            }}
                            className="btn btn-ghost btn-icon"
                            style={{ width: 18, height: 18, padding: 0, color: "#ef4444" }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delta Glitches Filter */}
          <button
            onClick={() => setShowDeltaGlitches(!showDeltaGlitches)}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              height: "auto",
              minHeight: 22,
              borderRadius: "var(--radius-sm)",
              backgroundColor: showDeltaGlitches ? "rgba(236, 72, 153, 0.15)" : "var(--bg-tertiary)",
              color: showDeltaGlitches ? "var(--signal-glitch)" : "var(--text-muted)",
              border: `1px solid ${showDeltaGlitches ? "var(--signal-glitch)" : "var(--border-subtle)"}`
            }}
            title={t.waveforms.glitchRadarTooltip}
          >
            <Bug size={12} />
            <span>{t.waveforms.glitchRadar}</span>
          </button>

          {/* Time Machine Sync Toggle */}
          <button
            onClick={() => setTimeMachineSync(!timeMachineSync)}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              height: "auto",
              minHeight: 22,
              borderRadius: "var(--radius-sm)",
              backgroundColor: timeMachineSync ? "rgba(6, 182, 212, 0.2)" : "var(--bg-tertiary)",
              color: timeMachineSync ? "var(--accent-cyan)" : "var(--text-muted)",
              border: `1px solid ${timeMachineSync ? "var(--accent-cyan)" : "var(--border-subtle)"}`
            }}
            title="When active, dragging cursor or clicking timeline instantly scrubs live circuit state"
          >
            <History size={12} />
            <span>Time-Machine: {timeMachineSync ? "SYNC ON" : "SYNC OFF"}</span>
          </button>

          {/* Protocol Decoder Trigger */}
          <button
            onClick={() => setIsProtocolModalOpen(true)}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              height: "auto",
              minHeight: 22,
              borderRadius: "var(--radius-sm)",
              backgroundColor: decodedTransactions.length > 0 ? "rgba(168, 85, 247, 0.2)" : "var(--bg-tertiary)",
              color: decodedTransactions.length > 0 ? "var(--accent-purple)" : "var(--text-muted)",
              border: `1px solid ${decodedTransactions.length > 0 ? "var(--accent-purple)" : "var(--border-subtle)"}`
            }}
            title="Open Live Hardware Protocol Decoder (UART, SPI, I2C, AXI)"
          >
            <Cpu size={12} />
            <span>Decode Protocol {decodedTransactions.length > 0 ? `(${decodedTransactions.length})` : ""}</span>
          </button>

          {/* SVA Assertion Radar Pins Toggle */}
          <button
            onClick={() => setShowAssertionPins(!showAssertionPins)}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              height: "auto",
              minHeight: 22,
              borderRadius: "var(--radius-sm)",
              backgroundColor:
                showAssertionPins && state.assertionViolations && state.assertionViolations.length > 0
                  ? "rgba(239, 68, 68, 0.2)"
                  : "var(--bg-tertiary)",
              color:
                showAssertionPins && state.assertionViolations && state.assertionViolations.length > 0
                  ? "#ef4444"
                  : "var(--text-muted)",
              border: `1px solid ${
                showAssertionPins && state.assertionViolations && state.assertionViolations.length > 0
                  ? "#ef4444"
                  : "var(--border-subtle)"
              }`
            }}
            title="Toggle SVA Assertion Violation Pins on Waveform Timeline"
          >
            <ShieldAlert size={12} />
            <span>
              SVA Radar{" "}
              {state.assertionViolations && state.assertionViolations.length > 0
                ? `(${state.assertionViolations.length})`
                : ""}
            </span>
          </button>
        </div>

        {/* Measurement HUD & Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Dual-Cursor Measurement HUD with Frequency and Clock Cycles */}
          {measurementDelta && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(15, 23, 42, 0.85)",
                border: "1px solid #334155",
                borderRadius: "var(--radius-sm)",
                padding: "2px 8px",
                fontSize: 11,
                fontFamily: "JetBrains Mono, monospace",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              <span style={{ color: "#00f2fe" }}>A:{cursorAPrivate !== null ? formatTimeCompact(cursorAPrivate) : ""}</span>
              <span style={{ color: "#a855f7" }}>B:{cursorBPrivate !== null ? formatTimeCompact(cursorBPrivate) : ""}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, whiteSpace: "nowrap" }}>Δt: {measurementDelta.timeStr}</span>
              <span style={{ color: "#10b981", fontWeight: 600, whiteSpace: "nowrap" }}>f: {measurementDelta.freqStr}</span>
              {clockCycleData && (
                <span style={{ color: "#f59e0b", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {clockCycleData.cycles} {t.waveforms.clockCycles}
                </span>
              )}
              <button
                onClick={handleZoomToWindow}
                className="btn btn-ghost"
                style={{ fontSize: 10, color: "#38bdf8", padding: "1px 5px", height: "auto", minHeight: 18, borderRadius: 2, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}
                title="Zoom into measurement window"
              >
                <Search size={11} />
                <span>Zoom</span>
              </button>
              <button
                onClick={() => {
                  setCursorAPrivate(null);
                  setCursorBPrivate(null);
                }}
                className="btn btn-ghost btn-icon"
                style={{ color: "var(--text-muted)", padding: "0 2px", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title={t.waveforms.clearCursors}
              >
                <X size={11} />
              </button>
            </div>
          )}

          {cursorAPrivate !== null && cursorBPrivate === null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(15, 23, 42, 0.85)",
                border: "1px solid #334155",
                borderRadius: "var(--radius-sm)",
                padding: "2px 8px",
                fontSize: 11,
                fontFamily: "JetBrains Mono, monospace",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              <span style={{ color: "#00f2fe" }}>A:{formatTimeCompact(cursorAPrivate)}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>Drag to create window</span>
              <button
                onClick={() => setCursorAPrivate(null)}
                className="btn btn-ghost btn-icon"
                style={{ color: "var(--text-muted)", padding: "0 2px", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title={t.waveforms.clearCursors}
              >
                <X size={11} />
              </button>
            </div>
          )}

          {/* Zoom Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => handleZoom(1.3)}
              title={t.waveforms.zoomIn}
              className="btn btn-secondary btn-icon"
              style={{
                padding: 4,
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm)"
              }}
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => handleZoom(0.7)}
              title={t.waveforms.zoomOut}
              className="btn btn-secondary btn-icon"
              style={{
                padding: 4,
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm)"
              }}
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={handleZoomFit}
              title={t.waveforms.zoomFit}
              className="btn btn-secondary btn-icon"
              style={{
                padding: 4,
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm)"
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const y = e.clientY - rect.top;
          const x = e.clientX - rect.left;

          if (x < gutterWidth) {
            const hit = rowLayouts.find((l) => y >= l.yTop && y < l.yTop + l.height);
            if (hit) {
              setForcingSignal({ id: hit.row.id, name: hit.row.name, isBus: hit.row.isBus, width: hit.row.width });
            }
          }
        }}
        onMouseLeave={() => {
          setIsPanning(false);
          setActiveCursorDrag(null);
          setHoverTimePs(null);
          setActiveHoverViolation(null);
          setHoveredMarkerId(null);
        }}
        style={{ flex: 1, cursor: isPanning ? "grabbing" : "crosshair" }}
      />

      {/* SVA Violation Hover Tooltip Card */}
      {activeHoverViolation && (
        <div
          style={{
            position: "absolute",
            top: headerHeight + 8,
            left: Math.max(
              gutterWidth + 10,
              Math.min(
                (containerRef.current?.clientWidth || 800) - 300,
                gutterWidth +
                  (getViolationTimePs(activeHoverViolation) - timeOffsetPs) * pixelsPerPs -
                  120
              )
            ),
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(239, 68, 68, 0.6)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(239, 68, 68, 0.25)",
            borderRadius: 8,
            padding: "8px 12px",
            zIndex: 60,
            pointerEvents: "none",
            minWidth: 240,
            maxWidth: 320
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 5
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 3,
                  textTransform: "uppercase"
                }}
              >
                SVA Violation
              </span>
              <span
                style={{
                  color: "#f87171",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {activeHoverViolation.assertion_id}
              </span>
            </div>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace"
              }}
            >
              Cycle #{activeHoverViolation.fail_cycle}
            </span>
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#e2e8f0",
              marginBottom: 6,
              lineHeight: 1.4
            }}
          >
            {activeHoverViolation.message}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 10,
              color: "#94a3b8",
              fontFamily: "JetBrains Mono, monospace",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              paddingTop: 4
            }}
          >
            <span>
              Time:{" "}
              <strong style={{ color: "#00f2fe" }}>
                {formatTimeCompact(getViolationTimePs(activeHoverViolation))}
              </strong>
            </span>
            <span>
              {activeHoverViolation.line ? (
                <span>Line: <strong style={{ color: "var(--accent-blue)" }}>L{activeHoverViolation.line}</strong></span>
              ) : (
                <span>Start: <strong style={{ color: "#94a3b8" }}>#{activeHoverViolation.start_cycle}</strong></span>
              )}
            </span>
            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Click to Center</span>
          </div>
        </div>
      )}

      {/* Zero-Time Delta Accordion Drawer (when expandedDeltaTimePs is set) */}
      {expandedDeltaTimePs !== null && (
        <div
          style={{
            height: 96,
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid #00f2fe",
            padding: "6px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
            zIndex: 30
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={14} color="#00f2fe" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9" }}>
                {t.waveforms.deltaAccordion}: t = {expandedDeltaTimePs} ps ({activeDeltaEvents.length} transition steps)
              </span>
            </div>
            <button
              onClick={() => setExpandedDeltaTimePs(null)}
              className="btn btn-ghost btn-icon"
              style={{ color: "var(--text-muted)", width: 20, height: 20 }}
            >
              <X size={12} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {activeDeltaEvents.map((evt, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: evt.isGlitch ? "rgba(236, 72, 153, 0.15)" : "var(--bg-tertiary)",
                  border: `1px solid ${evt.isGlitch ? "#ec4899" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 8px",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                  minWidth: 140
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>Step δ{evt.delta}</span>
                  {evt.isGlitch && (
                    <span style={{ color: "#ec4899", display: "flex", alignItems: "center", gap: 2 }}>
                      <AlertTriangle size={10} /> Hazard
                    </span>
                  )}
                </div>
                <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{evt.signalName}</div>
                <div style={{ color: "#38bdf8" }}>value: {evt.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal Forcing Modal Dialog */}
      {forcingSignal && (
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 320,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--accent-blue)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
            padding: 16,
            zIndex: 50
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sliders size={16} color="var(--accent-blue)" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t.waveforms.forceSignal}</span>
            </div>
            <button
              onClick={() => setForcingSignal(null)}
              className="btn btn-ghost btn-icon"
              style={{ color: "var(--text-muted)", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
            {t.waveforms.targetNet}: <strong style={{ color: "#f1f5f9" }}>{forcingSignal.name}</strong> ({forcingSignal.width}-bit {forcingSignal.isBus ? "Bus" : "Wire"})
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {!forcingSignal.isBus ? (
              (["0", "1", "x", "z"] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setForceInputVal(val)}
                  className="btn btn-ghost"
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: forceInputVal === val ? "var(--accent-blue)" : "var(--bg-tertiary)",
                    color: forceInputVal === val ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: 600,
                    fontSize: 12,
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  {val.toUpperCase()}
                </button>
              ))
            ) : (
              <input
                type="text"
                value={forceInputVal}
                onChange={(e) => setForceInputVal(e.target.value)}
                placeholder="e.g. 0x55 or 01010101"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: 12,
                  fontFamily: "JetBrains Mono, monospace",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "#f1f5f9"
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                engineBridge.forceSignal(forcingSignal.id, forceInputVal);
                setForcingSignal(null);
              }}
              className="btn btn-primary"
              style={{
                flex: 1,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4
              }}
            >
              <Lock size={12} />
              <span>{t.waveforms.applyForce}</span>
            </button>

            {state.forcedSignalIds.includes(forcingSignal.id) && (
              <button
                onClick={() => {
                  engineBridge.releaseForce(forcingSignal.id);
                  setForcingSignal(null);
                }}
                className="btn btn-secondary"
                style={{
                  color: "#f59e0b",
                  borderColor: "#f59e0b",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Unlock size={12} />
                <span>{t.waveforms.release}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Marker Create / Edit Modal Dialog */}
      {activeMarkerModal && (
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 300,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
            padding: 16,
            zIndex: 60
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Bookmark size={15} color={activeMarkerModal.marker.color} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {activeMarkerModal.isNew ? t.waveforms.addMarker : "Edit Marker"}
              </span>
            </div>
            <button
              onClick={() => setActiveMarkerModal(null)}
              className="btn btn-ghost btn-icon"
              style={{ color: "var(--text-muted)", width: 22, height: 22 }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Label:
            </label>
            <input
              type="text"
              value={activeMarkerModal.marker.label}
              onChange={(e) =>
                setActiveMarkerModal({
                  ...activeMarkerModal,
                  marker: { ...activeMarkerModal.marker, label: e.target.value }
                })
              }
              style={{
                width: "100%",
                padding: "6px 8px",
                fontSize: 12,
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "#f1f5f9"
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Color:
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["#f59e0b", "#10b981", "#38bdf8", "#a855f7", "#ec4899", "#ef4444"].map((c) => (
                <div
                  key={c}
                  onClick={() =>
                    setActiveMarkerModal({
                      ...activeMarkerModal,
                      marker: { ...activeMarkerModal.marker, color: c }
                    })
                  }
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    backgroundColor: c,
                    cursor: "pointer",
                    border:
                      activeMarkerModal.marker.color === c ? "2px solid #ffffff" : "2px solid transparent"
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (activeMarkerModal.isNew) {
                  setMarkers((prev) => [...prev, activeMarkerModal.marker]);
                } else {
                  setMarkers((prev) =>
                    prev.map((m) => (m.id === activeMarkerModal.marker.id ? activeMarkerModal.marker : m))
                  );
                }
                setActiveMarkerModal(null);
              }}
              className="btn btn-primary"
              style={{ flex: 1, fontSize: 12 }}
            >
              Save Marker
            </button>
            {!activeMarkerModal.isNew && (
              <button
                onClick={() => {
                  setMarkers((prev) => prev.filter((m) => m.id !== activeMarkerModal.marker.id));
                  setActiveMarkerModal(null);
                }}
                className="btn btn-secondary"
                style={{ color: "#ef4444", borderColor: "#ef4444", fontSize: 12 }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hardware Protocol Decoder Modal */}
      <ProtocolDecoderModal
        isOpen={isProtocolModalOpen}
        onClose={() => setIsProtocolModalOpen(false)}
        state={state}
        onSelectTransaction={(tx) => {
          setActiveHoverTx(tx);
          setCursorAPrivate(tx.start_time_ps);
          setCursorBPrivate(tx.end_time_ps);
          engineBridge.scrubToTime(tx.start_time_ps);
        }}
        onTransactionsUpdated={(txs) => {
          setDecodedTransactions(txs);
        }}
      />
    </div>
  );
};
