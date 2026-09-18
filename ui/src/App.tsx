import React, { useState, useEffect, useCallback } from "react";
import { Activity, Cpu, LayoutGrid, Sliders, Clock, Search, Columns } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { HdlEditor } from "./components/HdlEditor";
import { WaveformViewer } from "./components/WaveformViewer";
import { SchematicViewer } from "./components/SchematicViewer";
import { VirtualLabRack } from "./components/VirtualLabRack";
import { TimingRadarViewer } from "./components/TimingRadarViewer";
import { TelemetryViewer } from "./components/TelemetryViewer";
import { BottomConsole } from "./components/BottomConsole";
import { OmnibarModal } from "./components/OmnibarModal";
import { ResizableSplitter } from "./components/ResizableSplitter";
import { engineBridge, SimulationState } from "./engine/engineBridge";
import { SAMPLE_DESIGNS, SampleDesign } from "./engine/sampleDesigns";

export const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>(engineBridge.getState());
  const [activeDesign, setActiveDesign] = useState<SampleDesign>(SAMPLE_DESIGNS[0]);
  const [editorCode, setEditorCode] = useState<string>(SAMPLE_DESIGNS[0].code);
  const [centerView, setCenterView] = useState<"waveform" | "schematic" | "virtuallab" | "timing" | "split">("split");
  const [isOmnibarOpen, setIsOmnibarOpen] = useState<boolean>(false);

  // Cross-Probing State: Signal ID and Code Highlight Span
  const [activeCrossProbeSignal, setActiveCrossProbeSignal] = useState<string | null>(null);
  const [highlightLineSpan, setHighlightLineSpan] = useState<{ lineStart: number; lineEnd: number } | null>(null);

  const [selectedSignalIds, setSelectedSignalIds] = useState<Set<string>>(
    new Set([
      "alu_8bit.clk",
      "alu_8bit.rst_n",
      "alu_8bit.opcode",
      "alu_8bit.a",
      "alu_8bit.b",
      "alu_8bit.result",
      "alu_8bit.zero_flag",
      "alu_8bit.carry_flag",
      "clk",
      "rst_n",
      "opcode",
      "a",
      "b",
      "result",
      "zero_flag",
      "carry_flag"
    ])
  );

  useEffect(() => {
    const unsub = engineBridge.subscribeState((newState) => {
      setState(newState);
    });
    // Initial compile on boot
    engineBridge.compile(editorCode, activeDesign.topModule);
    return unsub;
  }, []);

  // Global Omnibar Keyboard Shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOmnibarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectDesign = (design: SampleDesign) => {
    setActiveDesign(design);
    setEditorCode(design.code);
    setActiveCrossProbeSignal(null);
    setHighlightLineSpan(null);
    engineBridge.compile(design.code, design.topModule);

    // Default select all signals in new design
    const sigIds = new Set<string>();
    engineBridge.getState().signals.forEach((s) => {
      sigIds.add(s.id);
      sigIds.add(s.fullName);
    });
    setSelectedSignalIds(sigIds);
  };

  const handleCompile = () => {
    engineBridge.compile(editorCode, activeDesign.topModule);
  };

  const handleToggleSignal = (id: string) => {
    const next = new Set(selectedSignalIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSignalIds(next);
    setActiveCrossProbeSignal(id);
  };

  const handleSchematicSelectSignal = (signalId: string) => {
    setActiveCrossProbeSignal(signalId);
    setSelectedSignalIds((prev) => {
      const next = new Set(prev);
      next.add(signalId);
      return next;
    });
  };

  const handleJumpToCode = (lineStart: number, lineEnd: number) => {
    setHighlightLineSpan({ lineStart, lineEnd });
  };

  // Dynamic Resizable Layout State
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(33);
  const [splitWaveformHeightPercent, setSplitWaveformHeightPercent] = useState<number>(45);
  const [schematicLabWidthPercent, setSchematicLabWidthPercent] = useState<number>(50);

  const handleEditorResize = useCallback((deltaPx: number) => {
    const totalWidth = window.innerWidth - 260;
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setEditorWidthPercent((prev) => Math.max(18, Math.min(65, Math.round((prev + deltaPct) * 10) / 10)));
  }, []);

  const handleWaveformHeightResize = useCallback((deltaPx: number) => {
    const totalHeight = window.innerHeight - 240;
    if (totalHeight <= 0) return;
    const deltaPct = (deltaPx / totalHeight) * 100;
    setSplitWaveformHeightPercent((prev) => Math.max(20, Math.min(80, Math.round((prev + deltaPct) * 10) / 10)));
  }, []);

  const handleSchematicLabResize = useCallback((deltaPx: number) => {
    const totalWidth = (window.innerWidth - 260) * ((100 - editorWidthPercent) / 100);
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setSchematicLabWidthPercent((prev) => Math.max(20, Math.min(80, Math.round((prev + deltaPct) * 10) / 10)));
  }, [editorWidthPercent]);

  return (
    <div className="axiom-app">
      {/* Simulation Execution & Status Header */}
      <Header state={state} onCompile={handleCompile} />

      {/* Main Workspace Body */}
      <div className="axiom-body">
        {/* Left Sidebar: Hierarchy Explorer & Fixture Chooser */}
        <Sidebar
          state={state}
          activeDesignId={activeDesign.id}
          selectedSignalIds={selectedSignalIds}
          onSelectDesign={handleSelectDesign}
          onToggleSignal={handleToggleSignal}
        />

        {/* Center Simulation Workspace */}
        <div className="axiom-center">
          {/* Studio View Switcher Tab Bar */}
          <div
            style={{
              height: 32,
              backgroundColor: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              zIndex: 5
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setCenterView("waveform")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "waveform" ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "waveform" ? "var(--accent-blue)" : "var(--text-muted)",
                  border: centerView === "waveform" ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Activity size={12} />
                <span>Waveforms</span>
              </button>

              <button
                onClick={() => setCenterView("schematic")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "schematic" ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "schematic" ? "var(--accent-cyan)" : "var(--text-muted)",
                  border: centerView === "schematic" ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Cpu size={12} />
                <span>Schematic DAG</span>
              </button>

              <button
                onClick={() => setCenterView("virtuallab")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "virtuallab" ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "virtuallab" ? "var(--accent-amber)" : "var(--text-muted)",
                  border: centerView === "virtuallab" ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Sliders size={12} />
                <span>Virtual Lab</span>
              </button>

              <button
                onClick={() => setCenterView("timing")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "timing" ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "timing" ? "var(--accent-purple)" : "var(--text-muted)",
                  border: centerView === "timing" ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Clock size={12} />
                <span>Timing & Energy</span>
              </button>

              <button
                onClick={() => setCenterView("split")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "split" ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "split" ? "var(--accent-emerald)" : "var(--text-muted)",
                  border: centerView === "split" ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <LayoutGrid size={12} />
                <span>Split Studio</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
              {/* Quick Layout Presets */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  marginRight: 4,
                  backgroundColor: "var(--bg-primary)",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                <Columns size={11} color="var(--text-muted)" style={{ marginRight: 2 }} />
                <button
                  onClick={() => setEditorWidthPercent(33)}
                  title="Balanced Layout (33% Code / 67% Visuals)"
                  style={{
                    fontSize: 10,
                    fontWeight: Math.abs(editorWidthPercent - 33) < 2 ? 700 : 500,
                    padding: "2px 6px",
                    borderRadius: 3,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: Math.abs(editorWidthPercent - 33) < 2 ? "var(--bg-elevated)" : "transparent",
                    color: Math.abs(editorWidthPercent - 33) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                  }}
                >
                  Balanced
                </button>
                <button
                  onClick={() => setEditorWidthPercent(52)}
                  title="Code Focus (52% Code / 48% Visuals)"
                  style={{
                    fontSize: 10,
                    fontWeight: Math.abs(editorWidthPercent - 52) < 2 ? 700 : 500,
                    padding: "2px 6px",
                    borderRadius: 3,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: Math.abs(editorWidthPercent - 52) < 2 ? "var(--bg-elevated)" : "transparent",
                    color: Math.abs(editorWidthPercent - 52) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                  }}
                >
                  Code Focus
                </button>
                <button
                  onClick={() => setEditorWidthPercent(20)}
                  title="Visualizer Focus (20% Code / 80% Visuals)"
                  style={{
                    fontSize: 10,
                    fontWeight: Math.abs(editorWidthPercent - 20) < 2 ? 700 : 500,
                    padding: "2px 6px",
                    borderRadius: 3,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: Math.abs(editorWidthPercent - 20) < 2 ? "var(--bg-elevated)" : "transparent",
                    color: Math.abs(editorWidthPercent - 20) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                  }}
                >
                  Visual Focus
                </button>
              </div>

              {activeCrossProbeSignal && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span>Probing:</span>
                  <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                    {activeCrossProbeSignal}
                  </span>
                </span>
              )}
              <button
                onClick={() => setIsOmnibarOpen(true)}
                title="Omnibar & Command Palette (Ctrl+K or Cmd+K)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 500,
                  transition: "all 0.15s ease"
                }}
              >
                <Search size={11} color="var(--accent-blue)" />
                <span>Omnibar</span>
                <kbd
                  style={{
                    fontSize: 9,
                    padding: "1px 4px",
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 3,
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)"
                  }}
                >
                  Ctrl+K
                </kbd>
              </button>
            </div>
          </div>

          {/* Upper Workspace: View Depending on centerView Mode */}
          {centerView === "split" && (
            <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
              {/* Left: HDL Editor */}
              <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>

              {/* Resizable Divider: Editor <-> Visualizers */}
              <ResizableSplitter
                orientation="horizontal"
                onResize={handleEditorResize}
                onDoubleClick={() => setEditorWidthPercent(33)}
              />

              {/* Right: Stacked Waveform & Split Schematic + Virtual Lab */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 320, overflow: "hidden" }}>
                <div style={{ height: `${splitWaveformHeightPercent}%`, display: "flex", minHeight: 120, overflow: "hidden" }}>
                  <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                </div>

                {/* Resizable Divider: Waveform <-> Schematic/Lab */}
                <ResizableSplitter
                  orientation="vertical"
                  onResize={handleWaveformHeightResize}
                  onDoubleClick={() => setSplitWaveformHeightPercent(45)}
                />

                <div style={{ flex: 1, display: "flex", minHeight: 140, overflow: "hidden" }}>
                  <div style={{ width: `${schematicLabWidthPercent}%`, display: "flex", minWidth: 160, overflow: "hidden" }}>
                    <SchematicViewer
                      state={state}
                      activeDesignId={activeDesign.id}
                      selectedSignalId={activeCrossProbeSignal}
                      onSelectSignal={handleSchematicSelectSignal}
                      onJumpToCode={handleJumpToCode}
                    />
                  </div>

                  {/* Resizable Divider: Schematic <-> Virtual Lab */}
                  <ResizableSplitter
                    orientation="horizontal"
                    onResize={handleSchematicLabResize}
                    onDoubleClick={() => setSchematicLabWidthPercent(50)}
                  />

                  <div style={{ flex: 1, display: "flex", minWidth: 160, overflow: "hidden" }}>
                    <VirtualLabRack state={state} activeDesignId={activeDesign.id} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {centerView === "timing" && (
            <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <ResizableSplitter
                orientation="horizontal"
                onResize={handleEditorResize}
                onDoubleClick={() => setEditorWidthPercent(33)}
              />
              <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                <TimingRadarViewer state={state} activeDesignId={activeDesign.id} />
              </div>
            </div>
          )}

          {centerView === "virtuallab" && (
            <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <ResizableSplitter
                orientation="horizontal"
                onResize={handleEditorResize}
                onDoubleClick={() => setEditorWidthPercent(33)}
              />
              <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                <VirtualLabRack state={state} activeDesignId={activeDesign.id} />
              </div>
            </div>
          )}

          {centerView === "waveform" && (
            <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <ResizableSplitter
                orientation="horizontal"
                onResize={handleEditorResize}
                onDoubleClick={() => setEditorWidthPercent(33)}
              />
              <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
              </div>
            </div>
          )}

          {centerView === "schematic" && (
            <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <ResizableSplitter
                orientation="horizontal"
                onResize={handleEditorResize}
                onDoubleClick={() => setEditorWidthPercent(33)}
              />
              <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                <SchematicViewer
                  state={state}
                  activeDesignId={activeDesign.id}
                  selectedSignalId={activeCrossProbeSignal}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                />
              </div>
            </div>
          )}

          {/* Lower Center: Analog Telemetry Viewer (Power, Current, Sag) */}
          <TelemetryViewer state={state} />

          {/* Bottom Simulation Kernel Console & Exporters */}
          <BottomConsole state={state} />
        </div>
      </div>

      {/* Omnibar & Global Command Palette Modal */}
      <OmnibarModal
        isOpen={isOmnibarOpen}
        onClose={() => setIsOmnibarOpen(false)}
        state={state}
        onSelectView={setCenterView}
        onSelectDesign={handleSelectDesign}
        onSelectSignal={handleSchematicSelectSignal}
        onCompile={handleCompile}
      />
    </div>
  );
};
