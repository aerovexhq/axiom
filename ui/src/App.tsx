import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Activity, Cpu, LayoutGrid, Sliders, Clock, Search, Columns, Maximize2, Minimize2 } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { HdlEditor } from "./components/HdlEditor";
import { WaveformViewer } from "./components/WaveformViewer";
import { SchematicViewer } from "./components/SchematicViewer";
import { VirtualLabRack } from "./components/VirtualLabRack";
import { TimingRadarViewer } from "./components/TimingRadarViewer";
import { UnifiedBottomDock } from "./components/UnifiedBottomDock";
import { OmnibarModal } from "./components/OmnibarModal";
import { NewProjectModal } from "./components/NewProjectModal";
import { AddSourceModal } from "./components/AddSourceModal";
import { ResizableSplitter } from "./components/ResizableSplitter";
import { engineBridge, SimulationState } from "./engine/engineBridge";
import {
  AxiomProject,
  ProjectFile,
  PROJECT_TEMPLATES,
  createProjectFromTemplate,
  bundleProjectSources,
  updateFileContent,
  addFileToProject,
  loadSavedProject,
  saveProjectToStorage
} from "./engine/projectModel";
import { SampleDesign } from "./engine/sampleDesigns";

export const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>(engineBridge.getState());
  const [project, setProject] = useState<AxiomProject>(() => loadSavedProject());
  const [centerView, setCenterView] = useState<"waveform" | "schematic" | "virtuallab" | "timing" | "split">("split");
  const [maximizedPanel, setMaximizedPanel] = useState<"editor" | "waveform" | "schematic" | "virtuallab" | null>(null);

  // Sidebar & Modals
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState<boolean>(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState<boolean>(false);

  // Cross-Probing State: Signal ID and Code Highlight Span
  const [activeCrossProbeSignal, setActiveCrossProbeSignal] = useState<string | null>(null);
  const [highlightLineSpan, setHighlightLineSpan] = useState<{ lineStart: number; lineEnd: number } | null>(null);

  const [selectedSignalIds, setSelectedSignalIds] = useState<Set<string>>(
    new Set([
      "clk",
      "rst_n",
      "pc",
      "instr",
      "alu_result",
      "reg_x1",
      "reg_x2",
      "branch_taken",
      "opcode",
      "a",
      "b",
      "result"
    ])
  );

  // Active File currently opened in HDL Editor
  const activeFile = useMemo(() => {
    return project.files.find((f) => f.id === project.activeFileId) ?? project.files[0];
  }, [project.files, project.activeFileId]);

  // Initial compilation on mount
  useEffect(() => {
    const unsub = engineBridge.subscribeState((newState) => {
      setState(newState);
    });

    // Compile active project sources
    const bundledCode = bundleProjectSources(project);
    engineBridge.compile(bundledCode, project.topModule);

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

  // Project Modification Handlers
  const handleUpdateProject = (updated: AxiomProject) => {
    setProject(updated);
    saveProjectToStorage(updated);
    const bundled = bundleProjectSources(updated);
    engineBridge.compile(bundled, updated.topModule);
  };

  const handleCompile = () => {
    const bundled = bundleProjectSources(project);
    engineBridge.compile(bundled, project.topModule);
  };

  const handleCodeChange = (newCode: string) => {
    if (!activeFile) return;
    const updated = updateFileContent(project, activeFile.id, newCode);
    setProject(updated);
    saveProjectToStorage(updated);
  };

  const handleSelectFile = (fileId: string) => {
    setProject((prev) => ({
      ...prev,
      activeFileId: fileId,
      openFileIds: prev.openFileIds.includes(fileId) ? prev.openFileIds : [...prev.openFileIds, fileId]
    }));
  };

  const handleCloseTab = (fileId: string) => {
    setProject((prev) => {
      const remainingOpenIds = prev.openFileIds.filter((id) => id !== fileId);
      const fallbackId = remainingOpenIds.length > 0 ? remainingOpenIds[0] : prev.files[0]?.id ?? "";
      return {
        ...prev,
        openFileIds: remainingOpenIds.length > 0 ? remainingOpenIds : [fallbackId],
        activeFileId: prev.activeFileId === fileId ? fallbackId : prev.activeFileId
      };
    });
  };

  const handleAddSource = (file: Omit<ProjectFile, "id">) => {
    const { project: updated } = addFileToProject(project, file);
    setProject(updated);
    saveProjectToStorage(updated);
    const bundled = bundleProjectSources(updated);
    engineBridge.compile(bundled, updated.topModule);
  };

  const handleCreateProject = (newProj: AxiomProject) => {
    setProject(newProj);
    saveProjectToStorage(newProj);
    const bundled = bundleProjectSources(newProj);
    engineBridge.compile(bundled, newProj.topModule);

    // Auto-select signals
    const sigIds = new Set<string>();
    engineBridge.getState().signals.forEach((s) => {
      sigIds.add(s.id);
      sigIds.add(s.fullName);
    });
    setSelectedSignalIds(sigIds);
  };

  const handleSelectDesign = (design: SampleDesign) => {
    const tmpl = PROJECT_TEMPLATES.find((t) => t.id === design.id || t.defaultTopModule === design.topModule);
    if (tmpl) {
      const newProj = createProjectFromTemplate(tmpl.id);
      handleCreateProject(newProj);
    } else {
      const newProj: AxiomProject = {
        id: `proj_${Date.now()}`,
        name: design.id,
        targetDevice: "Artix-7 xc7a35t-csg324-1",
        topModule: design.topModule,
        activeFileId: "file_top",
        openFileIds: ["file_top"],
        files: [
          {
            id: "file_top",
            name: `${design.topModule}.v`,
            fileType: "verilog",
            fileSet: "sources_1",
            isTop: true,
            content: design.code
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      handleCreateProject(newProj);
    }
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
    const totalWidth = window.innerWidth - (isSidebarCollapsed ? 38 : 260);
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setEditorWidthPercent((prev) => Math.max(18, Math.min(65, Math.round((prev + deltaPct) * 10) / 10)));
  }, [isSidebarCollapsed]);

  const handleWaveformHeightResize = useCallback((deltaPx: number) => {
    const totalHeight = window.innerHeight - 260;
    if (totalHeight <= 0) return;
    const deltaPct = (deltaPx / totalHeight) * 100;
    setSplitWaveformHeightPercent((prev) => Math.max(20, Math.min(80, Math.round((prev + deltaPct) * 10) / 10)));
  }, []);

  const handleSchematicLabResize = useCallback((deltaPx: number) => {
    const totalWidth = (window.innerWidth - (isSidebarCollapsed ? 38 : 260)) * ((100 - editorWidthPercent) / 100);
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setSchematicLabWidthPercent((prev) => Math.max(20, Math.min(80, Math.round((prev + deltaPct) * 10) / 10)));
  }, [editorWidthPercent, isSidebarCollapsed]);

  // Maximize panel helper
  const toggleMaximizePanel = (panel: "editor" | "waveform" | "schematic" | "virtuallab") => {
    setMaximizedPanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="axiom-app">
      {/* Simulation Execution & Status Header */}
      <Header state={state} onCompile={handleCompile} />

      {/* Main Workspace Body */}
      <div className="axiom-body">
        {/* Left Sidebar: Vivado Project Manager & Elaborated Netlist Hierarchy */}
        <Sidebar
          state={state}
          project={project}
          onUpdateProject={handleUpdateProject}
          onOpenAddSource={() => setIsAddSourceOpen(true)}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          onSelectFile={handleSelectFile}
          selectedSignalIds={selectedSignalIds}
          onToggleSignal={handleToggleSignal}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
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
                onClick={() => {
                  setCenterView("split");
                  setMaximizedPanel(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "split" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "split" && !maximizedPanel ? "var(--accent-emerald)" : "var(--text-muted)",
                  border: centerView === "split" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <LayoutGrid size={12} />
                <span>Split Studio</span>
              </button>

              <button
                onClick={() => {
                  setCenterView("waveform");
                  setMaximizedPanel(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "waveform" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "waveform" && !maximizedPanel ? "var(--accent-blue)" : "var(--text-muted)",
                  border: centerView === "waveform" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Activity size={12} />
                <span>Waveforms</span>
              </button>

              <button
                onClick={() => {
                  setCenterView("schematic");
                  setMaximizedPanel(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "schematic" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "schematic" && !maximizedPanel ? "var(--accent-cyan)" : "var(--text-muted)",
                  border: centerView === "schematic" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Cpu size={12} />
                <span>Schematic DAG</span>
              </button>

              <button
                onClick={() => {
                  setCenterView("virtuallab");
                  setMaximizedPanel(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "virtuallab" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "virtuallab" && !maximizedPanel ? "var(--accent-amber)" : "var(--text-muted)",
                  border: centerView === "virtuallab" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Sliders size={12} />
                <span>Virtual Lab</span>
              </button>

              <button
                onClick={() => {
                  setCenterView("timing");
                  setMaximizedPanel(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: centerView === "timing" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                  color: centerView === "timing" && !maximizedPanel ? "var(--accent-purple)" : "var(--text-muted)",
                  border: centerView === "timing" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                }}
              >
                <Clock size={12} />
                <span>Timing & Energy</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
              {/* Maximize Active Panel Badge */}
              {maximizedPanel && (
                <button
                  onClick={() => setMaximizedPanel(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    border: "1px solid var(--accent-blue)",
                    color: "var(--accent-blue)",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 600,
                    fontSize: 10
                  }}
                >
                  <Minimize2 size={11} />
                  <span>Restore {maximizedPanel.toUpperCase()} (🗗)</span>
                </button>
              )}

              {/* Quick Layout Presets for Split View */}
              {centerView === "split" && !maximizedPanel && (
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
              )}

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

          {/* Upper Workspace: View Depending on Mode or Panel Maximization */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", position: "relative" }}>
            {/* Panel Maximization Overrides */}
            {maximizedPanel === "editor" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <HdlEditor
                  code={activeFile?.content ?? ""}
                  topModule={project.topModule}
                  onChangeCode={handleCodeChange}
                  onCompile={handleCompile}
                  compiled={state.compiled}
                  highlightLineSpan={highlightLineSpan}
                  project={project}
                  onSelectTab={handleSelectFile}
                  onCloseTab={handleCloseTab}
                  onAddFileClick={() => setIsAddSourceOpen(true)}
                  isMaximized={true}
                  onToggleMaximize={() => toggleMaximizePanel("editor")}
                />
              </div>
            ) : maximizedPanel === "waveform" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
              </div>
            ) : maximizedPanel === "schematic" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <SchematicViewer
                  state={state}
                  activeDesignId={project.templateId ?? "riscv_soc_project"}
                  selectedSignalId={activeCrossProbeSignal}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                />
              </div>
            ) : maximizedPanel === "virtuallab" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <VirtualLabRack state={state} activeDesignId={project.templateId ?? "riscv_soc_project"} />
              </div>
            ) : centerView === "split" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                {/* Left: HDL Multi-File Editor */}
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                  <HdlEditor
                    code={activeFile?.content ?? ""}
                    topModule={project.topModule}
                    onChangeCode={handleCodeChange}
                    onCompile={handleCompile}
                    compiled={state.compiled}
                    highlightLineSpan={highlightLineSpan}
                    project={project}
                    onSelectTab={handleSelectFile}
                    onCloseTab={handleCloseTab}
                    onAddFileClick={() => setIsAddSourceOpen(true)}
                    isMaximized={false}
                    onToggleMaximize={() => toggleMaximizePanel("editor")}
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
                  <div style={{ height: `${splitWaveformHeightPercent}%`, display: "flex", minHeight: 120, overflow: "hidden", position: "relative" }}>
                    <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                    <button
                      onClick={() => toggleMaximizePanel("waveform")}
                      title="Maximize Waveforms to 100%"
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 8,
                        padding: 3,
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 3,
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        zIndex: 15
                      }}
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>

                  {/* Resizable Divider: Waveform <-> Schematic/Lab */}
                  <ResizableSplitter
                    orientation="vertical"
                    onResize={handleWaveformHeightResize}
                    onDoubleClick={() => setSplitWaveformHeightPercent(45)}
                  />

                  <div style={{ flex: 1, display: "flex", minHeight: 140, overflow: "hidden" }}>
                    <div style={{ width: `${schematicLabWidthPercent}%`, display: "flex", minWidth: 160, overflow: "hidden", position: "relative" }}>
                      <SchematicViewer
                        state={state}
                        activeDesignId={project.templateId ?? "riscv_soc_project"}
                        selectedSignalId={activeCrossProbeSignal}
                        onSelectSignal={handleSchematicSelectSignal}
                        onJumpToCode={handleJumpToCode}
                      />
                      <button
                        onClick={() => toggleMaximizePanel("schematic")}
                        title="Maximize Schematic DAG to 100%"
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 8,
                          padding: 3,
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 3,
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          zIndex: 15
                        }}
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>

                    {/* Resizable Divider: Schematic <-> Virtual Lab */}
                    <ResizableSplitter
                      orientation="horizontal"
                      onResize={handleSchematicLabResize}
                      onDoubleClick={() => setSchematicLabWidthPercent(50)}
                    />

                    <div style={{ flex: 1, display: "flex", minWidth: 160, overflow: "hidden", position: "relative" }}>
                      <VirtualLabRack state={state} activeDesignId={project.templateId ?? "riscv_soc_project"} />
                      <button
                        onClick={() => toggleMaximizePanel("virtuallab")}
                        title="Maximize Virtual Lab to 100%"
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 8,
                          padding: 3,
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 3,
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          zIndex: 15
                        }}
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : centerView === "waveform" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                  <HdlEditor
                    code={activeFile?.content ?? ""}
                    topModule={project.topModule}
                    onChangeCode={handleCodeChange}
                    onCompile={handleCompile}
                    compiled={state.compiled}
                    highlightLineSpan={highlightLineSpan}
                    project={project}
                    onSelectTab={handleSelectFile}
                    onCloseTab={handleCloseTab}
                    onAddFileClick={() => setIsAddSourceOpen(true)}
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
            ) : centerView === "schematic" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                  <HdlEditor
                    code={activeFile?.content ?? ""}
                    topModule={project.topModule}
                    onChangeCode={handleCodeChange}
                    onCompile={handleCompile}
                    compiled={state.compiled}
                    highlightLineSpan={highlightLineSpan}
                    project={project}
                    onSelectTab={handleSelectFile}
                    onCloseTab={handleCloseTab}
                    onAddFileClick={() => setIsAddSourceOpen(true)}
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
                    activeDesignId={project.templateId ?? "riscv_soc_project"}
                    selectedSignalId={activeCrossProbeSignal}
                    onSelectSignal={handleSchematicSelectSignal}
                    onJumpToCode={handleJumpToCode}
                  />
                </div>
              </div>
            ) : centerView === "virtuallab" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                  <HdlEditor
                    code={activeFile?.content ?? ""}
                    topModule={project.topModule}
                    onChangeCode={handleCodeChange}
                    onCompile={handleCompile}
                    compiled={state.compiled}
                    highlightLineSpan={highlightLineSpan}
                    project={project}
                    onSelectTab={handleSelectFile}
                    onCloseTab={handleCloseTab}
                    onAddFileClick={() => setIsAddSourceOpen(true)}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(33)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <VirtualLabRack state={state} activeDesignId={project.templateId ?? "riscv_soc_project"} />
                </div>
              </div>
            ) : (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 220, overflow: "hidden" }}>
                  <HdlEditor
                    code={activeFile?.content ?? ""}
                    topModule={project.topModule}
                    onChangeCode={handleCodeChange}
                    onCompile={handleCompile}
                    compiled={state.compiled}
                    highlightLineSpan={highlightLineSpan}
                    project={project}
                    onSelectTab={handleSelectFile}
                    onCloseTab={handleCloseTab}
                    onAddFileClick={() => setIsAddSourceOpen(true)}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(33)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <TimingRadarViewer state={state} activeDesignId={project.templateId ?? "riscv_soc_project"} />
                </div>
              </div>
            )}
          </div>

          {/* Unified Dockable Bottom Drawer (Console, REPL, Telemetry, Glitches, Timing) */}
          <UnifiedBottomDock state={state} />
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

      {/* Vivado New Project Wizard Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Vivado Add Source File Modal */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onAddSource={handleAddSource}
      />
    </div>
  );
};
