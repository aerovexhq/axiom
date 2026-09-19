// Axiom EDA — Browser IndexedDB Virtual FileSystem
// Implements FileSystem interface using IndexedDB (idb) with hierarchical POSIX paths

import { openDB, IDBPDatabase } from "idb";
import { FileSystem, FileEntry } from "./fileSystem";
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

      if (parentDir !== "/" && parentDir !== "") {
        await this.mkdir(parentDir);
      }

      const db = await this.getDB();
      const record: StoredFileRecord = {
        path: norm,
        name,
        parentDir,
        content,
        isDirectory: false,
        size: new Blob([content]).size,
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
}
