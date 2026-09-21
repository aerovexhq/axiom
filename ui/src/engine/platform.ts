// Axiom EDA — Universal Platform & Desktop Bridge
// Provides unified runtime environment detection, native OS window controls, and file system dialogs.

/**
 * Returns true if running inside native Tauri v2 desktop application.
 */
export function isDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

/**
 * Operating system platform detection.
 */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
}

export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Win/i.test(navigator.platform || navigator.userAgent);
}

export function isLinux(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Linux/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Opens a native OS folder selection dialog (on Desktop via Tauri `pick_folder` command).
 * Returns the selected absolute directory path, or null if cancelled or not on desktop.
 */
export async function openFolderDialog(): Promise<string | null> {
  if (!isDesktop()) {
    return null;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string | null>("pick_folder");
    return path ?? null;
  } catch (err) {
    console.warn("[Platform] Failed to open native folder dialog:", err);
    return null;
  }
}

/**
 * Opens a native OS multi-file selection dialog (on Desktop via Tauri `pick_files` command).
 * Returns array of selected absolute file paths, or null if cancelled or not on desktop.
 */
export async function openFilesDialog(options?: {
  title?: string;
  extensions?: string[];
}): Promise<string[] | null> {
  if (!isDesktop()) {
    return null;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const paths = await invoke<string[] | null>("pick_files", {
      title: options?.title,
      extensions: options?.extensions
    });
    return paths ?? null;
  } catch (err) {
    console.warn("[Platform] Failed to open native files dialog:", err);
    return null;
  }
}

/**
 * Native OS window minimize.
 */
export async function minimizeWindow(): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  } catch (err) {
    console.warn("[Platform] Failed to minimize window:", err);
  }
}

/**
 * Native OS window maximize / toggle maximize.
 */
export async function toggleMaximizeWindow(): Promise<void> {
  if (!isDesktop()) {
    toggleBrowserFullscreen();
    return;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  } catch (err) {
    console.warn("[Platform] Failed to toggle maximize window:", err);
  }
}

/**
 * Native OS window close.
 */
export async function closeWindow(): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (err) {
    console.warn("[Platform] Failed to close window:", err);
  }
}

/**
 * Toggles standard browser full screen mode (for Web mode).
 */
export function toggleBrowserFullscreen(): void {
  if (typeof document === "undefined") return;
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn("[Platform] Fullscreen request failed:", err);
    });
  } else {
    document.exitFullscreen().catch((err) => {
      console.warn("[Platform] Exit fullscreen failed:", err);
    });
  }
}

/**
 * Initiates the desktop self-updater:
 * Spawns a detached updater helper process, closes the running Tauri application,
 * replaces the executable, launches the new executable, and stops the updater process.
 */
export async function applyDesktopUpdate(params: {
  downloadUrl?: string;
  newBinaryPath?: string;
}): Promise<{ success: boolean; message: string }> {
  if (!isDesktop()) {
    return { success: false, message: "Self-update is only available on desktop runtime." };
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<{ success: boolean; message: string }>("apply_desktop_update", {
      downloadUrl: params.downloadUrl,
      newBinaryPath: params.newBinaryPath
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
