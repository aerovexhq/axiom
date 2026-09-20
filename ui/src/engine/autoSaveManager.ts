// Axiom EDA — Persistent Multi-Runtime Auto-Save Manager
// Coordinates non-blocking debounced auto-saving for editor files and project state.

const AUTO_SAVE_STORAGE_KEY = "axiom_auto_save_enabled";
const AUTO_SAVE_EVENT = "axiom_auto_save_changed";
const SAVE_STATE_EVENT = "axiom_save_state_changed";

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Returns whether Auto Save is enabled. Default is true.
 */
export function isAutoSaveEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(AUTO_SAVE_STORAGE_KEY);
  if (stored === null) {
    // Enabled by default as required by specification
    return true;
  }
  return stored === "true";
}

/**
 * Sets Auto Save enabled state and persists to localStorage.
 */
export function setAutoSaveEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_SAVE_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent(AUTO_SAVE_EVENT, {
      detail: { enabled }
    })
  );
}

/**
 * Schedules a debounced auto-save if Auto Save is enabled.
 * Default debounce is 800ms.
 */
export function scheduleAutoSave(onSave: () => void, delayMs = 800): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  if (!isAutoSaveEnabled()) {
    return;
  }

  autoSaveTimer = setTimeout(() => {
    try {
      onSave();
      notifySaveState(true);
    } catch (err) {
      console.warn("[AutoSave] Error during scheduled auto-save:", err);
    } finally {
      autoSaveTimer = null;
    }
  }, delayMs);
}

/**
 * Cancels any currently pending auto-save timeout.
 */
export function cancelPendingAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Notifies the UI of saved/dirty state changes.
 */
export function notifySaveState(isSaved: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SAVE_STATE_EVENT, {
      detail: { isSaved }
    })
  );
}

/**
 * Subscribes to Auto Save enabled/disabled toggles.
 */
export function subscribeAutoSave(callback: (enabled: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ enabled: boolean }>;
    callback(custom.detail?.enabled ?? isAutoSaveEnabled());
  };
  window.addEventListener(AUTO_SAVE_EVENT, handler);
  return () => window.removeEventListener(AUTO_SAVE_EVENT, handler);
}

/**
 * Subscribes to Save State notifications (saved vs dirty).
 */
export function subscribeSaveState(callback: (isSaved: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ isSaved: boolean }>;
    callback(custom.detail?.isSaved ?? true);
  };
  window.addEventListener(SAVE_STATE_EVENT, handler);
  return () => window.removeEventListener(SAVE_STATE_EVENT, handler);
}
