// Axiom EDA — Native Desktop Tauri IPC FileSystem
// Interacts directly with host operating system files via Tauri IPC

import { FileSystem } from "./fileSystem";

export class TauriIpcFileSystem extends FileSystem {
  private async getInvoke() {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke;
  }

  async readFile(path: string): Promise<string> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      const content = await invoke<string>("fs_read_file", { path: norm });
      return content;
    } catch (err: unknown) {
      throw new Error(`[TauriFS] Error reading file '${norm}': ${String(err)}`);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      await invoke("fs_write_file", { path: norm, content });
    } catch (err: unknown) {
      throw new Error(`[TauriFS] Error writing file '${norm}': ${String(err)}`);
    }
  }

  async deleteFile(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      await invoke("fs_remove_file", { path: norm });
    } catch (err: unknown) {
      throw new Error(`[TauriFS] Error deleting file '${norm}': ${String(err)}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      return await invoke<boolean>("fs_exists", { path: norm });
    } catch {
      return false;
    }
  }

  async listDir(path: string): Promise<string[]> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      const entries = await invoke<string[]>("fs_list_dir", { path: norm });
      return entries;
    } catch (err: unknown) {
      throw new Error(`[TauriFS] Error listing directory '${norm}': ${String(err)}`);
    }
  }

  async mkdir(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      await invoke("fs_create_dir", { path: norm });
    } catch (err: unknown) {
      throw new Error(`[TauriFS] Error creating directory '${norm}': ${String(err)}`);
    }
  }

  async rmdir(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    const invoke = await this.getInvoke();
    try {
      await invoke("fs_remove_file", { path: norm });
    } catch (err: unknown) {
      throw new Error(`[TauriFS] Error removing directory '${norm}': ${String(err)}`);
    }
  }
}
