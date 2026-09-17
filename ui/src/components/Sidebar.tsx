import React, { useState } from "react";
import { Folder, Box, GitCommit, FileCode, CheckSquare, Square, ChevronRight, ChevronDown, Layers } from "lucide-react";
import { HierarchyNode, SimulationState } from "../engine/engineBridge";
import { SAMPLE_DESIGNS, SampleDesign } from "../engine/sampleDesigns";

interface SidebarProps {
  state: SimulationState;
  activeDesignId: string;
  selectedSignalIds: Set<string>;
  onSelectDesign: (design: SampleDesign) => void;
  onToggleSignal: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  state,
  activeDesignId,
  selectedSignalIds,
  onSelectDesign,
  onToggleSignal
}) => {
  const [activeTab, setActiveTab] = useState<"hierarchy" | "samples">("hierarchy");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([state.topModule]));

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
              {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
            </span>
          )}

          <span style={{ marginRight: 6, display: "flex", alignItems: "center" }}>
            {node.kind === "module" && <Box size={14} color="var(--accent-cyan)" />}
            {node.kind === "reg" && <GitCommit size={14} color="var(--accent-amber)" />}
            {node.kind === "wire" && <Folder size={14} color="var(--accent-emerald)" />}
            {node.kind === "net" && <Folder size={14} color="var(--accent-blue)" />}
            {node.kind === "process" && <Layers size={14} color="var(--accent-purple)" />}
          </span>

          <span style={{ fontFamily: isSignal ? "var(--font-mono)" : "inherit" }}>
            {node.name}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderHierarchyNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{
        width: 260,
        backgroundColor: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden"
      }}
    >
      {/* Sidebar Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        <button
          onClick={() => setActiveTab("hierarchy")}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: activeTab === "hierarchy" ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: activeTab === "hierarchy" ? "2px solid var(--accent-blue)" : "2px solid transparent",
            backgroundColor: activeTab === "hierarchy" ? "var(--bg-secondary)" : "transparent"
          }}
        >
          Scope Hierarchy
        </button>
        <button
          onClick={() => setActiveTab("samples")}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: activeTab === "samples" ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: activeTab === "samples" ? "2px solid var(--accent-blue)" : "2px solid transparent",
            backgroundColor: activeTab === "samples" ? "var(--bg-secondary)" : "transparent"
          }}
        >
          Fixtures ({SAMPLE_DESIGNS.length})
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {activeTab === "hierarchy" ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", padding: "4px 8px 8px" }}>
              Elaborated Netlist
            </div>
            {state.hierarchy.map((node) => renderHierarchyNode(node))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", padding: "4px 4px 0" }}>
              Preset Verilog Designs
            </div>
            {SAMPLE_DESIGNS.map((design) => {
              const isSelected = design.id === activeDesignId;
              return (
                <div
                  key={design.id}
                  onClick={() => onSelectDesign(design)}
                  style={{
                    padding: 10,
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                    backgroundColor: isSelected ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <FileCode size={14} color={isSelected ? "var(--accent-cyan)" : "var(--text-muted)"} />
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{design.name}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {design.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
