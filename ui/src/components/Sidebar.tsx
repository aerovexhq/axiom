import React, { useState } from "react";
import { Folder, Box, GitCommit, FileCode, CheckSquare, Square, ChevronRight, ChevronDown, Layers, Search, X } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"hierarchy" | "samples">("samples");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([state.topModule]));
  const [sampleSearch, setSampleSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "processors" | "protocols" | "power" | "standard">("all");
  const [hierarchySearch, setHierarchySearch] = useState<string>("");

  const toggleExpand = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "processors":
        return { label: "RISC-V / CORE", color: "#c084fc", bg: "rgba(168, 85, 247, 0.18)", border: "rgba(168, 85, 247, 0.35)" };
      case "protocols":
        return { label: "PROTOCOL", color: "#22d3ee", bg: "rgba(6, 182, 212, 0.18)", border: "rgba(6, 182, 212, 0.35)" };
      case "power":
        return { label: "POWER / PWM", color: "#fbbf24", bg: "rgba(245, 158, 11, 0.18)", border: "rgba(245, 158, 11, 0.35)" };
      default:
        return { label: "STANDARD", color: "#60a5fa", bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.35)" };
    }
  };

  const filteredDesigns = SAMPLE_DESIGNS.filter((design) => {
    const matchesCategory = categoryFilter === "all" || design.category === categoryFilter;
    const query = sampleSearch.toLowerCase().trim();
    const matchesSearch =
      !query ||
      design.name.toLowerCase().includes(query) ||
      design.description.toLowerCase().includes(query) ||
      design.topModule.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

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
        width: 270,
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
          Hierarchy
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {activeTab === "hierarchy" ? (
          <div style={{ padding: 8 }}>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Search size={12} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
              <input
                type="text"
                value={hierarchySearch}
                onChange={(e) => setHierarchySearch(e.target.value)}
                placeholder="Filter nets & ports..."
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
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", padding: "4px 8px 8px" }}>
              Elaborated Netlist
            </div>
            {state.hierarchy.map((node) => renderHierarchyNode(node))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Search & Category Filter Header */}
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-primary)" }}>
              {/* Search Box */}
              <div style={{ position: "relative", marginBottom: 6 }}>
                <Search size={12} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
                <input
                  type="text"
                  value={sampleSearch}
                  onChange={(e) => setSampleSearch(e.target.value)}
                  placeholder="Search fixtures, cores, bus..."
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
                {sampleSearch && (
                  <button
                    onClick={() => setSampleSearch("")}
                    style={{ position: "absolute", right: 6, top: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {(["all", "processors", "protocols", "power", "standard"] as const).map((cat) => {
                  const isCatActive = categoryFilter === cat;
                  const label =
                    cat === "all" ? "All" :
                    cat === "processors" ? "Cores" :
                    cat === "protocols" ? "Protocols" :
                    cat === "power" ? "Power" : "Standard";
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 10,
                        border: `1px solid ${isCatActive ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                        backgroundColor: isCatActive ? "rgba(59, 130, 246, 0.2)" : "var(--bg-tertiary)",
                        color: isCatActive ? "var(--accent-blue)" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontWeight: isCatActive ? 700 : 500
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Designs List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredDesigns.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "20px 10px" }}>
                  No designs match "{sampleSearch}"
                </div>
              ) : (
                filteredDesigns.map((design) => {
                  const isSelected = design.id === activeDesignId;
                  const badge = getCategoryBadge(design.category);
                  return (
                    <div
                      key={design.id}
                      onClick={() => onSelectDesign(design)}
                      style={{
                        padding: 9,
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                        backgroundColor: isSelected ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 0 10px rgba(59, 130, 246, 0.2)" : "none"
                      }}
                    >
                      {/* Top Row: Category Badge & Top Module */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 3,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {design.topModule}
                        </span>
                      </div>

                      {/* Design Title */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <FileCode size={13} color={isSelected ? "var(--accent-cyan)" : "var(--text-muted)"} />
                        <span style={{ fontWeight: 600, fontSize: 12, color: isSelected ? "#fff" : "var(--text-primary)" }}>
                          {design.name}
                        </span>
                      </div>

                      {/* Description */}
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.35, margin: 0 }}>
                        {design.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
