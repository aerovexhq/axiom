import { FileSystem, ProjectStorageUsage } from "./fileSystem";

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

  async getProjectStorageUsage(projectId: string): Promise<ProjectStorageUsage> {
    const invoke = await this.getInvoke();
    const projDir = `/projects/${projectId}`;
    try {
      const totalBytes = await invoke<number>("get_directory_size", { path: projDir });
      const dataDirBytes = await invoke<number>("get_directory_size", { path: `${projDir}/.axiom/data` }).catch(() => 0);
      const files = await this.listDir(projDir).catch(() => []);
      return {
        totalBytes,
        dataDirBytes,
        sourceBytes: Math.max(0, totalBytes - dataDirBytes),
        fileCount: files.length
      };
    } catch {
      return { totalBytes: 0, dataDirBytes: 0, sourceBytes: 0, fileCount: 0 };
    }
  }

  async purgeProjectData(projectId: string): Promise<number> {
    const invoke = await this.getInvoke();
    const projDir = `/projects/${projectId}`;
    try {
      const freed = await invoke<number>("purge_data_directory", { projectPath: projDir });
      return freed;
    } catch {
      return 0;
    }
  }
}
