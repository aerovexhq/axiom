import React from "react";
import { ArrowUpCircle, ExternalLink, RefreshCw, Sparkles, X } from "lucide-react";
import { ReleaseManifest } from "../engine/updateChecker";
import { isDesktop } from "../engine/platform";
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
  if (!isOpen || !manifest) return null;

  const handleApplyUpdate = () => {
    if (isDesktop()) {
      // Desktop: Open GitHub releases page or download link
      const url = manifest.downloadUrl || "https://github.com/larvance/axiom/releases";
      window.open(url, "_blank");
      onClose();
    } else {
      // Web: Force cache clear and reload
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
      if ("caches" in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
      window.location.reload();
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
          <Button variant="ghost" size="sm" onClick={onClose}>
            Remind Me Later
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApplyUpdate}
            icon={isDesktop() ? <ExternalLink size={14} /> : <RefreshCw size={14} />}
          >
            {isDesktop() ? "Download Latest Release" : "Update to Latest Version"}
          </Button>
        </div>
      </div>
    </div>
  );
};
