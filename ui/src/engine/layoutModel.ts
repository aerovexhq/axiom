// Axiom EDA — Industry-Grade Hierarchical Layout Model
// Tabs -> Panels (Leaves) -> Split Panels (Row/Column) -> Whole Layout (AxiomLayout)

export type LayoutViewId =
  | "editor"
  | "waveform"
  | "schematic"
  | "fsm"
  | "package"
  | "microarch"
  | "virtuallab"
  | "timing"
  | "multidie"
  | "ppa"
  | "protocol"
  | "techmapping"
  | "formal"
  | "floorplan";

export interface LayoutViewMeta {
  id: LayoutViewId;
  labelKey: string;
  defaultLabel: string;
  color: string;
  description: string;
}

export const ALL_LAYOUT_VIEW_IDS: LayoutViewId[] = [
  "editor",
  "schematic",
  "waveform",
  "fsm",
  "package",
  "microarch",
  "virtuallab",
  "timing",
  "multidie",
  "ppa",
  "protocol",
  "techmapping",
  "formal",
  "floorplan"
];

export const LAYOUT_VIEWS_META: Record<LayoutViewId, LayoutViewMeta> = {
  editor: {
    id: "editor",
    labelKey: "layout.views.editor",
    defaultLabel: "HDL Editor",
    color: "var(--accent-blue)",
    description: "Monaco SystemVerilog / Verilog / XDC source code editor"
  },
  schematic: {
    id: "schematic",
    labelKey: "layout.views.schematic",
    defaultLabel: "Schematic Netlist",
    color: "var(--accent-cyan)",
    description: "IEEE gate-level schematic DAG and interactive netlist"
  },
  waveform: {
    id: "waveform",
    labelKey: "layout.views.waveform",
    defaultLabel: "Waveforms",
    color: "var(--accent-blue)",
    description: "Stratified IEEE 1800 multi-radix digital waveform viewer"
  },
  fsm: {
    id: "fsm",
    labelKey: "layout.views.fsm",
    defaultLabel: "FSM Bubble Graph",
    color: "var(--accent-purple, #a855f7)",
    description: "Finite state machine transition bubble graph & live vectors"
  },
  package: {
    id: "package",
    labelKey: "layout.views.package",
    defaultLabel: "Package Pinout",
    color: "var(--accent-cyan)",
    description: "FPGA ball grid array (BGA/QFP) pinout and physical I/O mapping"
  },
  microarch: {
    id: "microarch",
    labelKey: "layout.views.microarch",
    defaultLabel: "Architecture",
    color: "var(--accent-purple, #a855f7)",
    description: "Microarchitecture block diagram and datapath register inspector"
  },
  virtuallab: {
    id: "virtuallab",
    labelKey: "layout.views.virtuallab",
    defaultLabel: "Virtual Lab",
    color: "var(--accent-amber)",
    description: "Hardware lab rack with interactive switches, buttons, and probes"
  },
  timing: {
    id: "timing",
    labelKey: "layout.views.timing",
    defaultLabel: "Timing Radar",
    color: "var(--accent-purple)",
    description: "Static timing analysis radar and slack waterfall histogram"
  },
  multidie: {
    id: "multidie",
    labelKey: "layout.views.multidie",
    defaultLabel: "Multi-Die Interposer",
    color: "var(--accent-cyan, #06b6d4)",
    description: "Multi-FPGA partitioning and silicon interposer floorplan"
  },
  ppa: {
    id: "ppa",
    labelKey: "layout.views.ppa",
    defaultLabel: "PPA Pareto",
    color: "var(--accent-purple, #a855f7)",
    description: "Live PPA Pareto frontier & multi-part silicon cost forecaster"
  },
  protocol: {
    id: "protocol",
    labelKey: "layout.views.protocol",
    defaultLabel: "Protocol Analyzer",
    color: "var(--accent-cyan)",
    description: "Hardware protocol analyzer (CAN, USB, Ethernet, UART, SPI, I2C)"
  },
  techmapping: {
    id: "techmapping",
    labelKey: "layout.views.techmapping",
    defaultLabel: "Tech Map",
    color: "var(--accent-purple, #a855f7)",
    description: "FPGA technology mapping, LUT truth tables & primitive synthesis"
  },
  formal: {
    id: "formal",
    labelKey: "layout.views.formal",
    defaultLabel: "Formal Verification",
    color: "var(--accent-blue, #388bfd)",
    description: "Formal property verification, BMC & SVA assertions"
  },
  floorplan: {
    id: "floorplan",
    labelKey: "layout.views.floorplan",
    defaultLabel: "Floorplan Studio",
    color: "var(--accent-green, #2ea043)",
    description: "Physical silicon floorplan & gate placement studio"
  }
};

export interface LayoutLeaf {
  type: "leaf";
  id: string;
  views: LayoutViewId[];
  activeViewId: LayoutViewId;
}

export interface LayoutSplit {
  type: "split";
  id: string;
  direction: "row" | "column"; // "row" = horizontal split; "column" = vertical split
  splitRatio: number;          // 0.1 to 0.9 (default 0.5)
  first: LayoutNode;
  second: LayoutNode;
}

export type LayoutNode = LayoutLeaf | LayoutSplit;

export interface AxiomLayout {
  id: string;
  name: string;
  description?: string;
  root: LayoutNode;
  scope: "project" | "global";
  slot?: 1 | 2 | 3;
  isPreset?: boolean;
  createdAt: string;
  updatedAt: string;
}

let nextIdCounter = 1;
export function generateLayoutId(prefix = "panel"): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextIdCounter++).toString(36)}`;
}

export function createLeaf(views: LayoutViewId[], activeViewId?: LayoutViewId, id?: string): LayoutLeaf {
  const safeViews = views.length > 0 ? views : ["editor" as LayoutViewId];
  const safeActive = activeViewId && safeViews.includes(activeViewId) ? activeViewId : safeViews[0];
  return {
    type: "leaf",
    id: id || generateLayoutId("leaf"),
    views: [...safeViews],
    activeViewId: safeActive
  };
}

export function createSplit(
  direction: "row" | "column",
  splitRatio: number,
  first: LayoutNode,
  second: LayoutNode,
  id?: string
): LayoutSplit {
  return {
    type: "split",
    id: id || generateLayoutId("split"),
    direction,
    splitRatio: Math.max(0.1, Math.min(0.9, splitRatio)),
    first,
    second
  };
}

// Deep clone layout node
export function cloneLayoutNode(node: LayoutNode): LayoutNode {
  if (node.type === "leaf") {
    return {
      type: "leaf",
      id: node.id,
      views: [...node.views],
      activeViewId: node.activeViewId
    };
  }
  return {
    type: "split",
    id: node.id,
    direction: node.direction,
    splitRatio: node.splitRatio,
    first: cloneLayoutNode(node.first),
    second: cloneLayoutNode(node.second)
  };
}

// Find a leaf by its ID
export function findLeafById(node: LayoutNode, id: string): LayoutLeaf | null {
  if (node.type === "leaf") {
    return node.id === id ? node : null;
  }
  return findLeafById(node.first, id) || findLeafById(node.second, id);
}

// Collect all leaf nodes
export function getAllLeaves(node: LayoutNode): LayoutLeaf[] {
  if (node.type === "leaf") {
    return [node];
  }
  return [...getAllLeaves(node.first), ...getAllLeaves(node.second)];
}

// Find parent split of a child node
export function findParentSplit(
  root: LayoutNode,
  targetId: string
): { parent: LayoutSplit; position: "first" | "second" } | null {
  if (root.type === "leaf") return null;

  if (root.first.id === targetId) {
    return { parent: root, position: "first" };
  }
  if (root.second.id === targetId) {
    return { parent: root, position: "second" };
  }

  const left = findParentSplit(root.first, targetId);
  if (left) return left;
  return findParentSplit(root.second, targetId);
}

// Switch active view in a leaf
export function updateLeafActiveView(
  root: LayoutNode,
  leafId: string,
  viewId: LayoutViewId
): LayoutNode {
  const cloned = cloneLayoutNode(root);
  const leaf = findLeafById(cloned, leafId);
  if (leaf && leaf.views.includes(viewId)) {
    leaf.activeViewId = viewId;
  }
  return cloned;
}

// Move a view tab from one leaf to another
export function moveViewBetweenLeaves(
  root: LayoutNode,
  sourceLeafId: string,
  targetLeafId: string,
  viewId: LayoutViewId,
  targetIndex?: number
): LayoutNode {
  const cloned = cloneLayoutNode(root);
  const source = findLeafById(cloned, sourceLeafId);
  const target = findLeafById(cloned, targetLeafId);

  if (!source || !target) return cloned;
  if (!source.views.includes(viewId)) return cloned;

  // If source and target are the same, just reorder within the leaf
  if (sourceLeafId === targetLeafId) {
    const curIdx = source.views.indexOf(viewId);
    if (curIdx >= 0) {
      source.views.splice(curIdx, 1);
      const insertAt = typeof targetIndex === "number" ? Math.max(0, Math.min(source.views.length, targetIndex)) : source.views.length;
      source.views.splice(insertAt, 0, viewId);
      source.activeViewId = viewId;
    }
    return cloned;
  }

  // Remove from source leaf
  source.views = source.views.filter((v) => v !== viewId);
  if (source.activeViewId === viewId) {
    source.activeViewId = source.views[0] || "editor";
  }

  // Add to target leaf if not already present
  if (!target.views.includes(viewId)) {
    if (typeof targetIndex === "number") {
      target.views.splice(targetIndex, 0, viewId);
    } else {
      target.views.push(viewId);
    }
  }
  target.activeViewId = viewId;

  // Prune any now-empty leaves
  return simplifyLayoutTree(cloned);
}

// Split an existing leaf into two sibling leaves
export function splitLeaf(
  root: LayoutNode,
  targetLeafId: string,
  direction: "row" | "column",
  newViewId?: LayoutViewId
): LayoutNode {
  const cloned = cloneLayoutNode(root);
  const target = findLeafById(cloned, targetLeafId);
  if (!target) return cloned;

  const defaultNextView: LayoutViewId = newViewId || (target.activeViewId === "editor" ? "schematic" : "editor");
  const newSibling = createLeaf([defaultNextView], defaultNextView);

  // If the target is the root itself
  if (cloned.id === targetLeafId) {
    return createSplit(direction, 0.5, target, newSibling);
  }

  // Otherwise find parent split and replace target with new split
  const parentRef = findParentSplit(cloned, targetLeafId);
  if (parentRef) {
    const replacement = createSplit(direction, 0.5, target, newSibling);
    if (parentRef.position === "first") {
      parentRef.parent.first = replacement;
    } else {
      parentRef.parent.second = replacement;
    }
  }

  return cloned;
}

// Close a tab in a leaf
export function closeTabInLeaf(
  root: LayoutNode,
  leafId: string,
  viewId: LayoutViewId
): LayoutNode {
  const cloned = cloneLayoutNode(root);
  const leaf = findLeafById(cloned, leafId);
  if (!leaf) return cloned;

  leaf.views = leaf.views.filter((v) => v !== viewId);
  if (leaf.activeViewId === viewId) {
    leaf.activeViewId = leaf.views[0] || "editor";
  }

  return simplifyLayoutTree(cloned);
}

// Reorder views in a leaf (e.g. placing a selected overflow view at the last visible tab slot)
export function reorderLeafViews(
  root: LayoutNode,
  leafId: string,
  newViews: LayoutViewId[],
  activeViewId?: LayoutViewId
): LayoutNode {
  const cloned = cloneLayoutNode(root);
  const leaf = findLeafById(cloned, leafId);
  if (!leaf) return cloned;

  leaf.views = [...newViews];
  if (activeViewId) {
    leaf.activeViewId = activeViewId;
  }

  return cloned;
}

// Close and remove an entire leaf panel from a split layout tree
export function closeLeaf(root: LayoutNode, leafId: string): LayoutNode {
  if (root.type === "leaf") {
    return root;
  }

  const cloned = cloneLayoutNode(root);
  if (cloned.type !== "split") {
    return cloned;
  }

  // If root is a split and directly contains the leaf to close
  if (cloned.first.id === leafId) {
    return cloned.second;
  }
  if (cloned.second.id === leafId) {
    return cloned.first;
  }

  // Otherwise locate parent split of the target leaf
  const parentRef = findParentSplit(cloned, leafId);
  if (!parentRef) return cloned;

  const sibling = parentRef.position === "first" ? parentRef.parent.second : parentRef.parent.first;

  // Replace parent split with the sibling in the grandparent
  const grandParentRef = findParentSplit(cloned, parentRef.parent.id);
  if (grandParentRef) {
    if (grandParentRef.position === "first") {
      grandParentRef.parent.first = sibling;
    } else {
      grandParentRef.parent.second = sibling;
    }
  }

  return simplifyLayoutTree(cloned);
}

// Update split divider ratio
export function updateSplitRatio(
  root: LayoutNode,
  splitId: string,
  newRatio: number
): LayoutNode {
  const cloned = cloneLayoutNode(root);
  function traverse(node: LayoutNode) {
    if (node.type === "split") {
      if (node.id === splitId) {
        node.splitRatio = Math.max(0.1, Math.min(0.9, newRatio));
      } else {
        traverse(node.first);
        traverse(node.second);
      }
    }
  }
  traverse(cloned);
  return cloned;
}

// Clean up redundant splits and empty leaves
export function simplifyLayoutTree(node: LayoutNode): LayoutNode {
  if (node.type === "leaf") {
    // If a leaf is completely empty, give it a default view
    if (node.views.length === 0) {
      node.views = ["editor"];
      node.activeViewId = "editor";
    }
    return node;
  }

  node.first = simplifyLayoutTree(node.first);
  node.second = simplifyLayoutTree(node.second);

  // Check if first is an empty leaf with 0 views
  const firstEmpty = node.first.type === "leaf" && node.first.views.length === 0;
  const secondEmpty = node.second.type === "leaf" && node.second.views.length === 0;

  if (firstEmpty && !secondEmpty) return node.second;
  if (secondEmpty && !firstEmpty) return node.first;

  return node;
}

// 6 Factory Presets
export const BUILTIN_LAYOUT_PRESETS: AxiomLayout[] = [
  {
    id: "preset-engineering",
    name: "Engineering Dual Split",
    description: "Classic Vivado split: HDL Editor on left (42%), Multi-Visualizer Deck on right (58%).",
    isPreset: true,
    slot: 1,
    scope: "global",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    root: createSplit(
      "row",
      0.42,
      createLeaf(["editor"], "editor", "leaf-editor"),
      createLeaf(
        ["schematic", "waveform", "fsm", "virtuallab", "timing", "techmapping", "formal", "floorplan"],
        "schematic",
        "leaf-visualizers"
      ),
      "split-main"
    )
  },
  {
    id: "preset-code-waveform",
    name: "Code & Waveform Focus",
    description: "Top-to-bottom debugging split: Monaco editor on top (55%), stratified Waveforms on bottom (45%).",
    isPreset: true,
    slot: 2,
    scope: "global",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    root: createSplit(
      "column",
      0.55,
      createLeaf(["editor"], "editor", "leaf-code"),
      createLeaf(["waveform", "protocol"], "waveform", "leaf-waves"),
      "split-code-waves"
    )
  },
  {
    id: "preset-virtual-lab",
    name: "Virtual Lab Workbench",
    description: "Interactive hardware lab: Digilent Basys 3 board on top (50%), live Waveforms & Schematic on bottom (50%).",
    isPreset: true,
    slot: 3,
    scope: "global",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    root: createSplit(
      "column",
      0.5,
      createLeaf(["virtuallab"], "virtuallab", "leaf-lab"),
      createLeaf(["waveform", "schematic"], "waveform", "leaf-lab-waves"),
      "split-lab-workbench"
    )
  },
  {
    id: "preset-schematic-studio",
    name: "Full Schematic Studio",
    description: "Deep netlist inspection: Gate-level DAG on left (60%), FSM and Microarchitecture on right (40%).",
    isPreset: true,
    scope: "global",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    root: createSplit(
      "row",
      0.6,
      createLeaf(["schematic"], "schematic", "leaf-schematic-left"),
      createSplit(
        "column",
        0.5,
        createLeaf(["fsm"], "fsm", "leaf-fsm-top"),
        createLeaf(["microarch", "package"], "microarch", "leaf-arch-bottom"),
        "split-schematic-right"
      ),
      "split-schematic-studio"
    )
  },
  {
    id: "preset-timing-synthesis",
    name: "Timing & Synthesis Cockpit",
    description: "Physical implementation: STA Timing Radar & Slack Waterfall on top (50%), Technology Mapping & Floorplan on bottom (50%).",
    isPreset: true,
    scope: "global",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    root: createSplit(
      "column",
      0.5,
      createLeaf(["timing", "ppa"], "timing", "leaf-sta"),
      createLeaf(["techmapping", "floorplan"], "techmapping", "leaf-syn"),
      "split-timing-synthesis"
    )
  },
  {
    id: "preset-multi-waveform",
    name: "Multi-Waveform Analysis",
    description: "Deep protocol and delta inspection: IEEE Waveforms on top (50%), Hardware Protocol Analyzer on bottom (50%).",
    isPreset: true,
    scope: "global",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    root: createSplit(
      "column",
      0.5,
      createLeaf(["waveform"], "waveform", "leaf-waves-top"),
      createLeaf(["protocol"], "protocol", "leaf-proto-bottom"),
      "split-multi-waves"
    )
  }
];

export const DEFAULT_LAYOUT: AxiomLayout = BUILTIN_LAYOUT_PRESETS[0];
