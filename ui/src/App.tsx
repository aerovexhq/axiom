import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Activity, Cpu, Sliders, Clock, Maximize2, Boxes, Layers, Gauge, Box, Workflow, Radio, ShieldCheck } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { HdlEditor } from "./components/HdlEditor";
import { WaveformViewer } from "./components/WaveformViewer";
import { SchematicViewer } from "./components/SchematicViewer";
import { FsmViewer } from "./components/FsmViewer";
import { PackageVisualizer } from "./components/PackageVisualizer";
import { MicroarchViewer } from "./components/MicroarchViewer";
import { MultiDieViewer } from "./components/MultiDieViewer";
import { PpaParetoViewer } from "./components/PpaParetoViewer";
import { ProtocolAnalyzer } from "./components/ProtocolAnalyzer";
import { TechMappingViewer } from "./components/TechMappingViewer";
import { FormalVerificationViewer } from "./components/FormalVerificationViewer";
import { VirtualLabRack } from "./components/VirtualLabRack";
import { TimingRadarViewer } from "./components/TimingRadarViewer";
import { UnifiedBottomDock } from "./components/UnifiedBottomDock";
import { OmnibarModal } from "./components/OmnibarModal";
import { NewProjectModal } from "./components/NewProjectModal";
import { AddSourceModal } from "./components/AddSourceModal";
import { AutoPipelineModal } from "./components/AutoPipelineModal";
import { WelcomeLaunchpad } from "./components/WelcomeLaunchpad";
import { ResizableSplitter } from "./components/ResizableSplitter";
import { MobileDrawer, MobilePanelType } from "./components/MobileDrawer";
import { MobileBottomBar } from "./components/MobileBottomBar";
import { WindowFrame } from "./components/WindowFrame";
import { UpdatePromptModal } from "./components/UpdatePromptModal";
import { AboutModal } from "./components/AboutModal";
import { ProtocolDecoderModal } from "./components/ProtocolDecoderModal";
import { LabGraderModal } from "./components/LabGraderModal";
import { checkForUpdates, ReleaseManifest } from "./engine/updateChecker";
import { isDesktop } from "./engine/platform";
import { scheduleAutoSave, isAutoSaveEnabled, notifySaveState } from "./engine/autoSaveManager";
import { engineBridge, SimulationState, LspDiagnostic } from "./engine/engineBridge";
import {
  AutoPipelineRecommendation,
  evaluateAutoPipelineFromPath
} from "./engine/autoPipelineModel";
import { TimingPath } from "./engine/timingModel";
import {
  AxiomProject,
  ProjectFile,
  FileSetType,
  PROJECT_TEMPLATES,
  createProjectFromTemplate,
  bundleProjectSources,
  updateFileContent,
  addFileToProject,
  addFilesToProject,
  loadSavedProject,
  saveProjectToStorage,
  clearSavedProject
} from "./engine/projectModel";
import {
  ProjectMetadata,
  loadProjectRegistry,
  syncRegistryFromFs,
  createAndPersistProject,
  loadProjectById,
  trashProject,
  restoreProject,
  permanentDeleteProject,
  emptyTrash
} from "./engine/projectRegistry";
import { sessionBroadcaster } from "./engine/sessionSync";
import { toast } from "./engine/toast";
import { ToastContainer, ConfirmDialogContainer } from "./components/ui";
import { SampleDesign } from "./engine/sampleDesigns";

// URL Project Query Parameter Routing (?project=unique_name)
function getUrlProjectSlug(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("project");
}

function setUrlProjectSlug(slug: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (slug) {
    url.searchParams.set("project", slug);
  } else {
    url.searchParams.delete("project");
  }
  window.history.pushState({}, "", url.toString());
}

function getInitialProject(): AxiomProject | null {
  const slug = getUrlProjectSlug();
  if (!slug) {
    // When visiting without ?project=... (e.g. fresh http://localhost:3000/ or /studio/), start cleanly in Main Menu
    return null;
  }
  const registry = loadProjectRegistry();
  const meta = registry.find((p) => p.id === slug && !p.isTrashed);
  if (meta) {
    try {
      const cached = localStorage.getItem(`axiom_project_${slug}`);
      if (cached) {
        const parsed = JSON.parse(cached) as AxiomProject;
        if (parsed && parsed.files && parsed.files.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  const saved = loadSavedProject();
  if (saved && (saved.name === slug || saved.id === slug) && !registry.find((p) => p.id === slug)?.isTrashed) {
    return saved;
  }
  // Disallow temporary phantom projects: if slug is not found or is in trash, clean URL
  setUrlProjectSlug(null);
  return null;
}

export const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>(engineBridge.getState());
  const [project, setProject] = useState<AxiomProject | null>(() => getInitialProject());
  const [centerView, setCenterView] = useState<"waveform" | "schematic" | "fsm" | "virtuallab" | "timing" | "microarch" | "multidie" | "ppa" | "package" | "protocol" | "techmapping" | "formal" | "split">("split");
  const [maximizedPanel, setMaximizedPanel] = useState<"editor" | "waveform" | "schematic" | "fsm" | "virtuallab" | "timing" | "microarch" | "multidie" | "ppa" | "package" | "protocol" | "techmapping" | "formal" | null>(null);

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
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("axiom_sidebar_width");
    return saved ? Math.max(220, Math.min(500, parseInt(saved, 10))) : 285;
  });
  const [isOmnibarOpen, setIsOmnibarOpen] = useState<boolean>(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false);
  const [newProjectInitialTemplateId, setNewProjectInitialTemplateId] = useState<string>("logic_circuit_project");
  const [projects, setProjects] = useState<ProjectMetadata[]>(() => loadProjectRegistry());
  const [isAddSourceOpen, setIsAddSourceOpen] = useState<boolean>(false);
  const [addSourceInitialFileSet, setAddSourceInitialFileSet] = useState<FileSetType | undefined>(undefined);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [isAutoPipelineOpen, setIsAutoPipelineOpen] = useState<boolean>(false);
  const [autoPipelineRec, setAutoPipelineRec] = useState<AutoPipelineRecommendation | null>(null);
  const [timingSlackPs, setTimingSlackPs] = useState<number | null>(null);
  const [predictedFmaxGainMhz, setPredictedFmaxGainMhz] = useState<number | null>(null);

  // New Modals: Protocol Decoder, About, Software Update Prompt, and Lab Grader
  const [isProtocolDecoderOpen, setIsProtocolDecoderOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isUpdatePromptOpen, setIsUpdatePromptOpen] = useState<boolean>(false);
  const [isLabGraderOpen, setIsLabGraderOpen] = useState<boolean>(false);
  const [updateManifest, setUpdateManifest] = useState<ReleaseManifest | null>(null);
  const [updateCurrentCommit, setUpdateCurrentCommit] = useState<string>("a9a90cc");

  // Non-blocking auto-update check on desktop app startup only (disabled on web)
  useEffect(() => {
    if (!isDesktop()) return;
    checkForUpdates().then((res) => {
      if (res.updateAvailable && res.latestManifest) {
        setUpdateManifest(res.latestManifest);
        setUpdateCurrentCommit(res.currentCommit);
        const dismissed = sessionStorage.getItem(`axiom_update_dismissed_${res.latestManifest.shortCommit}`);
        if (!dismissed) {
          setIsUpdatePromptOpen(true);
        }
      }
    });
  }, []);

  const handleManualCheckUpdates = async () => {
    if (!isDesktop()) return;
    toast.info("Checking for Axiom EDA updates...");
    const res = await checkForUpdates();
    if (res.updateAvailable && res.latestManifest) {
      setUpdateManifest(res.latestManifest);
      setUpdateCurrentCommit(res.currentCommit);
      setIsUpdatePromptOpen(true);
    } else {
      toast.success(`Axiom EDA is up to date! (Build: ${res.currentCommit})`);
    }
  };

  const handleOpenAddSource = (fileSet?: FileSetType) => {
    setAddSourceInitialFileSet(fileSet);
    setIsAddSourceOpen(true);
  };

  // Multi-session cross-tab / cross-window real-time synchronization
  useEffect(() => {
    // Initial sync from filesystem
    syncRegistryFromFs().then((list) => {
      setProjects(list);
    });

    const unsubscribe = sessionBroadcaster.subscribe((event) => {
      if (
        event.type === "REGISTRY_UPDATED" ||
        event.type === "PROJECT_TRASHED" ||
        event.type === "PROJECT_DELETED"
      ) {
        syncRegistryFromFs().then((list) => {
          setProjects(list);
        });
      }

      if (
        event.type === "PROJECT_SAVED" &&
        event.projectId &&
        project &&
        project.id === event.projectId
      ) {
        // Current project was updated from another window/tab, sync latest state
        loadProjectById(project.id).then((updated) => {
          if (updated) {
            setProject(updated);
            setIsSaved(true);
          }
        });
      }
    });

    return unsubscribe;
  }, [project]);

  // Manual save handler
  const handleSaveProject = useCallback(() => {
    if (!project) return;
    saveProjectToStorage(project);
    setIsSaved(true);
    notifySaveState(true);
    toast.success(`Project "${project.name}" saved.`);
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

  // Active Design / Module ID for Hardware DAG & Visualizers
  const activeDesignId = useMemo(() => {
    return project?.templateId ?? project?.topModule ?? "";
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

    if (isAutoSaveEnabled()) {
      setIsSaved(false);
      notifySaveState(false);
      scheduleAutoSave(() => {
        saveProjectToStorage(updated);
        setIsSaved(true);
        notifySaveState(true);
      }, 800);
    } else {
      setIsSaved(false);
      notifySaveState(false);
    }
  };

  const handleSelectFile = (fileId: string) => {
    if (!project) return;
    const updated: AxiomProject = {
      ...project,
      activeFileId: fileId,
      openFileIds: project.openFileIds.includes(fileId) ? project.openFileIds : [...project.openFileIds, fileId],
      updatedAt: new Date().toISOString()
    };
    setProject(updated);
    saveProjectToStorage(updated);
  };

  const handleCloseTab = (fileId: string) => {
    if (!project) return;
    const remainingOpenIds = project.openFileIds.filter((id) => id !== fileId);
    const fallbackId = remainingOpenIds.length > 0 ? remainingOpenIds[0] : project.files[0]?.id ?? "";
    const updated: AxiomProject = {
      ...project,
      openFileIds: remainingOpenIds.length > 0 ? remainingOpenIds : [fallbackId],
      activeFileId: project.activeFileId === fileId ? fallbackId : project.activeFileId,
      updatedAt: new Date().toISOString()
    };
    setProject(updated);
    saveProjectToStorage(updated);
  };

  const handleAddSource = (file: Omit<ProjectFile, "id">) => {
    if (!project) return;
    const { project: updated } = addFileToProject(project, file);
    setProject(updated);
    saveProjectToStorage(updated);
    const bundled = bundleProjectSources(updated);
    engineBridge.compile(bundled, updated.topModule);
  };

  const handleAddSources = (files: Omit<ProjectFile, "id">[]) => {
    if (!project || files.length === 0) return;
    const { project: updated } = addFilesToProject(project, files);
    setProject(updated);
    saveProjectToStorage(updated);
    const bundled = bundleProjectSources(updated);
    engineBridge.compile(bundled, updated.topModule);
  };

  // Evaluate timing slack for Silicon Copilot recommendation banner
  useEffect(() => {
    if (!project) {
      setTimingSlackPs(null);
      setPredictedFmaxGainMhz(null);
      return;
    }
    const designFiles = project.files.filter((f) => f.fileSet === "sources_1");
    const constrFiles = project.files.filter((f) => f.fileSet === "constrs_1");
    const verilogCode = designFiles.map((f) => f.content).join("\n\n");
    const xdcCode = constrFiles.map((f) => f.content).join("\n\n");
    if (!verilogCode.trim()) return;

    let cancelled = false;
    engineBridge
      .runSta(verilogCode, xdcCode, project.topModule)
      .then((res) => {
        if (cancelled || !res) return;
        const wns = typeof res.worst_negative_slack_ps === "number" ? res.worst_negative_slack_ps : 0;
        setTimingSlackPs(wns);
        if (wns < 0) {
          engineBridge
            .recommendPipeline(verilogCode, xdcCode, project.topModule)
            .then((rec) => {
              if (cancelled || !rec) return;
              setAutoPipelineRec(rec);
              if (rec.optimal_cut) {
                setPredictedFmaxGainMhz(rec.optimal_cut.fmax_gain_mhz);
              }
            })
            .catch(() => {});
        } else {
          setPredictedFmaxGainMhz(null);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [project?.files, project?.topModule]);

  const handleOpenAutoPipeline = useCallback(
    async (pathOrCone?: any) => {
      if (!project) return;
      const designFiles = project.files.filter((f) => f.fileSet === "sources_1");
      const constrFiles = project.files.filter((f) => f.fileSet === "constrs_1");
      const verilogCode = designFiles.map((f) => f.content).join("\n\n");
      const xdcCode = constrFiles.map((f) => f.content).join("\n\n");
      const topModule = project.topModule || state.topModule;

      try {
        const rec = await engineBridge.recommendPipeline(verilogCode, xdcCode, topModule);
        if (rec) {
          setAutoPipelineRec(rec);
          setIsAutoPipelineOpen(true);
          return;
        }
      } catch (e) {
        console.warn("[App] recommendPipeline fallback to model:", e);
      }

      const currentCode = activeFile?.content || verilogCode;
      const targetPath: TimingPath =
        pathOrCone && pathOrCone.slackPs !== undefined
          ? {
              id: "critical_path",
              startPoint: pathOrCone.targetId || "launch_ff",
              endPoint: pathOrCone.targetId ? `${pathOrCone.targetId}_out` : "capture_ff",
              clockDomain: "clk",
              slackPs: pathOrCone.slackPs ?? -850,
              requiredTimePs: 10000,
              arrivalTimePs: 10850,
              dataDelayPs: pathOrCone.totalDelayPs ?? 1850,
              logicDelayPs: 1100,
              netDelayPs: 750,
              logicLevels: pathOrCone.maxDepth ?? 3,
              segments: [],
              status: "violated"
            }
          : {
              id: "critical_path",
              startPoint: "data_reg",
              endPoint: "result_reg",
              clockDomain: "clk",
              slackPs: -850,
              requiredTimePs: 10000,
              arrivalTimePs: 10850,
              dataDelayPs: 1850,
              logicDelayPs: 1100,
              netDelayPs: 750,
              logicLevels: 3,
              segments: [],
              status: "violated"
            };

      const fallbackRec = evaluateAutoPipelineFromPath(targetPath, 10.0, currentCode);
      setAutoPipelineRec(fallbackRec);
      setIsAutoPipelineOpen(true);
    },
    [project, state.topModule, activeFile]
  );

  const handleApplyPipeline = useCallback(
    async (cutNet: string, clockName: string, resetName?: string) => {
      if (!project || !activeFile) return;
      try {
        const res = await engineBridge.applyPipeline(
          activeFile.content,
          project.topModule,
          cutNet,
          clockName,
          resetName
        );
        if (res && res.refactored_code) {
          handleCodeChange(res.refactored_code);
          toast.success(`Silicon Copilot: Inserted pipeline register stage at '${cutNet}' (+1 cycle)`);
          handleCompile();
        }
      } catch (e) {
        toast.error(`Auto-pipeline failed: ${e}`);
      }
    },
    [project, activeFile, handleCodeChange, handleCompile]
  );

  const handleCloseProject = useCallback(() => {
    setUrlProjectSlug(null);
    setProject(null);
    clearSavedProject();
    engineBridge.reset();
  }, []);

  const handleOpenNewProject = useCallback((templateId?: string) => {
    if (templateId) {
      setNewProjectInitialTemplateId(templateId);
    }
    setIsNewProjectOpen(true);
  }, []);

  const handleCreateProject = useCallback(async (newProj: AxiomProject) => {
    // If files exist and activeFileId is not set, default to first file
    if (newProj.files.length > 0 && !newProj.activeFileId) {
      newProj.activeFileId = newProj.files[0].id;
      newProj.openFileIds = [newProj.files[0].id];
    }

    const slug = newProj.id;
    setUrlProjectSlug(slug);
    setProject(newProj);
    await createAndPersistProject(newProj);
    setProjects(loadProjectRegistry());
    setIsSaved(true);
    notifySaveState(true);

    if (newProj.files.length > 0 && newProj.topModule) {
      const bundled = bundleProjectSources(newProj);
      engineBridge.compile(bundled, newProj.topModule);

      // Auto-select signals
      const sigIds = new Set<string>();
      engineBridge.getState().signals.forEach((s) => {
        sigIds.add(s.id);
        sigIds.add(s.fullName);
      });
      setSelectedSignalIds(sigIds);
    }
  }, []);

  const handleSelectTemplate = useCallback(
    async (templateId: string, lessonId?: string) => {
      if (templateId === "class_examples_project") {
        const registry = loadProjectRegistry();
        const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
        const selectedLesson =
          template?.lessons?.find((l) => l.id === lessonId) ?? template?.lessons?.[0];
        const baseName = selectedLesson ? selectedLesson.defaultTopModule : "uygulama_0";

        let projName = baseName;
        let counter = 1;
        const existingNames = new Set(registry.map((p) => p.name.toLowerCase()));
        while (existingNames.has(projName.toLowerCase())) {
          projName = `${baseName}_${counter}`;
          counter++;
        }

        const newProj = createProjectFromTemplate(templateId, projName, undefined, lessonId);
        await handleCreateProject(newProj);
        toast.success(
          `Created project "${newProj.name}" (${selectedLesson?.title ?? "Lesson 1"})`
        );
        return;
      }
      handleOpenNewProject(templateId);
    },
    [handleCreateProject, handleOpenNewProject]
  );

  const handleOpenProjectById = useCallback(async (id: string) => {
    const registry = loadProjectRegistry();
    const meta = registry.find((p) => p.id === id);
    if (meta?.isTrashed) {
      toast.warning(`Cannot open "${meta.name}" because it is in Trash. Restore it first.`);
      return;
    }

    const loaded = await loadProjectById(id);
    if (loaded) {
      setUrlProjectSlug(loaded.id);
      setProject(loaded);
      saveProjectToStorage(loaded);
      setIsSaved(true);
      const bundled = bundleProjectSources(loaded);
      engineBridge.compile(bundled, loaded.topModule);

      const sigIds = new Set<string>();
      engineBridge.getState().signals.forEach((s) => {
        sigIds.add(s.id);
        sigIds.add(s.fullName);
      });
      setSelectedSignalIds(sigIds);
    }
  }, []);

  const handleTrashProject = useCallback(async (id: string) => {
    await trashProject(id);
    setProjects(loadProjectRegistry());
    if (project && project.id === id) {
      handleCloseProject();
    }
  }, [project, handleCloseProject]);

  const handleRestoreProject = useCallback(async (id: string) => {
    await restoreProject(id);
    setProjects(loadProjectRegistry());
  }, []);

  const handlePermanentDeleteProject = useCallback(async (id: string) => {
    await permanentDeleteProject(id);
    setProjects(loadProjectRegistry());
    if (project && project.id === id) {
      handleCloseProject();
    }
  }, [project, handleCloseProject]);

  const handleEmptyTrash = useCallback(async () => {
    await emptyTrash();
    setProjects(loadProjectRegistry());
  }, []);

  // Browser back/forward navigation sync
  useEffect(() => {
    const handlePopState = () => {
      const slug = getUrlProjectSlug();
      if (!slug) {
        setProject(null);
        engineBridge.reset();
      } else {
        const registry = loadProjectRegistry();
        const meta = registry.find((p) => p.id === slug && !p.isTrashed);
        if (meta) {
          loadProjectById(slug).then((loaded) => {
            if (loaded) {
              setProject(loaded);
              const bundled = bundleProjectSources(loaded);
              engineBridge.compile(bundled, loaded.topModule);
            } else {
              setProject(null);
              setUrlProjectSlug(null);
              engineBridge.reset();
            }
          });
        } else {
          setProject(null);
          setUrlProjectSlug(null);
          engineBridge.reset();
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleImportProjectJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr) as AxiomProject;
      if (parsed && parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        handleCreateProject(parsed);
        toast.success(`Imported project "${parsed.name}" successfully`);
      } else {
        toast.error("Invalid project JSON: Missing valid files array.");
      }
    } catch (err) {
      toast.error("Failed to parse project JSON: " + String(err));
    }
  };

  const handleSelectDesign = (design: SampleDesign) => {
    const tmpl = PROJECT_TEMPLATES.find((t) => t.id === design.id || t.defaultTopModule === design.topModule);
    if (tmpl) {
      handleOpenNewProject(tmpl.id);
    } else {
      handleOpenNewProject("logic_circuit_project");
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
  const [splitActiveVisualizer, setSplitActiveVisualizer] = useState<"schematic" | "fsm" | "package" | "microarch" | "virtuallab" | "waveform" | "timing" | "multidie" | "ppa" | "protocol" | "techmapping" | "formal">("schematic");
  const [splitStackWaveform, setSplitStackWaveform] = useState<boolean>(false);
  const [splitWaveformHeightPercent, setSplitWaveformHeightPercent] = useState<number>(42);

  const handleSidebarResize = useCallback((deltaPx: number) => {
    setSidebarWidth((prev) => {
      const next = Math.max(220, Math.min(500, Math.round(prev + deltaPx)));
      localStorage.setItem("axiom_sidebar_width", String(next));
      return next;
    });
  }, []);

  const handleEditorResize = useCallback((deltaPx: number) => {
    const totalWidth = window.innerWidth - (isSidebarCollapsed ? 38 : sidebarWidth);
    if (totalWidth <= 0) return;
    const deltaPct = (deltaPx / totalWidth) * 100;
    setEditorWidthPercent((prev) => Math.max(18, Math.min(75, Math.round((prev + deltaPct) * 10) / 10)));
  }, [isSidebarCollapsed, sidebarWidth]);

  const handleWaveformHeightResize = useCallback((deltaPx: number) => {
    const totalHeight = window.innerHeight - 200;
    if (totalHeight <= 0) return;
    const deltaPct = (deltaPx / totalHeight) * 100;
    setSplitWaveformHeightPercent((prev) => Math.max(20, Math.min(80, Math.round((prev + deltaPct) * 10) / 10)));
  }, []);

  // Maximize panel helper
  const toggleMaximizePanel = (panel: "editor" | "waveform" | "schematic" | "fsm" | "package" | "microarch" | "virtuallab" | "timing" | "multidie" | "ppa" | "protocol" | "techmapping" | "formal") => {
    setMaximizedPanel((prev) => (prev === panel ? null : panel));
  };

  // Insert formal SVA assertion into active file
  const handleInsertAssertion = useCallback((snippet: string) => {
    if (!project || !activeFile) return;
    const content = activeFile.content;
    const endModuleIdx = content.lastIndexOf("endmodule");
    let newCode: string;
    if (endModuleIdx !== -1) {
      newCode = content.slice(0, endModuleIdx) + `  // Formal SVA Assertion\n  ${snippet}\n\n` + content.slice(endModuleIdx);
    } else {
      newCode = content + `\n\n// Formal SVA Assertion\n${snippet}\n`;
    }
    handleCodeChange(newCode);
    toast.success("Inserted assertion into design source");
  }, [project, activeFile, handleCodeChange]);

  // Synchronize constraints from PackageVisualizer back to project XDC
  const handleUpdateXdc = useCallback((newXdc: string) => {
    if (!project) return;
    const constrFile = project.files.find((f) => f.fileSet === "constrs_1");
    if (!constrFile) {
      const newFile: ProjectFile = {
        id: `file_${Date.now()}`,
        name: "pins.xdc",
        fileType: "xdc",
        fileSet: "constrs_1",
        content: newXdc
      };
      const updated: AxiomProject = {
        ...project,
        files: [...project.files, newFile]
      };
      setProject(updated);
      saveProjectToStorage(updated);
      return;
    }
    const updated = updateFileContent(project, constrFile.id, newXdc);
    setProject(updated);
    saveProjectToStorage(updated);
  }, [project]);

  return (
    <div className="axiom-app">
      {/* Universal Desktop & Web Acrylic Window Frame & Application Menu */}
      {!isMobile && (
        <WindowFrame
          project={project}
          isSimRunning={state.isRunning}
          isSaved={isSaved}
          onOpenNewProject={() => handleOpenNewProject()}
          onOpenProjectFile={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                  const content = re.target?.result as string;
                  handleImportProjectJson(content);
                };
                reader.readAsText(file);
              }
            };
            input.click();
          }}
          onCloseProject={handleCloseProject}
          onSaveFile={handleSaveProject}
          onSaveAll={handleSaveProject}
          onAddSources={() => handleOpenAddSource()}
          onExportProjectJson={handleExportProjectJson}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onToggleBottomDock={() => {
            const dock = document.querySelector(".axiom-bottom-dock");
            if (dock) {
              dock.scrollIntoView({ behavior: "smooth" });
            }
          }}
          onSwitchVisualizer={(view) => {
            setCenterView("split");
            setSplitActiveVisualizer(view);
          }}
          onRunSimulation={() => engineBridge.play()}
          onPauseSimulation={() => engineBridge.pause()}
          onStep1ns={() => engineBridge.tick(1000)}
          onStep100ps={() => engineBridge.tick(100)}
          onStepDelta={() => engineBridge.stepDelta()}
          onResetSimulation={() => engineBridge.reset()}
          onCompile={handleCompile}
          onOpenAutoPipeline={() => handleOpenAutoPipeline()}
          onOpenProtocolDecoder={() => setIsProtocolDecoderOpen(true)}
          onOpenOmnibar={() => setIsOmnibarOpen(true)}
          onCheckForUpdates={handleManualCheckUpdates}
          onOpenAbout={() => setIsAboutOpen(true)}
        />
      )}

      {/* Simulation Execution & Status Header (Active project or mobile) */}
      {(project || isMobile) && (
        <Header
          state={state}
          onCompile={handleCompile}
          project={project}
          onOpenNewProject={() => handleOpenNewProject()}
          onCloseProject={handleCloseProject}
          onSaveProject={handleSaveProject}
          onExportProjectJson={handleExportProjectJson}
          onOpenAddSource={() => handleOpenAddSource()}
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
          onOpenLabGrader={() => setIsLabGraderOpen(true)}
          isSplitView={centerView === "split"}
        />
      )}

      {/* Mobile Off-Canvas Left Drawer */}
      {isMobile && (
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
            handleOpenAddSource();
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
      )}

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
              onOpenNewProject={handleOpenNewProject}
              onSelectTemplate={(tmplId, lessonId) => {
                handleSelectTemplate(tmplId, lessonId);
                setActiveMobilePanel("editor");
              }}
              onImportProjectJson={handleImportProjectJson}
              projects={projects}
              onOpenProject={(id) => {
                handleOpenProjectById(id);
                setActiveMobilePanel("editor");
              }}
              onTrashProject={handleTrashProject}
              onRestoreProject={handleRestoreProject}
              onPermanentDeleteProject={handlePermanentDeleteProject}
              onEmptyTrash={handleEmptyTrash}
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
                onOpenAutoPipeline={() => handleOpenAutoPipeline()}
                timingSlackPs={timingSlackPs}
                predictedFmaxGainMhz={predictedFmaxGainMhz}
              />
            </div>
          ) : activeMobilePanel === "schematic" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <SchematicViewer
                state={state}
                activeDesignId={activeDesignId}
                selectedSignalId={activeCrossProbeSignal}
                onSelectSignal={handleSchematicSelectSignal}
                onOpenAutoPipeline={handleOpenAutoPipeline}
                onJumpToCode={(line) => {
                  handleJumpToCode(line, line);
                  setActiveMobilePanel("editor");
                }}
              />
            </div>
          ) : activeMobilePanel === "fsm" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <FsmViewer
                state={state}
                activeDesignId={activeDesignId}
                verilogSource={activeFile?.content}
                onSelectSignal={handleSchematicSelectSignal}
                onOpenAutoPipeline={handleOpenAutoPipeline}
                onJumpToCode={(line) => {
                  handleJumpToCode(line, line);
                  setActiveMobilePanel("editor");
                }}
              />
            </div>
          ) : activeMobilePanel === "package" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <PackageVisualizer
                project={project}
                verilogSource={activeFile?.content}
                xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                activeDesignId={activeDesignId}
                onUpdateXdc={handleUpdateXdc}
                onNavigateToLine={(line) => {
                  handleJumpToCode(line, line);
                  setActiveMobilePanel("editor");
                }}
              />
            </div>
          ) : activeMobilePanel === "microarch" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <MicroarchViewer
                state={state}
                activeDesignId={activeDesignId}
                verilogSource={activeFile?.content}
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
                activeDesignId={activeDesignId}
                project={project}
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
                activeDesignId={activeDesignId}
                project={project}
                onCrossProbe={(sig) => {
                  handleSchematicSelectSignal(sig);
                  setActiveMobilePanel("schematic");
                }}
                onNavigateToLine={(line) => {
                  setHighlightLineSpan({ lineStart: line, lineEnd: line });
                  setActiveMobilePanel("editor");
                }}
                onOpenAutoPipeline={handleOpenAutoPipeline}
              />
            </div>
          ) : activeMobilePanel === "multidie" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <MultiDieViewer
                state={state}
                activeDesignId={activeDesignId}
                verilogSource={activeFile?.content}
                targetDevice={project.targetDevice}
                onSelectSignal={(sig) => {
                  handleSchematicSelectSignal(sig);
                  setActiveMobilePanel("schematic");
                }}
                onJumpToCode={(lineStart, lineEnd) => {
                  handleJumpToCode(lineStart, lineEnd);
                  setActiveMobilePanel("editor");
                }}
              />
            </div>
          ) : activeMobilePanel === "ppa" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <PpaParetoViewer
                state={state}
                activeDesignId={activeDesignId}
                verilogSource={activeFile?.content}
                xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                targetDevice={project.targetDevice}
                onSelectDevice={(dev) => {
                  setProject((prev) => prev ? { ...prev, targetDevice: dev } : null);
                }}
                onJumpToCode={(lineStart, lineEnd) => {
                  handleJumpToCode(lineStart, lineEnd);
                  setActiveMobilePanel("editor");
                }}
              />
            </div>
          ) : activeMobilePanel === "protocol" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <ProtocolAnalyzer
                state={state}
                activeDesignId={activeDesignId}
              />
            </div>
          ) : activeMobilePanel === "techmapping" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <TechMappingViewer
                activeDesignId={activeDesignId}
                topModule={project?.topModule}
                sourceCode={activeFile?.content ?? ""}
                targetDevice={project?.targetDevice}
                onDeviceChange={(dev) => {
                  setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
                }}
              />
            </div>
          ) : activeMobilePanel === "formal" ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <FormalVerificationViewer
                sourceCode={activeFile?.content ?? ""}
                topModule={project?.topModule}
                onNavigateToWaveform={() => setActiveMobilePanel("waveform")}
                onInsertAssertion={handleInsertAssertion}
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
                activeDesignId={activeDesignId}
                targetDevice={project?.targetDevice}
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
          onOpenAddSource={handleOpenAddSource}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          onCloseProject={handleCloseProject}
          onSelectTemplate={handleSelectTemplate}
          onSelectFile={handleSelectFile}
          selectedSignalIds={selectedSignalIds}
          onToggleSignal={handleToggleSignal}
          activeCrossProbeSignal={activeCrossProbeSignal}
          onSelectCrossProbeSignal={handleSchematicSelectSignal}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          width={sidebarWidth}
        />

        {/* Resizable Divider: Sidebar <-> Center Workspace */}
        {!isSidebarCollapsed && (
          <ResizableSplitter
            orientation="horizontal"
            onResize={handleSidebarResize}
            onDoubleClick={() => {
              setSidebarWidth(285);
              localStorage.setItem("axiom_sidebar_width", "285");
            }}
          />
        )}

        {/* Center Simulation Workspace */}
        <div className="axiom-center">
          {/* Upper Workspace: View Depending on Mode or Panel Maximization */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", position: "relative" }}>
            {!project ? (
              <WelcomeLaunchpad
                onOpenNewProject={handleOpenNewProject}
                onSelectTemplate={handleSelectTemplate}
                onImportProjectJson={handleImportProjectJson}
                projects={projects}
                onOpenProject={handleOpenProjectById}
                onTrashProject={handleTrashProject}
                onRestoreProject={handleRestoreProject}
                onPermanentDeleteProject={handlePermanentDeleteProject}
                onEmptyTrash={handleEmptyTrash}
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
                  onOpenAutoPipeline={handleOpenAutoPipeline}
                  timingSlackPs={timingSlackPs}
                  predictedFmaxGainMhz={predictedFmaxGainMhz}
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
                  activeDesignId={activeDesignId}
                  selectedSignalId={activeCrossProbeSignal}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                  onOpenAutoPipeline={handleOpenAutoPipeline}
                />
              </div>
            ) : maximizedPanel === "fsm" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <FsmViewer
                  state={state}
                  activeDesignId={activeDesignId}
                  verilogSource={activeFile?.content}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                  onOpenAutoPipeline={handleOpenAutoPipeline}
                />
              </div>
            ) : maximizedPanel === "package" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <PackageVisualizer
                  project={project}
                  verilogSource={activeFile?.content}
                  xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                  activeDesignId={activeDesignId}
                  onUpdateXdc={handleUpdateXdc}
                  onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                />
              </div>
            ) : maximizedPanel === "microarch" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <MicroarchViewer
                  state={state}
                  activeDesignId={activeDesignId}
                  verilogSource={activeFile?.content}
                  selectedSignalId={activeCrossProbeSignal}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                />
              </div>
            ) : maximizedPanel === "virtuallab" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <VirtualLabRack state={state} activeDesignId={activeDesignId} project={project} />
              </div>
            ) : maximizedPanel === "timing" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <TimingRadarViewer
                  state={state}
                  activeDesignId={activeDesignId}
                  project={project}
                  onCrossProbe={handleSchematicSelectSignal}
                  onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                  onOpenAutoPipeline={handleOpenAutoPipeline}
                />
              </div>
            ) : maximizedPanel === "multidie" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <MultiDieViewer
                  state={state}
                  activeDesignId={activeDesignId}
                  verilogSource={activeFile?.content}
                  targetDevice={project.targetDevice}
                  onSelectSignal={handleSchematicSelectSignal}
                  onJumpToCode={handleJumpToCode}
                />
              </div>
            ) : maximizedPanel === "ppa" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <PpaParetoViewer
                  state={state}
                  activeDesignId={activeDesignId}
                  verilogSource={activeFile?.content}
                  xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                  targetDevice={project.targetDevice}
                  onSelectDevice={(dev) => {
                    setProject((prev) => prev ? { ...prev, targetDevice: dev } : null);
                  }}
                  onJumpToCode={handleJumpToCode}
                />
              </div>
            ) : maximizedPanel === "protocol" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <ProtocolAnalyzer
                  state={state}
                  activeDesignId={activeDesignId}
                />
              </div>
            ) : maximizedPanel === "techmapping" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <TechMappingViewer
                  activeDesignId={activeDesignId}
                  topModule={project.topModule}
                  sourceCode={activeFile?.content ?? ""}
                  targetDevice={project.targetDevice}
                  onDeviceChange={(dev) => {
                    setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
                  }}
                />
              </div>
            ) : maximizedPanel === "formal" ? (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <FormalVerificationViewer
                  sourceCode={activeFile?.content ?? ""}
                  topModule={project.topModule}
                  onNavigateToWaveform={() => {
                    setMaximizedPanel(null);
                    setSplitActiveVisualizer("waveform");
                  }}
                  onInsertAssertion={handleInsertAssertion}
                />
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
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
                        onClick={() => setSplitActiveVisualizer("fsm")}
                        title="Interactive Finite State Machine (FSM) Bubble Diagram & Live State Tracker"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "fsm" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "fsm" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "fsm" ? "var(--accent-cyan)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "fsm" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Workflow size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>FSM</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("package")}
                        title="FPGA Package BGA Ball Grid & Device Floorplan (I/O Planning)"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "package" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "package" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "package" ? "var(--accent-cyan)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "package" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Box size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Package</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("microarch")}
                        title="Micro-Architectural Block Diagram Synthesis (Macro-clustering for FSMs, ALUs, RegFiles)"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "microarch" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "microarch" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "microarch" ? "var(--accent-purple, #a855f7)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "microarch" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Boxes size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Architecture</span>
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

                      <button
                        onClick={() => setSplitActiveVisualizer("multidie")}
                        title="Multi-FPGA Partitioning & Silicon Interposer Floorplan (SLRs, SLLs, Laguna Registers)"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "multidie" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "multidie" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "multidie" ? "var(--accent-cyan, #06b6d4)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "multidie" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Layers size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Multi-Die</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("ppa")}
                        title="Live PPA Pareto Frontier & Multi-Part Silicon Cost Forecaster (Power, Performance, Area, ASIC)"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "ppa" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "ppa" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "ppa" ? "var(--accent-purple, #a855f7)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "ppa" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Gauge size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>PPA</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("protocol")}
                        title="Live Hardware Protocol Analyzer & Wireshark PCAP Inspector (CAN, USB, Ethernet, UART, SPI, I2C, AXI)"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "protocol" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "protocol" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "protocol" ? "var(--accent-cyan)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "protocol" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Radio size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Protocol</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("techmapping")}
                        title="FPGA Technology Mapping, LUT Truth Tables, Primitive Synthesis & Structural Verilog Netlist"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "techmapping" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "techmapping" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "techmapping" ? "var(--accent-purple, #a855f7)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "techmapping" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <Cpu size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Tech Map</span>
                      </button>

                      <button
                        onClick={() => setSplitActiveVisualizer("formal")}
                        title="Formal Property Verification, Bounded Model Checking (BMC) & SVA Assertions"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: splitActiveVisualizer === "formal" ? 600 : 400,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: splitActiveVisualizer === "formal" ? "var(--bg-tertiary)" : "transparent",
                          color: splitActiveVisualizer === "formal" ? "var(--accent-blue, #388bfd)" : "var(--text-muted)",
                          border: splitActiveVisualizer === "formal" ? "1px solid var(--border-subtle)" : "1px solid transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        <ShieldCheck size={12} />
                        <span style={{ whiteSpace: "nowrap" }}>Formal</span>
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
                            activeDesignId={activeDesignId}
                            selectedSignalId={activeCrossProbeSignal}
                            onSelectSignal={handleSchematicSelectSignal}
                            onJumpToCode={handleJumpToCode}
                            onOpenAutoPipeline={handleOpenAutoPipeline}
                          />
                        )}
                        {splitActiveVisualizer === "fsm" && (
                          <FsmViewer
                            state={state}
                            activeDesignId={activeDesignId}
                            verilogSource={activeFile?.content}
                            onSelectSignal={handleSchematicSelectSignal}
                            onJumpToCode={handleJumpToCode}
                            onOpenAutoPipeline={handleOpenAutoPipeline}
                          />
                        )}
                        {splitActiveVisualizer === "package" && (
                          <PackageVisualizer
                            project={project}
                            verilogSource={activeFile?.content}
                            xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                            activeDesignId={activeDesignId}
                            onUpdateXdc={handleUpdateXdc}
                            onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                          />
                        )}
                        {splitActiveVisualizer === "microarch" && (
                          <MicroarchViewer
                            state={state}
                            activeDesignId={activeDesignId}
                            verilogSource={activeFile?.content}
                            selectedSignalId={activeCrossProbeSignal}
                            onSelectSignal={handleSchematicSelectSignal}
                            onJumpToCode={handleJumpToCode}
                          />
                        )}
                        {splitActiveVisualizer === "virtuallab" && (
                          <VirtualLabRack state={state} activeDesignId={activeDesignId} project={project} />
                        )}
                        {splitActiveVisualizer === "timing" && (
                          <TimingRadarViewer
                            state={state}
                            activeDesignId={activeDesignId}
                            project={project}
                            onCrossProbe={handleSchematicSelectSignal}
                            onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                            onOpenAutoPipeline={handleOpenAutoPipeline}
                          />
                        )}
                        {splitActiveVisualizer === "multidie" && (
                          <MultiDieViewer
                            state={state}
                            activeDesignId={activeDesignId}
                            verilogSource={activeFile?.content}
                            targetDevice={project.targetDevice}
                            onSelectSignal={handleSchematicSelectSignal}
                            onJumpToCode={handleJumpToCode}
                          />
                        )}
                        {splitActiveVisualizer === "ppa" && (
                          <PpaParetoViewer
                            state={state}
                            activeDesignId={activeDesignId}
                            verilogSource={activeFile?.content}
                            xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                            targetDevice={project.targetDevice}
                            onSelectDevice={(dev) => {
                              setProject((prev) => prev ? { ...prev, targetDevice: dev } : null);
                            }}
                            onJumpToCode={handleJumpToCode}
                          />
                        )}
                        {splitActiveVisualizer === "protocol" && (
                          <ProtocolAnalyzer
                            state={state}
                            activeDesignId={activeDesignId}
                          />
                        )}
                        {splitActiveVisualizer === "techmapping" && (
                          <TechMappingViewer
                            activeDesignId={activeDesignId}
                            topModule={project.topModule}
                            sourceCode={activeFile?.content ?? ""}
                            targetDevice={project.targetDevice}
                            onDeviceChange={(dev) => {
                              setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
                            }}
                          />
                        )}
                        {splitActiveVisualizer === "formal" && (
                          <FormalVerificationViewer
                            sourceCode={activeFile?.content ?? ""}
                            topModule={project.topModule}
                            onNavigateToWaveform={() => setSplitActiveVisualizer("waveform")}
                            onInsertAssertion={handleInsertAssertion}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                      {splitActiveVisualizer === "schematic" && (
                        <SchematicViewer
                          state={state}
                          activeDesignId={activeDesignId}
                          selectedSignalId={activeCrossProbeSignal}
                          onSelectSignal={handleSchematicSelectSignal}
                          onJumpToCode={handleJumpToCode}
                          onOpenAutoPipeline={handleOpenAutoPipeline}
                        />
                      )}
                      {splitActiveVisualizer === "fsm" && (
                        <FsmViewer
                          state={state}
                          activeDesignId={activeDesignId}
                          verilogSource={activeFile?.content}
                          onSelectSignal={handleSchematicSelectSignal}
                          onJumpToCode={handleJumpToCode}
                          onOpenAutoPipeline={handleOpenAutoPipeline}
                        />
                      )}
                      {splitActiveVisualizer === "package" && (
                        <PackageVisualizer
                          project={project}
                          verilogSource={activeFile?.content}
                          xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                          activeDesignId={activeDesignId}
                          onUpdateXdc={handleUpdateXdc}
                          onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                        />
                      )}
                      {splitActiveVisualizer === "microarch" && (
                        <MicroarchViewer
                          state={state}
                          activeDesignId={activeDesignId}
                          verilogSource={activeFile?.content}
                          selectedSignalId={activeCrossProbeSignal}
                          onSelectSignal={handleSchematicSelectSignal}
                          onJumpToCode={handleJumpToCode}
                        />
                      )}
                      {splitActiveVisualizer === "virtuallab" && (
                        <VirtualLabRack state={state} activeDesignId={activeDesignId} project={project} />
                      )}
                      {splitActiveVisualizer === "waveform" && (
                        <WaveformViewer state={state} selectedSignalIds={selectedSignalIds} />
                      )}
                      {splitActiveVisualizer === "timing" && (
                        <TimingRadarViewer
                          state={state}
                          activeDesignId={activeDesignId}
                          project={project}
                          onCrossProbe={handleSchematicSelectSignal}
                          onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                          onOpenAutoPipeline={handleOpenAutoPipeline}
                        />
                      )}
                      {splitActiveVisualizer === "multidie" && (
                        <MultiDieViewer
                          state={state}
                          activeDesignId={activeDesignId}
                          verilogSource={activeFile?.content}
                          targetDevice={project.targetDevice}
                          onSelectSignal={handleSchematicSelectSignal}
                          onJumpToCode={handleJumpToCode}
                        />
                      )}
                      {splitActiveVisualizer === "ppa" && (
                        <PpaParetoViewer
                          state={state}
                          activeDesignId={activeDesignId}
                          verilogSource={activeFile?.content}
                          xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                          targetDevice={project.targetDevice}
                          onSelectDevice={(dev) => {
                            setProject((prev) => prev ? { ...prev, targetDevice: dev } : null);
                          }}
                          onJumpToCode={handleJumpToCode}
                        />
                      )}
                      {splitActiveVisualizer === "protocol" && (
                        <ProtocolAnalyzer
                          state={state}
                          activeDesignId={activeDesignId}
                        />
                      )}
                      {splitActiveVisualizer === "techmapping" && (
                        <TechMappingViewer
                          activeDesignId={activeDesignId}
                          topModule={project.topModule}
                          sourceCode={activeFile?.content ?? ""}
                          targetDevice={project.targetDevice}
                          onDeviceChange={(dev) => {
                            setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
                          }}
                        />
                      )}
                      {splitActiveVisualizer === "formal" && (
                        <FormalVerificationViewer
                          sourceCode={activeFile?.content ?? ""}
                          topModule={project.topModule}
                          onNavigateToWaveform={() => setSplitActiveVisualizer("waveform")}
                          onInsertAssertion={handleInsertAssertion}
                        />
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
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
                    activeDesignId={activeDesignId}
                    selectedSignalId={activeCrossProbeSignal}
                    onSelectSignal={handleSchematicSelectSignal}
                    onJumpToCode={handleJumpToCode}
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                  />
                </div>
              </div>
            ) : centerView === "microarch" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <MicroarchViewer
                    state={state}
                    activeDesignId={activeDesignId}
                    verilogSource={activeFile?.content}
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <VirtualLabRack state={state} activeDesignId={activeDesignId} project={project} />
                </div>
              </div>
            ) : centerView === "multidie" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <MultiDieViewer
                    state={state}
                    activeDesignId={activeDesignId}
                    verilogSource={activeFile?.content}
                    targetDevice={project.targetDevice}
                    onSelectSignal={handleSchematicSelectSignal}
                    onJumpToCode={handleJumpToCode}
                  />
                </div>
              </div>
            ) : centerView === "ppa" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <PpaParetoViewer
                    state={state}
                    activeDesignId={activeDesignId}
                    verilogSource={activeFile?.content}
                    xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                    targetDevice={project.targetDevice}
                    onSelectDevice={(dev) => {
                      setProject((prev) => prev ? { ...prev, targetDevice: dev } : null);
                    }}
                    onJumpToCode={handleJumpToCode}
                  />
                </div>
              </div>
            ) : centerView === "package" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <PackageVisualizer
                    project={project}
                    verilogSource={activeFile?.content}
                    xdcSource={project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
                    activeDesignId={activeDesignId}
                    onUpdateXdc={handleUpdateXdc}
                    onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                  />
                </div>
              </div>
            ) : centerView === "protocol" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <ProtocolAnalyzer
                    state={state}
                    activeDesignId={activeDesignId}
                  />
                </div>
              </div>
            ) : centerView === "techmapping" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <TechMappingViewer
                    activeDesignId={activeDesignId}
                    topModule={project.topModule}
                    sourceCode={activeFile?.content ?? ""}
                    targetDevice={project.targetDevice}
                    onDeviceChange={(dev) => {
                      setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
                    }}
                  />
                </div>
              </div>
            ) : centerView === "formal" ? (
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <FormalVerificationViewer
                    sourceCode={activeFile?.content ?? ""}
                    topModule={project.topModule}
                    onNavigateToWaveform={() => setSplitActiveVisualizer("waveform")}
                    onInsertAssertion={handleInsertAssertion}
                  />
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
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                    timingSlackPs={timingSlackPs}
                    predictedFmaxGainMhz={predictedFmaxGainMhz}
                  />
                </div>
                <ResizableSplitter
                  orientation="horizontal"
                  onResize={handleEditorResize}
                  onDoubleClick={() => setEditorWidthPercent(42)}
                />
                <div style={{ flex: 1, display: "flex", minWidth: 320, overflow: "hidden" }}>
                  <TimingRadarViewer
                    state={state}
                    activeDesignId={activeDesignId}
                    project={project}
                    onCrossProbe={handleSchematicSelectSignal}
                    onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
                    onOpenAutoPipeline={handleOpenAutoPipeline}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Unified Dockable Bottom Drawer (Console, REPL, Telemetry, Glitches, Timing, Problems) */}
          <UnifiedBottomDock
            state={state}
            diagnostics={diagnostics}
            onNavigateToLine={(line) => setHighlightLineSpan({ lineStart: line, lineEnd: line })}
            activeDesignId={activeDesignId}
            targetDevice={project?.targetDevice}
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
        initialTemplateId={newProjectInitialTemplateId}
      />

      {/* Vivado Add Source File Modal */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onAddSource={handleAddSource}
        onAddSources={handleAddSources}
        initialFileSet={addSourceInitialFileSet}
      />

      {/* Silicon Copilot Auto-Pipeline Modal */}
      <AutoPipelineModal
        isOpen={isAutoPipelineOpen}
        onClose={() => setIsAutoPipelineOpen(false)}
        recommendation={autoPipelineRec}
        activeSourceCode={activeFile?.content}
        onApplyPipeline={handleApplyPipeline}
      />

      {/* Protocol Packet Decoder Modal */}
      <ProtocolDecoderModal
        isOpen={isProtocolDecoderOpen}
        onClose={() => setIsProtocolDecoderOpen(false)}
        state={state}
      />

      {/* Software Update Prompt Modal */}
      <UpdatePromptModal
        isOpen={isUpdatePromptOpen}
        onClose={() => setIsUpdatePromptOpen(false)}
        manifest={updateManifest}
        currentCommit={updateCurrentCommit}
      />

      {/* About Axiom EDA Studio Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Curriculum Lab Auto-Grader Modal */}
      <LabGraderModal
        isOpen={isLabGraderOpen}
        onClose={() => setIsLabGraderOpen(false)}
        project={project}
        diagnostics={diagnostics}
        state={state}
      />

      {/* Global Aerospace Toast & Confirmation Dialog Containers */}
      <ToastContainer />
      <ConfirmDialogContainer />
    </div>
  );
};
