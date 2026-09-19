// Axiom EDA — Professional Project Registry & Lifecycle Engine
// Conforming to POSIX filesystem conventions and dual-runtime persistence (IndexedDB / Tauri Host)

import { AxiomProject } from "./projectModel";
import { getFileSystem } from "./fs";
import { withLock, sessionBroadcaster } from "./sessionSync";

export interface ProjectMetadata {
  id: string;             // Unique slug: [a-zA-Z0-9_.-]+, exactly matches filesystem folder name
  name: string;           // Same as id
  targetDevice: string;   // e.g. "Artix-7 xc7a35t-csg324-1"
  topModule: string;      // e.g. "logic_circuit"
  fileCount: number;
  templateId?: string;
  createdAt: string;      // ISO string
  updatedAt: string;      // ISO string
  isTrashed?: boolean;    // Soft-delete flag
  trashedAt?: string;     // ISO string when moved to trash
}

export const REGISTRY_STORAGE_KEY = "axiom_projects_registry";
export const REGISTRY_FS_PATH = "/projects/registry.json";

/**
 * Strict regex for project and directory names:
 * Letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-), and dots (.).
 */
export const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Sanitizes any raw input string to conform strictly to [a-zA-Z0-9_.-].
 * Replaces spaces and invalid characters with an underscore.
 */
export function sanitizeProjectName(raw: string): string {
  let sanitized = raw.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
  // Prevent relative POSIX traversal or empty names
  if (!sanitized || sanitized === "." || sanitized === ".." || /^\.+$/.test(sanitized)) {
    sanitized = `project_${Date.now()}`;
  }
  return sanitized;
}

/**
 * Validates a project name for syntax correctness and registry collision.
 */
export function validateProjectName(
  name: string,
  existingProjects: ProjectMetadata[],
  currentId?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "Project name cannot be empty." };
  }
  if (!PROJECT_NAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: "Project name may only contain letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-), and dots (.)."
    };
  }
  if (trimmed === "." || trimmed === ".." || /^\.+$/.test(trimmed)) {
    return { valid: false, error: "Project name cannot be '.' or '..'." };
  }

  const collision = existingProjects.find(
    (p) => p.id.toLowerCase() === trimmed.toLowerCase() && p.id !== currentId
  );
  if (collision) {
    if (collision.isTrashed) {
      return {
        valid: false,
        error: `A project named "${trimmed}" is currently in Trash. Restore or permanently delete it first.`
      };
    }
    return { valid: false, error: `A project named "${trimmed}" already exists.` };
  }

  return { valid: true };
}

/**
 * Synchronously loads project metadata list from localStorage cache.
 */
export function loadProjectRegistry(): ProjectMetadata[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[ProjectRegistry] Failed to parse cached registry:", err);
  }
  return [];
}

/**
 * Persists the project metadata list to localStorage and mirrors to FileSystem.
 */
export async function saveProjectRegistry(projects: ProjectMetadata[]): Promise<void> {
  return withLock("axiom_registry_lock", async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(projects));
      } catch (err) {
        console.warn("[ProjectRegistry] Failed to persist registry to localStorage:", err);
      }
    }

    try {
      const fs = getFileSystem();
      await fs.mkdir("/projects");
      await fs.writeFile(REGISTRY_FS_PATH, JSON.stringify({ version: 1, projects }, null, 2));
    } catch (err) {
      console.warn("[ProjectRegistry] Failed to write registry to FileSystem:", err);
    }
  });
}

/**
 * Asynchronously synchronizes project registry from the FileSystem.
 */
export async function syncRegistryFromFs(): Promise<ProjectMetadata[]> {
  try {
    const fs = getFileSystem();
    const exists = await fs.exists(REGISTRY_FS_PATH);
    if (exists) {
      const content = await fs.readFile(REGISTRY_FS_PATH);
      const data = JSON.parse(content);
      if (data && Array.isArray(data.projects)) {
        if (typeof window !== "undefined") {
          localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(data.projects));
        }
        return data.projects;
      }
    }
  } catch (err) {
    console.warn("[ProjectRegistry] Failed to read registry from FileSystem:", err);
  }
  return loadProjectRegistry();
}

/**
 * Saves a project completely into the FileSystem under /projects/{project.id}/
 * and updates the project registry entry.
 */
export async function createAndPersistProject(project: AxiomProject): Promise<void> {
  return withLock(`axiom_project_lock_${project.id}`, async () => {
    const fs = getFileSystem();
    const projDir = `/projects/${project.id}`;

    // Ensure directories exist
    await fs.mkdir(`${projDir}/sources_1`);
    await fs.mkdir(`${projDir}/sim_1`);
    await fs.mkdir(`${projDir}/constrs_1`);

    // Write manifest and source files
    await fs.writeFile(`${projDir}/project.json`, JSON.stringify(project, null, 2));
    for (const f of project.files) {
      await fs.writeFile(`${projDir}/${f.fileSet}/${f.name}`, f.content);
    }

    // Update localStorage copy
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`axiom_project_${project.id}`, JSON.stringify(project));
        localStorage.setItem("axiom_current_project", JSON.stringify(project));
      } catch (err) {
        console.warn("[ProjectRegistry] LocalStorage quota exceeded:", err);
      }
    }

    // Update registry under registry lock
    const registry = loadProjectRegistry();
    const existingIdx = registry.findIndex((p) => p.id === project.id);
    const meta: ProjectMetadata = {
      id: project.id,
      name: project.id,
      targetDevice: project.targetDevice,
      topModule: project.topModule,
      fileCount: project.files.length,
      templateId: project.templateId,
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTrashed: false
    };

    if (existingIdx >= 0) {
      registry[existingIdx] = meta;
    } else {
      registry.unshift(meta);
    }

    await saveProjectRegistry(registry);

    // Broadcast change across all other sessions/tabs
    sessionBroadcaster.broadcast({
      type: "PROJECT_SAVED",
      projectId: project.id,
      updatedAt: new Date().toISOString()
    });
    sessionBroadcaster.broadcast({
      type: "REGISTRY_UPDATED"
    });
  });
}

/**
 * Loads a full AxiomProject by ID, either from local cache or FileSystem.
 */
export async function loadProjectById(id: string): Promise<AxiomProject | null> {
  // Try localStorage fast path
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`axiom_project_${id}`);
      if (cached) {
        const parsed = JSON.parse(cached) as AxiomProject;
        if (parsed && parsed.files && parsed.files.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Continue to FS fallback
    }
  }

  // Fallback to FileSystem
  try {
    const fs = getFileSystem();
    const manifestPath = `/projects/${id}/project.json`;
    if (await fs.exists(manifestPath)) {
      const jsonStr = await fs.readFile(manifestPath);
      const parsed = JSON.parse(jsonStr) as AxiomProject;
      if (parsed && parsed.files && parsed.files.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`axiom_project_${id}`, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[ProjectRegistry] Failed to read project ${id} from FileSystem:`, err);
  }

  return null;
}

/**
 * Moves a project to Trash (Soft Delete).
 */
export async function trashProject(id: string): Promise<void> {
  await withLock("axiom_registry_lock", async () => {
    const registry = loadProjectRegistry();
    const target = registry.find((p) => p.id === id);
    if (target) {
      target.isTrashed = true;
      target.trashedAt = new Date().toISOString();
      await saveProjectRegistry(registry);
    }
  });
  sessionBroadcaster.broadcast({ type: "PROJECT_TRASHED", projectId: id });
  sessionBroadcaster.broadcast({ type: "REGISTRY_UPDATED" });
}

/**
 * Restores a project from Trash back to Active.
 */
export async function restoreProject(id: string): Promise<void> {
  await withLock("axiom_registry_lock", async () => {
    const registry = loadProjectRegistry();
    const target = registry.find((p) => p.id === id);
    if (target) {
      target.isTrashed = false;
      delete target.trashedAt;
      await saveProjectRegistry(registry);
    }
  });
  sessionBroadcaster.broadcast({ type: "REGISTRY_UPDATED" });
}

/**
 * Permanently deletes a project (Hard Delete) from FileSystem and Registry.
 */
export async function permanentDeleteProject(id: string): Promise<void> {
  await withLock(`axiom_project_lock_${id}`, async () => {
    // 1. Delete from FileSystem
    try {
      const fs = getFileSystem();
      await fs.rmdir(`/projects/${id}`);
    } catch (err) {
      console.warn(`[ProjectRegistry] Error deleting directory /projects/${id}:`, err);
    }

    // 2. Clear local storage cache
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`axiom_project_${id}`);
        const cur = localStorage.getItem("axiom_current_project");
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed.id === id) {
            localStorage.removeItem("axiom_current_project");
          }
        }
      } catch {
        // Ignore
      }
    }

    // 3. Remove from registry under registry lock
    await withLock("axiom_registry_lock", async () => {
      const registry = loadProjectRegistry().filter((p) => p.id !== id);
      await saveProjectRegistry(registry);
    });
  });

  sessionBroadcaster.broadcast({ type: "PROJECT_DELETED", projectId: id });
  sessionBroadcaster.broadcast({ type: "REGISTRY_UPDATED" });
}

/**
 * Permanently deletes all projects currently in Trash.
 */
export async function emptyTrash(): Promise<void> {
  const registry = loadProjectRegistry();
  const trashed = registry.filter((p) => p.isTrashed);
  for (const p of trashed) {
    await permanentDeleteProject(p.id);
  }
}
