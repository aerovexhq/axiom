import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Activity, Cpu, LayoutGrid, Sliders, Clock, Search, Columns, Maximize2, Minimize2, Sparkles } from "lucide-react";
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
    if (!project) return;
    const bundled = bundleProjectSources(project);
    engineBridge.compile(bundled, project.topModule);
  };

  const handleCodeChange = (newCode: string) => {
    if (!project || !activeFile) return;
    const updated = updateFileContent(project, activeFile.id, newCode);
    setProject(updated);
    saveProjectToStorage(updated);
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
    const totalWidth = window.innerWidth - (isSidebarCollapsed ? 38 : 280);
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setEditorWidthPercent((prev) => Math.max(18, Math.min(75, Math.round((prev + deltaPct) * 10) / 10)));
  }, [isSidebarCollapsed]);

  const handleWaveformHeightResize = useCallback((deltaPx: number) => {
    const totalHeight = window.innerHeight - 280;
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
        isMobile={isMobile}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
        activeMobilePanel={activeMobilePanel}
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
            overflow: "hidden",
            paddingBottom: 56
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
          {/* Studio View Switcher Tab Bar */}
          <div
            style={{
              height: 38,
              backgroundColor: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
              zIndex: 5
            }}
          >
            {project ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button
                  onClick={() => {
                    setCenterView("split");
                    setMaximizedPanel(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "4px 11px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: centerView === "split" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                    color: centerView === "split" && !maximizedPanel ? "var(--accent-emerald)" : "var(--text-muted)",
                    border: centerView === "split" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                  }}
                >
                  <LayoutGrid size={14} />
                  <span>Dual Studio</span>
                </button>

                <button
                  onClick={() => {
                    setCenterView("waveform");
                    setMaximizedPanel(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "4px 11px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: centerView === "waveform" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                    color: centerView === "waveform" && !maximizedPanel ? "var(--accent-blue)" : "var(--text-muted)",
                    border: centerView === "waveform" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                  }}
                >
                  <Activity size={14} />
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
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "4px 11px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: centerView === "schematic" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                    color: centerView === "schematic" && !maximizedPanel ? "var(--accent-cyan)" : "var(--text-muted)",
                    border: centerView === "schematic" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                  }}
                >
                  <Cpu size={14} />
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
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "4px 11px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: centerView === "virtuallab" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                    color: centerView === "virtuallab" && !maximizedPanel ? "var(--accent-amber)" : "var(--text-muted)",
                    border: centerView === "virtuallab" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                  }}
                >
                  <Sliders size={14} />
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
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "4px 11px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: centerView === "timing" && !maximizedPanel ? "var(--bg-tertiary)" : "transparent",
                    color: centerView === "timing" && !maximizedPanel ? "var(--accent-purple)" : "var(--text-muted)",
                    border: centerView === "timing" && !maximizedPanel ? "1px solid var(--border-subtle)" : "1px solid transparent"
                  }}
                >
                  <Clock size={14} />
                  <span>Timing & Energy</span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-muted)" }}>
                <Sparkles size={14} color="var(--accent-cyan)" />
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Axiom Studio Launchpad</span>
                <span style={{ opacity: 0.7 }}>• Select or create a project below to begin simulation</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
              {/* Maximize Active Panel Badge */}
              {project && maximizedPanel && (
                <button
                  onClick={() => setMaximizedPanel(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 9px",
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    border: "1px solid var(--accent-blue)",
                    color: "var(--accent-blue)",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 600,
                    fontSize: 11
                  }}
                >
                  <Minimize2 size={12} />
                  <span>Restore {maximizedPanel.toUpperCase()} (🗗)</span>
                </button>
              )}

              {/* Quick Layout Presets for Split View */}
              {project && centerView === "split" && !maximizedPanel && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginRight: 4,
                    backgroundColor: "var(--bg-primary)",
                    padding: "3px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  <Columns size={12} color="var(--text-muted)" style={{ marginRight: 2 }} />
                  <button
                    onClick={() => setEditorWidthPercent(42)}
                    title="Balanced Layout (42% Code / 58% Visuals)"
                    style={{
                      fontSize: 11,
                      fontWeight: Math.abs(editorWidthPercent - 42) < 2 ? 700 : 500,
                      padding: "2px 7px",
                      borderRadius: 3,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: Math.abs(editorWidthPercent - 42) < 2 ? "var(--bg-elevated)" : "transparent",
                      color: Math.abs(editorWidthPercent - 42) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                    }}
                  >
                    Balanced
                  </button>
                  <button
                    onClick={() => setEditorWidthPercent(55)}
                    title="Code Focus (55% Code / 45% Visuals)"
                    style={{
                      fontSize: 11,
                      fontWeight: Math.abs(editorWidthPercent - 55) < 2 ? 700 : 500,
                      padding: "2px 7px",
                      borderRadius: 3,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: Math.abs(editorWidthPercent - 55) < 2 ? "var(--bg-elevated)" : "transparent",
                      color: Math.abs(editorWidthPercent - 55) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                    }}
                  >
                    Code Focus
                  </button>
                  <button
                    onClick={() => setEditorWidthPercent(25)}
                    title="Visualizer Focus (25% Code / 75% Visuals)"
                    style={{
                      fontSize: 11,
                      fontWeight: Math.abs(editorWidthPercent - 25) < 2 ? 700 : 500,
                      padding: "2px 7px",
                      borderRadius: 3,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: Math.abs(editorWidthPercent - 25) < 2 ? "var(--bg-elevated)" : "transparent",
                      color: Math.abs(editorWidthPercent - 25) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                    }}
                  >
                    Visual Focus
                  </button>
                </div>
              )}

              {project && activeCrossProbeSignal && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
                  padding: "4px 10px",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  transition: "all 0.15s ease"
                }}
              >
                <Search size={12} color="var(--accent-blue)" />
                <span>Omnibar</span>
                <kbd
                  style={{
                    fontSize: 10,
                    padding: "1px 5px",
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
                      height: 38,
                      backgroundColor: "var(--bg-secondary)",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 10px",
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <button
                        onClick={() => setSplitActiveVisualizer("schematic")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: splitActiveVisualizer === "schematic" ? 700 : 500,
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "schematic" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "schematic" ? "var(--accent-cyan)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "schematic" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer"
                        }}
                      >
                        <Cpu size={13} />
                        <span>Schematic DAG</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("virtuallab")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: splitActiveVisualizer === "virtuallab" ? 700 : 500,
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "virtuallab" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "virtuallab" ? "var(--accent-amber)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "virtuallab" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer"
                        }}
                      >
                        <Sliders size={13} />
                        <span>Virtual Lab</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("waveform")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: splitActiveVisualizer === "waveform" ? 700 : 500,
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "waveform" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "waveform" ? "var(--accent-blue)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "waveform" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer"
                        }}
                      >
                        <Activity size={13} />
                        <span>Waveforms</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("timing")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: splitActiveVisualizer === "timing" ? 700 : 500,
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "timing" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "timing" ? "var(--accent-purple)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "timing" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer"
                        }}
                      >
                        <Clock size={13} />
                        <span>Timing & Energy</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Optional Waveforms Stack Toggle */}
                      {splitActiveVisualizer !== "waveform" && (
                        <button
                          onClick={() => setSplitStackWaveform((prev) => !prev)}
                          title="Toggle stacked Waveforms viewer on top"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: splitStackWaveform ? 600 : 400,
                            backgroundColor: splitStackWaveform ? "rgba(59, 130, 246, 0.2)" : "var(--bg-tertiary)",
                            border: `1px solid ${splitStackWaveform ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                            color: splitStackWaveform ? "var(--accent-blue)" : "var(--text-muted)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer"
                          }}
                        >
                          <Activity size={12} />
                          <span>+ Waveforms</span>
                        </button>
                      )}

                      {/* Maximize Active Visualizer */}
                      <button
                        onClick={() => toggleMaximizePanel(splitActiveVisualizer)}
                        title={`Maximize ${splitActiveVisualizer} to 100%`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: 11
                        }}
                      >
                        <Maximize2 size={12} />
                        <span>Maximize</span>
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
