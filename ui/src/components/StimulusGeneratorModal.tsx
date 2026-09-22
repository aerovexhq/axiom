// Axiom EDA — Visual Testbench Stimulus Generator & Constrained Random Verification Modal
// Interactive timing diagram editor, clock/glitch wizards, constrained random distribution suite,
// and synthesizable IEEE 1364/1800 testbench harness emission.

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Play,
  Download,
  Copy,
  Check,
  Zap,
  Sliders,
  Plus,
  Trash2,
  Shuffle,
  FileCode,
  Activity,
  AlertTriangle
} from "lucide-react";
import {
  StimulusPlan,
  StimulusTrack,
  StimulusSignalType,
  PatternKind,
  extractModulePorts,
  evaluateTrackWaveform,
  generateVerilogTestbench,
  applyStimulusToSimulation,
  PseudoRandomGenerator
} from "../engine/stimulusModel";
import { engineBridge } from "../engine/engineBridge";
import { useTranslation } from "../i18n";
import { toast } from "../engine/toast";
import type { AxiomProject } from "../engine/projectModel";

interface StimulusGeneratorModalProps {
  topModule: string;
  isOpen: boolean;
  onClose: () => void;
  project?: AxiomProject | null;
  onAddSimSource?: (fileName: string, content: string) => void;
}

export const StimulusGeneratorModal: React.FC<StimulusGeneratorModalProps> = ({
  topModule,
  isOpen,
  onClose,
  project = null,
  onAddSimSource
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"timing" | "random" | "testbench">("timing");
  const [durationNs, setDurationNs] = useState<number>(100);
  const [tracks, setTracks] = useState<StimulusTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const totalDurationPs = durationNs * 1000;

  // Initialize tracks on modal open
  useEffect(() => {
    if (isOpen) {
      const compiledSigs = engineBridge.getState().signals;
      const initialTracks = extractModulePorts(project, topModule, compiledSigs);
      setTracks(initialTracks);
      if (initialTracks.length > 0) {
        setSelectedTrackId(initialTracks[0].id);
      }
    }
  }, [isOpen, topModule, project]);

  // Generate full stimulus plan
  const stimulusPlan: StimulusPlan = useMemo(() => {
    return {
      topModule: topModule || "dut",
      totalDurationPs,
      timeScalePs: 1000,
      tracks
    };
  }, [topModule, totalDurationPs, tracks]);

  // Synthesize Verilog Testbench
  const generatedTbCode = useMemo(() => {
    return generateVerilogTestbench(stimulusPlan);
  }, [stimulusPlan]);

  const selectedTrack = useMemo(() => {
    return tracks.find((t) => t.id === selectedTrackId) ?? tracks[0] ?? null;
  }, [tracks, selectedTrackId]);

  if (!isOpen) return null;

  // Handle Track Mutation
  const updateTrack = (trackId: string, mutator: (t: StimulusTrack) => StimulusTrack) => {
    setTracks((prev) => prev.map((tr) => (tr.id === trackId ? mutator({ ...tr }) : tr)));
  };

  // Handle Copy Testbench
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedTbCode);
    setCopied(true);
    toast.info(t("stimulusGenerator.copiedToClipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Download Testbench
  const handleDownloadCode = () => {
    const blob = new Blob([generatedTbCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tb_${topModule || "dut"}.v`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("stimulusGenerator.downloadStarted"));
  };

  // Handle Run In-RAM Simulation
  const handleRunSimulation = () => {
    applyStimulusToSimulation(stimulusPlan, engineBridge);
    setApplied(true);
    toast.success(t("stimulusGenerator.stimulusApplied"));
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 800);
  };

  // Handle Add to sim_1 Sources
  const handleAddToSimSources = () => {
    const fileName = `tb_${topModule || "dut"}.v`;
    if (onAddSimSource) {
      onAddSimSource(fileName, generatedTbCode);
      toast.success(`${t("stimulusGenerator.addedToSimSources")}: ${fileName}`);
      onClose();
    } else {
      // Fallback download if no callback
      handleDownloadCode();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "92%",
          maxWidth: 1120,
          height: "88vh",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-medium)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.85)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            height: 48,
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.2px" }}>
              {t("stimulusGenerator.modalTitle")}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                backgroundColor: "rgba(56, 189, 248, 0.12)",
                color: "var(--accent-cyan)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(56, 189, 248, 0.25)"
              }}
            >
              DUT: {topModule}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-muted)",
                padding: "2px 6px",
                borderRadius: 4
              }}
            >
              {durationNs} ns
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* View Switcher Tabs */}
            <div style={{ display: "flex", backgroundColor: "var(--bg-tertiary)", borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setActiveTab("timing")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: activeTab === "timing" ? "var(--accent-blue)" : "transparent",
                  color: activeTab === "timing" ? "#fff" : "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                <Activity size={12} />
                <span>{t("stimulusGenerator.tabTimingDiagram")}</span>
              </button>

              <button
                onClick={() => setActiveTab("random")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: activeTab === "random" ? "var(--accent-blue)" : "transparent",
                  color: activeTab === "random" ? "#fff" : "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                <Shuffle size={12} />
                <span>{t("stimulusGenerator.tabConstrainedRandom")}</span>
              </button>

              <button
                onClick={() => setActiveTab("testbench")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: activeTab === "testbench" ? "var(--accent-blue)" : "transparent",
                  color: activeTab === "testbench" ? "#fff" : "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                <FileCode size={12} />
                <span>{t("stimulusGenerator.tabTestbenchPreview")}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center"
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* TAB 1: Visual Timing Diagram Editor */}
          {activeTab === "timing" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {/* Left Column: Multitrack Waveform Canvas */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  borderRight: "1px solid var(--border-subtle)",
                  overflow: "hidden"
                }}
              >
                {/* Timing Toolbar */}
                <div
                  style={{
                    height: 38,
                    backgroundColor: "var(--bg-secondary)",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 12px",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {t("stimulusGenerator.durationLabel")}
                    </span>
                    <select
                      value={durationNs}
                      onChange={(e) => setDurationNs(Number(e.target.value))}
                      style={{
                        height: 24,
                        fontSize: 11,
                        backgroundColor: "var(--bg-tertiary)",
                        color: "#fff",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 4,
                        padding: "0 6px"
                      }}
                    >
                      <option value={50}>50 ns</option>
                      <option value={100}>100 ns</option>
                      <option value={200}>200 ns</option>
                      <option value={500}>500 ns</option>
                      <option value={1000}>1,000 ns (1 µs)</option>
                    </select>

                    <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)" }} />

                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Zoom:</span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      style={{
                        padding: "2px 6px",
                        fontSize: 11,
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 3,
                        cursor: "pointer"
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
                      style={{
                        padding: "2px 6px",
                        fontSize: 11,
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 3,
                        cursor: "pointer"
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoomLevel(1.0)}
                      style={{
                        padding: "2px 6px",
                        fontSize: 10,
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 3,
                        cursor: "pointer"
                      }}
                    >
                      Fit
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {t("stimulusGenerator.clickToToggleHelp")}
                    </span>
                  </div>
                </div>

                {/* Waveform Multitrack Area */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
                  {/* Timeline Time Ruler */}
                  <TimelineRuler durationNs={durationNs} zoom={zoomLevel} />

                  {/* Signal Tracks */}
                  {tracks.map((track) => (
                    <TrackLane
                      key={track.id}
                      track={track}
                      durationNs={durationNs}
                      zoom={zoomLevel}
                      isSelected={selectedTrack?.id === track.id}
                      onSelect={() => setSelectedTrackId(track.id)}
                      onToggleBit={(clickTimePs) => {
                        // Switch to custom if user clicks bit to manually paint
                        const segs = evaluateTrackWaveform(track, totalDurationPs);
                        const matchIdx = segs.findIndex(
                          (s) => clickTimePs >= s.startTimePs && clickTimePs < s.endTimePs
                        );
                        if (matchIdx >= 0) {
                          const curVal = segs[matchIdx].value;
                          const invertedVal = curVal ? 0 : 1;
                          segs[matchIdx].value = invertedVal;
                          updateTrack(track.id, (t) => ({
                            ...t,
                            type: "custom",
                            customSegments: segs
                          }));
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Right Column: Track Generator Inspector */}
              <div
                style={{
                  width: 320,
                  backgroundColor: "var(--bg-secondary)",
                  display: "flex",
                  flexDirection: "column",
                  padding: 14,
                  overflowY: "auto",
                  gap: 12
                }}
              >
                {selectedTrack ? (
                  <TrackInspector
                    track={selectedTrack}
                    durationNs={durationNs}
                    onChange={(updated) => updateTrack(selectedTrack.id, () => updated)}
                  />
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "center", marginTop: 40 }}>
                    {t("stimulusGenerator.noTrackSelected")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Constrained Random Verification Suite */}
          {activeTab === "random" && (
            <ConstrainedRandomPanel
              tracks={tracks}
              onUpdateTrack={(id, mutator) => updateTrack(id, mutator)}
            />
          )}

          {/* TAB 3: Testbench HDL Preview */}
          {activeTab === "testbench" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FileCode size={14} color="var(--accent-cyan)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {t("stimulusGenerator.harnessTitle")}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    (`tb_{topModule || "dut"}.v`)
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={handleCopyCode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      fontSize: 11,
                      backgroundColor: "var(--bg-tertiary)",
                      color: copied ? "var(--accent-emerald)" : "var(--text-muted)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 4,
                      cursor: "pointer"
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? "Copied!" : "Copy Code"}</span>
                  </button>

                  <button
                    onClick={handleDownloadCode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      fontSize: 11,
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--accent-cyan)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 4,
                      cursor: "pointer"
                    }}
                  >
                    <Download size={12} />
                    <span>Download .v</span>
                  </button>
                </div>
              </div>

              <pre
                style={{
                  flex: 1,
                  backgroundColor: "#070a0e",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "12px 14px",
                  color: "#94a3b8",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  lineHeight: "18px",
                  overflow: "auto",
                  margin: 0
                }}
              >
                <code>{generatedTbCode}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer Action Ribbon */}
        <div
          style={{
            height: 48,
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {tracks.filter((t) => t.direction === "input").length} Input Signals Driven
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleRunSimulation}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: applied ? "var(--accent-emerald)" : "var(--accent-blue)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              {applied ? <Check size={13} /> : <Play size={13} fill="#fff" />}
              <span>
                {applied
                  ? t("stimulusGenerator.injected")
                  : t("stimulusGenerator.runInRam")}
              </span>
            </button>

            <button
              onClick={handleAddToSimSources}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: "var(--accent-cyan)",
                color: "#0c1017",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>{t("stimulusGenerator.addSourceBtn")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Timeline Ruler
// ----------------------------------------------------------------------------
const TimelineRuler: React.FC<{ durationNs: number; zoom?: number }> = ({ durationNs }) => {
  const markerStepNs = durationNs <= 50 ? 5 : durationNs <= 100 ? 10 : 20;
  const count = Math.ceil(durationNs / markerStepNs);
  const markers = Array.from({ length: count + 1 }, (_, i) => i * markerStepNs);

  return (
    <div
      style={{
        height: 22,
        backgroundColor: "var(--bg-tertiary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        position: "relative",
        userSelect: "none"
      }}
    >
      <div style={{ width: 140, flexShrink: 0, paddingLeft: 10, fontSize: 10, color: "var(--text-muted)" }}>
        Time (ns)
      </div>
      <div style={{ flex: 1, position: "relative", height: "100%" }}>
        {markers.map((m) => {
          const leftPct = (m / durationNs) * 100;
          if (leftPct > 100) return null;
          return (
            <div
              key={m}
              style={{
                position: "absolute",
                left: `${leftPct}%`,
                top: 0,
                bottom: 0,
                borderLeft: "1px solid var(--border-subtle)",
                paddingLeft: 3,
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                lineHeight: "22px"
              }}
            >
              {m}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Track Lane
// ----------------------------------------------------------------------------
interface TrackLaneProps {
  track: StimulusTrack;
  durationNs: number;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleBit: (timePs: number) => void;
}

const TrackLane: React.FC<TrackLaneProps> = ({
  track,
  durationNs,
  isSelected,
  onSelect,
  onToggleBit
}) => {
  const totalPs = durationNs * 1000;
  const segments = useMemo(() => evaluateTrackWaveform(track, totalPs), [track, totalPs]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTimePs = Math.round(clickRatio * totalPs);
    onSelect();
    if (track.width === 1) {
      onToggleBit(clickTimePs);
    }
  };

  return (
    <div
      onClick={onSelect}
      style={{
        height: 38,
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: isSelected ? "rgba(56, 189, 248, 0.07)" : "transparent",
        cursor: "pointer"
      }}
    >
      {/* Left Gutter */}
      <div
        style={{
          width: 140,
          flexShrink: 0,
          padding: "0 8px 0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRight: "1px solid var(--border-subtle)",
          height: "100%"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: isSelected ? "var(--accent-cyan)" : "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
            title={track.name}
          >
            {track.name}
          </span>
          {track.width > 1 && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-muted)",
                padding: "1px 3px",
                borderRadius: 2
              }}
            >
              [{track.width - 1}:0]
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            color: getTrackTypeColor(track.type),
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            padding: "1px 4px",
            borderRadius: 2
          }}
        >
          {track.type.substring(0, 4)}
        </span>
      </div>

      {/* Waveform Drawing Area */}
      <div
        onClick={handleCanvasClick}
        style={{
          flex: 1,
          height: "100%",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {segments.map((seg, idx) => {
          const leftPct = (seg.startTimePs / totalPs) * 100;
          const widthPct = ((seg.endTimePs - seg.startTimePs) / totalPs) * 100;
          const isHigh = Boolean(seg.value);

          if (track.width === 1) {
            // Single bit high/low level
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                {/* Horizontal Wire Line */}
                <div
                  style={{
                    width: "100%",
                    height: 2,
                    backgroundColor: seg.isGlitch
                      ? "#ef4444"
                      : isHigh
                      ? "var(--accent-emerald)"
                      : "#475569",
                    marginTop: isHigh ? -14 : 14,
                    boxShadow: isHigh ? "0 0 6px rgba(16, 185, 129, 0.5)" : "none"
                  }}
                />
                {/* Vertical transition edge on left */}
                {idx > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 11,
                      bottom: 11,
                      width: 1.5,
                      backgroundColor: seg.isGlitch ? "#ef4444" : "var(--accent-emerald)"
                    }}
                  />
                )}
              </div>
            );
          } else {
            // Multi-bit Bus Hex Envelope
            const hexVal =
              typeof seg.value === "number"
                ? "0x" + seg.value.toString(16).toUpperCase()
                : String(seg.value);

            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 7,
                  bottom: 7,
                  backgroundColor: isSelected ? "rgba(56, 189, 248, 0.18)" : "rgba(148, 163, 184, 0.12)",
                  border: `1px solid ${isSelected ? "var(--accent-cyan)" : "rgba(148, 163, 184, 0.35)"}`,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  padding: "0 2px"
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    color: isSelected ? "#fff" : "#cbd5e1",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {hexVal}
                </span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Track Inspector
// ----------------------------------------------------------------------------
interface TrackInspectorProps {
  track: StimulusTrack;
  durationNs: number;
  onChange: (t: StimulusTrack) => void;
}

const TrackInspector: React.FC<TrackInspectorProps> = ({ track, durationNs, onChange }) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
        <Sliders size={14} color="var(--accent-cyan)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
          {track.name} {track.width > 1 && `[${track.width - 1}:0]`}
        </span>
      </div>

      {/* Generator Type Selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
          {t("stimulusGenerator.generatorType")}
        </span>
        <select
          value={track.type}
          onChange={(e) => {
            const nextType = e.target.value as StimulusSignalType;
            onChange({
              ...track,
              type: nextType
            });
          }}
          style={{
            height: 28,
            fontSize: 11,
            backgroundColor: "var(--bg-tertiary)",
            color: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 4,
            padding: "0 8px"
          }}
        >
          <option value="clock">Clock Generator</option>
          <option value="reset">Reset Pulse (rst_n / rst)</option>
          <option value="pulse_train">Periodic Pulse Train</option>
          <option value="glitch">Glitch / Hazard Injection</option>
          <option value="constrained_random">Constrained Random PRNG</option>
          <option value="pattern">Ramp / Walking / PRBS Pattern</option>
          <option value="custom">Custom Waveform Drawing</option>
        </select>
      </div>

      {/* CLOCK WIZARD */}
      {track.type === "clock" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Frequency (MHz)</span>
            <select
              value={track.clock?.freqMhz ?? 100}
              onChange={(e) =>
                onChange({
                  ...track,
                  clock: {
                    ...(track.clock ?? { freqMhz: 100, dutyCyclePercent: 50, phaseDelayPs: 0, jitterPs: 0 }),
                    freqMhz: Number(e.target.value)
                  }
                })
              }
              style={{
                height: 26,
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            >
              <option value={10}>10 MHz (100 ns period)</option>
              <option value={50}>50 MHz (20 ns period)</option>
              <option value={100}>100 MHz (10 ns period)</option>
              <option value={200}>200 MHz (5 ns period)</option>
              <option value={500}>500 MHz (2 ns period)</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}>
              <span>Duty Cycle</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "#fff" }}>
                {track.clock?.dutyCyclePercent ?? 50}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={track.clock?.dutyCyclePercent ?? 50}
              onChange={(e) =>
                onChange({
                  ...track,
                  clock: {
                    ...(track.clock ?? { freqMhz: 100, dutyCyclePercent: 50, phaseDelayPs: 0, jitterPs: 0 }),
                    dutyCyclePercent: Number(e.target.value)
                  }
                })
              }
              style={{ width: "100%", accentColor: "var(--accent-blue)" }}
            />
          </div>
        </div>
      )}

      {/* RESET WIZARD */}
      {track.type === "reset" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#fff", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={track.reset?.activeLow ?? true}
              onChange={(e) =>
                onChange({
                  ...track,
                  reset: {
                    ...(track.reset ?? { activeLow: true, assertDelayPs: 0, durationPs: 20000 }),
                    activeLow: e.target.checked
                  }
                })
              }
              style={{ accentColor: "var(--accent-blue)" }}
            />
            <span>Active Low (`0` asserts, `1` operates)</span>
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Hold Duration (ns)</span>
            <input
              type="number"
              min={5}
              max={100}
              value={Math.round((track.reset?.durationPs ?? 20000) / 1000)}
              onChange={(e) =>
                onChange({
                  ...track,
                  reset: {
                    ...(track.reset ?? { activeLow: true, assertDelayPs: 0, durationPs: 20000 }),
                    durationPs: Math.max(1000, Number(e.target.value) * 1000)
                  }
                })
              }
              style={{
                height: 26,
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            />
          </div>
        </div>
      )}

      {/* GLITCH WIZARD */}
      {track.type === "glitch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 11 }}>
            <AlertTriangle size={13} />
            <span>Hardware Hazard Runt Pulse</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Trigger Timestamp (ns)</span>
            <input
              type="number"
              min={1}
              max={durationNs}
              value={Math.round((track.glitch?.targetTimePs ?? 25000) / 1000)}
              onChange={(e) =>
                onChange({
                  ...track,
                  glitch: {
                    ...(track.glitch ?? { targetTimePs: 25000, glitchWidthPs: 250, targetLevel: true }),
                    targetTimePs: Number(e.target.value) * 1000
                  }
                })
              }
              style={{
                height: 26,
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Glitch Width (ps)</span>
            <input
              type="number"
              min={50}
              max={2000}
              step={50}
              value={track.glitch?.glitchWidthPs ?? 250}
              onChange={(e) =>
                onChange({
                  ...track,
                  glitch: {
                    ...(track.glitch ?? { targetTimePs: 25000, glitchWidthPs: 250, targetLevel: true }),
                    glitchWidthPs: Number(e.target.value)
                  }
                })
              }
              style={{
                height: 26,
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            />
          </div>
        </div>
      )}

      {/* PATTERN WIZARD */}
      {track.type === "pattern" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sequence Type</span>
            <select
              value={track.pattern?.kind ?? "ramp"}
              onChange={(e) =>
                onChange({
                  ...track,
                  pattern: {
                    kind: e.target.value as PatternKind,
                    stepPeriodPs: track.pattern?.stepPeriodPs ?? 10000
                  }
                })
              }
              style={{
                height: 26,
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            >
              <option value="ramp">Linear Ramp (+1 counter)</option>
              <option value="alternating">Alternating 0xAA / 0x55 (Max toggle stress)</option>
              <option value="walking">Walking Ones (Single-hot sweep)</option>
              <option value="prbs">PRBS7 Pseudo-Random</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Constrained Random Panel (TAB 2)
// ----------------------------------------------------------------------------
const ConstrainedRandomPanel: React.FC<{
  tracks: StimulusTrack[];
  onUpdateTrack: (id: string, mutator: (t: StimulusTrack) => StimulusTrack) => void;
}> = ({ tracks, onUpdateTrack }) => {
  const vectorTracks = tracks.filter((t) => t.width > 1 || t.type === "constrained_random");
  const [selectedId, setSelectedId] = useState<string>(vectorTracks[0]?.id ?? tracks[0]?.id ?? "");

  const activeTrack = tracks.find((t) => t.id === selectedId) ?? tracks[0];
  const maxBound = activeTrack ? (activeTrack.width >= 32 ? 0xffffffff : (1 << activeTrack.width) - 1) : 255;
  const cfg = activeTrack?.random ?? {
    seed: 42,
    minVal: 0,
    maxVal: maxBound,
    weights: [],
    illegalValues: [],
    samplePeriodPs: 10000
  };

  // Generate 16 preview samples deterministically
  const previewSamples = useMemo(() => {
    const rng = new PseudoRandomGenerator(cfg.seed);
    const samples: Array<{ index: number; val: number }> = [];
    for (let i = 0; i < 16; i++) {
      samples.push({ index: i, val: rng.nextConstrained(cfg) });
    }
    return samples;
  }, [cfg]);

  if (!activeTrack) {
    return (
      <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 12 }}>
        No signals available for constrained random configuration.
      </div>
    );
  }

  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000) + 1;
    onUpdateTrack(activeTrack.id, (t) => ({
      ...t,
      type: "constrained_random",
      random: { ...cfg, seed: newSeed }
    }));
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: 16, gap: 16 }}>
      {/* Left Column: Constraints Configuration */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        {/* Signal Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Target Signal:</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              height: 28,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--accent-cyan)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
              padding: "0 10px"
            }}
          >
            {tracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name} ({tr.width}-bit)
              </option>
            ))}
          </select>
        </div>

        {/* Seed & Range */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {/* Seed */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, backgroundColor: "var(--bg-secondary)", padding: 10, borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>PRNG Seed</span>
              <button
                onClick={handleRandomizeSeed}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-cyan)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10
                }}
              >
                <Shuffle size={10} />
                <span>Randomize</span>
              </button>
            </div>
            <input
              type="number"
              value={cfg.seed}
              onChange={(e) =>
                onUpdateTrack(activeTrack.id, (t) => ({
                  ...t,
                  type: "constrained_random",
                  random: { ...cfg, seed: Number(e.target.value) }
                }))
              }
              style={{
                height: 26,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            />
          </div>

          {/* Min Bound */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, backgroundColor: "var(--bg-secondary)", padding: 10, borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Min Bound</span>
            <input
              type="number"
              min={0}
              max={cfg.maxVal}
              value={cfg.minVal}
              onChange={(e) =>
                onUpdateTrack(activeTrack.id, (t) => ({
                  ...t,
                  type: "constrained_random",
                  random: { ...cfg, minVal: Number(e.target.value) }
                }))
              }
              style={{
                height: 26,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            />
          </div>

          {/* Max Bound */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, backgroundColor: "var(--bg-secondary)", padding: 10, borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Max Bound</span>
            <input
              type="number"
              min={cfg.minVal}
              max={maxBound}
              value={cfg.maxVal}
              onChange={(e) =>
                onUpdateTrack(activeTrack.id, (t) => ({
                  ...t,
                  type: "constrained_random",
                  random: { ...cfg, maxVal: Number(e.target.value) }
                }))
              }
              style={{
                height: 26,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-tertiary)",
                color: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "0 6px"
              }}
            />
          </div>
        </div>

        {/* Weighted Distribution Ranges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, backgroundColor: "var(--bg-secondary)", padding: 12, borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
              Weighted Interval Distributions
            </span>
            <button
              onClick={() => {
                const nextWeights = [...(cfg.weights || []), { min: 0, max: Math.min(15, cfg.maxVal), weight: 50 }];
                onUpdateTrack(activeTrack.id, (t) => ({
                  ...t,
                  type: "constrained_random",
                  random: { ...cfg, weights: nextWeights }
                }));
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontSize: 10,
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--accent-cyan)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              <Plus size={10} />
              <span>Add Distribution Rule</span>
            </button>
          </div>

          {(!cfg.weights || cfg.weights.length === 0) ? (
            <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "6px 0" }}>
              Uniform distribution across [{cfg.minVal} .. {cfg.maxVal}]. Add a rule to bias values toward specific ranges.
            </div>
          ) : (
            cfg.weights.map((w, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Range:</span>
                <input
                  type="number"
                  value={w.min}
                  onChange={(e) => {
                    const next = [...cfg.weights];
                    next[idx].min = Number(e.target.value);
                    onUpdateTrack(activeTrack.id, (t) => ({ ...t, random: { ...cfg, weights: next } }));
                  }}
                  style={{ width: 60, height: 22, fontSize: 10, backgroundColor: "var(--bg-tertiary)", color: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 3, padding: "0 4px" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>..</span>
                <input
                  type="number"
                  value={w.max}
                  onChange={(e) => {
                    const next = [...cfg.weights];
                    next[idx].max = Number(e.target.value);
                    onUpdateTrack(activeTrack.id, (t) => ({ ...t, random: { ...cfg, weights: next } }));
                  }}
                  style={{ width: 60, height: 22, fontSize: 10, backgroundColor: "var(--bg-tertiary)", color: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 3, padding: "0 4px" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Weight:</span>
                <input
                  type="number"
                  value={w.weight}
                  onChange={(e) => {
                    const next = [...cfg.weights];
                    next[idx].weight = Number(e.target.value);
                    onUpdateTrack(activeTrack.id, (t) => ({ ...t, random: { ...cfg, weights: next } }));
                  }}
                  style={{ width: 50, height: 22, fontSize: 10, backgroundColor: "var(--bg-tertiary)", color: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 3, padding: "0 4px" }}
                />
                <button
                  onClick={() => {
                    const next = cfg.weights.filter((_, i) => i !== idx);
                    onUpdateTrack(activeTrack.id, (t) => ({ ...t, random: { ...cfg, weights: next } }));
                  }}
                  style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Live Sample Preview */}
      <div
        style={{
          width: 340,
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflow: "hidden"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
            Seed Determinism Preview
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
            16 Samples
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>#</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Hex</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Dec</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>Binary</th>
              </tr>
            </thead>
            <tbody>
              {previewSamples.map((s) => (
                <tr key={s.index} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.03)" }}>
                  <td style={{ padding: "4px 6px", color: "var(--text-muted)" }}>{s.index + 1}</td>
                  <td style={{ padding: "4px 6px", color: "var(--accent-cyan)" }}>
                    0x{s.val.toString(16).toUpperCase().padStart(Math.ceil(activeTrack.width / 4), "0")}
                  </td>
                  <td style={{ padding: "4px 6px", color: "#fff" }}>{s.val}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", color: "var(--text-muted)" }}>
                    {s.val.toString(2).padStart(activeTrack.width, "0")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function getTrackTypeColor(type: StimulusSignalType): string {
  switch (type) {
    case "clock":
      return "var(--accent-blue)";
    case "reset":
      return "var(--accent-amber)";
    case "glitch":
      return "#ef4444";
    case "constrained_random":
      return "var(--accent-purple)";
    case "pattern":
      return "var(--accent-cyan)";
    default:
      return "var(--accent-emerald)";
  }
}

// Backward compatibility alias for legacy imports
export const StimulusPainterModal = StimulusGeneratorModal;
