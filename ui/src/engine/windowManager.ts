// Axiom EDA — Multi-Window Desktop & Browser Concurrency Manager
// Guarantees independent concurrent windows while enforcing mutual exclusion on active projects.

import { isDesktop } from "./platform";
import { SESSION_ID } from "./sessionSync";
import { toast } from "./toast";

const ACTIVE_PROJECTS_STORAGE_KEY = "axiom_active_project_leases";
const LEASE_TIMEOUT_MS = 8000;

interface ProjectLease {
  sessionId: string;
  projectId: string;
  projectName: string;
  lastHeartbeat: number;
}

type LeaseMap = Record<string, ProjectLease>;

function getLeaseMap(): LeaseMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: LeaseMap = JSON.parse(raw);
    const now = Date.now();
    // Prune stale leases
    const cleaned: LeaseMap = {};
    for (const [id, lease] of Object.entries(parsed)) {
      if (now - lease.lastHeartbeat < LEASE_TIMEOUT_MS) {
        cleaned[id] = lease;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

const leaseChangeListeners = new Set<() => void>();

function notifyLeaseChange(): void {
  for (const listener of leaseChangeListeners) {
    try {
      listener();
    } catch (e) {
      console.error("[WindowManager] Error in lease change listener:", e);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ACTIVE_PROJECTS_STORAGE_KEY) {
      notifyLeaseChange();
    }
  });
}

/**
 * Subscribes to cross-window and local project lease status changes.
 */
export function subscribeToProjectLeases(listener: () => void): () => void {
  leaseChangeListeners.add(listener);
  return () => {
    leaseChangeListeners.delete(listener);
  };
}

function saveLeaseMap(map: LeaseMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_PROJECTS_STORAGE_KEY, JSON.stringify(map));
    notifyLeaseChange();
  } catch {}
}

/**
 * Checks if a project is actively leased/open in another window or session.
 */
export function isProjectActiveInAnotherSession(projectId: string): boolean {
  const leases = getLeaseMap();
  const lease = leases[projectId];
  if (!lease) return false;
  // If leased by another session and not timed out
  return lease.sessionId !== SESSION_ID && (Date.now() - lease.lastHeartbeat < LEASE_TIMEOUT_MS);
}

/**
 * Registers an active lease for the current session on a project.
 */
export function registerActiveProjectLease(projectId: string, projectName: string): boolean {
  if (isProjectActiveInAnotherSession(projectId)) {
    return false;
  }
  const leases = getLeaseMap();
  leases[projectId] = {
    sessionId: SESSION_ID,
    projectId,
    projectName,
    lastHeartbeat: Date.now()
  };
  saveLeaseMap(leases);
  return true;
}

/**
 * Renews the active lease heartbeat for the current project.
 */
export function renewActiveProjectLease(projectId: string, projectName: string): void {
  const leases = getLeaseMap();
  leases[projectId] = {
    sessionId: SESSION_ID,
    projectId,
    projectName,
    lastHeartbeat: Date.now()
  };
  saveLeaseMap(leases);
}

/**
 * Releases the active lease when closing a project or window.
 */
export function releaseActiveProjectLease(projectId: string): void {
  const leases = getLeaseMap();
  if (leases[projectId] && leases[projectId].sessionId === SESSION_ID) {
    delete leases[projectId];
    saveLeaseMap(leases);
  }
}

/**
 * Takes over an active project lease forcefully for the current session.
 */
export function takeOverProjectLease(projectId: string, projectName: string): void {
  const leases = getLeaseMap();
  leases[projectId] = {
    sessionId: SESSION_ID,
    projectId,
    projectName,
    lastHeartbeat: Date.now()
  };
  saveLeaseMap(leases);
}

/**
 * Gets the current lease for a project, if any.
 */
export function getProjectLease(projectId: string): ProjectLease | null {
  const leases = getLeaseMap();
  return leases[projectId] || null;
}

/**
 * Opens a new Axiom window (Desktop WebviewWindow or Browser tab).
 * If a projectId is provided, verifies it is not already active in another window.
 */
export async function openInNewWindow(projectId?: string, projectName?: string): Promise<boolean> {
  if (projectId && isProjectActiveInAnotherSession(projectId)) {
    toast.warning(
      `Project "${projectName || projectId}" is already open in another window.`
    );
    return false;
  }

  if (isDesktop()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("create_new_window", { projectId: projectId || null });
      return true;
    } catch (err) {
      console.warn("[WindowManager] Failed to create desktop window via Tauri, falling back to window.open", err);
    }
  }

  // Web Browser fallback: preserve /studio/ path when running on web
  const basePath = typeof window !== "undefined"
    ? (window.location.pathname.startsWith("/studio") ? "/studio/" : window.location.pathname)
    : "/";
  const url = projectId ? `${basePath}?project=${encodeURIComponent(projectId)}` : basePath;
  window.open(url, "_blank");
  return true;
}

