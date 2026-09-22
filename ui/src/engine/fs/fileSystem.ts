// Axiom EDA — Unified Abstract FileSystem Architecture
// Supports dual-runtime execution: Browser IndexedDB Virtual FS and Native Desktop Tauri IPC FS

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: number;
}

export interface FsStat {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  updatedAt: number;
}

export interface ProjectStorageUsage {
  totalBytes: number;
  dataDirBytes: number;
  sourceBytes: number;
  fileCount: number;
}

export abstract class FileSystem {
  /**
   * Reads a text file from the filesystem.
   * @param path Absolute or virtual path (e.g. "/projects/proj_123/sources_1/counter.v")
   */
  abstract readFile(path: string): Promise<string>;

  /**
   * Writes content to a text file. Creates parent directories if needed.
   * @param path File path
   * @param content String contents
   */
  abstract writeFile(path: string, content: string): Promise<void>;

  /**
   * Deletes a file from the filesystem.
   * @param path File path
   */
  abstract deleteFile(path: string): Promise<void>;

  /**
   * Checks if a file or directory exists.
   * @param path Path to check
   */
  abstract exists(path: string): Promise<boolean>;

  /**
   * Lists the direct children (file/directory names) within a directory.
   * @param path Directory path
   */
  abstract listDir(path: string): Promise<string[]>;

  /**
   * Creates a directory (and any necessary intermediate directories).
   * @param path Directory path
   */
  abstract mkdir(path: string): Promise<void>;

  /**
   * Removes a directory and all of its contents.
   * @param path Directory path
   */
  abstract rmdir(path: string): Promise<void>;

  /**
   * Computes storage usage breakdown for a given project.
   * @param projectId Project identifier
   */
  abstract getProjectStorageUsage(projectId: string): Promise<ProjectStorageUsage>;

  /**
   * Purges temporary/generated simulation & synthesis data in .axiom/data/.
   * @param projectId Project identifier
   * @returns Number of bytes reclaimed
   */
  abstract purgeProjectData(projectId: string): Promise<number>;

  /**
   * Normalizes a path string to POSIX format (/ separated, no trailing slash unless root).
   */
  protected normalizePath(p: string): string {
    let normalized = p.replace(/\\/g, "/").replace(/\/+/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}
