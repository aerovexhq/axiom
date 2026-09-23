// Axiom EDA — Dual Persistence & Layout Slot Storage Engine
// Project-level storage (project.layout) + Global Slots (Slot 1, Slot 2, Slot 3) + Factory Presets

import { AxiomLayout, BUILTIN_LAYOUT_PRESETS, DEFAULT_LAYOUT } from "./layoutModel";
import { AxiomProject } from "./projectModel";

const STORAGE_ACTIVE_LAYOUT_ID = "axiom_active_layout_id";
const STORAGE_SLOT_PREFIX = "axiom_layout_slot_";
const STORAGE_CUSTOM_LAYOUTS = "axiom_custom_layouts";

// Builtin preset mapping for slots 1, 2, 3
export const DEFAULT_SLOT_PRESETS: Record<1 | 2 | 3, AxiomLayout> = {
  1: BUILTIN_LAYOUT_PRESETS[0], // Engineering Dual Split
  2: BUILTIN_LAYOUT_PRESETS[1], // Code & Waveform Focus
  3: BUILTIN_LAYOUT_PRESETS[2]  // Virtual Lab Workbench
};

export function getGlobalSlotLayout(slot: 1 | 2 | 3): AxiomLayout | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_SLOT_PREFIX}${slot}`);
    if (raw) {
      const parsed = JSON.parse(raw) as AxiomLayout;
      if (parsed && parsed.root) {
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }
  return null;
}

export function saveGlobalSlotLayout(slot: 1 | 2 | 3, name: string, layout: AxiomLayout): AxiomLayout {
  const updated: AxiomLayout = {
    ...layout,
    id: `slot-${slot}`,
    name: name.trim() || `Slot ${slot}`,
    scope: "global",
    slot,
    isPreset: false,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(`${STORAGE_SLOT_PREFIX}${slot}`, JSON.stringify(updated));
    localStorage.setItem(STORAGE_ACTIVE_LAYOUT_ID, updated.id);
  } catch {
    // storage quota fallback
  }

  return updated;
}

export function clearGlobalSlot(slot: 1 | 2 | 3): void {
  try {
    localStorage.removeItem(`${STORAGE_SLOT_PREFIX}${slot}`);
  } catch {
    // ignore
  }
}

export function getAllSavedSlots(): { slot: 1 | 2 | 3; layout: AxiomLayout | null; defaultPreset: AxiomLayout }[] {
  return [
    { slot: 1, layout: getGlobalSlotLayout(1), defaultPreset: DEFAULT_SLOT_PRESETS[1] },
    { slot: 2, layout: getGlobalSlotLayout(2), defaultPreset: DEFAULT_SLOT_PRESETS[2] },
    { slot: 3, layout: getGlobalSlotLayout(3), defaultPreset: DEFAULT_SLOT_PRESETS[3] }
  ];
}

// Get custom layouts saved in global storage
export function getCustomGlobalLayouts(): AxiomLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_LAYOUTS);
    if (raw) {
      const parsed = JSON.parse(raw) as AxiomLayout[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

// Save or update a custom global layout
export function saveCustomGlobalLayout(layout: AxiomLayout): void {
  try {
    const current = getCustomGlobalLayouts();
    const existingIdx = current.findIndex((l) => l.id === layout.id);
    const updatedLayout = { ...layout, scope: "global" as const, updatedAt: new Date().toISOString() };
    if (existingIdx >= 0) {
      current[existingIdx] = updatedLayout;
    } else {
      current.push(updatedLayout);
    }
    localStorage.setItem(STORAGE_CUSTOM_LAYOUTS, JSON.stringify(current));
  } catch {
    // storage quota fallback
  }
}

// Find layout by ID across project, slots, presets, and custom layouts
export function findLayoutById(id: string, project?: AxiomProject | null): AxiomLayout | null {
  if (id === "project" && project?.layout) {
    return project.layout;
  }

  // Check slots
  if (id === "slot-1" || id === "1") return getGlobalSlotLayout(1) || DEFAULT_SLOT_PRESETS[1];
  if (id === "slot-2" || id === "2") return getGlobalSlotLayout(2) || DEFAULT_SLOT_PRESETS[2];
  if (id === "slot-3" || id === "3") return getGlobalSlotLayout(3) || DEFAULT_SLOT_PRESETS[3];

  // Check built-in presets
  const preset = BUILTIN_LAYOUT_PRESETS.find((p) => p.id === id);
  if (preset) return preset;

  // Check custom layouts
  const custom = getCustomGlobalLayouts().find((l) => l.id === id);
  if (custom) return custom;

  return null;
}

// Determine active layout with smart fallback
export function getActiveLayout(project: AxiomProject | null): AxiomLayout {
  // 1. If project has a saved layout, use it
  if (project?.layout && project.layout.root) {
    return project.layout;
  }

  // 2. Check active layout preference in localStorage
  try {
    const activeId = localStorage.getItem(STORAGE_ACTIVE_LAYOUT_ID);
    if (activeId) {
      const found = findLayoutById(activeId, project);
      if (found) return found;
    }
  } catch {
    // ignore
  }

  // 3. Fallback to default layout preset
  return DEFAULT_LAYOUT;
}

// Save active layout preference
export function setActiveLayoutId(layoutId: string): void {
  try {
    localStorage.setItem(STORAGE_ACTIVE_LAYOUT_ID, layoutId);
  } catch {
    // ignore
  }
}

// Attach layout to project model
export function saveProjectLayout(project: AxiomProject, layout: AxiomLayout): AxiomProject {
  const projectLayout: AxiomLayout = {
    ...layout,
    id: "project",
    name: `${project.name} Layout`,
    scope: "project",
    isPreset: false,
    updatedAt: new Date().toISOString()
  };

  return {
    ...project,
    layout: projectLayout,
    updatedAt: new Date().toISOString()
  };
}

// Reset to default layout
export function resetToDefaultLayout(project?: AxiomProject | null): AxiomLayout {
  try {
    localStorage.removeItem(STORAGE_ACTIVE_LAYOUT_ID);
  } catch {
    // ignore
  }
  if (project) {
    delete project.layout;
  }
  return DEFAULT_LAYOUT;
}

// Validate layout node recursively
export function isValidLayoutNode(node: any): boolean {
  if (!node || typeof node !== "object") return false;
  if (node.type === "leaf") {
    return (
      typeof node.id === "string" &&
      Array.isArray(node.views) &&
      node.views.length > 0 &&
      typeof node.activeViewId === "string" &&
      node.views.includes(node.activeViewId)
    );
  }
  if (node.type === "split") {
    return (
      typeof node.id === "string" &&
      (node.direction === "row" || node.direction === "column") &&
      typeof node.splitRatio === "number" &&
      node.splitRatio >= 0.05 &&
      node.splitRatio <= 0.95 &&
      isValidLayoutNode(node.first) &&
      isValidLayoutNode(node.second)
    );
  }
  return false;
}

// Validate complete AxiomLayout object
export function validateLayoutJson(jsonStr: string): AxiomLayout | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    if (!isValidLayoutNode(parsed.root)) return null;

    const now = new Date().toISOString();
    const validated: AxiomLayout = {
      id: typeof parsed.id === "string" && parsed.id ? parsed.id : `layout_${Date.now()}`,
      name: parsed.name.trim(),
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      scope: parsed.scope === "project" ? "project" : "global",
      slot: parsed.slot === 1 || parsed.slot === 2 || parsed.slot === 3 ? parsed.slot : undefined,
      isPreset: false,
      root: parsed.root,
      createdAt: typeof parsed.createdAt === "string" && parsed.createdAt ? parsed.createdAt : now,
      updatedAt: now
    };
    return validated;
  } catch {
    return null;
  }
}

// Export layout to downloadable JSON file
export function exportLayoutToJson(layout: AxiomLayout): void {
  const cleanLayout: AxiomLayout = {
    ...layout,
    updatedAt: new Date().toISOString()
  };
  const jsonStr = JSON.stringify(cleanLayout, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const sanitizedName = (layout.name || "workspace_layout")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  a.href = url;
  a.download = `${sanitizedName}.axiom-layout.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import layout from File object
export function importLayoutFromJsonFile(file: File): Promise<AxiomLayout> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const validated = validateLayoutJson(text);
      if (validated) {
        resolve(validated);
      } else {
        reject(new Error("Invalid layout JSON format or corrupted layout tree structure."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file from disk."));
    reader.readAsText(file);
  });
}

