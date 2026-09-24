// Axiom EDA — Multi-Window Desktop & Browser Concurrency Manager
// Guarantees independent concurrent windows while enforcing mutual exclusion on active projects.

import { isDesktop } from "./platform";
import { SESSION_ID, TAB_INSTANCE_ID } from "./sessionSync";
import { toast } from "./toast";

const ACTIVE_PROJECTS_STORAGE_KEY = "axiom_active_project_leases";
const LEASE_CHANNEL_NAME = "axiom_project_leases";
export const LEASE_TIMEOUT_MS = 14000;

export interface ProjectLease {
  tabId: string;
  sessionId: string;
  projectId: string;
  projectName: string;
  lastHeartbeat: number;
}

export type LeaseMap = Record<string, ProjectLease>;

export type LeaseEventType = "LEASE_ACQUIRED" | "LEASE_RELEASED" | "LEASE_TAKEN_OVER";

export interface LeaseEvent {
  type: LeaseEventType;
  projectId: string;
  projectName?: string;
  tabId: string;
  sessionId: string;
  timestamp: number;
}

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
const leaseEventListeners = new Set<(event: LeaseEvent) => void>();

function notifyLeaseChange(): void {
  for (const listener of leaseChangeListeners) {
    try {
      listener();
    } catch (e) {
      console.error("[WindowManager] Error in lease change listener:", e);
    }
  }
}

function notifyLeaseEvent(event: LeaseEvent): void {
  for (const listener of leaseEventListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error("[WindowManager] Error in lease event listener:", e);
    }
  }
}

// Dedicated BroadcastChannel for instant cross-tab lease synchronization
let leaseBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    leaseBroadcastChannel = new BroadcastChannel(LEASE_CHANNEL_NAME);
    leaseBroadcastChannel.onmessage = (e: MessageEvent<LeaseEvent>) => {
      if (e.data && e.data.type) {
        notifyLeaseEvent(e.data);
        notifyLeaseChange();
      }
    };
  } catch (err) {
    console.warn("[WindowManager] BroadcastChannel initialization failed:", err);
  }
}

function broadcastLeaseEvent(event: LeaseEvent): void {
  if (leaseBroadcastChannel) {
    try {
      leaseBroadcastChannel.postMessage(event);
    } catch (err) {
      console.warn("[WindowManager] BroadcastChannel postMessage error:", err);
    }
  }
  notifyLeaseEvent(event);
  notifyLeaseChange();
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

/**
 * Subscribes to specific lease events (acquisition, release, takeover) across windows.
 */
export function subscribeToLeaseEvents(listener: (event: LeaseEvent) => void): () => void {
  leaseEventListeners.add(listener);
  return () => {
    leaseEventListeners.delete(listener);
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
 * Checks if a project is actively leased/open in another window or tab.
 * Supports bidirectional lookup matching either projectId or projectName.
 */
export function isProjectActiveInAnotherSession(idOrName: string): boolean {
  if (!idOrName) return false;
  const leases = getLeaseMap();
  const now = Date.now();
  for (const lease of Object.values(leases)) {
    if (lease.projectId === idOrName || lease.projectName === idOrName) {
      // Check if leased by another tab (different tabId) and lease is still unexpired
      const isOtherTab = lease.tabId ? lease.tabId !== TAB_INSTANCE_ID : lease.sessionId !== SESSION_ID;
      if (isOtherTab && now - lease.lastHeartbeat < LEASE_TIMEOUT_MS) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Gets the active lease for a project by ID or Name, if held and unexpired.
 */
export function getActiveProjectLease(idOrName: string): ProjectLease | null {
  if (!idOrName) return null;
  const leases = getLeaseMap();
  const now = Date.now();
  for (const lease of Object.values(leases)) {
    if (lease.projectId === idOrName || lease.projectName === idOrName) {
      if (now - lease.lastHeartbeat < LEASE_TIMEOUT_MS) {
        return lease;
      }
    }
  }
  return null;
}

/**
 * Registers an active lease for the current session and tab on a project.
 */
export function registerActiveProjectLease(projectId: string, projectName: string): boolean {
  if (isProjectActiveInAnotherSession(projectId) || isProjectActiveInAnotherSession(projectName)) {
    return false;
  }
  const leases = getLeaseMap();
  const lease: ProjectLease = {
    tabId: TAB_INSTANCE_ID,
    sessionId: SESSION_ID,
    projectId,
    projectName,
    lastHeartbeat: Date.now()
  };
  leases[projectId] = lease;
  saveLeaseMap(leases);
  broadcastLeaseEvent({
    type: "LEASE_ACQUIRED",
    projectId,
    projectName,
    tabId: TAB_INSTANCE_ID,
    sessionId: SESSION_ID,
    timestamp: Date.now()
  });
  return true;
}

/**
 * Renews the active lease heartbeat for the current project.
 * Returns false if the lease has been taken over or acquired by another active tab.
 */
export function renewActiveProjectLease(projectId: string, projectName: string): boolean {
  const leases = getLeaseMap();
  const existing = leases[projectId];

  if (existing) {
    const isOtherTab = existing.tabId ? existing.tabId !== TAB_INSTANCE_ID : existing.sessionId !== SESSION_ID;
    const isAlive = Date.now() - existing.lastHeartbeat < LEASE_TIMEOUT_MS;
    if (isOtherTab && isAlive) {
      // Lease was taken over or held by another active tab; refuse to overwrite
      return false;
    }
  }

  leases[projectId] = {
    tabId: TAB_INSTANCE_ID,
    sessionId: SESSION_ID,
    projectId,
    projectName,
    lastHeartbeat: Date.now()
  };
  saveLeaseMap(leases);
  return true;
}

/**
 * Releases the active lease when closing a project or window.
 */
export function releaseActiveProjectLease(projectId: string): void {
  const leases = getLeaseMap();
  const existing = leases[projectId];
  if (existing && (existing.tabId === TAB_INSTANCE_ID || existing.sessionId === SESSION_ID)) {
    delete leases[projectId];
    saveLeaseMap(leases);
    broadcastLeaseEvent({
      type: "LEASE_RELEASED",
      projectId,
      projectName: existing.projectName,
      tabId: TAB_INSTANCE_ID,
      sessionId: SESSION_ID,
      timestamp: Date.now()
    });
  }
}

/**
 * Takes over an active project lease forcefully for the current session and tab.
 */
export function takeOverProjectLease(projectId: string, projectName: string): void {
  const leases = getLeaseMap();
  leases[projectId] = {
    tabId: TAB_INSTANCE_ID,
    sessionId: SESSION_ID,
    projectId,
    projectName,
    lastHeartbeat: Date.now()
  };
  saveLeaseMap(leases);
  broadcastLeaseEvent({
    type: "LEASE_TAKEN_OVER",
    projectId,
    projectName,
    tabId: TAB_INSTANCE_ID,
    sessionId: SESSION_ID,
    timestamp: Date.now()
  });
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
  if (projectId && (isProjectActiveInAnotherSession(projectId) || (projectName && isProjectActiveInAnotherSession(projectName)))) {
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

