import React, { useState, useEffect } from "react";
import { Activity, Cpu, LayoutGrid, Sliders, Clock } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { HdlEditor } from "./components/HdlEditor";
import { WaveformViewer } from "./components/WaveformViewer";
import { SchematicViewer } from "./components/SchematicViewer";
import { VirtualLabRack } from "./components/VirtualLabRack";
import { TimingRadarViewer } from "./components/TimingRadarViewer";
import { TelemetryViewer } from "./components/TelemetryViewer";
import { BottomConsole } from "./components/BottomConsole";
import { engineBridge, SimulationState } from "./engine/engineBridge";
import { SAMPLE_DESIGNS, SampleDesign } from "./engine/sampleDesigns";

export const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>(engineBridge.getState());
  const [activeDesign, setActiveDesign] = useState<SampleDesign>(SAMPLE_DESIGNS[0]);
  const [editorCode, setEditorCode] = useState<string>(SAMPLE_DESIGNS[0].code);
  const [centerView, setCenterView] = useState<"waveform" | "schematic" | "virtuallab" | "timing" | "split">("split");

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

  return (
    <div className="betterado-app">
      {/* Simulation Execution & Status Header */}
      <Header state={state} onCompile={handleCompile} />

      {/* Main Workspace Body */}
      <div className="betterado-body">
        {/* Left Sidebar: Hierarchy Explorer & Fixture Chooser */}
        <Sidebar
          state={state}
          activeDesignId={activeDesign.id}
          selectedSignalIds={selectedSignalIds}
          onSelectDesign={handleSelectDesign}
          onToggleSignal={handleToggleSignal}
        />

        {/* Center Simulation Workspace */}
        <div className="betterado-center">
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
              {activeCrossProbeSignal && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span>Probing:</span>
                  <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                    {activeCrossProbeSignal}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Upper Workspace: View Depending on centerView Mode */}
          {centerView === "split" && (
            <div className="betterado-split-horizontal" style={{ flex: 1, minHeight: 0 }}>
              {/* Left: HDL Editor */}
              <div style={{ width: "32%", display: "flex", minWidth: 300 }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>

              {/* Right: Stacked Waveform (46%) & Split Schematic + Virtual Lab (54%) */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 400, overflow: "hidden" }}>
                <div style={{ height: "46%", display: "flex", minHeight: 180, borderBottom: "1px solid var(--border-subtle)" }}>
                  <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                </div>
                <div style={{ flex: 1, display: "flex", minHeight: 200, overflow: "hidden" }}>
                  <div style={{ flex: 1.15, display: "flex", borderRight: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                    <SchematicViewer
                      state={state}
                      activeDesignId={activeDesign.id}
                      selectedSignalId={activeCrossProbeSignal}
                      onSelectSignal={handleSchematicSelectSignal}
                      onJumpToCode={handleJumpToCode}
                    />
                  </div>
                  <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                    <VirtualLabRack state={state} activeDesignId={activeDesign.id} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {centerView === "timing" && (
            <div className="betterado-split-horizontal" style={{ flex: 1, minHeight: 0 }}>
              <div style={{ width: "32%", display: "flex", minWidth: 320 }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <div style={{ flex: 1, display: "flex", minWidth: 400 }}>
                <TimingRadarViewer state={state} activeDesignId={activeDesign.id} />
              </div>
            </div>
          )}

          {centerView === "virtuallab" && (
            <div className="betterado-split-horizontal" style={{ flex: 1, minHeight: 0 }}>
              <div style={{ width: "32%", display: "flex", minWidth: 320 }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <div style={{ flex: 1, display: "flex", minWidth: 400 }}>
                <VirtualLabRack state={state} activeDesignId={activeDesign.id} />
              </div>
            </div>
          )}

          {centerView === "waveform" && (
            <div className="betterado-split-horizontal" style={{ flex: 1, minHeight: 0 }}>
              <div style={{ width: "38%", display: "flex", minWidth: 320 }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <div style={{ flex: 1, display: "flex", minWidth: 400 }}>
                <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
              </div>
            </div>
          )}

          {centerView === "schematic" && (
            <div className="betterado-split-horizontal" style={{ flex: 1, minHeight: 0 }}>
              <div style={{ width: "35%", display: "flex", minWidth: 320 }}>
                <HdlEditor
                  code={editorCode}
                  topModule={activeDesign.topModule}
                  onChangeCode={setEditorCode}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                />
              </div>
              <div style={{ flex: 1, display: "flex", minWidth: 400 }}>
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
    </div>
  );
};
