// Axiom EDA — Recursive Layout Renderer
// Recursively renders LayoutSplit (row/column) with ResizableSplitter and LayoutLeaf

import React, { useRef } from "react";
import {
  LayoutNode,
  LayoutViewId,
  findLeafById
} from "../../engine/layoutModel";
import { LayoutLeafRenderer, VisualizerContextProps } from "./LayoutLeafRenderer";
import { ResizableSplitter } from "../ResizableSplitter";

export interface LayoutRendererProps {
  root: LayoutNode;
  context: VisualizerContextProps;
  maximizedLeafId: string | null;
  onSelectView: (leafId: string, viewId: LayoutViewId) => void;
  onCloseTab: (leafId: string, viewId: LayoutViewId) => void;
  onAddTab: (leafId: string, viewId: LayoutViewId) => void;
  onSplitLeaf?: (leafId: string, direction: "row" | "column") => void;
  onClosePanel?: (leafId: string) => void;
  onUpdateSplitRatio: (splitId: string, newRatio: number) => void;
  onToggleMaximize: (leafId: string) => void;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  root,
  context,
  maximizedLeafId,
  onSelectView,
  onCloseTab,
  onAddTab,
  onSplitLeaf,
  onClosePanel,
  onUpdateSplitRatio,
  onToggleMaximize
}) => {
  const canClosePanel = root.type === "split";

  // If a single leaf is maximized, render only that leaf
  if (maximizedLeafId) {
    const maximizedLeaf = findLeafById(root, maximizedLeafId);
    if (maximizedLeaf) {
      return (
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden" }}>
          <LayoutLeafRenderer
            leaf={maximizedLeaf}
            isMaximized={true}
            context={context}
            onSelectView={onSelectView}
            onCloseTab={onCloseTab}
            onAddTab={onAddTab}
            onSplitLeaf={onSplitLeaf}
            onClosePanel={onClosePanel}
            canClosePanel={canClosePanel}
            onToggleMaximize={onToggleMaximize}
          />
        </div>
      );
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden" }}>
      <SubtreeRenderer
        node={root}
        context={context}
        onSelectView={onSelectView}
        onCloseTab={onCloseTab}
        onAddTab={onAddTab}
        onSplitLeaf={onSplitLeaf}
        onClosePanel={onClosePanel}
        canClosePanel={canClosePanel}
        onUpdateSplitRatio={onUpdateSplitRatio}
        onToggleMaximize={onToggleMaximize}
      />
    </div>
  );
};

interface SubtreeRendererProps {
  node: LayoutNode;
  context: VisualizerContextProps;
  onSelectView: (leafId: string, viewId: LayoutViewId) => void;
  onCloseTab: (leafId: string, viewId: LayoutViewId) => void;
  onAddTab: (leafId: string, viewId: LayoutViewId) => void;
  onSplitLeaf?: (leafId: string, direction: "row" | "column") => void;
  onClosePanel?: (leafId: string) => void;
  canClosePanel?: boolean;
  onUpdateSplitRatio: (splitId: string, newRatio: number) => void;
  onToggleMaximize: (leafId: string) => void;
}

const SubtreeRenderer: React.FC<SubtreeRendererProps> = ({
  node,
  context,
  onSelectView,
  onCloseTab,
  onAddTab,
  onSplitLeaf,
  onClosePanel,
  canClosePanel = false,
  onUpdateSplitRatio,
  onToggleMaximize
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (node.type === "leaf") {
    return (
      <LayoutLeafRenderer
        leaf={node}
        isMaximized={false}
        context={context}
        onSelectView={onSelectView}
        onCloseTab={onCloseTab}
        onAddTab={onAddTab}
        onSplitLeaf={onSplitLeaf}
        onClosePanel={onClosePanel}
        canClosePanel={canClosePanel}
        onToggleMaximize={onToggleMaximize}
      />
    );
  }

  const isRow = node.direction === "row";
  const firstPct = node.splitRatio * 100;
  const secondPct = (1 - node.splitRatio) * 100;

  const handleResize = (deltaPx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const totalDim = isRow ? el.offsetWidth : el.offsetHeight;
    if (totalDim <= 0) return;
    const deltaRatio = deltaPx / totalDim;
    const nextRatio = Math.max(0.1, Math.min(0.9, Math.round((node.splitRatio + deltaRatio) * 1000) / 1000));
    onUpdateSplitRatio(node.id, nextRatio);
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
        overflow: "hidden"
      }}
    >
      {/* First Child Pane */}
      <div
        style={{
          display: "flex",
          overflow: "hidden",
          minWidth: isRow ? 140 : 0,
          minHeight: !isRow ? 100 : 0,
          flex: `0 0 ${firstPct}%`
        }}
      >
        <SubtreeRenderer
          node={node.first}
          context={context}
          onSelectView={onSelectView}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
          onSplitLeaf={onSplitLeaf}
          onUpdateSplitRatio={onUpdateSplitRatio}
          onToggleMaximize={onToggleMaximize}
        />
      </div>

      {/* Resizable Divider */}
      <ResizableSplitter
        orientation={isRow ? "horizontal" : "vertical"}
        onResize={handleResize}
        onDoubleClick={() => onUpdateSplitRatio(node.id, 0.5)}
      />

      {/* Second Child Pane */}
      <div
        style={{
          display: "flex",
          overflow: "hidden",
          minWidth: isRow ? 140 : 0,
          minHeight: !isRow ? 100 : 0,
          flex: `0 0 ${secondPct}%`
        }}
      >
        <SubtreeRenderer
          node={node.second}
          context={context}
          onSelectView={onSelectView}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
          onSplitLeaf={onSplitLeaf}
          onUpdateSplitRatio={onUpdateSplitRatio}
          onToggleMaximize={onToggleMaximize}
        />
      </div>
    </div>
  );
};
