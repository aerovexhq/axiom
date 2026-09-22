import { openDB, IDBPDatabase } from "idb";
import { FileSystem, FileEntry, ProjectStorageUsage } from "./fileSystem";
import { withLock } from "../sessionSync";

interface StoredFileRecord {
  path: string;
  name: string;
  parentDir: string;
  content: string;
  isDirectory: boolean;
  size: number;
  updatedAt: number;
}

const DB_NAME = "axiom_vfs";
const DB_VERSION = 1;
const STORE_NAME = "files";

function getCachedQuotaMb(projectId: string): number {
  if (typeof window === "undefined") return 50;
  try {
    const raw = localStorage.getItem("axiom_projects_registry");
    if (raw) {
      const projects = JSON.parse(raw);
      if (Array.isArray(projects)) {
        const p = projects.find((x: { id: string; storageQuotaMb?: number }) => x.id === projectId);
        if (p && typeof p.storageQuotaMb === "number") {
          return p.storageQuotaMb;
        }
      }
    }
  } catch {
    // ignore
  }
  return 50;
}

export class BrowserIndexedDbFileSystem extends FileSystem {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "path" });
            store.createIndex("by_parent", "parentDir");
          }
        }
      });
    }
    return this.dbPromise;
  }

  private splitPath(p: string): { parentDir: string; name: string } {
    const norm = this.normalizePath(p);
    const lastSlash = norm.lastIndexOf("/");
    if (lastSlash <= 0) {
      return { parentDir: "/", name: norm.slice(1) || "" };
    }
    return {
      parentDir: norm.slice(0, lastSlash),
      name: norm.slice(lastSlash + 1)
    };
  }

  async readFile(path: string): Promise<string> {
    const norm = this.normalizePath(path);
    const db = await this.getDB();
    const record = await db.get(STORE_NAME, norm);
    if (!record) {
      throw new Error(`[BrowserVFS] File not found: ${norm}`);
    }
    if (record.isDirectory) {
      throw new Error(`[BrowserVFS] Cannot read directory as file: ${norm}`);
    }
    return record.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const norm = this.normalizePath(path);
    return withLock(`vfs_file_${norm}`, async () => {
      const { parentDir, name } = this.splitPath(norm);

      let projectId: string | null = null;
      const parts = norm.split("/").filter(Boolean);
      if (parts[0] === "projects" && parts.length > 1 && parts[1] !== "registry.json") {
        projectId = parts[1];
      }

      const contentSize = new Blob([content]).size;
      const db = await this.getDB();

      if (projectId) {
        const quotaMb = getCachedQuotaMb(projectId);
        if (quotaMb > 0) {
          const quotaBytes = quotaMb * 1024 * 1024;
          const usage = await this.getProjectStorageUsage(projectId);
          const existingRecord = await db.get(STORE_NAME, norm);
          const oldSize = existingRecord ? existingRecord.size : 0;
          if (usage.totalBytes + contentSize - oldSize > quotaBytes) {
            throw new Error(
              `[StorageQuota] Storage quota exceeded for project '${projectId}' (${quotaMb} MB limit). Purge generated data or increase quota in Project Settings.`
            );
          }
        }
      }

      if (parentDir !== "/" && parentDir !== "") {
        await this.mkdir(parentDir);
      }

      const record: StoredFileRecord = {
        path: norm,
        name,
        parentDir,
        content,
        isDirectory: false,
        size: contentSize,
        updatedAt: Date.now()
      };

      await db.put(STORE_NAME, record);
    });
  }

  async deleteFile(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    return withLock(`vfs_file_${norm}`, async () => {
      const db = await this.getDB();
      await db.delete(STORE_NAME, norm);
    });
  }

  async exists(path: string): Promise<boolean> {
    const norm = this.normalizePath(path);
    if (norm === "/" || norm === "") return true;
    const db = await this.getDB();
    const record = await db.get(STORE_NAME, norm);
    return !!record;
  }

  async listDir(path: string): Promise<string[]> {
    const norm = this.normalizePath(path);
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.store.index("by_parent");
    const records = await index.getAll(norm);
    return records.map((r: StoredFileRecord) => r.name);
  }

  async listDirEntries(path: string): Promise<FileEntry[]> {
    const norm = this.normalizePath(path);
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.store.index("by_parent");
    const records = await index.getAll(norm);
    return records.map((r: StoredFileRecord) => ({
      name: r.name,
      path: r.path,
      isDirectory: r.isDirectory,
      size: r.size,
      updatedAt: r.updatedAt
    }));
  }

  async mkdir(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    if (norm === "/" || norm === "") return;

    const segments = norm.split("/").filter(Boolean);
    const db = await this.getDB();

    let current = "";
    for (const seg of segments) {
      const parentDir = current === "" ? "/" : current;
      current = `${current}/${seg}`;

      const existing = await db.get(STORE_NAME, current);
      if (!existing) {
        const record: StoredFileRecord = {
          path: current,
          name: seg,
          parentDir,
          content: "",
          isDirectory: true,
          size: 0,
          updatedAt: Date.now()
        };
        await db.put(STORE_NAME, record);
      }
    }
  }

  async rmdir(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    return withLock(`vfs_dir_${norm}`, async () => {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const allRecords: StoredFileRecord[] = await tx.store.getAll();

      const prefix = `${norm}/`;
      for (const rec of allRecords) {
        if (rec.path === norm || rec.path.startsWith(prefix)) {
          await tx.store.delete(rec.path);
        }
      }
      await tx.done;
    });
  }

  async getProjectStorageUsage(projectId: string): Promise<ProjectStorageUsage> {
    const db = await this.getDB();
    const prefix = `/projects/${projectId}/`;
    const tx = db.transaction(STORE_NAME, "readonly");
    const allRecords: StoredFileRecord[] = await tx.store.getAll();

    let totalBytes = 0;
    let dataDirBytes = 0;
    let sourceBytes = 0;
    let fileCount = 0;

    for (const rec of allRecords) {
      if (rec.path.startsWith(prefix) && !rec.isDirectory) {
        totalBytes += rec.size;
        fileCount += 1;
        if (rec.path.includes("/.axiom/data/") || rec.path.endsWith("/.axiom/data")) {
          dataDirBytes += rec.size;
        } else {
          sourceBytes += rec.size;
        }
      }
    }

    return { totalBytes, dataDirBytes, sourceBytes, fileCount };
  }

  async purgeProjectData(projectId: string): Promise<number> {
    return withLock(`vfs_purge_${projectId}`, async () => {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const allRecords: StoredFileRecord[] = await tx.store.getAll();
      const prefix = `/projects/${projectId}/.axiom/data/`;

      let freed = 0;
      for (const rec of allRecords) {
        if (rec.path.startsWith(prefix)) {
          freed += rec.size;
          await tx.store.delete(rec.path);
        }
      }
      await tx.done;
      return freed;
    });
  }
}
