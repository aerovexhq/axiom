// Axiom EDA — Interactive Blueprint Layout Editor Mode
// Fullscreen distraction-free layout authoring with blueish striped boxes and drag-and-drop tabs

import React, { useState, useRef, useEffect } from "react";
import {
  Layout,
  Columns,
  Rows,
  Plus,
  X,
  GripVertical,
  Sparkles,
  Save
} from "lucide-react";
import {
  AxiomLayout,
  LayoutNode,
  LayoutLeaf,
  LayoutViewId,
  LAYOUT_VIEWS_META,
  ALL_LAYOUT_VIEW_IDS,
  cloneLayoutNode,
  splitLeaf,
  closeTabInLeaf,
  updateSplitRatio,
  moveViewBetweenLeaves,
  simplifyLayoutTree,
  getAllLeaves,
  BUILTIN_LAYOUT_PRESETS
} from "../../engine/layoutModel";
import { getViewIcon } from "./LayoutLeafRenderer";

export interface BlueprintLayoutEditorProps {
  initialLayout: AxiomLayout;
  onClose: () => void;
  onSave: (layout: AxiomLayout, target: "project" | "slot-1" | "slot-2" | "slot-3") => void;
}

export const BlueprintLayoutEditor: React.FC<BlueprintLayoutEditorProps> = ({
  initialLayout,
  onClose,
  onSave
}) => {
  const [draftRoot, setDraftRoot] = useState<LayoutNode>(() => cloneLayoutNode(initialLayout.root));
  const [layoutName, setLayoutName] = useState<string>(initialLayout.name || "Custom Layout");
  const [targetScope, setTargetScope] = useState<"project" | "slot-1" | "slot-2" | "slot-3">(
    initialLayout.scope === "project" ? "project" : initialLayout.slot ? (`slot-${initialLayout.slot}` as any) : "project"
  );
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [draggedView, setDraggedView] = useState<{ sourceLeafId: string; viewId: LayoutViewId } | null>(null);

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleApplyPreset = (preset: AxiomLayout) => {
    setDraftRoot(cloneLayoutNode(preset.root));
    setLayoutName(preset.name);
    setShowPresetMenu(false);
  };

  const handleSplitBox = (leafId: string, direction: "row" | "column") => {
    setDraftRoot((prev) => splitLeaf(prev, leafId, direction));
  };

  const handleCloseTab = (leafId: string, viewId: LayoutViewId) => {
    setDraftRoot((prev) => closeTabInLeaf(prev, leafId, viewId));
  };

  const handleAddTab = (leafId: string, viewId: LayoutViewId) => {
    setDraftRoot((prev) => {
      const cloned = cloneLayoutNode(prev);
      const leaves = getAllLeaves(cloned);
      const target = leaves.find((l) => l.id === leafId);
      if (target && !target.views.includes(viewId)) {
        target.views.push(viewId);
        target.activeViewId = viewId;
      }
      return cloned;
    });
  };

  const handleDropTab = (targetLeafId: string) => {
    if (!draggedView) return;
    setDraftRoot((prev) =>
      moveViewBetweenLeaves(prev, draggedView.sourceLeafId, targetLeafId, draggedView.viewId)
    );
    setDraggedView(null);
  };

  const handleUpdateRatio = (splitId: string, newRatio: number) => {
    setDraftRoot((prev) => updateSplitRatio(prev, splitId, newRatio));
  };

  const handleSaveAndApply = () => {
    const cleanRoot = simplifyLayoutTree(draftRoot);
    const finalLayout: AxiomLayout = {
      id: targetScope === "project" ? "project" : targetScope,
      name: layoutName.trim() || "Custom Layout",
      root: cleanRoot,
      scope: targetScope === "project" ? "project" : "global",
      slot: targetScope === "slot-1" ? 1 : targetScope === "slot-2" ? 2 : targetScope === "slot-3" ? 3 : undefined,
      isPreset: false,
      createdAt: initialLayout.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onSave(finalLayout, targetScope);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(10, 14, 20, 0.97)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        userSelect: "none"
      }}
    >
      {/* Minimalist Top Action Bar */}
      <div
        style={{
          height: 48,
          minHeight: 48,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          gap: 16
        }}
      >
        {/* Left: Mode Title & Name Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(56, 139, 253, 0.15)",
              border: "1px solid rgba(56, 139, 253, 0.35)",
              color: "var(--accent-cyan)",
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <Layout size={14} />
            <span>Blueprint Layout Editor</span>
          </div>

          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Layout Name..."
            style={{
              height: 28,
              padding: "0 10px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: 12,
              width: 180,
              outline: "none"
            }}
          />
        </div>

        {/* Center: Save Destination Selector & Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Save to:</span>
          <select
            value={targetScope}
            onChange={(e) => setTargetScope(e.target.value as any)}
            style={{
              height: 28,
              padding: "0 8px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: 12,
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="project">Current Project Layout</option>
            <option value="slot-1">Global Slot 1 (Engineering)</option>
            <option value="slot-2">Global Slot 2 (Code & Waves)</option>
            <option value="slot-3">Global Slot 3 (Virtual Lab)</option>
          </select>

          {/* Quick Presets Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowPresetMenu((prev) => !prev)}
              className="btn btn-ghost"
              style={{
                height: 28,
                padding: "0 10px",
                fontSize: 11.5,
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Sparkles size={12} color="var(--accent-purple)" />
              <span>Load Preset...</span>
            </button>

            {showPresetMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  width: 260,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
                  padding: 6,
                  zIndex: 200
                }}
              >
                {BUILTIN_LAYOUT_PRESETS.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontSize: 11.5
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{p.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cancel & Save Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              height: 28,
              padding: "0 14px",
              fontSize: 12,
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)"
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSaveAndApply}
            className="btn btn-primary"
            style={{
              height: 28,
              padding: "0 16px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Save size={13} />
            <span>Save & Apply</span>
          </button>
        </div>
      </div>

      {/* Blueprint Canvas Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 16,
          display: "flex",
          overflow: "hidden"
        }}
      >
        <BlueprintSubtree
          node={draftRoot}
          setDraggedView={setDraggedView}
          onSplitBox={handleSplitBox}
          onCloseTab={handleCloseTab}
          onAddTab={handleAddTab}
          onDropTab={handleDropTab}
          onUpdateRatio={handleUpdateRatio}
        />
      </div>
    </div>
  );
};

interface BlueprintSubtreeProps {
  node: LayoutNode;
  setDraggedView: React.Dispatch<React.SetStateAction<{ sourceLeafId: string; viewId: LayoutViewId } | null>>;
  onSplitBox: (leafId: string, direction: "row" | "column") => void;
  onCloseTab: (leafId: string, viewId: LayoutViewId) => void;
  onAddTab: (leafId: string, viewId: LayoutViewId) => void;
  onDropTab: (targetLeafId: string) => void;
  onUpdateRatio: (splitId: string, newRatio: number) => void;
}

const BlueprintSubtree: React.FC<BlueprintSubtreeProps> = ({
  node,
  setDraggedView,
  onSplitBox,
  onCloseTab,
  onAddTab,
  onDropTab,
  onUpdateRatio
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (node.type === "leaf") {
    return (
      <BlueprintBox
        leaf={node}
        setDraggedView={setDraggedView}
        onSplitBox={onSplitBox}
        onCloseTab={onCloseTab}
        onAddTab={onAddTab}
        onDropTab={onDropTab}
      />
    );
  }

  const isRow = node.direction === "row";
  const firstPct = node.splitRatio * 100;
  const secondPct = (1 - node.splitRatio) * 100;

  const handleDividerDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;

    const startPos = isRow ? e.clientX : e.clientY;
    const initialRatio = node.splitRatio;
    const totalDim = isRow ? el.offsetWidth : el.offsetHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const curPos = isRow ? moveEvent.clientX : moveEvent.clientY;
      const deltaPx = curPos - startPos;
      const deltaRatio = deltaPx / totalDim;
      const nextRatio = Math.max(0.1, Math.min(0.9, Math.round((initialRatio + deltaRatio) * 1000) / 1000));
      onUpdateRatio(node.id, nextRatio);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: isRow ? "row" : "column",
        overflow: "hidden",
        gap: 6
      }}
    >
      {/* First Section */}
      <div
        style={{
          display: "flex",
          overflow: "hidden",
          flex: `0 0 calc(${firstPct}% - 4px)`
        }}
      >
        <BlueprintSubtree
          node={node.first}
          setDraggedView={setDraggedView}
          onSplitBox={onSplitBox}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
          onDropTab={onDropTab}
          onUpdateRatio={onUpdateRatio}
        />
      </div>

      {/* Blueprint Draggable Divider */}
      <div
        onMouseDown={handleDividerDrag}
        title={`Drag to adjust ratio: ${Math.round(firstPct)}% / ${Math.round(secondPct)}%`}
        style={{
          flex: "0 0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isRow ? "col-resize" : "row-resize",
          position: "relative",
          zIndex: 10
        }}
      >
        <div
          style={{
            width: isRow ? 3 : "100%",
            height: isRow ? "100%" : 3,
            backgroundColor: "rgba(56, 139, 253, 0.4)",
            borderRadius: 2,
            transition: "background-color 0.15s ease"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-cyan)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(56, 139, 253, 0.4)")}
        />
      </div>

      {/* Second Section */}
      <div
        style={{
          display: "flex",
          overflow: "hidden",
          flex: `0 0 calc(${secondPct}% - 4px)`
        }}
      >
        <BlueprintSubtree
          node={node.second}
          setDraggedView={setDraggedView}
          onSplitBox={onSplitBox}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
          onDropTab={onDropTab}
          onUpdateRatio={onUpdateRatio}
        />
      </div>
    </div>
  );
};

interface BlueprintBoxProps {
  leaf: LayoutLeaf;
  setDraggedView: React.Dispatch<React.SetStateAction<{ sourceLeafId: string; viewId: LayoutViewId } | null>>;
  onSplitBox: (leafId: string, direction: "row" | "column") => void;
  onCloseTab: (leafId: string, viewId: LayoutViewId) => void;
  onAddTab: (leafId: string, viewId: LayoutViewId) => void;
  onDropTab: (targetLeafId: string) => void;
}

const BlueprintBox: React.FC<BlueprintBoxProps> = ({
  leaf,
  setDraggedView,
  onSplitBox,
  onCloseTab,
  onAddTab,
  onDropTab
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const availableToAdd = ALL_LAYOUT_VIEW_IDS.filter((v) => !leaf.views.includes(v));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDropTab(leaf.id);
      }}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 8,
        border: `2px dashed ${isDragOver ? "var(--accent-cyan)" : "rgba(56, 139, 253, 0.65)"}`,
        backgroundColor: "rgba(13, 17, 23, 0.88)",
        backgroundImage: `repeating-linear-gradient(
          45deg,
          rgba(56, 139, 253, ${isDragOver ? "0.12" : "0.05"}),
          rgba(56, 139, 253, ${isDragOver ? "0.12" : "0.05"}) 12px,
          transparent 12px,
          transparent 24px
        )`,
        boxShadow: isDragOver
          ? "0 0 25px rgba(56, 139, 253, 0.4), inset 0 0 20px rgba(56, 139, 253, 0.2)"
          : "inset 0 0 15px rgba(56, 139, 253, 0.04)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        overflow: "hidden"
      }}
    >
      {/* Box Header: Tab Strip & Controls */}
      <div
        style={{
          height: 32,
          minHeight: 32,
          backgroundColor: "rgba(18, 24, 38, 0.95)",
          borderBottom: "1px solid rgba(56, 139, 253, 0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          gap: 6
        }}
      >
        {/* Draggable Tab Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
          {leaf.views.map((v) => {
            const meta = LAYOUT_VIEWS_META[v];
            return (
              <div
                key={v}
                draggable={true}
                onDragStart={() => setDraggedView({ sourceLeafId: leaf.id, viewId: v })}
                onDragEnd={() => setDraggedView(null)}
                title={`Drag to move ${meta?.defaultLabel || v} to another panel`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(56, 139, 253, 0.15)",
                  border: "1px solid rgba(56, 139, 253, 0.4)",
                  color: meta?.color || "var(--accent-cyan)",
                  cursor: "grab",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                <GripVertical size={10} color="var(--text-muted)" />
                {getViewIcon(v, 11)}
                <span>{meta?.defaultLabel || v}</span>
                {leaf.views.length > 1 && (
                  <button
                    onClick={() => onCloseTab(leaf.id, v)}
                    title="Remove Tab from Box"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      marginLeft: 2,
                      borderRadius: "50%",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      opacity: 0.6
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Tab Button */}
          {availableToAdd.length > 0 && (
            <div style={{ position: "relative" }} ref={addMenuRef}>
              <button
                onClick={() => setShowAddMenu((prev) => !prev)}
                title="Add View to this Box"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(56, 139, 253, 0.25)";
                  e.currentTarget.style.color = "var(--accent-cyan)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Plus size={11} />
              </button>

              {showAddMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    width: 170,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                    padding: 4,
                    zIndex: 300,
                    maxHeight: 220,
                    overflowY: "auto"
                  }}
                >
                  {availableToAdd.map((av) => {
                    const meta = LAYOUT_VIEWS_META[av];
                    return (
                      <button
                        key={av}
                        onClick={() => {
                          onAddTab(leaf.id, av);
                          setShowAddMenu(false);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 8px",
                          fontSize: 11,
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
                        <span style={{ color: meta?.color || "var(--accent-blue)" }}>{getViewIcon(av, 11)}</span>
                        <span>{meta?.defaultLabel || av}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Box Split Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onSplitBox(leaf.id, "row")}
            title="Split Box Horizontally (Columns)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(56, 139, 253, 0.12)",
              border: "1px solid rgba(56, 139, 253, 0.3)",
              color: "var(--accent-cyan)",
              fontSize: 10.5,
              cursor: "pointer"
            }}
          >
            <Columns size={11} />
            <span>Split Col</span>
          </button>

          <button
            onClick={() => onSplitBox(leaf.id, "column")}
            title="Split Box Vertically (Rows)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(56, 139, 253, 0.12)",
              border: "1px solid rgba(56, 139, 253, 0.3)",
              color: "var(--accent-cyan)",
              fontSize: 10.5,
              cursor: "pointer"
            }}
          >
            <Rows size={11} />
            <span>Split Row</span>
          </button>
        </div>
      </div>

      {/* Blueprint Box Body: Abstract View Representation */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: "rgba(56, 139, 253, 0.7)",
          padding: 12
        }}
      >
        <div style={{ opacity: 0.8 }}>{getViewIcon(leaf.activeViewId, 24)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          {LAYOUT_VIEWS_META[leaf.activeViewId]?.defaultLabel || leaf.activeViewId}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", maxWidth: 220 }}>
          {leaf.views.length} docked {leaf.views.length === 1 ? "view" : "views"} • Drag tabs or split box
        </div>
      </div>
    </div>
  );
};
