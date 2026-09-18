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
  X,
  FilePlus,
  Plus
} from "lucide-react";
import { HierarchyNode, SimulationState } from "../engine/engineBridge";
import { AxiomProject } from "../engine/projectModel";
import { ProjectManager } from "./ProjectManager";

interface SidebarProps {
  state: SimulationState;
  activeDesignId?: string;
  selectedSignalIds: Set<string>;
  onToggleSignal: (id: string) => void;
  project: AxiomProject | null;
  onUpdateProject: (p: AxiomProject) => void;
  onOpenAddSource: () => void;
  onOpenNewProject: () => void;
  onCloseProject?: () => void;
  onSelectTemplate?: (templateId: string) => void;
  onSelectFile: (fileId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  state,
  selectedSignalIds,
  onToggleSignal,
  project,
  onUpdateProject,
  onOpenAddSource,
  onOpenNewProject,
  onCloseProject,
  onSelectTemplate,
  onSelectFile,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [activeTab, setActiveTab] = useState<"project" | "hierarchy">("project");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([state.topModule]));
  const [hierarchySearch, setHierarchySearch] = useState<string>("");

  const toggleExpand = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const renderHierarchyNode = (node: HierarchyNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSignal = node.kind === "net" || node.kind === "reg" || node.kind === "wire";
    const isChecked = selectedSignalIds.has(node.id);

    if (hierarchySearch.trim() && !node.name.toLowerCase().includes(hierarchySearch.toLowerCase()) && !hasChildren) {
      return null;
    }

    return (
      <div key={node.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: `4px 8px 4px ${8 + depth * 14}px`,
            fontSize: 12,
            color: isChecked ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "pointer",
            backgroundColor: isChecked ? "var(--bg-active)" : "transparent",
            borderRadius: "var(--radius-sm)",
            userSelect: "none"
          }}
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            else if (isSignal) onToggleSignal(node.id);
          }}
        >
          {hasChildren ? (
            <span style={{ marginRight: 4, display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span style={{ width: 18 }} />
          )}

          {isSignal && (
            <span
              style={{ marginRight: 6, display: "flex", alignItems: "center", color: isChecked ? "var(--accent-blue)" : "var(--text-muted)" }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSignal(node.id);
              }}
            >
              {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
            </span>
          )}

          <span style={{ marginRight: 6, display: "flex", alignItems: "center" }}>
            {node.kind === "module" && <Box size={14} color="var(--accent-blue)" />}
            {node.kind === "net" && <GitCommit size={14} color="var(--accent-cyan)" />}
            {node.kind === "reg" && <GitCommit size={14} color="var(--accent-amber)" />}
            {node.kind === "wire" && <GitCommit size={14} color="var(--accent-emerald)" />}
          </span>

          <span style={{ fontFamily: isSignal ? "var(--font-mono)" : "inherit" }}>
            {node.name}
          </span>
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
          title="Expand Vivado Project Sidebar"
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
          title="Vivado Project Sources"
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
          title="Elaborated Netlist Hierarchy"
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
          onClick={onOpenAddSource}
          title="Add Source File"
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
          title="New Vivado Project"
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

  // Render Full Expanded Sidebar (260px wide)
  return (
    <aside
      style={{
        width: 260,
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
          height: 34,
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
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "project" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "project" ? "var(--accent-blue)" : "var(--text-muted)",
              border: activeTab === "project" ? "1px solid var(--border-subtle)" : "1px solid transparent"
            }}
          >
            <Folder size={12} />
            <span>Sources</span>
          </button>

          <button
            onClick={() => setActiveTab("hierarchy")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: activeTab === "hierarchy" ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === "hierarchy" ? "var(--accent-blue)" : "var(--text-muted)",
              border: activeTab === "hierarchy" ? "1px solid var(--border-subtle)" : "1px solid transparent"
            }}
          >
            <GitCommit size={12} />
            <span>Netlist</span>
          </button>
        </div>

        {/* Collapse Sidebar Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar (Liberate Workspace Space)"
            style={{
              padding: "3px 5px",
              color: "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer"
            }}
          >
            <ChevronLeft size={14} />
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
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {/* Search Box for Hierarchy */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Search size={12} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
              <input
                type="text"
                value={hierarchySearch}
                onChange={(e) => setHierarchySearch(e.target.value)}
                placeholder="Filter nets & instances..."
                style={{
                  width: "100%",
                  padding: "5px 8px 5px 26px",
                  fontSize: 11,
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  outline: "none"
                }}
              />
              {hierarchySearch && (
                <button
                  onClick={() => setHierarchySearch("")}
                  style={{ position: "absolute", right: 6, top: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", padding: "4px 8px 6px", letterSpacing: 0.5 }}>
              Elaborated Netlist Tree
            </div>

            {(!project || state.hierarchy.length === 0) ? (
              <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                <Box size={26} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>No Netlist Available</div>
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
                  Create or open a project to elaborate hardware netlist hierarchy.
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
