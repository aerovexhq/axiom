import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { HdlEditor } from "./components/HdlEditor";
import { WaveformViewer } from "./components/WaveformViewer";
import { TelemetryViewer } from "./components/TelemetryViewer";
import { BottomConsole } from "./components/BottomConsole";
import { engineBridge, SimulationState } from "./engine/engineBridge";
import { SAMPLE_DESIGNS, SampleDesign } from "./engine/sampleDesigns";

export const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>(engineBridge.getState());
  const [activeDesign, setActiveDesign] = useState<SampleDesign>(SAMPLE_DESIGNS[0]);
  const [editorCode, setEditorCode] = useState<string>(SAMPLE_DESIGNS[0].code);
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
          {/* Upper Workspace: HDL Editor + Waveform Viewer Split */}
          <div className="betterado-split-horizontal">
            <div style={{ width: "38%", display: "flex", minWidth: 320 }}>
              <HdlEditor
                code={editorCode}
                topModule={activeDesign.topModule}
                onChangeCode={setEditorCode}
                onCompile={handleCompile}
                compiled={state.compiled}
              />
            </div>
            <div style={{ flex: 1, display: "flex", minWidth: 400 }}>
              <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
            </div>
          </div>

          {/* Lower Center: Analog Telemetry Viewer (Power, Current, Sag) */}
          <TelemetryViewer state={state} />

          {/* Bottom Simulation Kernel Console & Exporters */}
          <BottomConsole state={state} />
        </div>
      </div>
    </div>
  );
};
