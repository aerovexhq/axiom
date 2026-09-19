// Axiom EDA — Multi-Session Concurrency, Web Locks & Real-Time Cross-Tab Synchronization
// Guarantees atomic FileSystem/Registry mutations and real-time live synchronization between browser tabs and desktop windows.

export interface SessionSyncEvent {
  type: "REGISTRY_UPDATED" | "PROJECT_SAVED" | "PROJECT_TRASHED" | "PROJECT_DELETED";
  projectId?: string;
  updatedAt?: string;
  sourceSessionId: string;
}

/**
 * Unique identifier for the current browser tab or desktop webview window session.
 */
export const SESSION_ID: string = (() => {
  if (typeof window !== "undefined") {
    const existing = (window as unknown as { __AXIOM_SESSION_ID__?: string }).__AXIOM_SESSION_ID__;
    if (existing) return existing;
    const created = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    (window as unknown as { __AXIOM_SESSION_ID__?: string }).__AXIOM_SESSION_ID__ = created;
    return created;
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
})();

// In-memory sequential queue fallback for environments without navigator.locks
const inMemoryQueues = new Map<string, Promise<unknown>>();

/**
 * Executes an asynchronous operation under a named exclusive lock.
 * Uses Web Locks API (navigator.locks) across tabs and windows when available.
 */
export async function withLock<T>(lockName: string, operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && "locks" in navigator && typeof navigator.locks?.request === "function") {
    return new Promise<T>((resolve, reject) => {
      navigator.locks.request(lockName, { mode: "exclusive" }, async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    });
  }

  // Sequential queue fallback
  const previous = inMemoryQueues.get(lockName) || Promise.resolve();
  let release: () => void = () => {};
  const lockPromise = new Promise<void>((res) => {
    release = res;
  });
  inMemoryQueues.set(lockName, previous.then(() => lockPromise));

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (inMemoryQueues.get(lockName) === lockPromise) {
      inMemoryQueues.delete(lockName);
    }
  }
}

/**
 * Real-time cross-tab and cross-window event broadcaster.
 */
class SessionBroadcaster {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: SessionSyncEvent) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel("axiom_session_sync");
        this.channel.onmessage = (event: MessageEvent<SessionSyncEvent>) => {
          if (!event.data || event.data.sourceSessionId === SESSION_ID) {
            // Ignore messages from the same session
            return;
          }
          this.notifyListeners(event.data);
        };
      } catch (err) {
        console.warn("[SessionSync] BroadcastChannel not supported, running single-tab:", err);
      }
    }
  }

  /**
   * Broadcast an event to all other open sessions.
   */
  broadcast(eventData: Omit<SessionSyncEvent, "sourceSessionId">): void {
    const payload: SessionSyncEvent = {
      ...eventData,
      sourceSessionId: SESSION_ID
    };
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.warn("[SessionSync] Failed to broadcast event:", err);
      }
    }
  }

  /**
   * Subscribe to events broadcasted from other sessions.
   */
  subscribe(listener: (event: SessionSyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: SessionSyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[SessionSync] Error in session sync listener:", err);
      }
    }
  }
}

export const sessionBroadcaster = new SessionBroadcaster();
