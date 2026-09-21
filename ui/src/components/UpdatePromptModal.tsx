import React, { useState } from "react";
import { ArrowUpCircle, ExternalLink, RefreshCw, Sparkles, X, AlertCircle } from "lucide-react";
import { ReleaseManifest } from "../engine/updateChecker";
import { isDesktop, applyDesktopUpdate } from "../engine/platform";
import { Button } from "./ui";

interface UpdatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: ReleaseManifest | null;
  currentCommit: string;
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  isOpen,
  onClose,
  manifest,
  currentCommit
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Strictly disabled in web environment
  if (!isOpen || !manifest || !isDesktop()) return null;

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateStatus("Initiating updater helper process...");

    try {
      const res = await applyDesktopUpdate({
        downloadUrl: manifest.downloadUrl
      });
      if (!res.success) {
        setUpdateError(res.message);
        setIsUpdating(false);
      } else {
        setUpdateStatus("Closing Axiom to replace executable and restart...");
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
      setIsUpdating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(5, 7, 10, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 540,
          maxWidth: "100%",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, transparent 100%)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-blue)"
              }}
            >
              <ArrowUpCircle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Software Update Available
              </h3>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
                A newer build of Axiom EDA has been released
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ width: 28, height: 28 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Commit & Version Comparison Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: "12px 14px",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)"
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>
                Your Installed Build
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span className="mono-num" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {currentCommit}
                </span>
                <span className="badge badge-slate" style={{ fontSize: 10 }}>
                  Active
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--accent-cyan)", fontWeight: 600 }}>
                Latest Release ({manifest.tag || "LTS"})
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span className="mono-num" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)" }}>
                  {manifest.shortCommit || manifest.commit.slice(0, 7)}
                </span>
                <span className="badge badge-cyan" style={{ fontSize: 10 }}>
                  New
                </span>
              </div>
            </div>
          </div>

          {/* Release Highlights Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              <Sparkles size={12} color="var(--accent-blue)" />
              {manifest.releaseName || "Release Highlights"}
            </span>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                backgroundColor: "var(--bg-primary)",
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                maxHeight: 140,
                overflowY: "auto"
              }}
            >
              {manifest.releaseNotes || "Performance optimizations, enhanced simulation features, and stability fixes."}
            </div>
          </div>

          {/* Live Progress or Error State */}
          {updateStatus && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "var(--accent-blue)"
              }}
            >
              <RefreshCw size={14} className={isUpdating ? "spin-fast" : ""} />
              <span>{updateStatus}</span>
            </div>
          )}

          {updateError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "10px 12px",
                backgroundColor: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "#f43f5e"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={14} />
                <span style={{ fontWeight: 600 }}>Update Failed</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{updateError}</span>
              <a
                href={manifest.downloadUrl || "https://github.com/aerovexsim/axiom/releases"}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: "var(--accent-cyan)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}
              >
                Download manually from GitHub Releases <ExternalLink size={11} />
              </a>
            </div>
          )}

          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Published: {manifest.timestamp ? new Date(manifest.timestamp).toLocaleDateString(undefined, { dateStyle: "long" }) : "Recent"}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isUpdating}>
            Remind Me Later
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            icon={isUpdating ? <RefreshCw size={14} className="spin-fast" /> : <ArrowUpCircle size={14} />}
          >
            {isUpdating ? "Restarting..." : "Install Update & Restart"}
          </Button>
        </div>
      </div>
    </div>
  );
};
