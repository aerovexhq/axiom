// Axiom EDA — Unified Keybinding System & Action Registry
// High-performance hotkey management, collision detection, and persistence

export type KeybindCategory = "file" | "simulation" | "view" | "tools";

export type KeybindActionId =
  | "file.newProject"
  | "file.openProject"
  | "file.saveProject"
  | "file.saveAll"
  | "file.newWindow"
  | "sim.runPause"
  | "sim.step1ns"
  | "sim.step100ps"
  | "sim.stepDelta"
  | "sim.reset"
  | "sim.compile"
  | "view.toggleSidebar"
  | "view.toggleBottomDock"
  | "view.toggleFullscreen"
  | "view.customizeLayout"
  | "view.switchFloorplan"
  | "tools.omnibar"
  | "tools.settings";

export interface KeybindDefinition {
  id: KeybindActionId;
  category: KeybindCategory;
  nameKey: string;
  descKey: string;
  defaultKey: string;
  allowInInput?: boolean;
}

export const KEYBIND_DEFINITIONS: KeybindDefinition[] = [
  // --- File Actions ---
  {
    id: "file.newProject",
    category: "file",
    nameKey: "keybinds.actionNewProject",
    descKey: "keybinds.descNewProject",
    defaultKey: "Ctrl+Shift+N"
  },
  {
    id: "file.openProject",
    category: "file",
    nameKey: "keybinds.actionOpenProject",
    descKey: "keybinds.descOpenProject",
    defaultKey: "Ctrl+O"
  },
  {
    id: "file.saveProject",
    category: "file",
    nameKey: "keybinds.actionSaveProject",
    descKey: "keybinds.descSaveProject",
    defaultKey: "Ctrl+S"
  },
  {
    id: "file.saveAll",
    category: "file",
    nameKey: "keybinds.actionSaveAll",
    descKey: "keybinds.descSaveAll",
    defaultKey: "Ctrl+Shift+S"
  },
  {
    id: "file.newWindow",
    category: "file",
    nameKey: "keybinds.actionNewWindow",
    descKey: "keybinds.descNewWindow",
    defaultKey: "Ctrl+Shift+W"
  },

  // --- Simulation Actions ---
  {
    id: "sim.runPause",
    category: "simulation",
    nameKey: "keybinds.actionRunPause",
    descKey: "keybinds.descRunPause",
    defaultKey: "F5"
  },
  {
    id: "sim.step1ns",
    category: "simulation",
    nameKey: "keybinds.actionStep1ns",
    descKey: "keybinds.descStep1ns",
    defaultKey: "F6"
  },
  {
    id: "sim.step100ps",
    category: "simulation",
    nameKey: "keybinds.actionStep100ps",
    descKey: "keybinds.descStep100ps",
    defaultKey: "F7"
  },
  {
    id: "sim.stepDelta",
    category: "simulation",
    nameKey: "keybinds.actionStepDelta",
    descKey: "keybinds.descStepDelta",
    defaultKey: "F8"
  },
  {
    id: "sim.reset",
    category: "simulation",
    nameKey: "keybinds.actionReset",
    descKey: "keybinds.descReset",
    defaultKey: "F9"
  },
  {
    id: "sim.compile",
    category: "simulation",
    nameKey: "keybinds.actionCompile",
    descKey: "keybinds.descCompile",
    defaultKey: "Ctrl+Enter"
  },

  // --- View & Navigation Actions ---
  {
    id: "view.toggleSidebar",
    category: "view",
    nameKey: "keybinds.actionToggleSidebar",
    descKey: "keybinds.descToggleSidebar",
    defaultKey: "Ctrl+B"
  },
  {
    id: "view.toggleBottomDock",
    category: "view",
    nameKey: "keybinds.actionToggleBottomDock",
    descKey: "keybinds.descToggleBottomDock",
    defaultKey: "Ctrl+J"
  },
  {
    id: "view.toggleFullscreen",
    category: "view",
    nameKey: "keybinds.actionToggleFullscreen",
    descKey: "keybinds.descToggleFullscreen",
    defaultKey: "F11"
  },
  {
    id: "view.customizeLayout",
    category: "view",
    nameKey: "keybinds.actionCustomizeLayout",
    descKey: "keybinds.descCustomizeLayout",
    defaultKey: "Ctrl+Alt+L"
  },
  {
    id: "view.switchFloorplan",
    category: "view",
    nameKey: "keybinds.actionSwitchFloorplan",
    descKey: "keybinds.descSwitchFloorplan",
    defaultKey: "Ctrl+Alt+F"
  },

  // --- Tools & General Actions ---
  {
    id: "tools.omnibar",
    category: "tools",
    nameKey: "keybinds.actionOmnibar",
    descKey: "keybinds.descOmnibar",
    defaultKey: "Ctrl+K"
  },
  {
    id: "tools.settings",
    category: "tools",
    nameKey: "keybinds.actionSettings",
    descKey: "keybinds.descSettings",
    defaultKey: "Ctrl+,"
  }
];

const STORAGE_KEY = "axiom_custom_keybinds";

// In-RAM cached state of keybinds map
let keybindsMapCache: Record<string, string> | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error("[keybinds] Listener error:", err);
    }
  }
}

export function subscribeKeybinds(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Get all active keybindings (defaults overridden by custom storage)
export function getAllKeybinds(): Record<KeybindActionId, string> {
  if (keybindsMapCache) {
    return keybindsMapCache as Record<KeybindActionId, string>;
  }

  const result: Record<string, string> = {};
  for (const def of KEYBIND_DEFINITIONS) {
    result[def.id] = def.defaultKey;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "string" && v.trim()) {
              result[k] = v.trim();
            }
          }
        }
      }
    } catch (err) {
      console.warn("[keybinds] Failed to load custom keybinds:", err);
    }
  }

  keybindsMapCache = result;
  return result as Record<KeybindActionId, string>;
}

export function getKeybind(actionId: KeybindActionId): string {
  const map = getAllKeybinds();
  return map[actionId] ?? KEYBIND_DEFINITIONS.find((d) => d.id === actionId)?.defaultKey ?? "";
}

export function isKeybindCustomized(actionId: KeybindActionId): boolean {
  const def = KEYBIND_DEFINITIONS.find((d) => d.id === actionId);
  if (!def) return false;
  const current = getKeybind(actionId);
  return current !== def.defaultKey;
}

export function saveKeybind(actionId: KeybindActionId, chord: string): void {
  const cleanChord = chord.trim();
  const current = getAllKeybinds();
  current[actionId] = cleanChord;
  keybindsMapCache = { ...current };

  if (typeof window !== "undefined") {
    try {
      // Build pure custom diff to keep storage lean
      const diff: Record<string, string> = {};
      for (const def of KEYBIND_DEFINITIONS) {
        if (current[def.id] !== def.defaultKey) {
          diff[def.id] = current[def.id];
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
    } catch (err) {
      console.error("[keybinds] Failed to save keybind:", err);
    }
  }

  notifyListeners();
}

export function resetKeybind(actionId: KeybindActionId): void {
  const def = KEYBIND_DEFINITIONS.find((d) => d.id === actionId);
  if (!def) return;
  saveKeybind(actionId, def.defaultKey);
}

export function resetAllKeybinds(): void {
  const result: Record<string, string> = {};
  for (const def of KEYBIND_DEFINITIONS) {
    result[def.id] = def.defaultKey;
  }
  keybindsMapCache = result;

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("[keybinds] Failed to reset keybinds:", err);
    }
  }

  notifyListeners();
}

// Find if any existing action already uses this key combination
export function findKeybindConflict(
  chord: string,
  excludeActionId?: KeybindActionId
): KeybindDefinition | null {
  const normalizedTarget = normalizeKeyChord(chord);
  if (!normalizedTarget) return null;

  const current = getAllKeybinds();
  for (const def of KEYBIND_DEFINITIONS) {
    if (excludeActionId && def.id === excludeActionId) continue;
    const existing = normalizeKeyChord(current[def.id]);
    if (existing === normalizedTarget) {
      return def;
    }
  }
  return null;
}

// Normalize a keyboard event into canonical "Ctrl+Alt+Shift+Key" format
export function parseEventToChord(e: KeyboardEvent): string | null {
  // Ignore bare modifier key presses
  const key = e.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) {
    return null;
  }

  const parts: string[] = [];

  // Use Ctrl for both Control and Meta (Mac Cmd) for cross-platform consistency
  if (e.ctrlKey || e.metaKey) {
    parts.push("Ctrl");
  }
  if (e.altKey) {
    parts.push("Alt");
  }
  if (e.shiftKey) {
    parts.push("Shift");
  }

  let formattedKey = key;

  // Normalize specific keys
  if (key === " ") formattedKey = "Space";
  else if (key === "Escape") formattedKey = "Esc";
  else if (key.length === 1) formattedKey = key.toUpperCase();
  else if (key.startsWith("Arrow")) formattedKey = key.replace("Arrow", "");

  parts.push(formattedKey);
  return parts.join("+");
}

// Normalize any chord string to canonical order (e.g. "Shift+Ctrl+S" -> "Ctrl+Shift+S")
export function normalizeKeyChord(chord: string): string {
  if (!chord || !chord.trim()) return "";
  const rawParts = chord.split("+").map((p) => p.trim());
  const hasCtrl = rawParts.some((p) => ["ctrl", "control", "cmd", "meta"].includes(p.toLowerCase()));
  const hasAlt = rawParts.some((p) => ["alt", "option"].includes(p.toLowerCase()));
  const hasShift = rawParts.some((p) => p.toLowerCase() === "shift");

  const nonModifier = rawParts.find(
    (p) => !["ctrl", "control", "cmd", "meta", "alt", "option", "shift"].includes(p.toLowerCase())
  );

  const parts: string[] = [];
  if (hasCtrl) parts.push("Ctrl");
  if (hasAlt) parts.push("Alt");
  if (hasShift) parts.push("Shift");
  if (nonModifier) {
    let k = nonModifier;
    if (k.toLowerCase() === "space") k = "Space";
    else if (k.toLowerCase() === "esc" || k.toLowerCase() === "escape") k = "Esc";
    else if (k.length === 1) k = k.toUpperCase();
    parts.push(k);
  }

  return parts.join("+");
}

// Check if a keyboard event matches a given chord
export function matchesKeybind(e: KeyboardEvent, chord: string): boolean {
  const eventChord = parseEventToChord(e);
  if (!eventChord) return false;
  return normalizeKeyChord(eventChord) === normalizeKeyChord(chord);
}

// Format chord into individual keys for rendering `<kbd>` badges
export function splitChordParts(chord: string): string[] {
  if (!chord) return [];
  return chord.split("+").map((p) => p.trim()).filter(Boolean);
}
