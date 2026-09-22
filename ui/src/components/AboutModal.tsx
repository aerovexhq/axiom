import React from "react";
import { ExternalLink, X } from "lucide-react";
import { CURRENT_CLIENT_COMMIT, CURRENT_CLIENT_VERSION } from "../engine/updateChecker";
import { Button } from "./ui";
import { useTranslation } from "../i18n";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

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
          width: 520,
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
            <img
              src="/logo.svg"
              alt="Axiom Logo"
              style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)" }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("about.modalTitle")}
              </h3>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
                {t("about.description")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gridTemplateColumns: "130px 1fr",
              gap: 8
            }}
          >
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{t("about.version")}:</span>
            <span className="mono-num" style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
              {CURRENT_CLIENT_VERSION}
            </span>

            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{t("about.commit")}:</span>
            <span className="mono-num" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
              {CURRENT_CLIENT_COMMIT}
            </span>

            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{t("about.craneliftJit")}:</span>
            <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
              Native x86_64 / AArch64 In-RAM
            </span>

            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Simulation Engine:</span>
            <span style={{ color: "var(--text-secondary)" }}>
              Stratified IEEE 1800 Event Queue + Zero-Time δ Inspector
            </span>

            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>License:</span>
            <span style={{ color: "var(--text-secondary)" }}>MIT Open-Source License</span>
          </div>

          <p style={{ color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            Axiom eliminates legacy EDA installation overhead with instant in-browser WebAssembly simulation, zero-disk turnaround Cranelift compilation, live PDN inductive sag physics telemetry, and cross-platform desktop execution.
          </p>

          <div style={{ display: "flex", gap: 10 }}>
            <a
              href="https://axiom.aerovex.net"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: 11.5, textDecoration: "none" }}
            >
              <ExternalLink size={13} />
              <span>{t("about.visitDocs")}</span>
            </a>
            <a
              href="https://github.com/aerovexsim/axiom"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: 11.5, textDecoration: "none" }}
            >
              <ExternalLink size={13} />
              <span>{t("about.visitGithub")}</span>
            </a>
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
            justifyContent: "flex-end"
          }}
        >
          <Button variant="primary" size="sm" onClick={onClose}>
            {t("about.closeBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
};
