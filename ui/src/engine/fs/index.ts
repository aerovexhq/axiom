// Axiom EDA — Unified FileSystem Export & Factory
import { FileSystem } from "./fileSystem";
import { BrowserIndexedDbFileSystem } from "./browserFileSystem";
import { TauriIpcFileSystem } from "./tauriFileSystem";

export * from "./fileSystem";
export * from "./browserFileSystem";
export * from "./tauriFileSystem";

let fsInstance: FileSystem | null = null;

/**
 * Returns the active FileSystem instance (Tauri IPC in desktop app, IndexedDB in browser).
 */
export function getFileSystem(): FileSystem {
  if (!fsInstance) {
    const isTauri =
      typeof window !== "undefined" &&
      !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

    if (isTauri) {
      fsInstance = new TauriIpcFileSystem();
    } else {
      fsInstance = new BrowserIndexedDbFileSystem();
    }
  }
  return fsInstance;
}
