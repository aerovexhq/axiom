// Axiom EDA — Tabbed Panel Leaf Host
// Renders tabs header, split actions, maximize toggle, and visualizer component

import React, { useState, useRef, useEffect } from "react";
import {
  Code2,
  Cpu,
  Activity,
  Workflow,
  Box,
  Boxes,
  Sliders,
  Clock,
  Layers,
  Gauge,
  Radio,
  ShieldCheck,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Plus,
  X,
  Layout
} from "lucide-react";
import { LayoutLeaf, LayoutViewId, LAYOUT_VIEWS_META, ALL_LAYOUT_VIEW_IDS } from "../../engine/layoutModel";
import { AxiomProject, ProjectFile } from "../../engine/projectModel";
import { SimulationState } from "../../engine/engineBridge";
import { useTranslation } from "../../i18n";
import { HdlEditor } from "../HdlEditor";
import { WaveformViewer } from "../WaveformViewer";
import { SchematicViewer } from "../SchematicViewer";
import { FsmViewer } from "../FsmViewer";
import { PackageVisualizer } from "../PackageVisualizer";
import { MicroarchViewer } from "../MicroarchViewer";
import { VirtualLabRack } from "../VirtualLabRack";
import { TimingRadarViewer } from "../TimingRadarViewer";
import { MultiDieViewer } from "../MultiDieViewer";
import { PpaParetoViewer } from "../PpaParetoViewer";
import { ProtocolAnalyzer } from "../ProtocolAnalyzer";
import { TechMappingViewer } from "../TechMappingViewer";
import { FormalVerificationViewer } from "../FormalVerificationViewer";
import { FloorplanStudioViewer } from "../FloorplanStudioViewer";

export interface VisualizerContextProps {
  project: AxiomProject;
  activeFile: ProjectFile | undefined;
  state: SimulationState;
  activeDesignId: string;
  selectedSignalIds: Set<string>;
  activeCrossProbeSignal: string | null;
  highlightLineSpan: { lineStart: number; lineEnd: number } | null;
  handleCodeChange: (newCode: string) => void;
  handleCompile: (manual: boolean) => void;
  handleSchematicSelectSignal: (sigId: string) => void;
  handleJumpToCode: (lineStart: number, lineEnd: number) => void;
  handleOpenAutoPipeline: () => void;
  handleUpdateXdc: (newXdc: string) => void;
  handleInsertAssertion: (assertionCode: string) => void;
  setProject: React.Dispatch<React.SetStateAction<AxiomProject | null>>;
  setHighlightLineSpan: React.Dispatch<React.SetStateAction<{ lineStart: number; lineEnd: number } | null>>;
  onOpenSettings?: (category?: "general" | "editor" | "simulation" | "security" | "layouts") => void;
  onOpenLayoutEditor?: () => void;
  handleSelectFile?: (fileId: string) => void;
  handleCloseTab?: (fileId: string) => void;
  onAddFileClick?: () => void;
  setDiagnostics?: (diagnostics: any[]) => void;
  timingSlackPs?: number | null;
  predictedFmaxGainMhz?: number | null;
  isCodeDirty?: boolean;
}

export interface LayoutLeafRendererProps {
  leaf: LayoutLeaf;
  isMaximized: boolean;
  context: VisualizerContextProps;
  onSelectView: (leafId: string, viewId: LayoutViewId) => void;
  onCloseTab: (leafId: string, viewId: LayoutViewId) => void;
  onAddTab: (leafId: string, viewId: LayoutViewId) => void;
  onSplitLeaf?: (leafId: string, direction: "row" | "column") => void;
  onClosePanel?: (leafId: string) => void;
  canClosePanel?: boolean;
  onToggleMaximize: (leafId: string) => void;
}

export function getViewIcon(id: LayoutViewId, size = 12) {
  switch (id) {
    case "editor":
      return <Code2 size={size} />;
    case "schematic":
      return <Cpu size={size} />;
    case "waveform":
      return <Activity size={size} />;
    case "fsm":
      return <Workflow size={size} />;
    case "package":
      return <Box size={size} />;
    case "microarch":
      return <Boxes size={size} />;
    case "virtuallab":
      return <Sliders size={size} />;
    case "timing":
      return <Clock size={size} />;
    case "multidie":
      return <Layers size={size} />;
    case "ppa":
      return <Gauge size={size} />;
    case "protocol":
      return <Radio size={size} />;
    case "techmapping":
      return <Cpu size={size} />;
    case "formal":
      return <ShieldCheck size={size} />;
    case "floorplan":
      return <LayoutGrid size={size} />;
    default:
      return <Box size={size} />;
  }
}

export const LayoutLeafRenderer: React.FC<LayoutLeafRendererProps> = ({
  leaf,
  isMaximized,
  context,
  onSelectView,
  onCloseTab,
  onAddTab,
  onClosePanel,
  canClosePanel = false,
  onToggleMaximize
}) => {
  const { t } = useTranslation();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    viewId: LayoutViewId;
    leafId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click, window resize, scroll, or Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    const handleDismiss = () => {
      setContextMenu(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [contextMenu]);

  // Close add menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddMenuOpen]);

  // Visualizers cannot dock the editor as a subtab; editor is a standalone panel
  const availableToAdd = ALL_LAYOUT_VIEW_IDS.filter((v) => v !== "editor" && !leaf.views.includes(v));

  const renderActiveView = () => {
    switch (leaf.activeViewId) {
      case "editor":
        return (
          <HdlEditor
            code={context.activeFile?.content ?? ""}
            topModule={context.project.topModule}
            onChangeCode={context.handleCodeChange}
            onCompile={() => context.handleCompile(false)}
            compiled={context.state.compiled}
            highlightLineSpan={context.highlightLineSpan}
            project={context.project}
            onSelectTab={context.handleSelectFile}
            onCloseTab={context.handleCloseTab}
            onAddFileClick={context.onAddFileClick}
            isMaximized={isMaximized}
            onToggleMaximize={() => onToggleMaximize(leaf.id)}
            onDiagnosticsChange={context.setDiagnostics}
            onOpenAutoPipeline={context.handleOpenAutoPipeline}
            timingSlackPs={context.timingSlackPs}
            predictedFmaxGainMhz={context.predictedFmaxGainMhz}
            onOpenSettings={context.onOpenSettings as any}
            isDirty={context.isCodeDirty}
          />
        );
      case "schematic":
        return (
          <SchematicViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            selectedSignalId={context.activeCrossProbeSignal}
            onSelectSignal={context.handleSchematicSelectSignal}
            onJumpToCode={context.handleJumpToCode}
            onOpenAutoPipeline={context.handleOpenAutoPipeline}
            verilogSource={context.activeFile?.content}
            topModule={context.project?.topModule}
            targetDevice={context.project?.targetDevice}
          />
        );
      case "waveform":
        return (
          <WaveformViewer
            state={context.state}
            selectedSignalIds={context.selectedSignalIds}
          />
        );
      case "fsm":
        return (
          <FsmViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            verilogSource={context.activeFile?.content}
            onSelectSignal={context.handleSchematicSelectSignal}
            onJumpToCode={context.handleJumpToCode}
            onOpenAutoPipeline={context.handleOpenAutoPipeline}
          />
        );
      case "package":
        return (
          <PackageVisualizer
            project={context.project}
            verilogSource={context.activeFile?.content}
            xdcSource={context.project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
            activeDesignId={context.activeDesignId}
            onUpdateXdc={context.handleUpdateXdc}
            onNavigateToLine={(line) => context.setHighlightLineSpan({ lineStart: line, lineEnd: line })}
          />
        );
      case "microarch":
        return (
          <MicroarchViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            verilogSource={context.activeFile?.content}
            selectedSignalId={context.activeCrossProbeSignal}
            onSelectSignal={context.handleSchematicSelectSignal}
            onJumpToCode={context.handleJumpToCode}
          />
        );
      case "virtuallab":
        return (
          <VirtualLabRack
            state={context.state}
            activeDesignId={context.activeDesignId}
            project={context.project}
          />
        );
      case "timing":
        return (
          <TimingRadarViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            project={context.project}
            onCrossProbe={context.handleSchematicSelectSignal}
            onNavigateToLine={(line) => context.setHighlightLineSpan({ lineStart: line, lineEnd: line })}
            onOpenAutoPipeline={context.handleOpenAutoPipeline}
          />
        );
      case "multidie":
        return (
          <MultiDieViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            verilogSource={context.activeFile?.content}
            targetDevice={context.project.targetDevice}
            onSelectSignal={context.handleSchematicSelectSignal}
            onJumpToCode={context.handleJumpToCode}
          />
        );
      case "ppa":
        return (
          <PpaParetoViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            verilogSource={context.activeFile?.content}
            xdcSource={context.project.files.find((f) => f.fileSet === "constrs_1")?.content ?? ""}
            targetDevice={context.project.targetDevice}
            onSelectDevice={(dev) => {
              context.setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
            }}
            onJumpToCode={context.handleJumpToCode}
          />
        );
      case "protocol":
        return (
          <ProtocolAnalyzer
            state={context.state}
            activeDesignId={context.activeDesignId}
          />
        );
      case "techmapping":
        return (
          <TechMappingViewer
            activeDesignId={context.activeDesignId}
            topModule={context.project.topModule}
            sourceCode={context.activeFile?.content ?? ""}
            targetDevice={context.project.targetDevice}
            onDeviceChange={(dev) => {
              context.setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
            }}
          />
        );
      case "formal":
        return (
          <FormalVerificationViewer
            sourceCode={context.activeFile?.content ?? ""}
            topModule={context.project.topModule}
            onNavigateToWaveform={() => onSelectView(leaf.id, "waveform")}
            onInsertAssertion={context.handleInsertAssertion}
          />
        );
      case "floorplan":
        return (
          <FloorplanStudioViewer
            state={context.state}
            activeDesignId={context.activeDesignId}
            verilogSource={context.activeFile?.content}
            topModule={context.project.topModule}
            targetDevice={context.project.targetDevice}
            onDeviceChange={(dev) => {
              context.setProject((prev) => (prev ? { ...prev, targetDevice: dev } : null));
            }}
            onSelectSignal={context.handleSchematicSelectSignal}
            onJumpToCode={context.handleJumpToCode}
          />
        );
      default:
        return (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            Select a view
          </div>
        );
    }
  };

  // Standalone Editor Panel: When this leaf represents the code editor, render it directly
  // without the outer 28px layout header bar or visualizer sub-tabs, letting HdlEditor's native file tabs manage the panel.
  if (leaf.activeViewId === "editor") {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        {renderActiveView()}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "var(--bg-primary)"
      }}
    >
      {/* Panel Header Bar */}
      <div
        style={{
          height: 28,
          minHeight: 28,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px",
          userSelect: "none",
          flexShrink: 0
        }}
      >
        {/* Tabs Strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto", scrollbarWidth: "none", minWidth: 0, flex: 1 }}>
          {leaf.views.map((v) => {
            const meta = LAYOUT_VIEWS_META[v];
            const isActive = leaf.activeViewId === v;
            return (
              <div
                key={v}
                onClick={() => onSelectView(leaf.id, v)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    viewId: v,
                    leafId: leaf.id
                  });
                }}
                title={meta?.description || meta?.defaultLabel}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: isActive ? 600 : 400,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                  color: isActive ? meta?.color || "var(--accent-cyan)" : "var(--text-muted)",
                  border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {getViewIcon(v, 12)}
                <span>{meta?.defaultLabel || v}</span>
              </div>
            );
          })}

          {/* Add View Dropdown Button */}
          {availableToAdd.length > 0 && (
            <div style={{ position: "relative" }} ref={addMenuRef}>
              <button
                onClick={() => setIsAddMenuOpen((prev) => !prev)}
                title="Dock Another View into this Panel"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-muted)",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Plus size={12} />
              </button>

              {isAddMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    zIndex: 200,
                    minWidth: 170,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    padding: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1
                  }}
                >
                  <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Dock View
                  </div>
                  {availableToAdd.map((av) => {
                    const meta = LAYOUT_VIEWS_META[av];
                    return (
                      <button
                        key={av}
                        onClick={() => {
                          onAddTab(leaf.id, av);
                          setIsAddMenuOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 8px",
                          fontSize: 11.5,
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <span style={{ color: meta?.color || "var(--accent-blue)" }}>{getViewIcon(av, 12)}</span>
                        <span>{meta?.defaultLabel || av}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel Action Controls (Close Panel & Maximize) */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {/* Close Panel (available in split multi-panel layouts) */}
          {canClosePanel && onClosePanel && (
            <button
              onClick={() => onClosePanel(leaf.id)}
              title="Close Panel"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 20,
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-rose)";
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <X size={12} />
            </button>
          )}

          {/* Maximize / Restore */}
          <button
            onClick={() => onToggleMaximize(leaf.id)}
            title={isMaximized ? "Restore Layout" : "Maximize Panel to 100%"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 20,
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: isMaximized ? "var(--accent-cyan)" : "var(--text-muted)",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isMaximized ? "var(--accent-cyan)" : "var(--text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      {/* Panel Body Content */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden" }}>
        {renderActiveView()}
      </div>

      {/* Visualizer Tab Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 150),
            left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 200),
            width: 195,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.15)",
            padding: 4,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontSize: 12,
            color: "var(--text-primary)",
            userSelect: "none"
          }}
        >
          {/* Close Tab */}
          <div
            onClick={() => {
              if (leaf.views.length > 1) {
                onCloseTab(contextMenu.leafId, contextMenu.viewId);
              }
              setContextMenu(null);
            }}
            title={leaf.views.length <= 1 ? (t("layout.cannotCloseOnlyTab") || "Cannot close the only tab in this panel") : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              cursor: leaf.views.length > 1 ? "pointer" : "not-allowed",
              color: leaf.views.length > 1 ? "var(--text-primary)" : "var(--text-muted)",
              opacity: leaf.views.length > 1 ? 1 : 0.45,
              transition: "background-color 0.1s ease"
            }}
            onMouseEnter={(e) => {
              if (leaf.views.length > 1) {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={13} color={leaf.views.length > 1 ? "var(--accent-red)" : "currentColor"} />
            <span style={{ flex: 1 }}>{t("layout.closeTab") || "Close"}</span>
          </div>

          {/* Close Other Tabs */}
          <div
            onClick={() => {
              if (leaf.views.length > 1) {
                const others = leaf.views.filter((v) => v !== contextMenu.viewId);
                others.forEach((v) => onCloseTab(contextMenu.leafId, v));
              }
              setContextMenu(null);
            }}
            title={leaf.views.length <= 1 ? (t("layout.cannotCloseOnlyTab") || "Cannot close the only tab in this panel") : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              cursor: leaf.views.length > 1 ? "pointer" : "not-allowed",
              color: leaf.views.length > 1 ? "var(--text-primary)" : "var(--text-muted)",
              opacity: leaf.views.length > 1 ? 1 : 0.45,
              transition: "background-color 0.1s ease"
            }}
            onMouseEnter={(e) => {
              if (leaf.views.length > 1) {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Layers size={13} color="var(--text-muted)" />
            <span style={{ flex: 1 }}>{t("layout.closeOtherTabs") || "Close Others"}</span>
          </div>

          <div style={{ height: 1, backgroundColor: "var(--border-subtle)", margin: "3px 0" }} />

          {/* Open in Layout Editor */}
          <div
            onClick={() => {
              setContextMenu(null);
              if (context.onOpenLayoutEditor) {
                context.onOpenLayoutEditor();
              } else if (context.onOpenSettings) {
                context.onOpenSettings("layouts");
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--text-primary)",
              transition: "background-color 0.1s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Layout size={13} color="var(--accent-cyan)" />
            <span style={{ flex: 1 }}>{t("layout.openLayoutEditor") || "Layout Editor..."}</span>
          </div>

          {/* Dock Another View */}
          {availableToAdd.length > 0 && (
            <div
              onClick={() => {
                setContextMenu(null);
                setIsAddMenuOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                color: "var(--text-primary)",
                transition: "background-color 0.1s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Plus size={13} color="var(--text-muted)" />
              <span style={{ flex: 1 }}>{t("layout.dockMoreViews") || "Dock Another View..."}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
