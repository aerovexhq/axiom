import React, { useState } from "react";
import {
  Folder,
  Box,
  GitCommit,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  FilePlus,
  Plus,
  Activity
} from "lucide-react";
import { HierarchyNode, SimulationState } from "../engine/engineBridge";
import { AxiomProject, FileSetType } from "../engine/projectModel";
import { ProjectManager } from "./ProjectManager";
import { useTranslation } from "../i18n";
import { Input } from "./ui";

interface SidebarProps {
  state: SimulationState;
  activeDesignId?: string;
  selectedSignalIds: Set<string>;
  onToggleSignal: (id: string) => void;
  activeCrossProbeSignal?: string | null;
  onSelectCrossProbeSignal?: (signalId: string) => void;
  project: AxiomProject | null;
  onUpdateProject: (p: AxiomProject) => void;
  onOpenAddSource: (fileSet?: FileSetType) => void;
  onOpenNewProject: () => void;
  onCloseProject?: () => void;
  onSelectTemplate?: (templateId: string) => void;
  onSelectFile: (fileId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  state,
  selectedSignalIds,
  onToggleSignal,
  activeCrossProbeSignal,
  onSelectCrossProbeSignal,
  project,
  onUpdateProject,
  onOpenAddSource,
  onOpenNewProject,
  onCloseProject,
  onSelectTemplate,
  onSelectFile,
  isCollapsed = false,
  onToggleCollapse,
  width = 280
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"project" | "hierarchy">("project");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([state.topModule]));
  const [hierarchySearch, setHierarchySearch] = useState<string>("");

  const toggleExpand = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const isNodeProbed = React.useCallback(
    (node: HierarchyNode): boolean => {
      if (!activeCrossProbeSignal) return false;
      const target = activeCrossProbeSignal.toLowerCase();
      const idLower = node.id.toLowerCase();
      const nameLower = node.name.toLowerCase();

      if (idLower === target || nameLower === target) return true;
      if (idLower.endsWith(`.${target}`) || target.endsWith(`.${idLower}`)) return true;
      if (nameLower.endsWith(`.${target}`) || target.endsWith(`.${nameLower}`)) return true;

      const bareTarget = target.replace(/^(gate_|prim_|in_|out_)/, "");
      const bareName = nameLower.replace(/^(gate_|prim_|in_|out_)/, "");
      const bareId = idLower.split(".").pop()?.replace(/^(gate_|prim_|in_|out_)/, "") ?? "";

      if (bareName === bareTarget || bareId === bareTarget) return true;
      if (bareName && target.includes(bareName)) return true;
      if (bareTarget && (idLower.includes(bareTarget) || nameLower.includes(bareTarget))) return true;

      return false;
    },
    [activeCrossProbeSignal]
  );

  // Auto-expand module hierarchy when an element inside is probed in the graph
  React.useEffect(() => {
    if (!activeCrossProbeSignal) return;
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      const expandIfMatches = (nodes: HierarchyNode[]) => {
        for (const n of nodes) {
          if (n.children && n.children.length > 0) {
            const hasMatch = n.children.some((c) => isNodeProbed(c) || (c.children && c.children.some(isNodeProbed)));
            if (hasMatch) {
              next.add(n.id);
            }
            expandIfMatches(n.children);
          }
        }
      };
      expandIfMatches(state.hierarchy);
      return next;
    });
  }, [activeCrossProbeSignal, state.hierarchy, isNodeProbed]);

  const totalSignals = React.useMemo(() => {
    let count = 0;
    const countSignals = (nodes: HierarchyNode[]) => {
      for (const n of nodes) {
        if (n.kind === "net" || n.kind === "reg" || n.kind === "wire") count++;
        if (n.children) countSignals(n.children);
      }
    };
    countSignals(state.hierarchy);
    return count;
  }, [state.hierarchy]);

  const renderHierarchyNode = (node: HierarchyNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSignal = node.kind === "net" || node.kind === "reg" || node.kind === "wire";
    const isChecked = selectedSignalIds.has(node.id) || selectedSignalIds.has(node.name);
    const isProbed = isNodeProbed(node);

    if (hierarchySearch.trim() && !node.name.toLowerCase().includes(hierarchySearch.toLowerCase()) && !hasChildren) {
      return null;
    }

    return (
      <div key={node.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: `5px 8px 5px ${8 + depth * 14}px`,
            fontSize: 12,
            color: isProbed ? "var(--accent-cyan)" : isChecked ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "pointer",
            backgroundColor: isProbed ? "rgba(56, 189, 248, 0.15)" : isChecked ? "var(--bg-active)" : "transparent",
            border: isProbed ? "1px solid rgba(56, 189, 248, 0.45)" : "1px solid transparent",
            borderRadius: "var(--radius-sm)",
            userSelect: "none",
            transition: "all 0.15s ease",
            position: "relative"
          }}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(node.id);
            } else {
              onSelectCrossProbeSignal?.(node.id);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSignal) {
              onToggleSignal(node.id);
            }
          }}
          title={isSignal ? `${node.name} — Click to inspect, Check to show in Waveforms` : node.name}
        >
          {hasChildren ? (
            <span style={{ marginRight: 5, display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span style={{ width: 19 }} />
          )}

          {isSignal && (
            <span
              style={{
                marginRight: 6,
                display: "flex",
                alignItems: "center",
                color: isChecked ? "var(--accent-blue)" : "var(--text-muted)"
              }}
              title={isChecked ? "Remove from Waveform Viewer" : "Add to Waveform Viewer"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSignal(node.id);
              }}
            >
              {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
            </span>
          )}

          <span style={{ marginRight: 6, display: "flex", alignItems: "center" }}>
            {node.kind === "module" && <Box size={14} color="var(--accent-blue)" />}
            {node.kind === "net" && <GitCommit size={14} color="var(--accent-cyan)" />}
            {node.kind === "reg" && <GitCommit size={14} color="var(--accent-amber)" />}
            {node.kind === "wire" && <GitCommit size={14} color="var(--accent-emerald)" />}
            {node.kind === "process" && <GitCommit size={14} color="var(--accent-purple)" />}
          </span>

          <span
            style={{
              fontFamily: isSignal ? "var(--font-mono)" : "inherit",
              fontWeight: isProbed ? 600 : isChecked ? 500 : 400
            }}
          >
            {node.name}
          </span>

          {isProbed && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 2,
                backgroundColor: "rgba(56, 189, 248, 0.25)",
                color: "var(--accent-cyan)",
                letterSpacing: "0.04em",
                flexShrink: 0
              }}
            >
              PROBE
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderHierarchyNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // Render Collapsed Sidebar Strip (38px wide)
  if (isCollapsed) {
    return (
      <aside
        style={{
          width: 38,
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
          gap: 12,
          zIndex: 10,
          userSelect: "none"
        }}
      >
        <button
          onClick={onToggleCollapse}
          title={t("sidebar.expandSidebar")}
          style={{
            padding: 6,
            color: "var(--accent-blue)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer"
          }}
        >
          <ChevronRight size={16} />
        </button>

        <div style={{ width: 24, height: 1, backgroundColor: "var(--border-subtle)" }} />

        <button
          onClick={() => {
            setActiveTab("project");
            onToggleCollapse?.();
          }}
          title={t("sidebar.sourcesTab")}
          style={{
            padding: 6,
            color: activeTab === "project" ? "var(--accent-blue)" : "var(--text-muted)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer"
          }}
        >
          <Folder size={16} />
        </button>

        <button
          onClick={() => {
            setActiveTab("hierarchy");
            onToggleCollapse?.();
          }}
          title={t("sidebar.netlistTab")}
          style={{
            padding: 6,
            color: activeTab === "hierarchy" ? "var(--accent-blue)" : "var(--text-muted)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer"
          }}
        >
          <GitCommit size={16} />
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => onOpenAddSource()}
          title={t("sidebar.addSources")}
          style={{
            padding: 6,
            color: "var(--accent-cyan)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer"
          }}
        >
          <FilePlus size={16} />
        </button>

        <button
          onClick={onOpenNewProject}
          title={t("sidebar.newProjectAction")}
          style={{
            padding: 6,
            color: "var(--accent-emerald)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer"
          }}
        >
          <Plus size={16} />
        </button>
      </aside>
    );
  }

  // Render Full Expanded Sidebar (customizable width, default 280px)
  return (
    <aside
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        backgroundColor: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 5
      }}
    >
      {/* Top Sidebar Header & Tab Bar */}
      <div
        style={{
          height: 28,
          minHeight: 28,
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        {/* Tabs: Project Sources vs Netlist Hierarchy */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button
            onClick={() => setActiveTab("project")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "project" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "project" ? "var(--accent-blue)" : "var(--text-muted)",
              border: activeTab === "project" ? "1px solid var(--border-subtle)" : "1px solid transparent"
            }}
          >
            <Folder size={12} />
            <span>{t("sidebar.sourcesTab")}</span>
          </button>

          <button
            onClick={() => setActiveTab("hierarchy")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "hierarchy" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "hierarchy" ? "var(--accent-blue)" : "var(--text-muted)",
              border: activeTab === "hierarchy" ? "1px solid var(--border-subtle)" : "1px solid transparent"
            }}
          >
            <GitCommit size={12} />
            <span>{t("sidebar.netlistTab")}</span>
          </button>
        </div>

        {/* Collapse Sidebar Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={t("sidebar.collapseSidebar")}
            style={{
              padding: "4px 6px",
              color: "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer"
            }}
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "project" ? (
          <ProjectManager
            project={project}
            onUpdateProject={onUpdateProject}
            onOpenAddSource={onOpenAddSource}
            onOpenNewProject={onOpenNewProject}
            onCloseProject={onCloseProject}
            onSelectTemplate={onSelectTemplate}
            onSelectFile={onSelectFile}
          />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {/* Search Box for Hierarchy (Componentized Input) */}
            <div style={{ marginBottom: 10 }}>
              <Input
                size="sm"
                value={hierarchySearch}
                onChange={(e) => setHierarchySearch(e.target.value)}
                placeholder={t("sidebar.searchSignals")}
                icon={<Search size={13} color="var(--text-muted)" />}
                clearable
                onClear={() => setHierarchySearch("")}
              />
            </div>

            {/* Waveform Traces Status Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 8px",
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "var(--radius-sm)",
                marginBottom: 8,
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)"
              }}
              title="Checkboxes select which signals appear in the Waveform Viewer"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Activity size={12} color="var(--accent-cyan)" />
                <span>Waveform Traces:</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {selectedSignalIds.size > 0 ? `${selectedSignalIds.size} visible` : `All (${totalSignals})`}
                </span>
              </div>

              {selectedSignalIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    Array.from(selectedSignalIds).forEach((id) => onToggleSignal(id));
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-blue)",
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "1px 4px"
                  }}
                  title="Reset to show all signals in Waveform Viewer"
                >
                  Reset
                </button>
              )}
            </div>

            {(!project || state.hierarchy.length === 0) ? (
              <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                <Box size={26} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{t("sidebar.noNetlist")}</div>
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
                  {t("sidebar.emptyDesc")}
                </div>
              </div>
            ) : (
              state.hierarchy.map((node) => renderHierarchyNode(node))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
