import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Activity, Cpu, Sliders, Clock, Maximize2 } from "lucide-react";
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
import { WelcomeLaunchpad } from "./components/WelcomeLaunchpad";
import { ResizableSplitter } from "./components/ResizableSplitter";
import { MobileDrawer, MobilePanelType } from "./components/MobileDrawer";
import { MobileBottomBar } from "./components/MobileBottomBar";
import { engineBridge, SimulationState, LspDiagnostic } from "./engine/engineBridge";
import {
  AxiomProject,
  ProjectFile,
  PROJECT_TEMPLATES,
  createProjectFromTemplate,
  bundleProjectSources,
  updateFileContent,
  addFileToProject,
  loadSavedProject,
  saveProjectToStorage,
  clearSavedProject
} from "./engine/projectModel";
import { SampleDesign } from "./engine/sampleDesigns";

export const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>(engineBridge.getState());
  const [project, setProject] = useState<AxiomProject | null>(() => loadSavedProject());
  const [centerView, setCenterView] = useState<"waveform" | "schematic" | "virtuallab" | "timing" | "split">("split");
  const [maximizedPanel, setMaximizedPanel] = useState<"editor" | "waveform" | "schematic" | "virtuallab" | "timing" | null>(null);

  // Responsive Mobile Mode & Off-Canvas Left Drawer
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth <= 768;
    }
    return false;
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanelType>("editor");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sidebar & Modals
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState<boolean>(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Manual save handler
  const handleSaveProject = useCallback(() => {
    if (!project) return;
    saveProjectToStorage(project);
    setIsSaved(true);
  }, [project]);

  // Export JSON bundle handler
  const handleExportProjectJson = useCallback(() => {
    if (!project) return;
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.axiom.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [project]);

  // Cross-Probing State: Signal ID and Code Highlight Span
  const [activeCrossProbeSignal, setActiveCrossProbeSignal] = useState<string | null>(null);
  const [highlightLineSpan, setHighlightLineSpan] = useState<{ lineStart: number; lineEnd: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState<LspDiagnostic[]>([]);

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
    if (!project) return null;
    return project.files.find((f) => f.id === project.activeFileId) ?? project.files[0] ?? null;
  }, [project]);

  // Initial compilation on mount
  useEffect(() => {
    const unsub = engineBridge.subscribeState((newState) => {
      setState(newState);
    });

    // Compile active project sources if project exists
    if (project) {
      const bundledCode = bundleProjectSources(project);
      engineBridge.compile(bundledCode, project.topModule);
    }

    return unsub;
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K for Omnibar, Ctrl+S / Cmd+S for Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOmnibarOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveProject();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveProject]);

  // Project Modification Handlers
  const handleUpdateProject = (updated: AxiomProject) => {
    setProject(updated);
    saveProjectToStorage(updated);
    setIsSaved(true);
    const bundled = bundleProjectSources(updated);
    engineBridge.compile(bundled, updated.topModule);
  };

  const handleCompile = () => {
    if (!project) return;
    const bundled = bundleProjectSources(project);
    engineBridge.compile(bundled, project.topModule);
  };

  const handleCodeChange = (newCode: string) => {
    if (!project || !activeFile) return;
    const updated = updateFileContent(project, activeFile.id, newCode);
    setProject(updated);
    saveProjectToStorage(updated);
    setIsSaved(true);
  };

  const handleSelectFile = (fileId: string) => {
    if (!project) return;
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        activeFileId: fileId,
        openFileIds: prev.openFileIds.includes(fileId) ? prev.openFileIds : [...prev.openFileIds, fileId]
      };
    });
  };

  const handleCloseTab = (fileId: string) => {
    if (!project) return;
    setProject((prev) => {
      if (!prev) return prev;
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
    if (!project) return;
    const { project: updated } = addFileToProject(project, file);
    setProject(updated);
    saveProjectToStorage(updated);
    const bundled = bundleProjectSources(updated);
    engineBridge.compile(bundled, updated.topModule);
  };

  const handleCloseProject = () => {
    setProject(null);
    clearSavedProject();
    engineBridge.reset();
  };

  const handleSelectTemplate = (templateId: string) => {
    const newProj = createProjectFromTemplate(templateId);
    handleCreateProject(newProj);
  };

  const handleImportProjectJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr) as AxiomProject;
      if (parsed && parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        handleCreateProject(parsed);
      } else {
        alert("Invalid project JSON: Missing valid files array.");
      }
    } catch (err) {
      alert("Failed to parse project JSON: " + String(err));
    }
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
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(42);
  const [splitActiveVisualizer, setSplitActiveVisualizer] = useState<"schematic" | "virtuallab" | "waveform" | "timing">("schematic");
  const [splitStackWaveform, setSplitStackWaveform] = useState<boolean>(false);
  const [splitWaveformHeightPercent, setSplitWaveformHeightPercent] = useState<number>(42);

  const handleEditorResize = useCallback((deltaPx: number) => {
    const totalWidth = window.innerWidth - (isSidebarCollapsed ? 38 : 228);
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setEditorWidthPercent((prev) => Math.max(18, Math.min(75, Math.round((prev + deltaPct) * 10) / 10)));
  }, [isSidebarCollapsed]);

  const handleWaveformHeightResize = useCallback((deltaPx: number) => {
    const totalHeight = window.innerHeight - 200;
    if (totalHeight <= 0) return;
    const deltaPct = (deltaPx / totalHeight) * 100;
    setSplitWaveformHeightPercent((prev) => Math.max(20, Math.min(80, Math.round((prev + deltaPct) * 10) / 10)));
  }, []);

  // Maximize panel helper
  const toggleMaximizePanel = (panel: "editor" | "waveform" | "schematic" | "virtuallab" | "timing") => {
    setMaximizedPanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="axiom-app">
      {/* Simulation Execution & Status Header */}
      <Header
        state={state}
        onCompile={handleCompile}
        project={project}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onCloseProject={handleCloseProject}
        onSaveProject={handleSaveProject}
        onExportProjectJson={handleExportProjectJson}
        onOpenAddSource={() => setIsAddSourceOpen(true)}
        isSaved={isSaved}
        isMobile={isMobile}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
        activeMobilePanel={activeMobilePanel}
        editorWidthPercent={editorWidthPercent}
        onSetEditorWidthPercent={setEditorWidthPercent}
        maximizedPanel={maximizedPanel}
        onRestoreMaximizedPanel={() => setMaximizedPanel(null)}
        activeCrossProbeSignal={activeCrossProbeSignal}
        onOpenOmnibar={() => setIsOmnibarOpen(true)}
        isSplitView={centerView === "split"}
      />

      {/* Mobile Off-Canvas Left Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        project={project}
        activePanel={activeMobilePanel}
        onSelectPanel={(panel) => {
          setActiveMobilePanel(panel);
          setIsMobileDrawerOpen(false);
        }}
        state={state}
        onCompile={handleCompile}
        onOpenNewProject={() => {
          setIsMobileDrawerOpen(false);
          setIsNewProjectOpen(true);
        }}
        onOpenAddSource={() => {
          setIsMobileDrawerOpen(false);
          setIsAddSourceOpen(true);
        }}
        onCloseProject={() => {
          setIsMobileDrawerOpen(false);
          handleCloseProject();
        }}
        onSelectFile={(fileId) => {
          handleSelectFile(fileId);
          setActiveMobilePanel("editor");
          setIsMobileDrawerOpen(false);
        }}
        onSelectTemplate={(templateId) => {
          handleSelectTemplate(templateId);
          setActiveMobilePanel("editor");
          setIsMobileDrawerOpen(false);
        }}
      />

      {/* Main Workspace Body */}
      {isMobile ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {!project ? (
            <WelcomeLaunchpad
              onOpenNewProject={() => setIsNewProjectOpen(true)}
              onSelectTemplate={(tmplId) => {
                handleSelectTemplate(tmplId);
                setActiveMobilePanel("editor");
              }}
              onImportProjectJson={handleImportProjectJson}
            />
          ) : activeMobilePanel === "editor" ? (
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
                isMaximized={false}
                onDiagnosticsChange={setDiagnostics}
              />
            </div>
          ) : activeMobilePanel === "schematic" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <SchematicViewer
                state={state}
                activeDesignId={project.templateId ?? "logic_circuit_project"}
                selectedSignalId={activeCrossProbeSignal}
                onSelectSignal={handleSchematicSelectSignal}
                onJumpToCode={(line) => {
                  handleJumpToCode(line, line);
                  setActiveMobilePanel("editor");
                }}
              />
            </div>
          ) : activeMobilePanel === "virtuallab" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <VirtualLabRack
                state={state}
                activeDesignId={project.templateId ?? "logic_circuit_project"}
              />
            </div>
          ) : activeMobilePanel === "waveform" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <WaveformViewer
                state={state}
                selectedSignalIds={selectedSignalIds}
              />
            </div>
          ) : activeMobilePanel === "timing" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <TimingRadarViewer
                state={state}
                activeDesignId={project.templateId ?? "logic_circuit_project"}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <UnifiedBottomDock
                state={state}
                diagnostics={diagnostics}
                onNavigateToLine={(line) => {
                  setHighlightLineSpan({ lineStart: line, lineEnd: line });
                  setActiveMobilePanel("editor");
                }}
                isMobileFullScreen={true}
              />
            </div>
          )}

          {/* Fixed 1-Tap Thumb Bottom Bar for Mobile */}
          <MobileBottomBar
            activePanel={activeMobilePanel}
            onSelectPanel={setActiveMobilePanel}
            diagnosticCount={diagnostics.length}
            glitchCount={state.glitchCount}
          />
        </div>
      ) : (
        <div className="axiom-body">
        {/* Left Sidebar: Vivado Project Manager & Elaborated Netlist Hierarchy */}
        <Sidebar
          state={state}
          project={project}
          onUpdateProject={handleUpdateProject}
          onOpenAddSource={() => setIsAddSourceOpen(true)}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          onCloseProject={handleCloseProject}
          onSelectTemplate={handleSelectTemplate}
          onSelectFile={handleSelectFile}
          selectedSignalIds={selectedSignalIds}
          onToggleSignal={handleToggleSignal}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Center Simulation Workspace */}
        <div className="axiom-center">
          {/* Upper Workspace: View Depending on Mode or Panel Maximization */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", position: "relative" }}>
            {!project ? (
              <WelcomeLaunchpad
                onOpenNewProject={() => setIsNewProjectOpen(true)}
                onSelectTemplate={handleSelectTemplate}
                onImportProjectJson={handleImportProjectJson}
              />
            ) : maximizedPanel === "editor" ? (
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
                  onDiagnosticsChange={setDiagnostics}
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
                  activeDesignId={project.templateId ?? "logic_circuit_project"}
                  selectedSignalId={activeCrossProbeSignal}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                />
              </div>
            ) : maximizedPanel === "virtuallab" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <VirtualLabRack state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
              </div>
            ) : maximizedPanel === "timing" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <TimingRadarViewer state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
              </div>
            ) : centerView === "split" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                {/* Left: HDL Multi-File Editor */}
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 280, overflow: "hidden" }}>
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
                    onDiagnosticsChange={setDiagnostics}
                  />
                </div>

                {/* Resizable Divider: Editor <-> Visualizers */}
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />

                {/* Right: Spacious Dual-Pane Visualizer Container */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 360, overflow: "hidden" }}>
                  {/* Visualizer Tab Switcher Bar */}
                  <div
                    style={{
                      height: 28,
                      minHeight: 28,
                      backgroundColor: "var(--bg-secondary)",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 8px",
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => setSplitActiveVisualizer("schematic")}
                        title="Schematic Netlist DAG Viewer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "schematic" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "schematic" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "schematic" ? "var(--accent-cyan)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "schematic" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Cpu size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Schematic</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("virtuallab")}
                        title="Interactive Virtual Lab Rack (DIP switches, buttons, probes)"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "virtuallab" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "virtuallab" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "virtuallab" ? "var(--accent-amber)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "virtuallab" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Sliders size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Lab</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("waveform")}
                        title="Stratified IEEE 1800 Multi-Radix Waveform Traces"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "waveform" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "waveform" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "waveform" ? "var(--accent-blue)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "waveform" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Activity size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Waveforms</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("timing")}
                        title="Static Timing Analysis & Dynamic Energy Treemap"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "timing" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "timing" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "timing" ? "var(--accent-purple)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "timing" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Clock size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Timing</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {/* Optional Waveforms Stack Toggle */}
                      {splitActiveVisualizer !== "waveform" && (
                        <button
                          onClick={() => setSplitStackWaveform((prev) => !prev)}
                          title="Toggle stacked Waveforms viewer on top"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "2px 6px",
                            fontSize: 10.5,
                            fontWeight: splitStackWaveform ? 600 : 400,
                            backgroundColor: splitStackWaveform ? "rgba(59, 130, 246, 0.2)" : "var(--bg-tertiary)",
                            border: `1px solid ${splitStackWaveform ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                            color: splitStackWaveform ? "var(--accent-blue)" : "var(--text-muted)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            flexShrink: 0
                          }}
                        >
                          <Activity size={11} />
                          <span style={{ whiteSpace: "nowrap" }}>+ Waves</span>
                        </button>
                      )}

                      {/* Maximize Active Visualizer */}
                      <button
                        onClick={() => toggleMaximizePanel(splitActiveVisualizer)}
                        title={`Maximize ${splitActiveVisualizer} to 100%`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 22,
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <Maximize2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Visualizer Body: Either Single Full Visualizer or Stacked with Waveforms */}
                  {splitStackWaveform && splitActiveVisualizer !== "waveform" ? (
                    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ height: `${splitWaveformHeightPercent}%`, display: "flex", minHeight: 120, overflow: "hidden" }}>
                        <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                      </div>
                      <ResizableSplitter
                        orientation="vertical"
                        onResize={handleWaveformHeightResize}
                        onDoubleClick={() => setSplitWaveformHeightPercent(42)}
                      />
                      <div style={{ flex: 1, minHeight: 140, display: "flex", overflow: "hidden" }}>
                        {splitActiveVisualizer === "schematic" && (
                          <SchematicViewer
                            state={state}
                            activeDesignId={project.templateId ?? "logic_circuit_project"}
                            selectedSignalId={activeCrossProbeSignal}
                            onSelectSignal={handleSchematicSelectSignal}
                            onJumpToCode={handleJumpToCode}
                          />
                        )}
                        {splitActiveVisualizer === "virtuallab" && (
                          <VirtualLabRack state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
                        )}
                        {splitActiveVisualizer === "timing" && (
                          <TimingRadarViewer state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                      {splitActiveVisualizer === "schematic" && (
                        <SchematicViewer
                          state={state}
                          activeDesignId={project.templateId ?? "logic_circuit_project"}
                          selectedSignalId={activeCrossProbeSignal}
                          onSelectSignal={handleSchematicSelectSignal}
                          onJumpToCode={handleJumpToCode}
                        />
                      )}
                      {splitActiveVisualizer === "virtuallab" && (
                        <VirtualLabRack state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
                      )}
                      {splitActiveVisualizer === "waveform" && (
                        <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                      )}
                      {splitActiveVisualizer === "timing" && (
                        <TimingRadarViewer state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : centerView === "waveform" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 280, overflow: "hidden" }}>
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
                    onDiagnosticsChange={setDiagnostics}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                </div>
              </div>
            ) : centerView === "schematic" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 280, overflow: "hidden" }}>
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
                    onDiagnosticsChange={setDiagnostics}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <SchematicViewer
                    state={state}
                    activeDesignId={project.templateId ?? "logic_circuit_project"}
                    selectedSignalId={activeCrossProbeSignal}
                    onSelectSignal={handleSchematicSelectSignal}
                    onJumpToCode={handleJumpToCode}
                  />
                </div>
              </div>
            ) : centerView === "virtuallab" ? (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 280, overflow: "hidden" }}>
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
                    onDiagnosticsChange={setDiagnostics}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <VirtualLabRack state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
                </div>
              </div>
            ) : (
              <div className="axiom-split-horizontal" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ width: `${editorWidthPercent}%`, display: "flex", minWidth: 280, overflow: "hidden" }}>
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
                    onDiagnosticsChange={setDiagnostics}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <TimingRadarViewer state={state} activeDesignId={project.templateId ?? "logic_circuit_project"} />
                </div>
              </div>
            )}
          </div>

          {/* Unified Dockable Bottom Drawer (Console, REPL, Telemetry, Glitches, Timing, Problems) */}
          <UnifiedBottomDock
            state={state}
            diagnostics={diagnostics}
            onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
          />
        </div>
      </div>
      )}

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
