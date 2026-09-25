// Axiom EDA — Continuous Release Manifest & Auto-Update Supervision
// Inspects remote release version metadata hosted on GitHub Pages and checks against local commit SHA.

import { isDesktop } from "./platform";

export interface ReleaseManifest {
  commit: string;
  shortCommit: string;
  tag: string;
  releaseName: string;
  timestamp: string;
  releaseNotes: string;
  downloadUrl: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentCommit: string;
  currentVersion: string;
  latestManifest: ReleaseManifest | null;
  error?: string;
}

// Current client build reference
export const CURRENT_CLIENT_COMMIT = "v1.0.1";
export const CURRENT_CLIENT_VERSION = "v1.0.1";

/**
 * Gets the active runtime's commit hash (queries Tauri desktop command if on desktop, or compile constant).
 */
export async function getRuntimeCommitHash(): Promise<string> {
  if (isDesktop()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<{ version: string; commit: string }>("get_app_version");
      if (info && info.commit) {
        return info.commit.slice(0, 7);
      }
    } catch {
      // fallback
    }
  }
  return CURRENT_CLIENT_COMMIT;
}

/**
 * Checks GitHub Pages remote release manifest for newer commits/releases.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentCommit = await getRuntimeCommitHash();
  const currentVersion = CURRENT_CLIENT_VERSION;

  // Try relative endpoint first, then remote domain fallback
  const endpoints = [
    "/version.json",
    "https://axiom.aerovex.net/version.json",
    "/studio/version.json"
  ];

  let manifest: ReleaseManifest | null = null;
  let lastError: string | undefined;

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        cache: "no-cache",
        headers: { Accept: "application/json" }
      });
      if (resp.ok) {
        manifest = (await resp.json()) as ReleaseManifest;
        break;
      }
    } catch (err) {
      lastError = String(err);
    }
  }

  if (!manifest) {
    return {
      updateAvailable: false,
      currentCommit,
      currentVersion,
      latestManifest: null,
      error: lastError || "Failed to reach release update server."
    };
  }

  const remoteShort = (manifest.shortCommit || manifest.commit.slice(0, 7)).toLowerCase();
  const localShort = currentCommit.toLowerCase();

  const updateAvailable = remoteShort !== localShort && manifest.commit.length > 0;

  return {
    updateAvailable,
    currentCommit: localShort,
    currentVersion,
    latestManifest: manifest
  };
}
